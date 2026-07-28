from __future__ import annotations

from pathlib import Path

import fitz  # type: ignore[import-untyped]
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import Database
from ..inspection import InspectionBudget
from ..models import InputArtifact, QueryAttempt, ResearchRun, TraceEvent, Workspace
from ..schemas import RunStatus


class ResearchCancelled(RuntimeError):
    pass


def get_run(session: Session, run_id: str) -> ResearchRun:
    run = session.get(ResearchRun, run_id)
    if run is None:
        raise LookupError(f"Run {run_id} does not exist")
    return run


def raise_if_cancelled(db: Database, run_id: str) -> None:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        if run.status == RunStatus.cancelled.value:
            raise ResearchCancelled


def is_timeout_error(error: Exception) -> bool:
    return isinstance(error, TimeoutError) or type(error).__name__ in {
        "APITimeoutError",
        "ConnectTimeout",
        "ReadTimeout",
        "TimeoutException",
    }


def page_budget_available(
    *,
    round_number: int,
    normal_rounds: int,
    normal_attempts: int,
    normal_limit: int,
    subquestion_id: str,
    recovery_attempts: dict[str, int],
    recovery_limit: int,
) -> bool:
    if round_number <= normal_rounds:
        return normal_attempts < normal_limit
    return recovery_attempts.get(subquestion_id, 0) < recovery_limit


def checkpoint(
    db: Database,
    run_id: str,
    status: RunStatus,
    summary: dict[str, object],
    *,
    tool: str = "workflow",
) -> None:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        if run.status == RunStatus.cancelled.value:
            return
        sequence = session.scalar(
            select(func.coalesce(func.max(TraceEvent.sequence), 0)).where(
                TraceEvent.run_id == run_id
            )
        )
        run.status = status.value
        run.checkpoint_stage = status.value
        if status is RunStatus.gap_check:
            run.coverage_report = dict(summary)
        session.add(
            TraceEvent(
                run_id=run_id,
                sequence=int(sequence or 0) + 1,
                stage=status.value,
                tool=tool,
                summary=summary,
                retry_count=run.attempt,
            )
        )
        session.commit()


def build_research_context(session: Session, workspace_id: str) -> str:
    workspace = session.get(Workspace, workspace_id)
    parts: list[str] = []
    if workspace is not None:
        if workspace.brief.strip():
            parts.append(f"Brief: {workspace.brief.strip()}")
        if workspace.constraints:
            parts.append(f"Constraints: {'; '.join(workspace.constraints)}")
    artifacts = list(
        session.scalars(
            select(InputArtifact)
            .where(InputArtifact.workspace_id == workspace_id)
            .order_by(InputArtifact.created_at, InputArtifact.id)
        )
    )
    for artifact in artifacts:
        if artifact.kind == "url" and artifact.url:
            parts.append(f"Reference URL: {artifact.url}")
        elif artifact.kind == "pdf" and artifact.storage_path:
            extracted = extract_pdf_text(Path(artifact.storage_path), maximum_length=2_000)
            if extracted:
                parts.append(f"PDF {artifact.filename or 'input'}: {extracted}")
        elif artifact.kind == "image" and artifact.filename:
            parts.append(f"Uploaded image: {artifact.filename}")
    return "\n".join(parts)[:4_000]


def extract_pdf_text(path: Path, *, maximum_length: int) -> str:
    try:
        with fitz.open(path) as document:
            pages: list[str] = []
            for page_number, page in enumerate(document, start=1):
                text = " ".join(page.get_text("text").split())
                if text:
                    pages.append(f"[page {page_number}] {text}")
                if sum(len(item) for item in pages) >= maximum_length:
                    break
    except (FileNotFoundError, OSError, fitz.FileDataError):
        return ""
    return " ".join(pages)[:maximum_length]


def record_query(
    db: Database,
    run_id: str,
    *,
    round_number: int,
    language: str,
    subquestion_id: str,
    query: str,
    purpose: str,
    provider_name: str,
) -> str:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        attempt = QueryAttempt(
            run_id=run_id,
            round_number=round_number,
            subquestion_id=subquestion_id,
            run_attempt=run.attempt,
            status="started",
            query=query,
            language=language,
            purpose=purpose,
            provider=provider_name,
            cost_usd=0.0,
        )
        session.add(attempt)
        session.commit()
        return attempt.id


def completed_query_keys_for_resume(
    db: Database,
    run_id: str,
) -> set[tuple[int, str, str]]:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        attempts = list(
            session.scalars(
                select(QueryAttempt)
                .where(QueryAttempt.run_id == run_id)
                .order_by(QueryAttempt.created_at, QueryAttempt.id)
            )
        )

    attempts_by_generation: dict[int, list[QueryAttempt]] = {}
    for attempt in attempts:
        attempts_by_generation.setdefault(attempt.run_attempt, []).append(attempt)

    def latest_states(items: list[QueryAttempt]) -> dict[tuple[int, str, str], str]:
        states: dict[tuple[int, str, str], str] = {}
        for item in items:
            if item.subquestion_id is not None:
                states[(item.round_number, item.language, item.subquestion_id)] = item.status
        return states

    current_states = latest_states(attempts_by_generation.get(run.attempt, []))
    if current_states:
        completed_keys = {key for key, status in current_states.items() if status == "completed"}
        inherit_previous = any(status != "completed" for status in current_states.values())
        previous_generation = run.attempt - 1
    else:
        completed_keys = set()
        inherit_previous = run.attempt > 0
        previous_generation = run.attempt - 1

    while inherit_previous and previous_generation >= 0:
        previous_states = latest_states(attempts_by_generation.get(previous_generation, []))
        if not previous_states or not any(
            status != "completed" for status in previous_states.values()
        ):
            break
        completed_keys.update(
            key for key, status in previous_states.items() if status == "completed"
        )
        previous_generation -= 1
    return completed_keys


def mark_query_completed(db: Database, attempt_id: str) -> None:
    with db.session_factory() as session:
        attempt = session.get(QueryAttempt, attempt_id)
        if attempt is None:
            raise LookupError(f"Query attempt {attempt_id} does not exist")
        attempt.status = "completed"
        session.commit()


def persist_inspection_budget(
    db: Database,
    run_id: str,
    budget: InspectionBudget,
) -> None:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        run.visual_calls_used = max(run.visual_calls_used, budget.used_calls)
        run.visual_bytes_used = max(run.visual_bytes_used, budget.used_bytes)
        run.visual_byte_limit_reached = run.visual_byte_limit_reached or budget.byte_limit_reached
        session.commit()


def persist_browser_page_attempts(db: Database, run_id: str, attempted: int) -> None:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        run.browser_pages_attempted = max(run.browser_pages_attempted, attempted)
        session.commit()
