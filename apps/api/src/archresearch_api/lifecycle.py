from __future__ import annotations

import shutil
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import delete, select

from .database import Database
from .models import (
    AssetCandidate,
    EvidenceClaim,
    QueryAttempt,
    ReferenceBoard,
    RejectedFeedback,
    ResearchRun,
    SourcePage,
    TraceEvent,
)
from .schemas import RunStatus


@dataclass(frozen=True)
class CleanupReport:
    runs: int = 0
    assets: int = 0
    sources: int = 0
    evidence_claims: int = 0
    trace_events: int = 0
    queries: int = 0
    orphan_files: int = 0


def cleanup_expired_data(
    database: Database,
    *,
    data_dir: Path,
    now: datetime | None = None,
    metadata_ttl_days: int = 30,
) -> CleanupReport:
    cutoff_time = now or datetime.now(UTC)
    metadata_cutoff = cutoff_time - timedelta(days=metadata_ttl_days)
    with database.session_factory() as session:
        expired_run_ids = list(
            session.scalars(
                select(ResearchRun.id).where(
                    ResearchRun.keep_forever.is_(False),
                    ResearchRun.retention_expires_at.is_not(None),
                    ResearchRun.retention_expires_at <= cutoff_time,
                )
            )
        )
    expired_runs = delete_runs(database, data_dir=data_dir, run_ids=expired_run_ids)

    with database.session_factory() as session:
        expired_assets = list(
            session.scalars(
                select(AssetCandidate).where(
                    AssetCandidate.expires_at.is_not(None),
                    AssetCandidate.expires_at <= cutoff_time,
                )
            )
        )
        expired_sources = list(
            session.scalars(
                select(SourcePage).where(
                    SourcePage.expires_at.is_not(None),
                    SourcePage.expires_at <= cutoff_time,
                )
            )
        )
        expired_claims = list(
            session.scalars(
                select(EvidenceClaim).where(
                    EvidenceClaim.expires_at.is_not(None),
                    EvidenceClaim.expires_at <= cutoff_time,
                )
            )
        )
        old_trace = list(
            session.scalars(select(TraceEvent).where(TraceEvent.created_at <= metadata_cutoff))
        )
        old_queries = list(
            session.scalars(select(QueryAttempt).where(QueryAttempt.created_at <= metadata_cutoff))
        )

        for asset in expired_assets:
            _remove_candidate_file(asset.storage_path, data_dir)
            session.delete(asset)
        for item in (*expired_claims, *expired_sources, *old_trace, *old_queries):
            session.delete(item)
        session.flush()
        referenced_storage_paths = list(
            session.scalars(
                select(AssetCandidate.storage_path).where(AssetCandidate.storage_path.is_not(None))
            )
        )
        session.commit()

    orphan_files = _remove_orphan_candidate_files(data_dir, referenced_storage_paths)
    return CleanupReport(
        runs=expired_runs,
        assets=len(expired_assets),
        sources=len(expired_sources),
        evidence_claims=len(expired_claims),
        trace_events=len(old_trace),
        queries=len(old_queries),
        orphan_files=orphan_files,
    )


def delete_runs(
    database: Database,
    *,
    data_dir: Path,
    run_ids: list[str],
) -> int:
    if not run_ids:
        return 0
    with database.session_factory() as session:
        runs = list(session.scalars(select(ResearchRun).where(ResearchRun.id.in_(run_ids))))
        if not runs:
            return 0
        concrete_ids = [run.id for run in runs]
        assets = list(
            session.execute(
                select(AssetCandidate.id, AssetCandidate.storage_path).where(
                    AssetCandidate.run_id.in_(concrete_ids)
                )
            )
        )
        asset_ids = [asset_id for asset_id, _storage_path in assets]
        board_ids = list(
            session.scalars(
                select(ReferenceBoard.id).where(ReferenceBoard.run_id.in_(concrete_ids))
            )
        )
        if asset_ids:
            session.execute(
                delete(RejectedFeedback).where(RejectedFeedback.asset_candidate_id.in_(asset_ids))
            )
        for run in runs:
            session.delete(run)
        session.commit()

    for _asset_id, storage_path in assets:
        _remove_candidate_file(storage_path, data_dir)
    for run_id in concrete_ids:
        _remove_storage_tree(data_dir / "runs" / run_id, data_dir)
    for board_id in board_ids:
        _remove_storage_tree(data_dir / "exports" / board_id, data_dir)
    return len(concrete_ids)


def incomplete_run_ids(database: Database) -> list[str]:
    active_statuses = {
        RunStatus.created.value,
        RunStatus.planning.value,
        RunStatus.searching.value,
        RunStatus.inspecting.value,
        RunStatus.analyzing.value,
        RunStatus.verifying.value,
        RunStatus.gap_check.value,
        RunStatus.composing.value,
    }
    with database.session_factory() as session:
        return list(
            session.scalars(
                select(ResearchRun.id)
                .where(ResearchRun.status.in_(active_statuses))
                .order_by(ResearchRun.created_at)
            )
        )


def _remove_candidate_file(storage_path: str | None, data_dir: Path) -> None:
    if not storage_path:
        return
    root = data_dir.resolve()
    candidate = Path(storage_path).resolve()
    if candidate == root or root not in candidate.parents:
        return
    if candidate.is_file():
        candidate.unlink()


def _remove_storage_tree(target: Path, data_dir: Path) -> None:
    root = data_dir.resolve()
    resolved_target = target.resolve()
    if resolved_target == root or root not in resolved_target.parents:
        return
    if resolved_target.is_dir():
        shutil.rmtree(resolved_target)


def _remove_orphan_candidate_files(
    data_dir: Path,
    referenced_storage_paths: list[str | None],
) -> int:
    root = data_dir.resolve()
    runs_root = (root / "runs").resolve()
    if runs_root != root and root not in runs_root.parents:
        return 0

    referenced = {
        _resolve_storage_path(storage_path)
        for storage_path in referenced_storage_paths
        if storage_path
    }
    removed = 0
    for candidate in runs_root.glob("*/candidates/*.png"):
        resolved_candidate = candidate.resolve()
        if runs_root not in resolved_candidate.parents or resolved_candidate in referenced:
            continue
        if resolved_candidate.is_file():
            resolved_candidate.unlink()
            removed += 1
    return removed


def _resolve_storage_path(storage_path: str) -> Path:
    return Path(storage_path).resolve()
