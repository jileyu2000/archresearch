from __future__ import annotations

import hashlib
import json
import shutil
from collections.abc import Iterator
from html import escape
from pathlib import Path
from typing import Literal, cast
from urllib.parse import urlparse
from uuid import UUID, uuid4

import fitz  # type: ignore[import-untyped]
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
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
from .providers import ResearchProvider, ReverseImageProvider
from .public_pages import PublicPageParser
from .schemas import (
    BUDGETS,
    ArtifactKind,
    AssetCandidateRead,
    BoardUpdate,
    ExportCreate,
    ExportRead,
    InputArtifactRead,
    ReferenceBoardRead,
    RejectCreate,
    RejectedFeedbackRead,
    RejectedUserState,
    ResearchRunRead,
    ResearchSpec,
    RunStatus,
    RunUserStateRead,
    SaveCreate,
    SavedReferenceRead,
    SavedUserState,
    StyleProfileCreate,
    StyleProfileRead,
    StyleProfileUpdate,
    UrlInputCreate,
    WorkspaceCreate,
    WorkspaceRead,
    WorkspaceUpdate,
)
from .visual import VisualClassifier
from .workflow import ACTIVE_STAGES, execute_research_run

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
EXPORT_CONTENT_SECURITY_POLICY = (
    "default-src 'none'; img-src 'self' http: https:; style-src 'unsafe-inline'; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
)


def get_session(request: Request) -> Iterator[Session]:
    database: Database = request.app.state.database
    with database.session_factory() as session:
        yield session


def get_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


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
    return list(session.scalars(select(Workspace).order_by(Workspace.created_at)))


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(workspace_id: str, session: Session = Depends(get_session)) -> Workspace:
    return _workspace_or_404(session, workspace_id)


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
    run = ResearchRun(
        workspace_id=workspace_id,
        question=payload.question,
        goal=payload.goal.value,
        budget_mode=payload.budget_mode.value,
        budget=BUDGETS[payload.budget_mode].model_dump(),
        allowed_domains=payload.allowed_domains,
        research_sources=[source.value for source in payload.research_sources],
        status=RunStatus.created.value,
        coverage_report={},
    )
    session.add(run)
    session.flush()
    session.add(ReferenceBoard(run_id=run.id))
    session.commit()

    database: Database = request.app.state.database
    provider: ResearchProvider = request.app.state.research_provider
    tineye_provider: ReverseImageProvider | None = request.app.state.tineye_provider
    browser_broker: BrowserBroker = request.app.state.browser_broker
    visual_classifier: VisualClassifier = request.app.state.visual_classifier
    public_page_parser: PublicPageParser | None = request.app.state.public_page_parser
    if settings.run_inline:
        execute_research_run(
            database,
            run.id,
            provider,
            browser_broker.notify_terminal,
            source_lookup_provider=tineye_provider,
            browser_client=browser_broker,
            visual_classifier=visual_classifier,
            candidate_root=settings.data_dir / "runs",
            public_page_parser=public_page_parser,
        )
    else:
        background_tasks.add_task(
            execute_research_run,
            database,
            run.id,
            provider,
            browser_broker.notify_terminal,
            source_lookup_provider=tineye_provider,
            browser_client=browser_broker,
            visual_classifier=visual_classifier,
            candidate_root=settings.data_dir / "runs",
            public_page_parser=public_page_parser,
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
    run.status = RunStatus.created.value
    run.stop_reason = None
    run.finished_at = None
    run.attempt += 1
    session.commit()
    database: Database = request.app.state.database
    provider: ResearchProvider = request.app.state.research_provider
    tineye_provider: ReverseImageProvider | None = request.app.state.tineye_provider
    browser_broker: BrowserBroker = request.app.state.browser_broker
    visual_classifier: VisualClassifier = request.app.state.visual_classifier
    public_page_parser: PublicPageParser | None = request.app.state.public_page_parser
    if settings.run_inline:
        execute_research_run(
            database,
            run.id,
            provider,
            browser_broker.notify_terminal,
            source_lookup_provider=tineye_provider,
            browser_client=browser_broker,
            visual_classifier=visual_classifier,
            candidate_root=settings.data_dir / "runs",
            public_page_parser=public_page_parser,
        )
    else:
        background_tasks.add_task(
            execute_research_run,
            database,
            run.id,
            provider,
            browser_broker.notify_terminal,
            source_lookup_provider=tineye_provider,
            browser_client=browser_broker,
            visual_classifier=visual_classifier,
            candidate_root=settings.data_dir / "runs",
            public_page_parser=public_page_parser,
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
) -> SavedReference:
    asset, run = _asset_and_run_or_404(session, asset_id)
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
    else:
        saved.note = payload.note
    session.commit()
    session.refresh(saved)
    return saved


@router.delete("/results/{asset_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave_result(
    asset_id: str,
    session: Session = Depends(get_session),
) -> Response:
    _, run = _asset_and_run_or_404(session, asset_id)
    saved = session.scalar(
        select(SavedReference).where(
            SavedReference.workspace_id == run.workspace_id,
            SavedReference.asset_candidate_id == asset_id,
        )
    )
    if saved is not None:
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
                "source_url": asset.source_url,
                "image_url": asset.image_url,
                "rights_status": asset.rights_status,
                "embed_full_image": embed_full_image,
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
                "rights_gate": "deterministic",
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
        return f"/v1/results/{asset.id}/content"
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
) -> str:
    cards: list[str] = []
    for asset in assets:
        asset_type_label = EXPORT_ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type)
        rights_status_label = EXPORT_RIGHTS_STATUS_LABELS.get(
            asset.rights_status, asset.rights_status
        )
        source_url = _safe_export_http_url(asset.source_url)
        source_link = (
            f'<a href="{escape(source_url, quote=True)}" target="_blank" '
            'rel="noopener noreferrer">打开来源</a>'
            if source_url is not None
            else '<span class="muted">无可用来源链接</span>'
        )
        image_src = renderable_images.get(asset.id)
        if image_src is not None:
            visual = (
                '<div class="visual">'
                f'<img src="{escape(image_src, quote=True)}" '
                f'alt="{escape(asset.project_name, quote=True)}" loading="lazy">'
                "</div>"
            )
        else:
            reason = (
                "分享版未嵌入这张图片，请通过来源页面查看。"
                if mode == "share"
                else "当前结果没有可显示的图片，请通过来源页面查看。"
            )
            visual = f'<div class="source-only"><span>来源卡</span><p>{reason}</p></div>'
        cards.append(
            '<article class="card">'
            f"{visual}"
            '<div class="card-copy">'
            f'<p class="eyebrow">{escape(asset_type_label)}</p>'
            f"<h2>{escape(asset.project_name)}</h2>"
            f'<p class="rights">权利状态：{escape(rights_status_label)}</p>'
            f"{source_link}"
            "</div>"
            "</article>"
        )
    notes = escape(board.notes) if board.notes else "未添加画板备注。"
    mode_label = "本地私有版" if mode == "private" else "可分享来源版"
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ArchResearch 图纸参考板</title>
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
    h1 {{
      margin: 0;
      font-size: clamp(36px, 6vw, 72px);
      line-height: .98;
      letter-spacing: -.055em;
    }}
    .notes {{ max-width: 760px; margin: 0; color: #59615d; font-size: 16px; line-height: 1.7; }}
    .board {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }}
    .card {{
      overflow: hidden;
      border: 1px solid #d7dcd7;
      border-radius: 22px;
      background: rgba(255,255,255,.86);
      box-shadow: 0 18px 45px rgba(23,27,25,.07);
    }}
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
    .card-copy {{ display: grid; gap: 10px; padding: 22px; }}
    h2 {{ margin: 0; font-size: 23px; line-height: 1.2; }}
    .rights {{ margin: 0; color: #737b77; font-size: 13px; }}
    a {{ width: fit-content; color: #315cf4; font-weight: 700; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    .muted {{ color: #8b928e; }}
  </style>
</head>
<body>
  <main>
    <header>
      <p class="kicker">{mode_label} · {len(assets)} 项参考</p>
      <h1>图纸参考板</h1>
      <p class="notes">{notes}</p>
    </header>
    <section class="board" aria-label="图纸参考">{"".join(cards)}</section>
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


def _board_for_run_or_404(session: Session, run_id: str) -> ReferenceBoard:
    board = session.scalar(select(ReferenceBoard).where(ReferenceBoard.run_id == run_id))
    if board is None:
        raise HTTPException(status_code=404, detail="Reference board not found")
    return board
