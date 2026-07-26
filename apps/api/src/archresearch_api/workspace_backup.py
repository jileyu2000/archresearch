from __future__ import annotations

import hashlib
import json
import os
import shutil
import sqlite3
import stat
import tempfile
import threading
import zipfile
from collections import Counter
from collections.abc import Iterator
from contextlib import closing, contextmanager
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import BinaryIO, Literal

from alembic.config import Config
from alembic.script import ScriptDirectory
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.engine import make_url

from .config import Settings
from .database import Database
from .models import ResearchRun

BackupCategory = Literal["database", "runs", "collections", "workspaces", "exports"]

BACKUP_FORMAT = "archresearch-workspace-backup"
BACKUP_VERSION = 1
PORTABLE_DATA_ROOT = "__ARCHRESEARCH_DATA__"
DATA_DIRECTORIES: tuple[BackupCategory, ...] = (
    "runs",
    "collections",
    "workspaces",
    "exports",
)
MAX_ARCHIVE_FILES = 100_000
MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024
MAX_MANIFEST_BYTES = 1024 * 1024
TERMINAL_RUN_STATUSES = {"completed", "partial", "blocked", "failed", "cancelled"}
_OPERATION_LOCK = threading.Lock()


class WorkspaceBackupError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 422) -> None:
        super().__init__(message)
        self.status_code = status_code


class BackupManifestFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    category: BackupCategory
    size: int = Field(ge=0)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class BackupManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    format: str
    version: int
    created_at: datetime
    schema_revision: str
    files: list[BackupManifestFile]


class WorkspaceBackupSummary(BaseModel):
    ready: bool = True
    format_version: int
    schema_revision: str
    file_count: int
    total_bytes: int
    categories: dict[str, int]
    workspace_count: int
    run_count: int
    collection_count: int
    input_artifact_count: int


class WorkspaceRestoreSummary(WorkspaceBackupSummary):
    restored: bool = True
    rollback_backup: str


def create_workspace_backup(
    target: Path,
    *,
    settings: Settings,
    database: Database,
) -> WorkspaceBackupSummary:
    if not _OPERATION_LOCK.acquire(blocking=False):
        raise WorkspaceBackupError("已有备份或恢复操作正在进行。", status_code=409)
    try:
        return _create_workspace_backup_unlocked(target, settings=settings, database=database)
    finally:
        _OPERATION_LOCK.release()


def inspect_workspace_backup(
    archive: Path,
) -> WorkspaceBackupSummary:
    with _prepared_archive(archive) as (_, _, summary):
        return summary


def restore_workspace_backup(
    archive: Path,
    *,
    settings: Settings,
    database: Database,
) -> WorkspaceRestoreSummary:
    if not _OPERATION_LOCK.acquire(blocking=False):
        raise WorkspaceBackupError("已有备份或恢复操作正在进行。", status_code=409)
    try:
        _ensure_no_active_runs(database)
        with _prepared_archive(archive) as (staging_root, manifest, summary):
            staging_data = staging_root / "data"
            for directory in DATA_DIRECTORIES:
                (staging_data / directory).mkdir(parents=True, exist_ok=True)
            database_target = _database_path(settings)
            staged_database = staging_data / "archresearch.db"
            _rewrite_portable_paths(
                staged_database,
                target_data_dir=settings.data_dir.resolve(),
                archive_paths={item.path for item in manifest.files},
            )
            _validate_sqlite(staged_database, expected_revision=manifest.schema_revision)

            backup_dir = settings.data_dir / "backups"
            backup_dir.mkdir(parents=True, exist_ok=True)
            rollback_name = f"archresearch-rollback-{_timestamp()}.zip"
            _create_workspace_backup_unlocked(
                backup_dir / rollback_name,
                settings=settings,
                database=database,
            )
            _swap_workspace_data(
                staging_data,
                database_target=database_target,
                data_dir=settings.data_dir.resolve(),
                database=database,
                expected_revision=manifest.schema_revision,
            )
            return WorkspaceRestoreSummary(
                **summary.model_dump(),
                rollback_backup=rollback_name,
            )
    finally:
        _OPERATION_LOCK.release()


def copy_upload_to_path(
    source: BinaryIO,
    target: Path,
    *,
    max_bytes: int = MAX_ARCHIVE_BYTES,
) -> None:
    total = 0
    with target.open("wb") as output:
        while chunk := source.read(1024 * 1024):
            total += len(chunk)
            if total > max_bytes:
                raise WorkspaceBackupError("备份包超过 2 GiB 限制。")
            output.write(chunk)


def _create_workspace_backup_unlocked(
    target: Path,
    *,
    settings: Settings,
    database: Database,
) -> WorkspaceBackupSummary:
    _ensure_no_active_runs(database)
    data_dir = settings.data_dir.resolve()
    database_path = _database_path(settings)
    if not database_path.is_file():
        raise WorkspaceBackupError("找不到 ArchResearch SQLite 数据库。")
    target.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="archresearch-backup-") as temporary:
        snapshot = Path(temporary) / "archresearch.db"
        _sqlite_snapshot(database_path, snapshot)
        durable_files = _durable_files(data_dir)
        archive_paths = {f"data/{relative.as_posix()}" for relative, _, _ in durable_files}
        _make_paths_portable(snapshot, data_dir=data_dir, archive_paths=archive_paths)
        schema_revision = _validate_sqlite(snapshot, expected_revision=_schema_head_revision())

        manifest_files = [
            _manifest_file(snapshot, "data/archresearch.db", "database"),
            *[
                _manifest_file(source, f"data/{relative.as_posix()}", category)
                for relative, source, category in durable_files
            ],
        ]
        manifest = BackupManifest(
            format=BACKUP_FORMAT,
            version=BACKUP_VERSION,
            created_at=datetime.now(UTC),
            schema_revision=schema_revision,
            files=manifest_files,
        )
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(
                "manifest.json",
                json.dumps(manifest.model_dump(mode="json"), ensure_ascii=False, indent=2),
            )
            archive.write(snapshot, "data/archresearch.db")
            for relative, source, _ in durable_files:
                archive.write(source, f"data/{relative.as_posix()}")
        return _summary(manifest, snapshot)


def _database_path(settings: Settings) -> Path:
    url = make_url(settings.database_url)
    if not url.drivername.startswith("sqlite") or not url.database or url.database == ":memory:":
        raise WorkspaceBackupError("工作区备份当前只支持本地 SQLite 数据库。")
    path = Path(url.database)
    return (path if path.is_absolute() else Path.cwd() / path).resolve()


def _durable_files(data_dir: Path) -> list[tuple[Path, Path, BackupCategory]]:
    files: list[tuple[Path, Path, BackupCategory]] = []
    for directory in DATA_DIRECTORIES:
        root = data_dir / directory
        if not root.exists():
            continue
        if root.is_symlink() or not root.is_dir():
            raise WorkspaceBackupError(f"数据目录无效：{directory}")
        for source in sorted(root.rglob("*")):
            if source.is_symlink():
                raise WorkspaceBackupError(f"数据目录包含不允许的符号链接：{directory}")
            if source.is_file():
                files.append((source.relative_to(data_dir), source, directory))
    return files


def _sqlite_snapshot(source: Path, target: Path) -> None:
    with (
        closing(sqlite3.connect(source)) as source_connection,
        closing(sqlite3.connect(target)) as target_connection,
    ):
        source_connection.backup(target_connection)


def _make_paths_portable(
    database_path: Path,
    *,
    data_dir: Path,
    archive_paths: set[str],
) -> None:
    with closing(sqlite3.connect(database_path)) as connection:
        for table, allowed_directory in (
            ("input_artifacts", "workspaces"),
            ("asset_candidates", "runs"),
        ):
            rows = connection.execute(
                f"SELECT id, storage_path FROM {table} "
                "WHERE storage_path IS NOT NULL AND trim(storage_path) != ''"
            ).fetchall()
            for record_id, raw_path in rows:
                try:
                    source = Path(raw_path).resolve(strict=True)
                    relative = source.relative_to(data_dir)
                except (OSError, ValueError) as error:
                    raise WorkspaceBackupError(
                        "数据库引用了备份范围外或缺失的本地文件。"
                    ) from error
                if relative.parts[0] != allowed_directory:
                    raise WorkspaceBackupError("数据库本地文件引用不属于允许的数据目录。")
                archive_path = f"data/{relative.as_posix()}"
                if archive_path not in archive_paths:
                    raise WorkspaceBackupError("数据库引用的本地文件未进入备份清单。")
                portable = f"{PORTABLE_DATA_ROOT}/{relative.as_posix()}"
                connection.execute(
                    f"UPDATE {table} SET storage_path = ? WHERE id = ?",
                    (portable, record_id),
                )
        connection.commit()
        connection.execute("VACUUM")


def _rewrite_portable_paths(
    database_path: Path,
    *,
    target_data_dir: Path,
    archive_paths: set[str],
) -> None:
    with closing(sqlite3.connect(database_path)) as connection:
        for table, allowed_directory in (
            ("input_artifacts", "workspaces"),
            ("asset_candidates", "runs"),
        ):
            rows = connection.execute(
                f"SELECT id, storage_path FROM {table} "
                "WHERE storage_path IS NOT NULL AND trim(storage_path) != ''"
            ).fetchall()
            for record_id, raw_path in rows:
                prefix = f"{PORTABLE_DATA_ROOT}/"
                if not isinstance(raw_path, str) or not raw_path.startswith(prefix):
                    raise WorkspaceBackupError("备份数据库包含不可迁移的本地文件路径。")
                relative = _safe_relative_path(raw_path.removeprefix(prefix))
                if not relative.parts or relative.parts[0] != allowed_directory:
                    raise WorkspaceBackupError("备份数据库包含越界的本地文件路径。")
                if f"data/{relative.as_posix()}" not in archive_paths:
                    raise WorkspaceBackupError("备份数据库引用的本地文件不在清单中。")
                target = (target_data_dir / Path(*relative.parts)).resolve()
                if target_data_dir not in target.parents:
                    raise WorkspaceBackupError("备份数据库包含越界的目标路径。")
                connection.execute(
                    f"UPDATE {table} SET storage_path = ? WHERE id = ?",
                    (str(target), record_id),
                )
        connection.commit()


def _validate_portable_paths(database_path: Path, *, archive_paths: set[str]) -> None:
    with closing(sqlite3.connect(database_path)) as connection:
        for table, allowed_directory in (
            ("input_artifacts", "workspaces"),
            ("asset_candidates", "runs"),
        ):
            rows = connection.execute(
                f"SELECT storage_path FROM {table} "
                "WHERE storage_path IS NOT NULL AND trim(storage_path) != ''"
            ).fetchall()
            for (raw_path,) in rows:
                prefix = f"{PORTABLE_DATA_ROOT}/"
                if not isinstance(raw_path, str) or not raw_path.startswith(prefix):
                    raise WorkspaceBackupError("备份数据库包含不可迁移的本地文件路径。")
                relative = _safe_relative_path(raw_path.removeprefix(prefix))
                if not relative.parts or relative.parts[0] != allowed_directory:
                    raise WorkspaceBackupError("备份数据库包含越界的本地文件路径。")
                if f"data/{relative.as_posix()}" not in archive_paths:
                    raise WorkspaceBackupError("备份数据库引用的本地文件不在清单中。")


def _manifest_file(
    source: Path,
    archive_path: str,
    category: BackupCategory,
) -> BackupManifestFile:
    return BackupManifestFile(
        path=archive_path,
        category=category,
        size=source.stat().st_size,
        sha256=_file_sha256(source),
    )


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


@contextmanager
def _prepared_archive(
    archive_path: Path,
) -> Iterator[tuple[Path, BackupManifest, WorkspaceBackupSummary]]:
    try:
        archive = zipfile.ZipFile(archive_path)
    except (OSError, zipfile.BadZipFile) as error:
        raise WorkspaceBackupError("无法读取备份包，请选择有效的 ZIP 文件。") from error
    with archive, tempfile.TemporaryDirectory(prefix="archresearch-restore-") as temporary:
        infos = archive.infolist()
        if len(infos) > MAX_ARCHIVE_FILES + 1:
            raise WorkspaceBackupError("备份包文件数量超过限制。")
        names = [info.filename for info in infos]
        if len(names) != len(set(names)):
            raise WorkspaceBackupError("备份包包含重复路径。")
        for info in infos:
            _validate_zip_info(info)
        if "manifest.json" not in names:
            raise WorkspaceBackupError("备份包缺少 manifest.json。")
        manifest_info = archive.getinfo("manifest.json")
        if manifest_info.file_size > MAX_MANIFEST_BYTES:
            raise WorkspaceBackupError("备份清单大小超过 1 MiB 限制。")
        with archive.open(manifest_info) as manifest_source:
            manifest_content = manifest_source.read(MAX_MANIFEST_BYTES + 1)
        if len(manifest_content) > MAX_MANIFEST_BYTES:
            raise WorkspaceBackupError("备份清单大小超过 1 MiB 限制。")
        try:
            manifest = BackupManifest.model_validate_json(manifest_content)
        except (KeyError, ValidationError, ValueError) as error:
            raise WorkspaceBackupError("备份清单格式无效。") from error
        if manifest.format != BACKUP_FORMAT or manifest.version != BACKUP_VERSION:
            raise WorkspaceBackupError("备份格式版本不受当前 ArchResearch 支持。")
        if manifest.schema_revision != _schema_head_revision():
            raise WorkspaceBackupError("备份数据库版本与当前 ArchResearch 不兼容。")

        file_by_path = {item.path: item for item in manifest.files}
        if len(file_by_path) != len(manifest.files):
            raise WorkspaceBackupError("备份清单包含重复文件。")
        expected_names = {"manifest.json", *file_by_path}
        if set(names) != expected_names:
            raise WorkspaceBackupError("备份包包含清单之外的文件或缺少清单文件。")
        if "data/archresearch.db" not in file_by_path:
            raise WorkspaceBackupError("备份包缺少 SQLite 数据库。")
        if len(manifest.files) > MAX_ARCHIVE_FILES:
            raise WorkspaceBackupError("备份包文件数量超过限制。")
        if sum(item.size for item in manifest.files) > MAX_ARCHIVE_BYTES:
            raise WorkspaceBackupError("备份包解压大小超过 2 GiB 限制。")

        root = Path(temporary)
        for info in infos:
            if info.filename == "manifest.json":
                continue
            item = file_by_path[info.filename]
            relative = _safe_relative_path(item.path)
            _validate_manifest_category(item, relative)
            target = root.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            digest = hashlib.sha256()
            written = 0
            with archive.open(info) as source, target.open("wb") as output:
                while chunk := source.read(1024 * 1024):
                    written += len(chunk)
                    if written > item.size:
                        raise WorkspaceBackupError("备份文件大小校验失败。")
                    digest.update(chunk)
                    output.write(chunk)
            if written != item.size or digest.hexdigest() != item.sha256:
                raise WorkspaceBackupError("备份文件完整性校验失败。")
        database_path = root / "data" / "archresearch.db"
        _validate_sqlite(database_path, expected_revision=manifest.schema_revision)
        _validate_portable_paths(database_path, archive_paths=set(file_by_path))
        yield root, manifest, _summary(manifest, database_path)


def _validate_zip_info(info: zipfile.ZipInfo) -> None:
    if info.is_dir():
        raise WorkspaceBackupError("备份包包含清单之外的目录路径。")
    _safe_relative_path(info.filename)
    if info.flag_bits & 0x1:
        raise WorkspaceBackupError("不支持加密备份包。")
    if stat.S_ISLNK(info.external_attr >> 16):
        raise WorkspaceBackupError("备份包包含不允许的符号链接路径。")


def _safe_relative_path(raw_path: str) -> PurePosixPath:
    if "\\" in raw_path or ":" in raw_path:
        raise WorkspaceBackupError("备份包包含不安全的路径。")
    path = PurePosixPath(raw_path)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise WorkspaceBackupError("备份包包含不安全的路径。")
    return path


def _validate_manifest_category(item: BackupManifestFile, path: PurePosixPath) -> None:
    if path == PurePosixPath("data/archresearch.db"):
        if item.category != "database":
            raise WorkspaceBackupError("数据库清单类别无效。")
        return
    if len(path.parts) < 3 or path.parts[0] != "data" or path.parts[1] not in DATA_DIRECTORIES:
        raise WorkspaceBackupError("备份清单包含不支持的数据路径。")
    if item.category != path.parts[1]:
        raise WorkspaceBackupError("备份清单的文件类别与路径不一致。")


def _validate_sqlite(database_path: Path, *, expected_revision: str) -> str:
    try:
        with closing(
            sqlite3.connect(f"file:{database_path.as_posix()}?mode=ro", uri=True)
        ) as connection:
            quick_check = connection.execute("PRAGMA quick_check").fetchone()
            foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
            revision_row = connection.execute("SELECT version_num FROM alembic_version").fetchone()
    except sqlite3.Error as error:
        raise WorkspaceBackupError("备份 SQLite 数据库无法读取或结构无效。") from error
    revision = str(revision_row[0]) if revision_row else ""
    if quick_check != ("ok",) or foreign_keys:
        raise WorkspaceBackupError("备份 SQLite 数据库完整性校验失败。")
    if revision != expected_revision:
        raise WorkspaceBackupError("备份 SQLite schema 版本不兼容。")
    return revision


def _schema_head_revision() -> str:
    config = Config(Path(__file__).resolve().parents[2] / "alembic.ini")
    revision = ScriptDirectory.from_config(config).get_current_head()
    if revision is None:
        raise WorkspaceBackupError("无法确定当前数据库 schema 版本。", status_code=500)
    return revision


def _summary(manifest: BackupManifest, database_path: Path) -> WorkspaceBackupSummary:
    with closing(
        sqlite3.connect(f"file:{database_path.as_posix()}?mode=ro", uri=True)
    ) as connection:
        counts = {
            "workspace_count": connection.execute("SELECT count(*) FROM workspaces").fetchone()[0],
            "run_count": connection.execute("SELECT count(*) FROM research_runs").fetchone()[0],
            "collection_count": connection.execute(
                "SELECT count(*) FROM saved_references"
            ).fetchone()[0],
            "input_artifact_count": connection.execute(
                "SELECT count(*) FROM input_artifacts"
            ).fetchone()[0],
        }
    return WorkspaceBackupSummary(
        format_version=manifest.version,
        schema_revision=manifest.schema_revision,
        file_count=len(manifest.files),
        total_bytes=sum(item.size for item in manifest.files),
        categories=dict(sorted(Counter(item.category for item in manifest.files).items())),
        **counts,
    )


def _ensure_no_active_runs(database: Database) -> None:
    with database.session_factory() as session:
        active_count = session.scalar(
            select(func.count())
            .select_from(ResearchRun)
            .where(ResearchRun.status.not_in(TERMINAL_RUN_STATUSES))
        )
    if active_count:
        raise WorkspaceBackupError("研究进行中，完成或取消后才能备份或恢复。", status_code=409)


def _swap_workspace_data(
    staging_data: Path,
    *,
    database_target: Path,
    data_dir: Path,
    database: Database,
    expected_revision: str,
) -> None:
    swap_root = Path(tempfile.mkdtemp(prefix=".archresearch-swap-", dir=data_dir.parent))
    old_root = swap_root / "current"
    old_root.mkdir()
    targets = [("database", staging_data / "archresearch.db", database_target)] + [
        (directory, staging_data / directory, data_dir / directory)
        for directory in DATA_DIRECTORIES
    ]
    moved_old: list[tuple[Path, Path]] = []
    installed: list[tuple[Path, Path]] = []
    database.engine.dispose()
    try:
        for name, _, target in targets:
            if target.exists():
                old = old_root / name
                _move_entry(target, old)
                moved_old.append((old, target))
        for _, staged, target in targets:
            _move_entry(staged, target)
            installed.append((target, staged))
        database.reconnect()
        _validate_sqlite(database_target, expected_revision=expected_revision)
    except Exception as error:
        database.engine.dispose()
        for target, _ in reversed(installed):
            _remove_entry(target)
        for old, target in reversed(moved_old):
            if old.exists():
                _move_entry(old, target)
        database.reconnect()
        shutil.rmtree(swap_root, ignore_errors=True)
        if isinstance(error, WorkspaceBackupError):
            raise WorkspaceBackupError("恢复失败，现有数据保持不变。") from error
        raise WorkspaceBackupError("恢复失败，现有数据保持不变。") from error
    shutil.rmtree(swap_root, ignore_errors=True)


def _move_entry(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    os.replace(source, target)


def _remove_entry(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def _timestamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
