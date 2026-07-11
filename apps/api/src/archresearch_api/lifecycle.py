from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from .database import Database
from .models import (
    AssetCandidate,
    EvidenceClaim,
    QueryAttempt,
    ResearchRun,
    SourcePage,
    TraceEvent,
)
from .schemas import RunStatus


@dataclass(frozen=True)
class CleanupReport:
    assets: int = 0
    sources: int = 0
    evidence_claims: int = 0
    trace_events: int = 0
    queries: int = 0


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
        session.commit()

    return CleanupReport(
        assets=len(expired_assets),
        sources=len(expired_sources),
        evidence_claims=len(expired_claims),
        trace_events=len(old_trace),
        queries=len(old_queries),
    )


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
