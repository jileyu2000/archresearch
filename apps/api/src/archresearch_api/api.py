from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from html import escape
from pathlib import Path
from typing import Literal, cast
from urllib.parse import urlparse
from uuid import UUID, uuid4

import fitz  # type: ignore[import-untyped]
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    status,
)
from fastapi import (
    UploadFile as FastAPIUploadFile,
)
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile

from .browser import BrowserBroker
from .config import Settings
from .database import Database
from .models import (
    AssetCandidate,
    InputArtifact,
    ReferenceBoard,
    RejectedFeedback,
    ResearchRun,
    SavedReference,
    StyleProfile,
    TraceEvent,
    Workspace,
)
from .providers import ResearchPlanningProvider, ResearchProvider
from .public_pages import PublicPageParser
from .run_gate import ResearchRunGate
from .schemas import (
    BUDGETS,
    ArtifactKind,
    AssetCandidateRead,
    BoardUpdate,
    BudgetMode,
    ExportCreate,
    ExportRead,
    InputArtifactRead,
    ProjectBriefReviewRead,
    ReferenceBoardRead,
    RejectCreate,
    RejectedFeedbackRead,
    RejectedUserState,
    ResearchGoal,
    ResearchRunRead,
    ResearchSpec,
    RunRetentionUpdate,
    RunStatus,
    RunUserStateRead,
    SaveCreate,
    SavedReferenceRead,
    SavedReferenceSnapshot,
    SavedUserState,
    StyleProfileCreate,
    StyleProfileRead,
    StyleProfileUpdate,
    UrlInputCreate,
    WorkspaceBackupPreflightRead,
    WorkspaceCreate,
    WorkspaceRead,
    WorkspaceRestoreRead,
    WorkspaceUpdate,
)
from .visual import VisualClassifier
from .workflow import ACTIVE_STAGES, execute_research_run
from .workspace_backup import (
    WorkspaceBackupError,
    copy_upload_to_path,
    create_workspace_backup,
    inspect_workspace_backup,
    restore_workspace_backup,
)
from .xiaohongshu import XiaohongshuSearch

router = APIRouter(prefix="/v1")

SHAREABLE_IMAGE_RIGHTS = {"user_owned", "open_license", "permissioned"}
EXPORT_ASSET_TYPE_LABELS = {
    "plan": "平面图",
    "section": "剖面图",
    "elevation": "立面图",
    "site_plan": "总平面图",
    "axonometric": "轴测图",
    "circulation": "流线图",
    "analysis_diagram": "分析图",
    "render": "效果图",
    "photograph": "项目照片",
}
EXPORT_RIGHTS_STATUS_LABELS = {
    "user_owned": "用户自有",
    "open_license": "开放许可",
    "permissioned": "已获授权",
    "unknown": "权利未知",
    "restricted": "受限",
}
ACTIVE_RUN_STATUSES = {RunStatus.created.value} | {stage.value for stage in ACTIVE_STAGES}
ACTIVE_RUN_MESSAGE = "已有研究正在进行，请先等待完成或取消。"
RUN_TRANSITION_MESSAGE = "当前研究正在启动或清理浏览器，请稍候再开始。"
EXPORT_CONTENT_SECURITY_POLICY = (
    "default-src 'none'; img-src 'self' http: https:; style-src 'unsafe-inline'; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
)


def get_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def get_session(request: Request) -> Iterator[Session]:
    if request.app.state.data_maintenance:
        raise HTTPException(status_code=503, detail="工作区数据正在备份或恢复，请稍候。")
    database: Database = request.app.state.database
    with database.session_factory() as session:
        yield session


def _backup_error(error: WorkspaceBackupError) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=str(error))


@router.post("/data-backups")
def create_data_backup(
    request: Request, settings: Settings = Depends(get_settings)
) -> FileResponse:
    if request.app.state.data_maintenance:
        raise HTTPException(status_code=409, detail="已有备份或恢复操作正在进行。")
    temporary = tempfile.NamedTemporaryFile(
        prefix="archresearch-backup-", suffix=".zip", delete=False
    )
    temporary.close()
    target = Path(temporary.name)
    request.app.state.data_maintenance = True
    try:
        create_workspace_backup(
            target,
            settings=settings,
            database=request.app.state.database,
        )
    except WorkspaceBackupError as error:
        target.unlink(missing_ok=True)
        raise _backup_error(error) from error
    finally:
        request.app.state.data_maintenance = False
    filename = f"archresearch-backup-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.zip"
    return FileResponse(
        target,
        media_type="application/zip",
        filename=filename,
        background=BackgroundTask(target.unlink, missing_ok=True),
    )


@router.post("/data-backups/preflight", response_model=WorkspaceBackupPreflightRead)
def preflight_data_backup(
    file: FastAPIUploadFile = File(...),
) -> WorkspaceBackupPreflightRead:
    with tempfile.NamedTemporaryFile(
        prefix="archresearch-preflight-", suffix=".zip", delete=False
    ) as temporary:
        target = Path(temporary.name)
    try:
        copy_upload_to_path(file.file, target)
        return WorkspaceBackupPreflightRead(**inspect_workspace_backup(target).model_dump())
    except WorkspaceBackupError as error:
        raise _backup_error(error) from error
    finally:
        target.unlink(missing_ok=True)


@router.post("/data-backups/restore", response_model=WorkspaceRestoreRead)
def restore_data_backup(
    request: Request,
    file: FastAPIUploadFile = File(...),
    confirmation: str = Form(...),
    settings: Settings = Depends(get_settings),
) -> WorkspaceRestoreRead:
    if confirmation != "restore-verified-backup":
        raise HTTPException(status_code=400, detail="恢复确认无效。")
    if request.app.state.data_maintenance:
        raise HTTPException(status_code=409, detail="已有备份或恢复操作正在进行。")
    with tempfile.NamedTemporaryFile(
        prefix="archresearch-restore-", suffix=".zip", delete=False
    ) as temporary:
        target = Path(temporary.name)
    request.app.state.data_maintenance = True
    try:
        copy_upload_to_path(file.file, target)
        summary = restore_workspace_backup(
            target,
            settings=settings,
            database=request.app.state.database,
        )
        return WorkspaceRestoreRead(**summary.model_dump())
    except WorkspaceBackupError as error:
        raise _backup_error(error) from error
    finally:
        request.app.state.data_maintenance = False
        target.unlink(missing_ok=True)


def _collection_case_evidence(
    asset: AssetCandidate,
    analysis: dict[str, object],
) -> dict[str, object] | None:
    preferred_statements = [
        value.strip()
        for value in (
            analysis.get("design_mechanism"),
            analysis.get("project_context"),
        )
        if isinstance(value, str) and value.strip()
    ]
    claims = list(asset.evidence_claims)
    for statement in preferred_statements:
        claim = next(
            (item for item in claims if item.statement.strip() == statement and item.text_excerpt),
            None,
        )
        if claim is not None:
            return {
                "statement": claim.statement,
                "text_excerpt": claim.text_excerpt,
                "source_url": claim.source_url,
            }
    return None


def _collection_case_subquestions(
    asset: AssetCandidate,
    run: ResearchRun,
    selected_subquestion_ids: list[str] | None = None,
) -> list[dict[str, object]]:
    if run.goal == "visual_reference_search":
        return []
    question_by_id = {
        item["id"]: item["question"]
        for item in run.subquestions
        if isinstance(item.get("id"), str) and isinstance(item.get("question"), str)
    }
    analyses = asset.subquestion_analysis if isinstance(asset.subquestion_analysis, dict) else {}
    subquestion_ids = [
        item for item in [*asset.subquestion_ids, *analyses] if isinstance(item, str)
    ]
    available_ids = set(subquestion_ids)
    if selected_subquestion_ids is not None:
        invalid_ids = [item for item in selected_subquestion_ids if item not in available_ids]
        if invalid_ids:
            raise HTTPException(
                status_code=422,
                detail="Selected subquestion is not associated with this case",
            )
        selected_ids = set(selected_subquestion_ids)
        subquestion_ids = [item for item in subquestion_ids if item in selected_ids]
    case_subquestions: list[dict[str, object]] = []
    seen: set[str] = set()
    for subquestion_id in subquestion_ids:
        if subquestion_id in seen:
            continue
        seen.add(subquestion_id)
        raw_analysis = analyses.get(subquestion_id, {})
        analysis = raw_analysis if isinstance(raw_analysis, dict) else {}
        transfer_strategy = analysis.get("transfer_strategy", [])
        limitations = analysis.get("limitations", [])
        item: dict[str, object] = {
            "id": subquestion_id,
            "question": question_by_id.get(subquestion_id, "未记录具体案例子问题"),
            "project_context": analysis.get("project_context", ""),
            "design_mechanism": analysis.get("design_mechanism", ""),
            "transfer_strategy": transfer_strategy if isinstance(transfer_strategy, list) else [],
            "limitations": limitations if isinstance(limitations, list) else [],
        }
        evidence = _collection_case_evidence(asset, analysis)
        if evidence is not None:
            item["evidence"] = evidence
        case_subquestions.append(item)
    return case_subquestions


def _collection_case_images(
    asset: AssetCandidate,
    session: Session,
) -> list[dict[str, str]]:
    project_assets = list(
        session.scalars(
            select(AssetCandidate)
            .where(
                AssetCandidate.run_id == asset.run_id,
                AssetCandidate.project_name == asset.project_name,
                AssetCandidate.image_url.is_not(None),
            )
            .order_by(AssetCandidate.rank_index, AssetCandidate.created_at, AssetCandidate.id)
        )
    )
    selected: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    seen_types: set[str] = set()

    def append_candidate(candidate: AssetCandidate) -> None:
        image_url = candidate.image_url
        if not image_url or image_url in seen_urls or len(selected) >= 3:
            return
        selected.append(
            {
                "asset_id": candidate.id,
                "asset_type": candidate.asset_type,
                "image_url": image_url,
                "source_url": candidate.source_url,
            }
        )
        seen_urls.add(image_url)
        seen_types.add(candidate.asset_type)

    append_candidate(asset)
    for candidate in project_assets:
        if candidate.asset_type not in seen_types:
            append_candidate(candidate)
    for candidate in project_assets:
        append_candidate(candidate)
    return selected


def _collection_read(
    saved: SavedReference,
    session: Session,
) -> tuple[SavedReferenceRead, bool]:
    snapshot = dict(saved.snapshot)
    if snapshot.get("goal") != "visual_reference_search" and (
        not snapshot.get("case_subquestions") or "case_images" not in snapshot
    ):
        asset = session.get(AssetCandidate, saved.asset_candidate_id)
        if asset is not None:
            if not snapshot.get("case_subquestions"):
                run = session.get(ResearchRun, asset.run_id)
                if run is not None:
                    case_subquestions = _collection_case_subquestions(asset, run)
                    if case_subquestions:
                        snapshot["case_subquestions"] = case_subquestions
            if asset.project_context:
                snapshot.setdefault("project_context", asset.project_context)
            if "case_images" not in snapshot:
                snapshot["case_images"] = _collection_case_images(asset, session)
    upgraded = snapshot != saved.snapshot
    if upgraded:
        saved.snapshot = snapshot
    return (
        SavedReferenceRead.model_validate(saved).model_copy(
            update={"snapshot": SavedReferenceSnapshot.model_validate(snapshot)}
        ),
        upgraded,
    )


def execute_reserved_research_run(
    run_gate: ResearchRunGate,
    database: Database,
    run_id: str,
    provider: ResearchProvider,
    on_terminal: Callable[[str], None] | None,
    *,
    browser_client: BrowserBroker,
    visual_classifier: VisualClassifier,
    candidate_root: Path,
    public_page_parser: PublicPageParser | None,
    xiaohongshu_search: XiaohongshuSearch | None,
) -> None:
    try:
        execute_research_run(
            database,
            run_id,
            provider,
            on_terminal,
            browser_client=browser_client,
            visual_classifier=visual_classifier,
            candidate_root=candidate_root,
            public_page_parser=public_page_parser,
            xiaohongshu_search=xiaohongshu_search,
        )
    finally:
        run_gate.release(run_id)


def _reserve_research_run(
    request: Request,
    session: Session,
    run_id: str,
    *,
    exclude_run_id: str | None = None,
) -> ResearchRunGate:
    active_statement = select(ResearchRun.id).where(ResearchRun.status.in_(ACTIVE_RUN_STATUSES))
    if exclude_run_id is not None:
        active_statement = active_statement.where(ResearchRun.id != exclude_run_id)
    active_run_id = session.scalar(active_statement.limit(1))
    run_gate: ResearchRunGate = request.app.state.run_gate
    if active_run_id is not None:
        raise HTTPException(status_code=409, detail=ACTIVE_RUN_MESSAGE)
    if not run_gate.reserve(run_id):
        raise HTTPException(status_code=409, detail=RUN_TRANSITION_MESSAGE)
    return run_gate


@router.post("/workspaces", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate, session: Session = Depends(get_session)
) -> Workspace:
    workspace = Workspace(**payload.model_dump())
    session.add(workspace)
    session.commit()
    session.refresh(workspace)
    return workspace


@router.get("/workspaces", response_model=list[WorkspaceRead])
def list_workspaces(session: Session = Depends(get_session)) -> list[Workspace]:
    return list(
        session.scalars(
            select(Workspace).order_by(
                Workspace.archived_at.is_not(None),
                Workspace.created_at,
            )
        )
    )


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(workspace_id: str, session: Session = Depends(get_session)) -> Workspace:
    return _workspace_or_404(session, workspace_id)


@router.get(
    "/workspaces/{workspace_id}/collections",
    response_model=list[SavedReferenceRead],
)
def list_personal_collections(
    workspace_id: str,
    session: Session = Depends(get_session),
) -> list[SavedReferenceRead]:
    _workspace_or_404(session, workspace_id)
    saved_references = list(
        session.scalars(
            select(SavedReference)
            .where(SavedReference.workspace_id == workspace_id)
            .order_by(SavedReference.created_at.desc(), SavedReference.id)
        )
    )
    collection_reads = [_collection_read(saved, session) for saved in saved_references]
    if any(upgraded for _, upgraded in collection_reads):
        session.commit()
    return [collection for collection, _ in collection_reads]


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceRead)
def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdate,
    session: Session = Depends(get_session),
) -> Workspace:
    workspace = _workspace_or_404(session, workspace_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(workspace, key, value)
    session.commit()
    session.refresh(workspace)
    return workspace


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: str,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    workspace = _workspace_or_404(session, workspace_id)
    session.delete(workspace)
    session.commit()
    workspace_dir = (settings.data_dir / "workspaces" / workspace_id).resolve()
    data_root = settings.data_dir.resolve()
    if workspace_dir.is_relative_to(data_root) and workspace_dir.exists():
        shutil.rmtree(workspace_dir)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/workspaces/{workspace_id}/inputs",
    response_model=InputArtifactRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_input(
    workspace_id: str,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> InputArtifact:
    _workspace_or_404(session, workspace_id)
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        if not isinstance(upload, UploadFile):
            raise HTTPException(status_code=422, detail="A file field is required")
        artifact = await _store_upload(workspace_id, upload, settings)
    elif content_type.startswith("application/json"):
        try:
            payload = UrlInputCreate.model_validate(await request.json())
        except (ValidationError, json.JSONDecodeError) as exc:
            raise HTTPException(
                status_code=422, detail="A valid public HTTP(S) URL is required"
            ) from exc
        artifact = InputArtifact(
            workspace_id=workspace_id,
            kind=ArtifactKind.url.value,
            url=payload.url,
        )
    else:
        raise HTTPException(status_code=415, detail="Use JSON for URLs or multipart for files")
    session.add(artifact)
    session.commit()
    session.refresh(artifact)
    return artifact


@router.delete(
    "/workspaces/{workspace_id}/inputs/{input_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_input(
    workspace_id: str,
    input_id: str,
    session: Session = Depends(get_session),
) -> Response:
    artifact = session.scalar(
        select(InputArtifact).where(
            InputArtifact.id == input_id,
            InputArtifact.workspace_id == workspace_id,
        )
    )
    if artifact is None:
        raise HTTPException(status_code=404, detail="Input artifact not found")
    if artifact.storage_path:
        Path(artifact.storage_path).unlink(missing_ok=True)
    session.delete(artifact)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/workspaces/{workspace_id}/brief-review",
    response_model=ProjectBriefReviewRead,
)
async def review_project_brief(
    workspace_id: str,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ProjectBriefReviewRead:
    _workspace_or_404(session, workspace_id)
    form = await request.form()
    upload = form.get("file")
    question = form.get("question")
    budget_mode = form.get("budget_mode")
    if not isinstance(upload, UploadFile):
        raise HTTPException(status_code=422, detail="A project brief PDF is required")
    if not isinstance(question, str) or len(question.strip()) < 3:
        raise HTTPException(status_code=422, detail="A research question is required")
    try:
        resolved_mode = BudgetMode(str(budget_mode or BudgetMode.balanced.value))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Unsupported research mode") from exc

    filename = Path(upload.filename or "project-brief.pdf").name
    if Path(filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=415, detail="Only a project brief PDF is accepted")
    content = await upload.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Uploaded file is too large")
    try:
        with fitz.open(stream=content, filetype="pdf") as document:
            page_count = document.page_count
            pages = [
                f"[page {index}] {' '.join(page.get_text('text').split())}"
                for index, page in enumerate(document, start=1)
            ]
    except fitz.FileDataError as exc:
        raise HTTPException(status_code=422, detail="The project brief PDF cannot be read") from exc
    brief_text = " ".join(item for item in pages if item.strip())[:12_000]
    if not brief_text:
        raise HTTPException(
            status_code=422,
            detail="The project brief contains no readable text",
        )

    provider: ResearchProvider = request.app.state.research_provider
    if not isinstance(provider, ResearchPlanningProvider):
        raise HTTPException(status_code=503, detail="Project brief review is unavailable")
    try:
        plan = await run_in_threadpool(
            provider.plan,
            question.strip(),
            ResearchGoal.precedent_research,
            resolved_mode,
            f"PDF {filename}: {brief_text}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Project brief review failed; the original question can still be used",
        ) from exc
    project_summary = plan.project_summary.strip() or f"已读取 {filename}"
    project_boundaries = [item.strip() for item in plan.project_boundaries if item.strip()]
    if not project_boundaries:
        project_boundaries = ["任务书内容将作为问题拆解和案例检索的项目边界。"]
    return ProjectBriefReviewRead(
        filename=filename,
        page_count=page_count,
        project_summary=project_summary,
        project_boundaries=project_boundaries,
        subquestions=plan.subquestions,
    )


@router.post(
    "/workspaces/{workspace_id}/runs",
    response_model=ResearchRunRead,
    status_code=status.HTTP_201_CREATED,
)
def create_run(
    workspace_id: str,
    payload: ResearchSpec,
    background_tasks: BackgroundTasks,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRun:
    _workspace_or_404(session, workspace_id)
    run_id = str(uuid4())
    run_gate = _reserve_research_run(request, session, run_id)
    run = ResearchRun(
        id=run_id,
        workspace_id=workspace_id,
        question=payload.question,
        goal=payload.goal.value,
        budget_mode=payload.budget_mode.value,
        budget=BUDGETS[payload.budget_mode].model_dump(),
        allowed_domains=payload.allowed_domains,
        research_sources=[source.value for source in payload.research_sources],
        subquestions=[item.model_dump() for item in payload.subquestions or []],
        status=RunStatus.created.value,
        coverage_report={},
        retention_expires_at=datetime.now(UTC) + timedelta(days=14),
    )
    try:
        session.add(run)
        session.flush()
        session.add(ReferenceBoard(run_id=run.id))
        session.commit()
    except Exception:
        run_gate.release(run_id)
        raise

    database: Database = request.app.state.database
    provider: ResearchProvider = request.app.state.research_provider
    browser_broker: BrowserBroker = request.app.state.browser_broker
    visual_classifier: VisualClassifier = request.app.state.visual_classifier
    public_page_parser: PublicPageParser | None = request.app.state.public_page_parser
    xiaohongshu_search: XiaohongshuSearch | None = request.app.state.xiaohongshu_search
    if settings.run_inline:
        execute_reserved_research_run(
            run_gate,
            database,
            run.id,
            provider,
            browser_broker.notify_terminal,
            browser_client=browser_broker,
            visual_classifier=visual_classifier,
            candidate_root=settings.data_dir / "runs",
            public_page_parser=public_page_parser,
            xiaohongshu_search=xiaohongshu_search,
        )
    else:
        background_tasks.add_task(
            execute_reserved_research_run,
            run_gate,
            database,
            run.id,
            provider,
            browser_broker.notify_terminal,
            browser_client=browser_broker,
            visual_classifier=visual_classifier,
            candidate_root=settings.data_dir / "runs",
            public_page_parser=public_page_parser,
            xiaohongshu_search=xiaohongshu_search,
        )
    session.expire(run)
    session.refresh(run)
    return run


@router.get("/workspaces/{workspace_id}/runs", response_model=list[ResearchRunRead])
def list_workspace_runs(
    workspace_id: str,
    session: Session = Depends(get_session),
) -> list[ResearchRun]:
    _workspace_or_404(session, workspace_id)
    return list(
        session.scalars(
            select(ResearchRun)
            .where(ResearchRun.workspace_id == workspace_id)
            .order_by(ResearchRun.created_at.desc(), ResearchRun.id.desc())
        )
    )


@router.get("/runs/{run_id}", response_model=ResearchRunRead)
def get_run(run_id: str, session: Session = Depends(get_session)) -> ResearchRun:
    return _run_or_404(session, run_id)


@router.patch("/runs/{run_id}/retention", response_model=ResearchRunRead)
def update_run_retention(
    run_id: str,
    payload: RunRetentionUpdate,
    session: Session = Depends(get_session),
) -> ResearchRun:
    run = _run_or_404(session, run_id)
    run.keep_forever = payload.permanent
    run.retention_expires_at = None if payload.permanent else datetime.now(UTC) + timedelta(days=14)
    session.commit()
    session.refresh(run)
    return run


@router.get("/runs/{run_id}/events")
def get_run_events(run_id: str, session: Session = Depends(get_session)) -> StreamingResponse:
    _run_or_404(session, run_id)
    events = list(
        session.scalars(
            select(TraceEvent).where(TraceEvent.run_id == run_id).order_by(TraceEvent.sequence)
        )
    )

    def stream() -> Iterator[str]:
        for event in events:
            data = {
                "id": event.id,
                "sequence": event.sequence,
                "stage": event.stage,
                "tool": event.tool,
                "duration_ms": event.duration_ms,
                "cost_usd": event.cost_usd,
                "retry_count": event.retry_count,
                "summary": event.summary,
                "created_at": event.created_at.isoformat(),
            }
            yield f"event: trace\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.post("/runs/{run_id}/cancel", response_model=ResearchRunRead)
def cancel_run(
    run_id: str,
    request: Request,
    session: Session = Depends(get_session),
) -> ResearchRun:
    run = _run_or_404(session, run_id)
    if run.status not in {stage.value for stage in ACTIVE_STAGES} | {RunStatus.created.value}:
        raise HTTPException(status_code=409, detail="Only an active run can be cancelled")
    run.status = RunStatus.cancelled.value
    run.stop_reason = "user_cancelled"
    session.commit()
    session.refresh(run)
    browser_broker: BrowserBroker = request.app.state.browser_broker
    browser_broker.notify_terminal(RunStatus.cancelled.value)
    return run


@router.post("/runs/{run_id}/retry", response_model=ResearchRunRead)
def retry_run(
    run_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ResearchRun:
    run = _run_or_404(session, run_id)
    if run.status == RunStatus.completed.value:
        return run
    retryable = {
        RunStatus.partial.value,
        RunStatus.blocked.value,
        RunStatus.cancelled.value,
        RunStatus.failed.value,
    }
    if run.status not in retryable:
        raise HTTPException(status_code=409, detail="Run is already active")
    run_gate = _reserve_research_run(
        request,
        session,
        run.id,
        exclude_run_id=run.id,
    )
    try:
        run.status = RunStatus.created.value
        run.stop_reason = None
        run.finished_at = None
        run.attempt += 1
        session.commit()
    except Exception:
        run_gate.release(run.id)
        raise
    database: Database = request.app.state.database
    provider: ResearchProvider = request.app.state.research_provider
    browser_broker: BrowserBroker = request.app.state.browser_broker
    visual_classifier: VisualClassifier = request.app.state.visual_classifier
    public_page_parser: PublicPageParser | None = request.app.state.public_page_parser
    xiaohongshu_search: XiaohongshuSearch | None = request.app.state.xiaohongshu_search
    if settings.run_inline:
        execute_reserved_research_run(
            run_gate,
            database,
            run.id,
            provider,
            browser_broker.notify_terminal,
            browser_client=browser_broker,
            visual_classifier=visual_classifier,
            candidate_root=settings.data_dir / "runs",
            public_page_parser=public_page_parser,
            xiaohongshu_search=xiaohongshu_search,
        )
    else:
        background_tasks.add_task(
            execute_reserved_research_run,
            run_gate,
            database,
            run.id,
            provider,
            browser_broker.notify_terminal,
            browser_client=browser_broker,
            visual_classifier=visual_classifier,
            candidate_root=settings.data_dir / "runs",
            public_page_parser=public_page_parser,
            xiaohongshu_search=xiaohongshu_search,
        )
    session.expire(run)
    session.refresh(run)
    return run


@router.get("/runs/{run_id}/results", response_model=list[AssetCandidateRead])
def get_results(run_id: str, session: Session = Depends(get_session)) -> list[AssetCandidate]:
    _run_or_404(session, run_id)
    return list(
        session.scalars(
            select(AssetCandidate)
            .options(selectinload(AssetCandidate.evidence_claims))
            .where(AssetCandidate.run_id == run_id)
            .order_by(AssetCandidate.rank_index)
        )
    )


@router.get("/runs/{run_id}/user-state", response_model=RunUserStateRead)
def get_run_user_state(
    run_id: str,
    session: Session = Depends(get_session),
) -> RunUserStateRead:
    run = _run_or_404(session, run_id)
    candidate_ids = select(AssetCandidate.id).where(AssetCandidate.run_id == run_id)
    saved = list(
        session.scalars(
            select(SavedReference)
            .where(
                SavedReference.workspace_id == run.workspace_id,
                SavedReference.asset_candidate_id.in_(candidate_ids),
            )
            .order_by(SavedReference.created_at, SavedReference.id)
        )
    )
    rejected = list(
        session.scalars(
            select(RejectedFeedback)
            .where(
                RejectedFeedback.workspace_id == run.workspace_id,
                RejectedFeedback.asset_candidate_id.in_(candidate_ids),
            )
            .order_by(RejectedFeedback.created_at, RejectedFeedback.id)
        )
    )
    return RunUserStateRead(
        saved=[
            SavedUserState(asset_candidate_id=item.asset_candidate_id, note=item.note)
            for item in saved
        ],
        rejected=[
            RejectedUserState(asset_candidate_id=item.asset_candidate_id, reason=item.reason)
            for item in rejected
        ],
    )


@router.get("/results/{asset_id}/content", include_in_schema=False)
@router.get("/assets/{asset_id}/content")
def get_asset_content(
    asset_id: str,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    asset = session.get(AssetCandidate, asset_id)
    if asset is None or not asset.storage_path:
        raise HTTPException(status_code=404, detail="Asset content not found")
    raw_path = asset.storage_path
    if "://" in raw_path.lower() or raw_path.startswith(("\\\\", "//")):
        raise HTTPException(status_code=404, detail="Asset content not found")
    try:
        storage_root = (settings.data_dir / "runs").resolve()
        content_path = Path(raw_path).resolve(strict=True)
    except (OSError, RuntimeError):
        raise HTTPException(status_code=404, detail="Asset content not found") from None
    if content_path == storage_root or storage_root not in content_path.parents:
        raise HTTPException(status_code=404, detail="Asset content not found")
    if not content_path.is_file():
        raise HTTPException(status_code=404, detail="Asset content not found")
    return FileResponse(content_path)


@router.post(
    "/results/{asset_id}/save",
    response_model=SavedReferenceRead,
    status_code=status.HTTP_201_CREATED,
)
def save_result(
    asset_id: str,
    payload: SaveCreate,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> SavedReference:
    asset, run = _asset_and_run_or_404(session, asset_id)
    selected_case_subquestions = (
        _collection_case_subquestions(asset, run, payload.subquestion_ids)
        if payload.subquestion_ids is not None
        else None
    )
    saved = session.scalar(
        select(SavedReference).where(
            SavedReference.workspace_id == run.workspace_id,
            SavedReference.asset_candidate_id == asset_id,
        )
    )
    if saved is None:
        saved = SavedReference(
            workspace_id=run.workspace_id,
            asset_candidate_id=asset_id,
            source_url=asset.source_url,
            note=payload.note,
            snapshot={
                "project_name": asset.project_name,
                "asset_type": asset.asset_type,
                "image_url": asset.image_url,
                "result_tier": asset.result_tier,
                "rights_status": asset.rights_status,
            },
        )
        session.add(saved)
        session.flush()
    else:
        saved.note = payload.note
    snapshot = {
        **saved.snapshot,
        "question": run.question,
        "goal": run.goal,
        "project_name": asset.project_name,
        "asset_type": asset.asset_type,
        "image_url": asset.image_url,
        "result_tier": asset.result_tier,
        "rights_status": asset.rights_status,
        "visual_observation": next(iter(asset.observations), ""),
        "project_context": asset.project_context,
        "design_mechanism": asset.design_mechanism,
        "transfer_strategy": asset.transfer_strategy,
        "limitations": asset.limitations,
    }
    existing_case_subquestions = saved.snapshot.get("case_subquestions")
    case_subquestions = selected_case_subquestions
    if case_subquestions is None:
        case_subquestions = (
            existing_case_subquestions
            if isinstance(existing_case_subquestions, list)
            else _collection_case_subquestions(asset, run)
        )
    if case_subquestions:
        snapshot["case_subquestions"] = case_subquestions
    if run.goal != "visual_reference_search":
        snapshot["case_images"] = _collection_case_images(asset, session)
    collection_file = _copy_collection_content(asset, saved.id, settings.data_dir)
    if collection_file is not None:
        snapshot["collection_file"] = collection_file
    saved.snapshot = snapshot
    session.commit()
    session.refresh(saved)
    return saved


@router.delete("/results/{asset_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave_result(
    asset_id: str,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    _, run = _asset_and_run_or_404(session, asset_id)
    saved = session.scalar(
        select(SavedReference).where(
            SavedReference.workspace_id == run.workspace_id,
            SavedReference.asset_candidate_id == asset_id,
        )
    )
    if saved is not None:
        _remove_collection_content(saved, settings.data_dir)
        session.delete(saved)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/collections/{collection_id}/content")
def get_collection_content(
    collection_id: str,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    saved = session.get(SavedReference, collection_id)
    content_path = _collection_content_path(saved, settings.data_dir)
    if content_path is None or not content_path.is_file():
        raise HTTPException(status_code=404, detail="Collection content not found")
    return FileResponse(content_path)


@router.delete("/collections/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_personal_collection(
    collection_id: str,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Response:
    saved = session.get(SavedReference, collection_id)
    if saved is not None:
        _remove_collection_content(saved, settings.data_dir)
        session.delete(saved)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/results/{asset_id}/reject",
    response_model=RejectedFeedbackRead,
    status_code=status.HTTP_201_CREATED,
)
def reject_result(
    asset_id: str,
    payload: RejectCreate,
    session: Session = Depends(get_session),
) -> RejectedFeedback:
    asset, run = _asset_and_run_or_404(session, asset_id)
    rejected = session.scalar(
        select(RejectedFeedback).where(
            RejectedFeedback.workspace_id == run.workspace_id,
            RejectedFeedback.asset_candidate_id == asset_id,
        )
    )
    if rejected is None:
        rejected = RejectedFeedback(
            workspace_id=run.workspace_id,
            asset_candidate_id=asset_id,
            source_url=asset.source_url,
            perceptual_hash=asset.perceptual_hash,
            reason=payload.reason,
        )
        session.add(rejected)
        session.commit()
        session.refresh(rejected)
    return rejected


@router.delete("/results/{asset_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def undo_reject_result(
    asset_id: str,
    session: Session = Depends(get_session),
) -> Response:
    _, run = _asset_and_run_or_404(session, asset_id)
    rejected = session.scalar(
        select(RejectedFeedback).where(
            RejectedFeedback.workspace_id == run.workspace_id,
            RejectedFeedback.asset_candidate_id == asset_id,
        )
    )
    if rejected is not None:
        session.delete(rejected)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/runs/{run_id}/board", response_model=ReferenceBoardRead)
def get_board(run_id: str, session: Session = Depends(get_session)) -> ReferenceBoard:
    _run_or_404(session, run_id)
    return _board_for_run_or_404(session, run_id)


@router.patch("/runs/{run_id}/board", response_model=ReferenceBoardRead)
def update_board(
    run_id: str,
    payload: BoardUpdate,
    session: Session = Depends(get_session),
) -> ReferenceBoard:
    _run_or_404(session, run_id)
    board = _board_for_run_or_404(session, run_id)
    updates = payload.model_dump(exclude_unset=True)
    selected = updates.get("selected_asset_ids")
    if selected is not None:
        if len(set(selected)) != len(selected):
            raise HTTPException(status_code=422, detail="Board asset IDs must be unique")
        matching = set(
            session.scalars(
                select(AssetCandidate.id).where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.id.in_(selected),
                )
            )
        )
        if matching != set(selected):
            raise HTTPException(status_code=422, detail="All board assets must belong to the run")
    for key, value in updates.items():
        setattr(board, key, value)
    session.commit()
    session.refresh(board)
    return board


@router.post(
    "/boards/{board_id}/exports",
    response_model=ExportRead,
    status_code=status.HTTP_201_CREATED,
)
def create_export(
    board_id: str,
    payload: ExportCreate,
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ExportRead:
    board = session.get(ReferenceBoard, board_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    run = session.get(ResearchRun, board.run_id)
    goal = run.goal if run is not None else "precedent_research"
    artifact_kind = (
        "visual_inspiration_board" if goal == "visual_reference_search" else "case_strategy_matrix"
    )
    style_profile = board.style_profile if artifact_kind == "visual_inspiration_board" else None
    selected_assets = list(
        session.scalars(
            select(AssetCandidate)
            .where(AssetCandidate.id.in_(board.selected_asset_ids))
            .order_by(AssetCandidate.rank_index)
        )
    )
    assets_by_id = {asset.id: asset for asset in selected_assets}
    assets = [
        assets_by_id[asset_id] for asset_id in board.selected_asset_ids if asset_id in assets_by_id
    ]
    if goal != "visual_reference_search" and payload.mode == "private":
        project_names = {asset.project_name.strip().casefold() for asset in assets}
        if len(project_names) < 2:
            raise HTTPException(status_code=422, detail="策略矩阵至少需要两个不同案例")
    items: list[dict[str, object]] = []
    renderable_images: dict[str, str] = {}
    for asset in assets:
        image_src = _export_image_source(asset)
        embed_full_image = image_src is not None and (
            payload.mode == "private" or asset.rights_status in SHAREABLE_IMAGE_RIGHTS
        )
        if embed_full_image and image_src is not None:
            renderable_images[asset.id] = image_src
        items.append(
            {
                "asset_id": asset.id,
                "project_name": asset.project_name,
                "asset_type": asset.asset_type,
                "asset_type_label": EXPORT_ASSET_TYPE_LABELS.get(
                    asset.asset_type, asset.asset_type
                ),
                "source_url": asset.source_url,
                "image_url": asset.image_url,
                "rights_status": asset.rights_status,
                "embed_full_image": embed_full_image,
                "visual_observation": next(iter(asset.observations), "")
                if goal == "visual_reference_search"
                else None,
                "project_context": asset.project_context
                if goal != "visual_reference_search"
                else None,
                "design_mechanism": asset.design_mechanism
                if goal != "visual_reference_search"
                else None,
                "transfer_strategy": asset.transfer_strategy
                if goal != "visual_reference_search"
                else [],
                "limitations": asset.limitations if goal != "visual_reference_search" else [],
                "evidence_claims": (
                    [
                        {
                            "statement": claim.statement,
                            "source_url": claim.source_url,
                            "text_excerpt": claim.text_excerpt,
                            "pdf_page": claim.pdf_page,
                        }
                        for claim in asset.evidence_claims
                    ]
                    if goal != "visual_reference_search"
                    else []
                ),
            }
        )
    export_id = str(uuid4())
    export_dir = settings.data_dir / "exports" / board_id
    export_dir.mkdir(parents=True, exist_ok=True)
    html_target = (export_dir / f"{export_id}-{payload.mode}.html").resolve()
    manifest_target = (export_dir / f"{export_id}-{payload.mode}-sources.json").resolve()
    manifest_target.write_text(
        json.dumps(
            {
                "board_id": board_id,
                "mode": payload.mode,
                "artifact_kind": artifact_kind,
                "rights_gate": "deterministic",
                "style_profile": (
                    {
                        "palette": style_profile.palette,
                        "line_weights": style_profile.line_weights,
                        "texture": style_profile.texture,
                        "font_category": style_profile.font_category,
                        "layout_notes": style_profile.layout_notes,
                    }
                    if style_profile is not None
                    else None
                ),
                "items": items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    html_target.write_text(
        _render_export_html(
            board,
            payload.mode,
            assets,
            renderable_images,
            goal=goal,
            run=run,
            style_profile=style_profile,
        ),
        encoding="utf-8",
    )
    browser_url = str(
        request.url_for(
            "get_export_html",
            board_id=board_id,
            export_id=export_id,
            mode=payload.mode,
        )
    )
    return ExportRead(
        id=export_id,
        board_id=board_id,
        mode=payload.mode,
        path=str(html_target),
        browser_url=browser_url,
        manifest_path=str(manifest_target),
        item_count=len(items),
    )


@router.get("/boards/{board_id}/exports/{export_id}/{mode}", name="get_export_html")
def get_export_html(
    board_id: str,
    export_id: UUID,
    mode: Literal["private", "share"],
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    if session.get(ReferenceBoard, board_id) is None:
        raise HTTPException(status_code=404, detail="Board not found")
    export_root = (settings.data_dir / "exports").resolve()
    target = (export_root / board_id / f"{export_id}-{mode}.html").resolve()
    if export_root not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="Export not found")
    return FileResponse(
        target,
        media_type="text/html; charset=utf-8",
        headers={"Content-Security-Policy": EXPORT_CONTENT_SECURITY_POLICY},
    )


def _export_image_source(asset: AssetCandidate) -> str | None:
    if _safe_export_http_url(asset.image_url) is not None:
        assert asset.image_url is not None
        return asset.image_url
    if asset.storage_path:
        return f"/v1/assets/{asset.id}/content"
    return None


def _safe_export_http_url(value: str | None) -> str | None:
    if not value or any(ord(character) < 32 for character in value):
        return None
    parsed = urlparse(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        return None
    return value


def _render_export_html(
    board: ReferenceBoard,
    mode: Literal["private", "share"],
    assets: list[AssetCandidate],
    renderable_images: dict[str, str],
    *,
    goal: str,
    run: ResearchRun | None,
    style_profile: StyleProfile | None,
) -> str:
    is_visual = goal == "visual_reference_search"
    mode_label = (
        "个人灵感板"
        if is_visual and mode == "private"
        else (
            "分享来源板" if is_visual else ("案例策略矩阵" if mode == "private" else "分享证据板")
        )
    )

    def source_link(asset: AssetCandidate) -> str:
        source_url = _safe_export_http_url(asset.source_url)
        return (
            f'<a href="{escape(source_url, quote=True)}" target="_blank" '
            'rel="noopener noreferrer">打开原始来源</a>'
            if source_url is not None
            else '<span class="muted">无可用来源链接</span>'
        )

    def visual(asset: AssetCandidate, *, alt: str) -> str:
        image_src = renderable_images.get(asset.id)
        if image_src is not None:
            return (
                '<div class="visual">'
                f'<img src="{escape(image_src, quote=True)}" '
                f'alt="{escape(alt, quote=True)}" loading="lazy">'
                "</div>"
            )
        reason = (
            "分享版未嵌入这张图片，请通过来源页面查看。"
            if mode == "share"
            else "当前结果没有可显示的图片，请通过来源页面查看。"
        )
        return f'<div class="source-only"><span>来源卡</span><p>{reason}</p></div>'

    if is_visual:
        posts: dict[str, list[AssetCandidate]] = {}
        for asset in assets:
            posts.setdefault(asset.source_url, []).append(asset)
        cards = []
        for post_assets in posts.values():
            primary = post_assets[0]
            observation = next(iter(primary.observations), "保留帖子整体画面作为视觉参考。")

            def render_visual_item(asset: AssetCandidate, post_title: str) -> str:
                asset_type_label = EXPORT_ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type)
                rights_label = EXPORT_RIGHTS_STATUS_LABELS.get(
                    asset.rights_status, asset.rights_status
                )
                return (
                    '<article class="visual-item">'
                    f"{visual(asset, alt=f'{post_title} {asset_type_label}')}"
                    f'<p class="asset-type">{escape(asset_type_label)}</p>'
                    f'<p class="rights">权利状态：{escape(rights_label)}</p>'
                    "</article>"
                )

            images = "".join(
                render_visual_item(asset, primary.project_name) for asset in post_assets
            )
            cards.append(
                '<article class="post">'
                '<header class="post-heading">'
                f'<p class="eyebrow">帖子组 · {len(post_assets)} 张图</p>'
                f"<h2>{escape(primary.project_name)}</h2>"
                f'<p class="observation"><strong>视觉表达</strong>{escape(observation)}</p>'
                f"{source_link(primary)}"
                "</header>"
                f'<div class="post-images">{images}</div>'
                "</article>"
            )
    else:
        projects: list[str] = []
        assets_by_project: dict[str, list[AssetCandidate]] = {}
        for asset in assets:
            if asset.project_name not in assets_by_project:
                projects.append(asset.project_name)
                assets_by_project[asset.project_name] = []
            assets_by_project[asset.project_name].append(asset)

        subquestions = list(run.subquestions) if run is not None else []
        if not subquestions:
            subquestions = [
                {
                    "id": "research-question",
                    "question": run.question if run is not None else "本次研究问题",
                }
            ]

        def branch_copy(asset: AssetCandidate, subquestion_id: str) -> tuple[str, str, str]:
            analysis = asset.subquestion_analysis.get(subquestion_id, {})
            mechanism = str(analysis.get("design_mechanism") or asset.design_mechanism)
            transfers = analysis.get("transfer_strategy") or asset.transfer_strategy
            limitations = analysis.get("limitations") or asset.limitations
            transfer = str(transfers[0]) if transfers else "尚未提炼可迁移动作。"
            boundary = str(limitations[0]) if limitations else "当前来源未给出适用边界。"
            return mechanism or "当前来源未给出设计机制。", transfer, boundary

        rows: list[str] = []
        for subquestion in subquestions:
            subquestion_id = str(subquestion.get("id", ""))
            cells = []
            for project in projects:
                project_assets = assets_by_project[project]
                matching = next(
                    (
                        asset
                        for asset in project_assets
                        if subquestion_id in asset.subquestion_ids
                        or subquestion_id in asset.subquestion_analysis
                    ),
                    project_assets[0] if len(subquestions) == 1 else None,
                )
                if matching is None:
                    cells.append('<td class="matrix-empty">本题未选入该案例证据</td>')
                    continue
                mechanism, transfer, boundary = branch_copy(matching, subquestion_id)
                cells.append(
                    '<td><div class="matrix-cell">'
                    f"<p><strong>机制</strong>{escape(mechanism)}</p>"
                    f"<p><strong>可迁移动作</strong>{escape(transfer)}</p>"
                    f"<p><strong>适用边界</strong>{escape(boundary)}</p>"
                    f"<p><strong>证据来源</strong>{source_link(matching)}</p>"
                    "</div></td>"
                )
            rows.append(
                "<tr>"
                f'<th scope="row">{escape(str(subquestion.get("question", "设计问题")))}</th>'
                f"{''.join(cells)}"
                "</tr>"
            )

        actions: list[str] = []
        for asset in assets:
            for action in asset.transfer_strategy:
                if action and action not in actions:
                    actions.append(action)
            for analysis in asset.subquestion_analysis.values():
                for action in analysis.get("transfer_strategy", []):
                    if action and action not in actions:
                        actions.append(str(action))
        action_items = "".join(f"<li>{escape(action)}</li>" for action in actions[:8])
        if not action_items:
            action_items = "<li>从矩阵中的机制与边界提炼下一步设计动作。</li>"

        project_headers = "".join(f'<th scope="col">{escape(project)}</th>' for project in projects)
        cards = [
            '<section class="strategy-matrix" aria-labelledby="strategy-matrix-title">'
            '<header><h2 id="strategy-matrix-title">跨案例策略矩阵</h2>'
            "<p>同一设计问题下直接比较机制、动作与边界。</p></header>"
            '<div class="strategy-matrix-wrap"><table><thead><tr>'
            '<th scope="col">设计问题</th>'
            f"{project_headers}</tr></thead><tbody>{''.join(rows)}</tbody></table></div>"
            "</section>",
            f'<section class="action-list"><h2>设计动作清单</h2><ol>{action_items}</ol></section>',
        ]
    notes = escape(board.notes) if board.notes else "未添加画板备注。"
    style_markup = ""
    if is_visual:
        if style_profile is None:
            style_markup = (
                '<section class="style-spec"><h2>表达规范</h2>'
                '<p class="muted">尚未保存表达规范；先从图纸类型和帖子整体画面'
                "建立自己的线型、配色与注释习惯。</p></section>"
            )
        else:
            palette = "、".join(escape(str(color)) for color in style_profile.palette) or "未设定"
            weights = (
                " / ".join(
                    f"{escape(str(name))} {escape(str(value))}"
                    for name, value in style_profile.line_weights.items()
                )
                or "未设定"
            )
            style_markup = (
                '<section class="style-spec"><h2>表达规范</h2>'
                f"<p><strong>主色</strong>{palette}</p>"
                f"<p><strong>线型层级</strong>{weights}</p>"
                f"<p><strong>字体</strong>{escape(style_profile.font_category or '未设定')}</p>"
                f"<p><strong>版式备注</strong>{escape(style_profile.layout_notes or '未设定')}</p>"
                "</section>"
            )
    board_label = "图纸参考" if is_visual else "策略矩阵"
    cards_markup = "".join(cards)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ArchResearch {"图纸灵感板" if is_visual else "案例策略矩阵"}</title>
  <style>
    :root {{
      color-scheme: light;
      font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #f3f5f1;
      color: #171b19;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; }}
    main {{ width: min(1400px, calc(100% - 40px)); margin: 0 auto; padding: 56px 0 80px; }}
    header {{ display: grid; gap: 12px; margin-bottom: 32px; }}
    .kicker, .eyebrow {{
      margin: 0;
      color: #315cf4;
      font-size: 12px;
      font-weight: 750;
      letter-spacing: .09em;
      text-transform: uppercase;
    }}
    h1 {{ margin: 0; font-size: clamp(34px, 5vw, 60px); line-height: 1; letter-spacing: -.045em; }}
    .notes {{ max-width: 760px; margin: 0; color: #59615d; font-size: 16px; line-height: 1.7; }}
    .board {{ display: grid; gap: 28px; }}
    .post {{ overflow: hidden; border-top: 1px solid #b8c0ba; background: #fff; }}
    .post {{ display: grid; gap: 18px; padding: 22px 0 28px; }}
    .visual, .source-only {{ aspect-ratio: 4 / 3; background: #e7eae5; }}
    .visual img {{ display: block; width: 100%; height: 100%; object-fit: contain; }}
    .source-only {{
      display: grid;
      place-content: center;
      gap: 10px;
      padding: 32px;
      text-align: center;
      color: #59615d;
    }}
    .source-only span {{ color: #171b19; font-size: 28px; font-weight: 760; }}
    .source-only p {{ margin: 0; line-height: 1.6; }}
    .post-heading {{
      display: grid; align-content: start; gap: 12px; padding: 22px 26px;
    }}
    h2 {{ margin: 0; font-size: 23px; line-height: 1.2; }}
    h3 {{ margin: 0; color: #59615d; font-size: 12px; letter-spacing: .04em; }}
    section p, blockquote {{ margin: 4px 0 0; line-height: 1.6; }}
    .post-heading {{ grid-template-columns: 1fr auto; align-items: start; }}
    .post-heading .eyebrow, .post-heading h2, .post-heading .observation {{ grid-column: 1 / -1; }}
    .observation {{ max-width: 72ch; color: #59615d; }}
    .observation strong {{ display: block; margin-bottom: 4px; color: #171b19; }}
    .post-images {{
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;
    }}
    .visual-item {{ display: grid; gap: 6px; min-width: 0; }}
    .asset-type {{ margin: 0; font-size: 13px; font-weight: 700; }}
    .rights {{ margin: 0; color: #737b77; font-size: 13px; }}
    .evidence {{ padding-top: 8px; border-top: 1px solid #e0e4e0; }}
    .style-spec {{
      display: grid; gap: 8px; padding: 18px 20px;
      border: 1px solid #d7dcd7; background: #f7f8f6;
    }}
    .style-spec h2 {{ font-size: 18px; }}
    .style-spec p {{ margin: 0; color: #59615d; line-height: 1.55; }}
    .style-spec strong {{ display: inline-block; min-width: 80px; color: #171b19; }}
    .strategy-matrix {{ display: grid; gap: 16px; }}
    .strategy-matrix > header {{ margin: 0; }}
    .strategy-matrix > header p {{ margin: 0; color: #59615d; }}
    .strategy-matrix-wrap {{ overflow-x: auto; border: 1px solid #cbd1cc; background: #fff; }}
    table {{ width: 100%; min-width: 860px; border-collapse: collapse; }}
    th, td {{ padding: 16px; border: 1px solid #dfe3df; text-align: left; vertical-align: top; }}
    thead th {{ background: #eef1ed; font-size: 14px; }}
    tbody th {{ width: 220px; background: #f7f8f6; font-size: 14px; line-height: 1.5; }}
    .matrix-cell {{ display: grid; gap: 12px; min-width: 240px; }}
    .matrix-cell p {{ display: grid; gap: 3px; margin: 0; line-height: 1.5; }}
    .matrix-cell strong {{ color: #59615d; font-size: 12px; }}
    .matrix-empty {{ color: #8b928e; }}
    .action-list {{ padding: 22px 26px; border-top: 1px solid #b8c0ba; background: #fff; }}
    .action-list ol {{ columns: 2; gap: 32px; margin: 16px 0 0; padding-left: 20px; }}
    .action-list li {{ break-inside: avoid; margin: 0 0 10px; line-height: 1.55; }}
    blockquote {{ padding-left: 14px; border-left: 2px solid #b8c0ba; color: #59615d; }}
    a {{ width: fit-content; color: #315cf4; font-weight: 700; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    .muted {{ color: #8b928e; }}
    @media (max-width: 760px) {{
      .post-heading {{ grid-template-columns: 1fr; }}
      .action-list ol {{ columns: 1; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <p class="kicker">{mode_label} · {len(assets)} 项参考</p>
      <h1>{"图纸灵感板" if is_visual else "案例策略矩阵"}</h1>
      <p class="notes">{notes}</p>
      {style_markup}
    </header>
    <section class="board" aria-label="{board_label}">{cards_markup}</section>
  </main>
</body>
</html>
"""


@router.post(
    "/boards/{board_id}/style-profile",
    response_model=StyleProfileRead,
    status_code=status.HTTP_201_CREATED,
)
def create_style_profile(
    board_id: str,
    payload: StyleProfileCreate,
    session: Session = Depends(get_session),
) -> StyleProfile:
    board = session.get(ReferenceBoard, board_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    existing = session.scalar(select(StyleProfile).where(StyleProfile.board_id == board_id))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Style profile already exists")
    profile = StyleProfile(board_id=board_id, **payload.model_dump())
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.get("/boards/{board_id}/style-profile", response_model=StyleProfileRead)
def get_style_profile(board_id: str, session: Session = Depends(get_session)) -> StyleProfile:
    profile = session.scalar(select(StyleProfile).where(StyleProfile.board_id == board_id))
    if profile is None:
        raise HTTPException(status_code=404, detail="Style profile not found")
    return profile


@router.patch("/boards/{board_id}/style-profile", response_model=StyleProfileRead)
def update_style_profile(
    board_id: str,
    payload: StyleProfileUpdate,
    session: Session = Depends(get_session),
) -> StyleProfile:
    profile = session.scalar(select(StyleProfile).where(StyleProfile.board_id == board_id))
    if profile is None:
        raise HTTPException(status_code=404, detail="Style profile not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    session.commit()
    session.refresh(profile)
    return profile


async def _store_upload(
    workspace_id: str,
    upload: UploadFile,
    settings: Settings,
) -> InputArtifact:
    filename = Path(upload.filename or "artifact").name
    suffix = Path(filename).suffix.lower()
    accepted = {
        ".jpg": (ArtifactKind.image, "image/jpeg"),
        ".jpeg": (ArtifactKind.image, "image/jpeg"),
        ".png": (ArtifactKind.image, "image/png"),
        ".pdf": (ArtifactKind.pdf, "application/pdf"),
    }
    if suffix not in accepted:
        raise HTTPException(status_code=415, detail="Only JPG, PNG, and PDF files are accepted")
    content = await upload.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Uploaded file is too large")
    kind, canonical_mime = accepted[suffix]
    target_dir = settings.data_dir / "workspaces" / workspace_id / "inputs"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = (target_dir / f"{uuid4()}{suffix}").resolve()
    target.write_bytes(content)
    page_count: int | None = None
    if kind is ArtifactKind.pdf:
        try:
            with fitz.open(stream=content, filetype="pdf") as document:
                page_count = document.page_count
        except fitz.FileDataError:
            page_count = None
    return InputArtifact(
        workspace_id=workspace_id,
        kind=kind.value,
        filename=filename,
        mime_type=upload.content_type or canonical_mime,
        sha256=hashlib.sha256(content).hexdigest(),
        storage_path=str(target),
        page_count=page_count,
    )


def _workspace_or_404(session: Session, workspace_id: str) -> Workspace:
    workspace = session.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _run_or_404(session: Session, run_id: str) -> ResearchRun:
    run = session.get(ResearchRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Research run not found")
    return run


def _asset_and_run_or_404(
    session: Session,
    asset_id: str,
) -> tuple[AssetCandidate, ResearchRun]:
    asset = session.get(AssetCandidate, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset candidate not found")
    return asset, _run_or_404(session, asset.run_id)


def _copy_collection_content(
    asset: AssetCandidate,
    collection_id: str,
    data_dir: Path,
) -> str | None:
    if not asset.storage_path:
        return None
    try:
        source = Path(asset.storage_path).resolve(strict=True)
        run_root = (data_dir / "runs").resolve()
    except (OSError, RuntimeError):
        return None
    if not source.is_file() or source == run_root or run_root not in source.parents:
        return None
    suffix = source.suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
        suffix = ".bin"
    filename = f"{collection_id}{suffix}"
    destination = data_dir / "collections" / filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    return filename


def _collection_content_path(
    saved: SavedReference | None,
    data_dir: Path,
) -> Path | None:
    if saved is None:
        return None
    filename = saved.snapshot.get("collection_file")
    if not isinstance(filename, str) or not filename or Path(filename).name != filename:
        return None
    try:
        collection_root = (data_dir / "collections").resolve()
        content_path = (collection_root / filename).resolve()
    except (OSError, RuntimeError):
        return None
    if content_path == collection_root or collection_root not in content_path.parents:
        return None
    return content_path


def _remove_collection_content(saved: SavedReference, data_dir: Path) -> None:
    content_path = _collection_content_path(saved, data_dir)
    if content_path is not None:
        content_path.unlink(missing_ok=True)


def _board_for_run_or_404(session: Session, run_id: str) -> ReferenceBoard:
    board = session.scalar(select(ReferenceBoard).where(ReferenceBoard.run_id == run_id))
    if board is None:
        raise HTTPException(status_code=404, detail="Reference board not found")
    return board
