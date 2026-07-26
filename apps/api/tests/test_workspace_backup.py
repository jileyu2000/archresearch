from __future__ import annotations

import hashlib
import io
import json
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from archresearch_api import workspace_backup
from archresearch_api.models import AssetCandidate, InputArtifact, ResearchRun, Workspace


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _seed_durable_workspace(
    client: TestClient,
    workspace_id: str,
) -> dict[str, Path]:
    data_dir = Path(client.app.state.settings.data_dir)
    paths = {
        "run": data_dir / "runs" / "run-backup" / "candidates" / "section.png",
        "collection": data_dir / "collections" / "collection-backup.png",
        "brief": data_dir / "workspaces" / workspace_id / "brief.pdf",
        "export": data_dir / "exports" / "board-backup" / "export.html",
    }
    for name, path in paths.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(f"durable-{name}".encode())

    with client.app.state.database.session_factory() as session:
        run = ResearchRun(
            id="run-backup",
            workspace_id=workspace_id,
            question="备份前的问题",
            goal="precedent_research",
            budget_mode="balanced",
            budget={},
            status="completed",
        )
        session.add(run)
        session.flush()
        session.add(
            AssetCandidate(
                id="asset-backup",
                run_id=run.id,
                project_name="备份案例",
                asset_type="section",
                source_url="https://example.com/backup",
                storage_path=str(paths["run"]),
            )
        )
        session.add(
            InputArtifact(
                id="brief-backup",
                workspace_id=workspace_id,
                kind="pdf",
                filename="brief.pdf",
                mime_type="application/pdf",
                sha256=_sha256(paths["brief"]),
                storage_path=str(paths["brief"]),
                page_count=1,
            )
        )
        session.commit()
    return paths


def _backup_bytes(client: TestClient) -> bytes:
    response = client.post("/v1/data-backups")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "archresearch-backup-" in response.headers["content-disposition"]
    return response.content


def _replace_zip_member(archive: bytes, member: str, replacement: bytes) -> bytes:
    source = zipfile.ZipFile(io.BytesIO(archive))
    target_buffer = io.BytesIO()
    with source, zipfile.ZipFile(target_buffer, "w", zipfile.ZIP_DEFLATED) as target:
        for info in source.infolist():
            target.writestr(info, replacement if info.filename == member else source.read(info))
    return target_buffer.getvalue()


def test_backup_preflight_and_restore_round_trip_all_durable_data(
    client: TestClient,
    workspace_id: str,
) -> None:
    paths = _seed_durable_workspace(client, workspace_id)
    archive = _backup_bytes(client)

    with zipfile.ZipFile(io.BytesIO(archive)) as packaged:
        manifest = json.loads(packaged.read("manifest.json"))
        packaged_paths = {item["path"] for item in manifest["files"]}
        assert manifest["format"] == "archresearch-workspace-backup"
        assert manifest["version"] == 1
        assert manifest["schema_revision"] == "d0f1a2b3c4d5"
        assert {
            "data/archresearch.db",
            "data/runs/run-backup/candidates/section.png",
            "data/collections/collection-backup.png",
            f"data/workspaces/{workspace_id}/brief.pdf",
            "data/exports/board-backup/export.html",
        } <= packaged_paths
        snapshot = packaged.read("data/archresearch.db")
        assert str(Path(client.app.state.settings.data_dir).resolve()).encode() not in snapshot

    preflight = client.post(
        "/v1/data-backups/preflight",
        files={"file": ("workspace.zip", archive, "application/zip")},
    )
    assert preflight.status_code == 200
    assert preflight.json() == {
        "ready": True,
        "format_version": 1,
        "schema_revision": "d0f1a2b3c4d5",
        "file_count": 5,
        "total_bytes": sum(item["size"] for item in manifest["files"]),
        "categories": {
            "collections": 1,
            "database": 1,
            "exports": 1,
            "runs": 1,
            "workspaces": 1,
        },
        "workspace_count": 1,
        "run_count": 1,
        "collection_count": 0,
        "input_artifact_count": 1,
    }

    with client.app.state.database.session_factory() as session:
        workspace = session.get(Workspace, workspace_id)
        assert workspace is not None
        workspace.name = "恢复前的临时改名"
        session.commit()
    for path in paths.values():
        path.write_bytes(b"changed-after-backup")

    restored = client.post(
        "/v1/data-backups/restore",
        data={"confirmation": "restore-verified-backup"},
        files={"file": ("workspace.zip", archive, "application/zip")},
    )
    assert restored.status_code == 200
    assert restored.json()["restored"] is True
    assert restored.json()["rollback_backup"].startswith("archresearch-rollback-")
    assert client.get("/v1/workspaces").json()[0]["name"] != "恢复前的临时改名"
    for name, path in paths.items():
        assert path.read_bytes() == f"durable-{name}".encode()

    with client.app.state.database.session_factory() as session:
        artifact = session.get(InputArtifact, "brief-backup")
        asset = session.get(AssetCandidate, "asset-backup")
        assert (
            artifact is not None and Path(artifact.storage_path or "") == paths["brief"].resolve()
        )
        assert asset is not None and Path(asset.storage_path or "") == paths["run"].resolve()


def test_corrupt_backup_is_rejected_without_changing_current_data(
    client: TestClient,
    workspace_id: str,
) -> None:
    paths = _seed_durable_workspace(client, workspace_id)
    archive = _backup_bytes(client)
    corrupted = _replace_zip_member(
        archive,
        "data/collections/collection-backup.png",
        b"tampered",
    )
    database_path = Path(client.app.state.settings.database_url.removeprefix("sqlite:///"))
    before = {
        "database": _sha256(database_path),
        **{name: _sha256(path) for name, path in paths.items()},
    }

    preflight = client.post(
        "/v1/data-backups/preflight",
        files={"file": ("corrupt.zip", corrupted, "application/zip")},
    )
    restored = client.post(
        "/v1/data-backups/restore",
        data={"confirmation": "restore-verified-backup"},
        files={"file": ("corrupt.zip", corrupted, "application/zip")},
    )

    assert preflight.status_code == 422
    assert "校验" in preflight.json()["detail"]
    assert restored.status_code == 422
    after = {
        "database": _sha256(database_path),
        **{name: _sha256(path) for name, path in paths.items()},
    }
    assert after == before


def test_preflight_rejects_archive_path_traversal(
    client: TestClient,
) -> None:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as packaged:
        packaged.writestr("../outside.txt", "unsafe")
        packaged.writestr("manifest.json", "{}")

    response = client.post(
        "/v1/data-backups/preflight",
        files={"file": ("unsafe.zip", archive.getvalue(), "application/zip")},
    )

    assert response.status_code == 422
    assert "路径" in response.json()["detail"]


def test_preflight_rejects_oversized_manifest_before_parsing(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(workspace_backup, "MAX_MANIFEST_BYTES", 32)
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as packaged:
        packaged.writestr("manifest.json", b"{" + b" " * 64 + b"}")

    response = client.post(
        "/v1/data-backups/preflight",
        files={"file": ("oversized.zip", archive.getvalue(), "application/zip")},
    )

    assert response.status_code == 422
    assert "清单大小" in response.json()["detail"]


def test_restore_swap_failure_rolls_back_every_current_entry(
    client: TestClient,
    workspace_id: str,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    paths = _seed_durable_workspace(client, workspace_id)
    archive = _backup_bytes(client)
    for path in paths.values():
        path.write_bytes(b"current-must-survive")
    database_path = Path(client.app.state.settings.database_url.removeprefix("sqlite:///"))
    before = {
        "database": _sha256(database_path),
        **{name: _sha256(path) for name, path in paths.items()},
    }
    archive_path = tmp_path / "backup.zip"
    archive_path.write_bytes(archive)

    real_move = workspace_backup._move_entry
    calls = 0

    def fail_during_swap(source: Path, target: Path) -> None:
        nonlocal calls
        calls += 1
        if calls == 3:
            raise OSError("simulated swap failure")
        real_move(source, target)

    monkeypatch.setattr(workspace_backup, "_move_entry", fail_during_swap)

    with pytest.raises(workspace_backup.WorkspaceBackupError, match="现有数据保持不变"):
        workspace_backup.restore_workspace_backup(
            archive_path,
            settings=client.app.state.settings,
            database=client.app.state.database,
        )

    after = {
        "database": _sha256(database_path),
        **{name: _sha256(path) for name, path in paths.items()},
    }
    assert after == before
    assert client.get("/v1/workspaces").status_code == 200
