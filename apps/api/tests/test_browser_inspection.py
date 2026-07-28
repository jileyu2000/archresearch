from __future__ import annotations

import asyncio
import base64
import json
import struct
import threading
import zlib
from collections.abc import Sequence
from io import BytesIO
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import delete, select

import archresearch_api.workflow as workflow_module
from archresearch_api.agent.planning import build_research_plan
from archresearch_api.agent.synthesis import (
    deterministic_research_synthesis,
    research_synthesis_case_identity,
)
from archresearch_api.browser import BrowserBroker
from archresearch_api.config import Settings
from archresearch_api.database import Database
from archresearch_api.inspection import InspectionBudget, inspect_local_images, inspect_source_page
from archresearch_api.main import create_app
from archresearch_api.models import (
    AssetCandidate,
    EvidenceClaim,
    QueryAttempt,
    ResearchRun,
    SourcePage,
    TraceEvent,
    Workspace,
)
from archresearch_api.providers import (
    ProviderAsset,
    ProviderSearchResult,
    ProviderSource,
    PublicPageAnalysis,
    PublicPageDrawing,
    PublicPageSupportedFact,
    ResearchSynthesis,
    ResearchSynthesisBranchAnalysis,
    ResearchSynthesisCase,
    ResearchSynthesisFinding,
)
from archresearch_api.public_pages import ParsedPageImage, ParsedPublicPage, PublicSearchLead
from archresearch_api.schemas import (
    AssociationStatus,
    BudgetMode,
    PrimarySourceStatus,
    PublicationTier,
    ResearchGoal,
    ResearchPlan,
    ResearchSubquestion,
    ResultTier,
    RightsStatus,
    RunStatus,
)
from archresearch_api.visual import (
    ArchitectureAssetType,
    RemoteVisualCandidate,
    RemoteVisualClassification,
    RemoteVisualClassificationBatch,
    VisualClassification,
)
from archresearch_api.workflow import (
    _persist_expanded_project_page,
    execute_research_run,
)


class SingleBatchProvider:
    name = "single"

    def __init__(self, result: ProviderSearchResult) -> None:
        self.result = result

    def search(
        self,
        query: str,
        goal: ResearchGoal,
        allowed_domains: list[str] | None = None,
    ) -> ProviderSearchResult:
        del query, goal, allowed_domains
        return self.result


class AnalyzingPageProvider(SingleBatchProvider):
    worst_case_page_analysis_seconds = 30.0

    def __init__(self, result: ProviderSearchResult) -> None:
        super().__init__(result)
        self.analysis_calls: list[list[PublicPageDrawing]] = []

    def analyze_public_page(
        self,
        *,
        question: str,
        source_url: str,
        title: str,
        page_text: str,
        drawings: list[PublicPageDrawing],
        analysis_requirements: Sequence[str],
    ) -> PublicPageAnalysis:
        del question, source_url, title, page_text, analysis_requirements
        self.analysis_calls.append(drawings)
        return PublicPageAnalysis(
            relevance=4,
            drawing_ids=[drawings[0].drawing_id],
            project_name_zh="服务入口示范馆",
            project_context="项目将服务入口设置在东侧。",
            design_mechanism="将后勤入口与公众入口分置在建筑两侧。",
            transfer_strategy=["在总平面先标出两类入口。", "用独立服务廊道连接后台。"],
            facts=[
                PublicPageSupportedFact(
                    statement="项目将服务入口设置在东侧。",
                    text_excerpt="The service entrance is located on the east side.",
                ),
                PublicPageSupportedFact(
                    statement="将后勤入口与公众入口分置在建筑两侧。",
                    text_excerpt="Visitors enter from the public courtyard.",
                ),
            ],
            limitations=["原项目消防条件仍需单独核对。"],
        )


class TextFirstPageProvider(SingleBatchProvider):
    worst_case_page_analysis_seconds = 30.0

    def __init__(self, result: ProviderSearchResult) -> None:
        super().__init__(result)
        self.analysis_calls: list[list[PublicPageDrawing]] = []

    def analyze_public_page(
        self,
        *,
        question: str,
        source_url: str,
        title: str,
        page_text: str,
        drawings: list[PublicPageDrawing],
        analysis_requirements: Sequence[str],
    ) -> PublicPageAnalysis:
        del question, source_url, title, page_text, analysis_requirements
        self.analysis_calls.append(drawings)
        return PublicPageAnalysis(
            relevance=4,
            drawing_ids=[],
            project_context="项目将旧厂房改造为社区文化中心。",
            design_mechanism="独立插入体在保留外壳内组织展览和工作坊。",
            transfer_strategy=["用独立结构承载新功能，并与保留外壳留出检修缝。"],
            facts=[
                PublicPageSupportedFact(
                    statement="项目将旧厂房改造为社区文化中心。",
                    text_excerpt=(
                        "The former factory was converted into a community cultural center."
                    ),
                ),
                PublicPageSupportedFact(
                    statement="独立插入体在保留外壳内组织展览和工作坊。",
                    text_excerpt=(
                        "Independent inserted volumes organize galleries and workshops "
                        "inside the retained shell."
                    ),
                ),
            ],
            limitations=["代表图片只用于定位项目，设计机制以正文引文为准。"],
        )


def _crop_png(pattern: int) -> bytes:
    rows = [
        [
            [0, 32, 64, 96, 128, 160, 192, 224, 255],
            [255, 224, 192, 160, 128, 96, 64, 32, 0],
            [0, 255, 0, 255, 0, 255, 0, 255, 0],
            [255, 0, 0, 255, 255, 0, 0, 255, 255],
            [0, 64, 128, 255, 128, 64, 0, 64, 128],
            [128, 64, 0, 64, 128, 255, 128, 64, 0],
        ][pattern]
        for _ in range(8)
    ]
    raw = b"".join(b"\x00" + bytes(row) for row in rows)

    def chunk(kind: bytes, data: bytes) -> bytes:
        payload = kind + data
        return (
            struct.pack(">I", len(data))
            + payload
            + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", 9, 8, 8, 0, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def _distinct_crop_png(seed: int) -> bytes:
    row = [128]
    for bit in range(8):
        row.append(row[-1] + (8 if seed & (1 << bit) else -8))
    raw = b"".join(b"\x00" + bytes(row) for _ in range(8))

    def chunk(kind: bytes, data: bytes) -> bytes:
        payload = kind + data
        return (
            struct.pack(">I", len(data))
            + payload
            + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", 9, 8, 8, 0, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


class RecordingBrowser:
    def __init__(self, *, fail_action: str | None = None) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.fail_action = fail_action

    def bind_loop(self) -> None:
        pass

    def notify_terminal(self, state: str) -> None:
        del state

    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        del timeout_seconds
        self.calls.append((action, payload))
        if action == self.fail_action:
            raise TimeoutError("browser timed out")
        if action == "open_url":
            return {"tab_id": 41, "url": payload["url"]}
        if action == "wait":
            return {"waited_ms": payload["milliseconds"]}
        if action == "scroll":
            return {"scrolled": True}
        if action == "page_metadata":
            return {
                "url": "https://studio.example/project",
                "title": "Project title " + "P" * 2_000,
                "description": "Description " + "D" * 4_000,
                "publisher": "Studio",
            }
        if action == "page_snapshot":
            return {
                "blocks": [
                    {"kind": "heading", "text": "Retained hall and inserted stair"},
                    {"kind": "caption", "text": "Section through the public route"},
                ],
                "truncated": False,
            }
        if action == "enumerate_media":
            return {
                "media": [
                    {
                        "media_type": "image",
                        "url": f"https://images.example/drawing-{index}.png",
                        "alt": "Longitudinal section " + "C" * 2_000,
                        "adjacent_text": "Section through the old hall",
                        "intrinsic_width": 1_600,
                        "intrinsic_height": 1_000,
                        "region": {
                            "x": index * 10,
                            "y": index * 20,
                            "width": 800,
                            "height": 500,
                        },
                    }
                    for index in range(7)
                ]
            }
        if action == "capture_region":
            pattern = int(payload["region"]["x"] // 10)
            encoded = base64.b64encode(_crop_png(pattern)).decode()
            return {"image_data_url": f"data:image/png;base64,{encoded}", "media_type": "image/png"}
        if action == "close_tab":
            return {"closed": True}
        raise AssertionError(f"unexpected action: {action}")


class RecordingClassifier:
    name = "recording-vision"

    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []

    def classify(
        self,
        image_data_url: str,
        *,
        question: str,
        caption: str,
        project_text: str,
    ) -> VisualClassification:
        self.calls.append(
            {
                "image_data_url": image_data_url,
                "question": question,
                "caption": caption,
                "project_text": project_text,
            }
        )
        return VisualClassification(
            asset_type=ArchitectureAssetType.section,
            relevance=4,
            observations=["可见剖切构件与多层空间关系。"],
        )


class LazyLoadingBrowser(RecordingBrowser):
    def __init__(self) -> None:
        super().__init__()
        self.scroll_count = 0

    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        if action == "scroll":
            self.calls.append((action, payload))
            self.scroll_count += 1
            return {"scrolled": True}
        if action == "enumerate_media":
            self.calls.append((action, payload))
            media = [
                {
                    "media_type": "image",
                    "url": "https://images.example/plan.png",
                    "alt": "Ground floor plan",
                    "adjacent_text": "Existing plan",
                    "intrinsic_width": 1_200,
                    "intrinsic_height": 675,
                    "region": {"x": 10, "y": 20, "width": 640, "height": 360},
                }
            ]
            if self.scroll_count:
                media.append(
                    {
                        "media_type": "image",
                        "url": "https://images.example/lazy-section.png",
                        "alt": "Section loaded after scrolling",
                        "adjacent_text": "Inserted public stair",
                        "intrinsic_width": 1_200,
                        "intrinsic_height": 675,
                        "region": {"x": 20, "y": 80, "width": 640, "height": 360},
                    }
                )
            return {"media": media}
        return super().send_command_sync(
            action,
            payload,
            timeout_seconds=timeout_seconds,
        )


class RecordingRemoteClassifier(RecordingClassifier):
    worst_case_remote_batch_seconds = 30.0

    def __init__(self) -> None:
        super().__init__()
        self.remote_calls: list[list[RemoteVisualCandidate]] = []

    def classify_remote_batch(
        self,
        candidates: list[RemoteVisualCandidate],
        *,
        question: str,
        project_text: str,
    ) -> RemoteVisualClassificationBatch:
        del question, project_text
        self.remote_calls.append(candidates)
        return RemoteVisualClassificationBatch(
            classifications=[
                RemoteVisualClassification(
                    candidate_id=candidates[0].candidate_id,
                    asset_type=ArchitectureAssetType.section,
                    relevance=4,
                    observations=["可见错层楼板、贯通楼梯和挑空空间。"],
                ),
                RemoteVisualClassification(
                    candidate_id=candidates[1].candidate_id,
                    asset_type=None,
                    relevance=0,
                    observations=[],
                ),
            ]
        )


def test_local_carousel_images_use_one_bounded_visual_batch(tmp_path: Path) -> None:
    image_paths: list[Path] = []
    for index in range(6):
        path = tmp_path / f"download-{index + 1}.png"
        path.write_bytes(_crop_png(index))
        image_paths.append(path)
    classifier = RecordingRemoteClassifier()
    budget = InspectionBudget(max_calls=12, max_bytes=24 * 1024 * 1024)

    inspected = inspect_local_images(
        classifier,
        run_id="run-local",
        source_url="https://www.xiaohongshu.com/search_result/note-42",
        image_paths=image_paths,
        question="旧建筑改造的剖面空间层次",
        caption="工业遗址改造分析图",
        candidate_root=tmp_path / "runs",
        budget=budget,
    )

    assert len(classifier.remote_calls) == 1
    assert len(classifier.remote_calls[0]) == 4
    assert all(
        candidate.image_url.startswith("data:image/jpeg;base64,")
        for candidate in classifier.remote_calls[0]
    )
    assert budget.used_calls == 4
    assert len(inspected) == 1
    assert inspected[0].asset_type is ArchitectureAssetType.section
    assert inspected[0].image_url is None
    assert inspected[0].storage_path is not None
    assert inspected[0].storage_path.is_file()
    assert inspected[0].storage_path.suffix == ".png"


def test_workflow_uses_opencli_xiaohongshu_multi_image_path_without_extension(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.research_sources = ["xiaohongshu"]
        session.commit()

    class FakeOpenCliXiaohongshu:
        name = "fake-opencli-xiaohongshu"

        def __init__(self) -> None:
            self.searches: list[str] = []
            self.downloads: list[str] = []

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            self.searches.append(query)
            assert limit == 4
            return [
                ProviderSource(
                    url="https://www.xiaohongshu.com/search_result/note-42?xsec_token=test",
                    publisher="小红书 · 林中空地",
                    title="工业遗址改造剖面分析图",
                    publication_tier=PublicationTier.aggregator,
                )
            ]

        def download(self, note_url: str, output_dir: Path, *, limit: int = 4) -> list[Path]:
            self.downloads.append(note_url)
            output_dir.mkdir(parents=True, exist_ok=True)
            paths: list[Path] = []
            for index in range(6):
                path = output_dir / f"note-{index + 1}.png"
                path.write_bytes(_crop_png(index))
                paths.append(path)
            return [paths[0], paths[2], paths[3], paths[5]][:limit]

    xiaohongshu = FakeOpenCliXiaohongshu()
    classifier = RecordingRemoteClassifier()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(ProviderSearchResult(assets=[], sources=[])),
        visual_classifier=classifier,
        candidate_root=tmp_path / "runs",
        xiaohongshu_search=xiaohongshu,
    )

    assert len(xiaohongshu.searches) == 1
    assert len(xiaohongshu.downloads) == 1
    assert len(classifier.remote_calls) == 1
    with database.session_factory() as session:
        page = session.scalar(select(SourcePage).where(SourcePage.run_id == run_id))
        asset = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        traces = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))
    assert page is not None
    assert page.publisher == "小红书 · 林中空地"
    assert asset is not None
    assert asset.result_tier == ResultTier.visual_lead.value
    assert asset.project_name == "工业遗址改造剖面分析图"
    assert asset.storage_path is not None
    assert Path(asset.storage_path).is_file()
    assert "xsec_token" not in json.dumps(
        [trace.summary for trace in traces],
        ensure_ascii=False,
    )


def test_visual_reference_search_completes_from_one_bounded_xiaohongshu_note_per_branch(
    tmp_path: Path,
) -> None:
    branch_count = 3
    target_assets = 4
    database, run_id = _database_with_run(
        tmp_path,
        max_pages=branch_count,
        budget_mode=BudgetMode.quick,
    )
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.question = "帮我找几种建筑图纸视觉风格"
        run.goal = ResearchGoal.visual_reference_search.value
        run.research_sources = ["xiaohongshu"]
        run.budget = {
            "max_rounds": 2,
            "max_queries": branch_count * 2,
            "max_pages": branch_count,
            "max_seconds": 240,
        }
        session.commit()

    class BranchXiaohongshu:
        name = "branch-opencli-xiaohongshu"

        def __init__(self) -> None:
            self.searches: list[str] = []
            self.downloads: list[str] = []

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            self.searches.append(query)
            assert limit == 4
            note_index = len(self.searches)
            return [
                ProviderSource(
                    url=(f"https://www.xiaohongshu.com/explore/visual-note-{note_index}-{rank}"),
                    publisher=f"小红书 · 制图参考 {note_index}-{rank}",
                    title=f"建筑图纸表达 {note_index}-{rank}",
                    publication_tier=PublicationTier.aggregator,
                )
                for rank in (1, 2)
            ]

        def download(self, note_url: str, output_dir: Path, *, limit: int = 4) -> list[Path]:
            self.downloads.append(note_url)
            output_dir.mkdir(parents=True, exist_ok=True)
            batch_index = len(self.downloads) - 1
            paths: list[Path] = []
            for index in range(4):
                path = output_dir / f"visual-{index + 1}.png"
                path.write_bytes(_distinct_crop_png(batch_index * 4 + index + 1))
                paths.append(path)
            return paths[:limit]

    xiaohongshu = BranchXiaohongshu()

    class RankedFallbackClassifier(RecordingRemoteClassifier):
        def classify_remote_batch(
            self,
            candidates: list[RemoteVisualCandidate],
            *,
            question: str,
            project_text: str,
        ) -> RemoteVisualClassificationBatch:
            del question, project_text
            self.remote_calls.append(candidates)
            accepted = len(self.remote_calls) % 2 == 0
            return RemoteVisualClassificationBatch(
                classifications=[
                    RemoteVisualClassification(
                        candidate_id=candidate.candidate_id,
                        asset_type=(ArchitectureAssetType.analysis_diagram if accepted else None),
                        relevance=4 if accepted else 0,
                        observations=["可见明确的建筑图纸表达。"] if accepted else [],
                    )
                    for candidate in candidates
                ]
            )

    classifier = RankedFallbackClassifier()

    class RecordingSearchProvider(SingleBatchProvider):
        def __init__(self) -> None:
            super().__init__(_provider_result("https://studio.example/unrelated-visual"))
            self.searches: list[str] = []

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            self.searches.append(query)
            return super().search(query, goal, allowed_domains)

    provider = RecordingSearchProvider()

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        candidate_root=tmp_path / "visual-candidates",
        xiaohongshu_search=xiaohongshu,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        traces = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))

    assert run is not None
    assert run.status == RunStatus.completed.value
    assert run.stop_reason == "coverage_satisfied"
    assert run.coverage_report["covered_subquestions"] == branch_count
    assert run.coverage_report["gaps"] == []
    assert run.coverage_report["enrichment_gaps"] == []
    assert provider.searches == []
    assert len(xiaohongshu.searches) == branch_count
    assert len(xiaohongshu.downloads) == branch_count * 2
    assert len(classifier.remote_calls) == branch_count * 2
    assert all(len(batch) == 4 for batch in classifier.remote_calls)
    assert len(assets) >= target_assets
    assert {asset.result_tier for asset in assets} == {ResultTier.visual_lead.value}
    assert {asset.publication_tier for asset in assets} == {PublicationTier.aggregator.value}
    assert {asset.rights_status for asset in assets} == {RightsStatus.unknown.value}
    assert sum(trace.tool == "xiaohongshu_assets" for trace in traces) == branch_count * 2


def test_visual_plan_fallback_keeps_the_explicitly_requested_drawing_type() -> None:
    class FailingPlanningProvider(SingleBatchProvider):
        name = "failing-planner"

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            workspace_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, workspace_context
            raise RuntimeError("planner unavailable")

    plan, planner, error_type = build_research_plan(
        FailingPlanningProvider(ProviderSearchResult(assets=[], sources=[])),
        question="我想出一张轴测图，帮我找风格",
        goal=ResearchGoal.visual_reference_search,
        budget_mode=BudgetMode.quick,
        research_context="",
        existing_subquestions=[],
    )

    assert planner == "deterministic_fallback"
    assert error_type == "RuntimeError"
    assert [item.question for item in plan.subquestions] == [
        "精细线稿轴测图",
        "拼贴叙事轴测图",
        "材质渲染轴测图",
    ]


def test_visual_reference_search_only_persists_the_requested_drawing_type(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.question = "我想出一张轴测图，帮我找风格"
        run.goal = ResearchGoal.visual_reference_search.value
        run.research_sources = ["xiaohongshu"]
        run.budget = {
            "max_rounds": 1,
            "max_queries": 3,
            "max_pages": 3,
            "max_seconds": 240,
        }
        session.commit()

    plan = ResearchPlan(
        subquestions=[
            ResearchSubquestion(
                id="linework",
                question="精细线稿轴测图",
                rationale="比较线宽与留白。",
            ),
            ResearchSubquestion(
                id="collage",
                question="拼贴叙事轴测图",
                rationale="比较色块与材质。",
            ),
            ResearchSubquestion(
                id="rendered",
                question="材质渲染轴测图",
                rationale="比较光影与纹理。",
            ),
        ]
    )

    class AxisStyleProvider(SingleBatchProvider):
        name = "axis-style-provider"

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            workspace_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, workspace_context
            return plan

    class AxisStyleXiaohongshu:
        name = "axis-style-xiaohongshu"

        def __init__(self) -> None:
            self.searches: list[str] = []
            self.downloads: list[str] = []

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            self.searches.append(query)
            assert limit == 4
            index = len(self.searches)
            return [
                ProviderSource(
                    url=f"https://www.xiaohongshu.com/search_result/axis-note-{index}",
                    publisher=f"小红书 · 轴测风格 {index}",
                    title=f"轴测风格参考 {index}",
                    publication_tier=PublicationTier.aggregator,
                )
            ]

        def download(self, note_url: str, output_dir: Path, *, limit: int = 4) -> list[Path]:
            self.downloads.append(note_url)
            output_dir.mkdir(parents=True, exist_ok=True)
            batch = len(self.downloads) - 1
            paths = []
            for index in range(4):
                path = output_dir / f"axis-{index + 1}.png"
                path.write_bytes(_distinct_crop_png(batch * 4 + index + 1))
                paths.append(path)
            return paths[:limit]

    class MixedDrawingClassifier(RecordingRemoteClassifier):
        def classify_remote_batch(
            self,
            candidates: list[RemoteVisualCandidate],
            *,
            question: str,
            project_text: str,
        ) -> RemoteVisualClassificationBatch:
            del question, project_text
            self.remote_calls.append(candidates)
            types = (
                ArchitectureAssetType.axonometric,
                ArchitectureAssetType.analysis_diagram,
                ArchitectureAssetType.site_plan,
                ArchitectureAssetType.axonometric,
            )
            return RemoteVisualClassificationBatch(
                classifications=[
                    RemoteVisualClassification(
                        candidate_id=candidate.candidate_id,
                        asset_type=types[index],
                        relevance=4,
                        observations=["可见明确的建筑图纸表达。"],
                    )
                    for index, candidate in enumerate(candidates)
                ]
            )

    xiaohongshu = AxisStyleXiaohongshu()
    classifier = MixedDrawingClassifier()
    execute_research_run(
        database,
        run_id,
        AxisStyleProvider(ProviderSearchResult(assets=[], sources=[])),
        visual_classifier=classifier,
        candidate_root=tmp_path / "visual-candidates",
        xiaohongshu_search=xiaohongshu,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        traces = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))

    assert run is not None
    assert run.status == RunStatus.completed.value
    assert run.coverage_report["covered_subquestions"] == 3
    assert len(xiaohongshu.downloads) == 3
    assert len(assets) == 6
    assert {asset.asset_type for asset in assets} == {ArchitectureAssetType.axonometric.value}
    assert {asset_id for asset in assets for asset_id in asset.subquestion_ids} == {
        "linework",
        "collage",
        "rendered",
    }
    asset_traces = [trace for trace in traces if trace.tool == "xiaohongshu_assets"]
    assert [trace.summary["type_mismatch_count"] for trace in asset_traces] == [2, 2, 2]


def test_xiaohongshu_accumulates_three_usable_ranked_notes_before_extension_fallback(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=4)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.goal = ResearchGoal.visual_reference_search.value
        run.research_sources = ["xiaohongshu"]
        session.commit()

    note_urls = [
        f"https://www.xiaohongshu.com/explore/ranked-note-{index}" for index in range(1, 5)
    ]

    class TwoNoteXiaohongshu:
        name = "two-note-opencli-xiaohongshu"

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            del query
            assert limit == 4
            return [
                ProviderSource(
                    url=note_url,
                    publisher=f"小红书 · 排名 {index}",
                    title=f"建筑图纸帖子 {index}",
                    publication_tier=PublicationTier.aggregator,
                )
                for index, note_url in enumerate(note_urls, start=1)
            ]

        def download(self, note_url: str, output_dir: Path, *, limit: int = 4) -> list[Path]:
            assert note_url in note_urls[:3]
            note_index = note_urls.index(note_url)
            output_dir.mkdir(parents=True, exist_ok=True)
            paths: list[Path] = []
            for index in range(4):
                path = output_dir / f"ranked-{note_index + 1}-{index + 1}.png"
                path.write_bytes(_distinct_crop_png(note_index * 4 + index + 1))
                paths.append(path)
            return paths[:limit]

    browser = RecordingBrowser()
    classifier = RecordingRemoteClassifier()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(ProviderSearchResult(assets=[], sources=[])),
        browser_client=browser,
        visual_classifier=classifier,
        candidate_root=tmp_path / "selected-candidates",
        xiaohongshu_search=TwoNoteXiaohongshu(),
    )

    with database.session_factory() as session:
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )

    assert not any(action == "open_url" for action, _ in browser.calls)
    assert {asset.source_url for asset in assets} == set(note_urls[:3])
    assert len(classifier.remote_calls) == 3
    assert all(len(batch) == 4 for batch in classifier.remote_calls)


def test_visual_reference_budget_reaches_third_direction_after_four_notes_each(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=12)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.question = "我想出一张轴测图，帮我找风格"
        run.goal = ResearchGoal.visual_reference_search.value
        run.research_sources = ["xiaohongshu"]
        run.budget = {
            "max_rounds": 1,
            "max_queries": 3,
            "max_pages": 12,
            "max_seconds": 240,
        }
        session.commit()

    plan = ResearchPlan(
        subquestions=[
            ResearchSubquestion(
                id="linework",
                question="精细线稿轴测图",
                rationale="比较线宽与留白。",
            ),
            ResearchSubquestion(
                id="collage",
                question="拼贴叙事轴测图",
                rationale="比较色块与材质。",
            ),
            ResearchSubquestion(
                id="rendered",
                question="材质渲染轴测图",
                rationale="比较光影与纹理。",
            ),
        ]
    )

    class ThreeDirectionProvider(SingleBatchProvider):
        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            workspace_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, workspace_context
            return plan

    class WorstCaseXiaohongshu:
        name = "worst-case-opencli-xiaohongshu"

        def __init__(self) -> None:
            self.searches: list[str] = []
            self.downloads: list[str] = []

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            self.searches.append(query)
            assert limit == 4
            branch = len(self.searches)
            return [
                ProviderSource(
                    url=f"https://www.xiaohongshu.com/explore/branch-{branch}-note-{rank}",
                    publisher=f"小红书 · 极限参考 {branch}-{rank}",
                    title=f"轴测图参考 {branch}-{rank}",
                    publication_tier=PublicationTier.aggregator,
                )
                for rank in range(1, 5)
            ]

        def download(self, note_url: str, output_dir: Path, *, limit: int = 4) -> list[Path]:
            self.downloads.append(note_url)
            slug = note_url.rsplit("/", 1)[-1].split("-")
            branch, rank = int(slug[1]), int(slug[3])
            output_dir.mkdir(parents=True, exist_ok=True)
            paths: list[Path] = []
            for index in range(4):
                path = output_dir / f"axis-{index + 1}.png"
                seed = ((branch - 1) * 4 + rank - 1) * 4 + index + 1
                path.write_bytes(_distinct_crop_png(seed))
                paths.append(path)
            return paths[:limit]

    class FirstNoteMismatchClassifier(RecordingRemoteClassifier):
        def classify_remote_batch(
            self,
            candidates: list[RemoteVisualCandidate],
            *,
            question: str,
            project_text: str,
        ) -> RemoteVisualClassificationBatch:
            del question, project_text
            self.remote_calls.append(candidates)
            note_rank = (len(self.remote_calls) - 1) % 4 + 1
            asset_type = (
                ArchitectureAssetType.analysis_diagram
                if note_rank == 1
                else ArchitectureAssetType.axonometric
            )
            return RemoteVisualClassificationBatch(
                classifications=[
                    RemoteVisualClassification(
                        candidate_id=candidate.candidate_id,
                        asset_type=asset_type,
                        relevance=4,
                        observations=["可见明确的建筑图纸表达。"],
                    )
                    for candidate in candidates
                ]
            )

    xiaohongshu = WorstCaseXiaohongshu()
    classifier = FirstNoteMismatchClassifier()
    execute_research_run(
        database,
        run_id,
        ThreeDirectionProvider(ProviderSearchResult(assets=[], sources=[])),
        visual_classifier=classifier,
        candidate_root=tmp_path / "visual-candidates",
        xiaohongshu_search=xiaohongshu,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )

    assert run is not None
    assert run.visual_calls_used == 48
    assert len(xiaohongshu.searches) == 3
    assert len(xiaohongshu.downloads) == 12
    assert len(classifier.remote_calls) == 12
    assert run.status == RunStatus.completed.value
    assert run.stop_reason == "coverage_satisfied"
    assert run.coverage_report["covered_subquestions"] == 3
    assert len(assets) == 36
    assert {asset.asset_type for asset in assets} == {ArchitectureAssetType.axonometric.value}
    assert {asset_id for asset in assets for asset_id in asset.subquestion_ids} == {
        "linework",
        "collage",
        "rendered",
    }


def test_visual_reference_exhausted_slots_use_visual_budget_stop_reason(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.question = "我想出一张轴测图，帮我找风格"
        run.goal = ResearchGoal.visual_reference_search.value
        run.research_sources = ["xiaohongshu"]
        run.visual_calls_used = 48
        run.budget = {
            "max_rounds": 2,
            "max_queries": 2,
            "max_pages": 1,
            "max_seconds": 240,
        }
        session.commit()

    plan = ResearchPlan(
        subquestions=[
            ResearchSubquestion(
                id="linework",
                question="精细线稿轴测图",
                rationale="比较线宽与留白。",
            ),
            ResearchSubquestion(
                id="collage",
                question="拼贴叙事轴测图",
                rationale="比较色块与材质。",
            ),
            ResearchSubquestion(
                id="rendered",
                question="材质渲染轴测图",
                rationale="比较光影与纹理。",
            ),
        ]
    )

    class OneDirectionProvider(SingleBatchProvider):
        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            workspace_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, workspace_context
            return plan

    class EmptyXiaohongshu:
        name = "empty-opencli-xiaohongshu"

        def __init__(self) -> None:
            self.searches = 0

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            del query, limit
            self.searches += 1
            return []

    xiaohongshu = EmptyXiaohongshu()
    execute_research_run(
        database,
        run_id,
        OneDirectionProvider(ProviderSearchResult(assets=[], sources=[])),
        xiaohongshu_search=xiaohongshu,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)

    assert run is not None
    assert run.stop_reason == "visual_budget_exhausted"
    assert run.visual_calls_used == 48
    assert xiaohongshu.searches == 0


def test_xiaohongshu_extension_inspection_accumulates_until_fixed_visual_budget(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=12)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.goal = ResearchGoal.visual_reference_search.value
        run.research_sources = ["xiaohongshu"]
        run.budget = {
            "max_rounds": 1,
            "max_queries": 3,
            "max_pages": 12,
            "max_seconds": 240,
        }
        session.commit()

    class SearchOnlyXiaohongshu:
        name = "search-only-xiaohongshu"

        def __init__(self) -> None:
            self.searches: list[str] = []

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            self.searches.append(query)
            assert limit == 4
            branch = len(self.searches)
            return [
                ProviderSource(
                    url=f"https://www.xiaohongshu.com/explore/branch-{branch}-{rank}",
                    publisher=f"小红书 · 扩展参考 {branch}-{rank}",
                    title=f"扩展图纸参考 {branch}-{rank}",
                    publication_tier=PublicationTier.aggregator,
                )
                for rank in range(1, 5)
            ]

    xiaohongshu = SearchOnlyXiaohongshu()

    class DistinctNoteBrowser(RecordingBrowser):
        def __init__(self) -> None:
            super().__init__()
            self.note_seed = 0
            self.current_url = ""

        def send_command_sync(
            self,
            action: str,
            payload: dict[str, Any],
            *,
            timeout_seconds: float = 30,
        ) -> Any:
            if action == "open_url":
                slug = payload["url"].rsplit("/", 1)[-1]
                branch, rank = (int(value) for value in slug.rsplit("-", 2)[-2:])
                self.note_seed = ((branch - 1) * 4 + rank - 1) * 6
                self.current_url = payload["url"]
            if action == "page_metadata":
                self.calls.append((action, payload))
                return {
                    "url": self.current_url,
                    "title": "Xiaohongshu drawing note",
                    "description": "Architectural drawing reference",
                    "publisher": "小红书",
                }
            if action == "enumerate_media":
                response = super().send_command_sync(
                    action,
                    payload,
                    timeout_seconds=timeout_seconds,
                )
                note_slug = self.current_url.rsplit("/", 1)[-1]
                for index, media in enumerate(response["media"], start=1):
                    media["url"] = f"https://images.example/{note_slug}-{index}.png"
                return response
            if action == "capture_region":
                self.calls.append((action, payload))
                pattern = int(payload["region"]["x"] // 10)
                encoded = base64.b64encode(
                    _distinct_crop_png(self.note_seed + pattern + 1)
                ).decode()
                return {
                    "image_data_url": f"data:image/png;base64,{encoded}",
                    "media_type": "image/png",
                }
            return super().send_command_sync(
                action,
                payload,
                timeout_seconds=timeout_seconds,
            )

    browser = DistinctNoteBrowser()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/must-not-run")),
        browser_client=browser,
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "extension-candidates",
        xiaohongshu_search=xiaohongshu,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )

    opened_notes = [
        payload["url"]
        for action, payload in browser.calls
        if action == "open_url" and "xiaohongshu.com" in payload["url"]
    ]
    assert run is not None
    assert len(xiaohongshu.searches) == 3
    assert opened_notes == [
        "https://www.xiaohongshu.com/explore/branch-1-1",
        "https://www.xiaohongshu.com/explore/branch-1-2",
        "https://www.xiaohongshu.com/explore/branch-1-3",
        "https://www.xiaohongshu.com/explore/branch-2-1",
        "https://www.xiaohongshu.com/explore/branch-2-2",
        "https://www.xiaohongshu.com/explore/branch-2-3",
        "https://www.xiaohongshu.com/explore/branch-3-1",
        "https://www.xiaohongshu.com/explore/branch-3-2",
    ]
    assert run.status == RunStatus.partial.value, (
        run.stop_reason,
        run.coverage_report,
    )
    assert run.stop_reason == "visual_budget_exhausted"
    assert run.visual_calls_used == 48
    assert assets
    assert {asset.publication_tier for asset in assets} == {PublicationTier.aggregator.value}
    assert {asset.result_tier for asset in assets} == {ResultTier.visual_lead.value}


@pytest.mark.parametrize("search_surface", ["local", "model"])
def test_xiaohongshu_only_visual_failure_does_not_fall_back_to_generic_search(
    tmp_path: Path,
    search_surface: str,
) -> None:
    case_root = tmp_path / search_surface
    case_root.mkdir()
    database, run_id = _database_with_run(case_root, max_pages=4)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.question = "我想出一张轴测图，帮我找风格"
        run.goal = ResearchGoal.visual_reference_search.value
        run.research_sources = ["xiaohongshu"]
        run.budget = {
            "max_rounds": 1,
            "max_queries": 3,
            "max_pages": 4,
            "max_seconds": 240,
        }
        session.commit()

    class FailingXiaohongshu:
        name = "failing-opencli-xiaohongshu"

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            del query, limit
            raise RuntimeError("offline xiaohongshu failure")

    class RecordingGenericProvider(SingleBatchProvider):
        def __init__(self) -> None:
            super().__init__(_provider_result("https://studio.example/must-not-run"))
            self.calls = 0

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            self.calls += 1
            return super().search(query, goal, allowed_domains)

    provider = RecordingGenericProvider()
    public_parser = RecordingPublicSearchParser([]) if search_surface == "local" else None

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=RecordingClassifier(),
        candidate_root=case_root / "candidates",
        public_page_parser=public_parser,
        xiaohongshu_search=FailingXiaohongshu(),
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        sources = list(session.scalars(select(SourcePage).where(SourcePage.run_id == run_id)))

    assert provider.calls == 0
    if public_parser is not None:
        assert public_parser.queries == []
    assert assets == []
    assert sources == []
    assert run is not None
    assert run.status == RunStatus.blocked.value
    assert run.stop_reason == "no_usable_assets"
    assert "browser_inspection_incomplete" in run.coverage_report["gaps"]


class SingleLargeCropBrowser(RecordingBrowser):
    def __init__(self) -> None:
        super().__init__()
        image = Image.new("RGB", (2_400, 1_200), "#f4f0e8")
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        self.original_crop = buffer.getvalue()

    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        if action == "enumerate_media":
            response = super().send_command_sync(
                action,
                payload,
                timeout_seconds=timeout_seconds,
            )
            response["media"] = response["media"][:1]
            return response
        if action == "capture_region":
            self.calls.append((action, payload))
            encoded = base64.b64encode(self.original_crop).decode()
            return {
                "image_data_url": f"data:image/png;base64,{encoded}",
                "media_type": "image/png",
            }
        return super().send_command_sync(
            action,
            payload,
            timeout_seconds=timeout_seconds,
        )


def _database_with_run(
    tmp_path: Path,
    *,
    max_pages: int = 1,
    budget_mode: BudgetMode = BudgetMode.quick,
) -> tuple[Database, str]:
    database = Database(f"sqlite:///{(tmp_path / 'browser.db').as_posix()}")
    database.create_all()
    with database.session_factory() as session:
        workspace = Workspace(name="浏览器研究")
        session.add(workspace)
        session.flush()
        run = ResearchRun(
            workspace_id=workspace.id,
            question="旧建筑中如何形成有层次的剖面？",
            goal=ResearchGoal.precedent_research.value,
            budget_mode=budget_mode.value,
            budget={
                "max_rounds": 1,
                "max_queries": 1,
                "max_pages": max_pages,
                "max_seconds": 240,
            },
            allowed_domains=[],
            status=RunStatus.created.value,
            coverage_report={},
        )
        session.add(run)
        session.commit()
        return database, run.id


def _provider_result(*source_urls: str) -> ProviderSearchResult:
    first_url = source_urls[0]
    return ProviderSearchResult(
        assets=[
            ProviderAsset(
                project_name="已检索项目",
                asset_type="plan",
                source_url=first_url,
                image_url="https://images.example/web-result.png",
                publication_tier=PublicationTier.primary,
                project_identity=AssociationStatus.confirmed,
                asset_association=AssociationStatus.confirmed,
                primary_source=PrimarySourceStatus.confirmed,
                rights_status=RightsStatus.unknown,
                result_tier=ResultTier.partial,
                relevance=4,
                facts=["项目页发布了该图纸。"],
            )
        ],
        sources=[
            ProviderSource(
                url=url,
                publisher="Studio",
                title=f"Project {index}",
                publication_tier=PublicationTier.primary,
            )
            for index, url in enumerate(source_urls, start=1)
        ],
    )


def test_workflow_inspects_pages_with_read_only_actions_and_persists_six_visual_leads(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    browser = RecordingBrowser()
    classifier = RecordingClassifier()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/project")),
        browser_client=browser,
        visual_classifier=classifier,
        candidate_root=tmp_path / "candidates",
    )

    actions = [action for action, _ in browser.calls]
    assert actions == [
        "open_url",
        "wait",
        "page_metadata",
        "page_snapshot",
        "enumerate_media",
        "capture_region",
        "capture_region",
        "capture_region",
        "capture_region",
        "capture_region",
        "capture_region",
        "close_tab",
    ]
    assert not ({"safe_click", "type_search_query"} & set(actions))
    assert len(classifier.calls) == 6
    assert all(len(call["caption"]) <= 500 for call in classifier.calls)
    assert all(len(call["project_text"]) <= 1_200 for call in classifier.calls)
    assert all("Retained hall" in call["project_text"] for call in classifier.calls)
    assert all(len(call["question"]) <= 1_000 for call in classifier.calls)

    with database.session_factory() as session:
        assets = list(
            session.scalars(
                select(AssetCandidate)
                .where(AssetCandidate.run_id == run_id)
                .order_by(AssetCandidate.created_at)
            )
        )
        browser_assets = [asset for asset in assets if asset.project_name == "待核验项目"]
        trace_events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))

    assert len(assets) == 7
    assert len(browser_assets) == 6
    assert all(asset.asset_type == ArchitectureAssetType.section.value for asset in browser_assets)
    assert all(asset.result_tier == ResultTier.visual_lead.value for asset in browser_assets)
    assert all(
        asset.project_identity == AssociationStatus.unknown.value for asset in browser_assets
    )
    assert all(
        asset.asset_association == AssociationStatus.unknown.value for asset in browser_assets
    )
    assert all(asset.facts == [] and asset.inferences == [] for asset in browser_assets)
    assert all(asset.observations == ["可见剖切构件与多层空间关系。"] for asset in browser_assets)
    assert all(
        asset.storage_path and Path(asset.storage_path).is_file() for asset in browser_assets
    )
    assert all(
        asset.perceptual_hash
        and len(asset.perceptual_hash) == 16
        and set(asset.perceptual_hash) <= set("0123456789abcdef")
        for asset in browser_assets
    )
    serialized_trace = json.dumps([event.summary for event in trace_events], ensure_ascii=False)
    assert "data:image" not in serialized_trace
    assert "ZmFr" not in serialized_trace


def test_inspection_scrolls_a_bounded_number_of_times_and_captures_lazy_media(
    tmp_path: Path,
) -> None:
    browser = LazyLoadingBrowser()
    classifier = RecordingClassifier()

    inspected = inspect_source_page(
        browser,
        classifier,
        run_id="lazy-run",
        source_url="https://studio.example/lazy-project",
        question="剖面中如何植入公共流线？",
        candidate_root=tmp_path,
    )

    assert [item.image_url for item in inspected] == [
        "https://images.example/plan.png",
        "https://images.example/lazy-section.png",
    ]
    actions = [action for action, _ in browser.calls]
    assert actions.count("scroll") == 2
    assert actions.count("enumerate_media") == 3
    assert actions.count("capture_region") == 2
    assert len(classifier.calls) == 2


def test_browser_failure_closes_the_tab_and_preserves_web_results(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path)
    browser = RecordingBrowser(fail_action="enumerate_media")

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/project")),
        browser_client=browser,
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
    )

    assert [action for action, _ in browser.calls][-1] == "close_tab"
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
    assert run is not None
    assert run.status == RunStatus.blocked.value
    assert run.stop_reason == "browser_inspection_incomplete"
    assert run.coverage_report["gaps"] == ["browser_inspection_incomplete"]
    assert len(assets) == 1
    assert assets[0].project_name == "已检索项目"


def test_direct_page_parse_makes_optional_browser_crop_failure_non_blocking(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    browser = RecordingBrowser(fail_action="enumerate_media")

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/project")),
        browser_client=browser,
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
        public_page_parser=RecordingPublicPageParser([]),
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)

    assert run is not None
    assert "browser_inspection_incomplete" not in run.coverage_report["gaps"]
    assert run.stop_reason != "browser_inspection_incomplete"


def test_one_unreadable_page_does_not_override_another_successful_direct_parse(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=2)
    browser = RecordingBrowser(fail_action="enumerate_media")
    readable_url = "https://studio.example/readable"
    unreadable_url = "https://studio.example/unreadable"

    class PartiallyFailingParser(RecordingPublicPageParser):
        def parse(self, url: str) -> ParsedPublicPage:
            if url == unreadable_url:
                raise RuntimeError("page unavailable")
            return super().parse(url)

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result(readable_url, unreadable_url)),
        browser_client=browser,
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
        public_page_parser=PartiallyFailingParser([]),
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)

    assert run is not None
    assert "browser_inspection_incomplete" not in run.coverage_report["gaps"]
    assert run.stop_reason != "browser_inspection_incomplete"


def test_snapshot_failure_falls_back_to_metadata_and_keeps_visual_results(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path)
    browser = RecordingBrowser(fail_action="page_snapshot")
    classifier = RecordingClassifier()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/project")),
        browser_client=browser,
        visual_classifier=classifier,
        candidate_root=tmp_path / "candidates",
    )

    assert len(classifier.calls) == 6
    assert all("Project title" in call["project_text"] for call in classifier.calls)
    assert [action for action, _ in browser.calls][-1] == "close_tab"


class RecordingPublicPageParser:
    name = "local_browser"

    def __init__(
        self,
        images: list[ParsedPageImage],
        *,
        markdown: str = "# Courtyard Archive",
    ) -> None:
        self.images = images
        self.markdown = markdown
        self.urls: list[str] = []

    def parse(self, url: str) -> ParsedPublicPage:
        self.urls.append(url)
        return ParsedPublicPage(
            source_url=url,
            title="Courtyard Archive",
            markdown=self.markdown,
            images=self.images,
        )


class RecordingPublicSearchParser(RecordingPublicPageParser):
    worst_case_call_seconds = 30.0

    def __init__(self, images: list[ParsedPageImage]) -> None:
        super().__init__(images)
        self.queries: list[str] = []
        self.domain_batches: list[list[str]] = []

    def search(
        self,
        query: str,
        *,
        limit: int,
        include_domains: list[str],
    ) -> list[PublicSearchLead]:
        del limit
        self.queries.append(query)
        self.domain_batches.append(include_domains)
        return [
            PublicSearchLead(
                url="https://studio.example/local_browser-project",
                title="Local browser Project",
                description="Public source lead",
            )
        ]

    def parse(self, url: str) -> ParsedPublicPage:
        self.urls.append(url)
        return ParsedPublicPage(
            source_url=url,
            title="Local browser Project",
            markdown="# Local browser Project",
            images=self.images,
        )


class UniquePublicSearchParser(RecordingPublicSearchParser):
    def search(
        self,
        query: str,
        *,
        limit: int,
        include_domains: list[str],
    ) -> list[PublicSearchLead]:
        del limit, include_domains
        self.queries.append(query)
        index = len(self.queries)
        return [
            PublicSearchLead(
                url=f"https://studio.example/project-{index}",
                title=f"Project {index}",
                description="Public source lead",
            )
        ]


def test_completion_recovery_keeps_page_capacity_for_each_uncovered_subquestion(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {
            **run.budget,
            "max_rounds": 2,
            "max_queries": 6,
            "completion_recovery_rounds": 1,
            "completion_recovery_pages_per_subquestion": 2,
        }
        session.commit()
    parser = UniquePublicSearchParser([])

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(ProviderSearchResult(sources=[], assets=[])),
        public_page_parser=parser,
    )

    assert parser.urls == [
        "https://studio.example/project-1",
        "https://studio.example/project-7",
        "https://studio.example/project-8",
        "https://studio.example/project-9",
    ]


class ExpandingPublicPageParser:
    name = "local_browser"
    worst_case_call_seconds = 20.0

    def __init__(self, pages: dict[str, ParsedPublicPage]) -> None:
        self.pages = pages
        self.urls: list[str] = []

    def parse(self, url: str) -> ParsedPublicPage:
        self.urls.append(url)
        return self.pages[url]


class TimeoutSearchProvider(SingleBatchProvider):
    def search(
        self,
        query: str,
        goal: ResearchGoal,
        allowed_domains: list[str] | None = None,
    ) -> ProviderSearchResult:
        del query, goal, allowed_domains
        raise TimeoutError("model web search timed out")


class ReservedSearchProvider(TimeoutSearchProvider):
    worst_case_call_seconds = 120.0

    def __init__(self) -> None:
        super().__init__(ProviderSearchResult(sources=[], assets=[]))
        self.calls = 0

    def search(
        self,
        query: str,
        goal: ResearchGoal,
        allowed_domains: list[str] | None = None,
    ) -> ProviderSearchResult:
        del query, goal, allowed_domains
        self.calls += 1
        raise AssertionError("model search should be skipped when only public-search time remains")


class TimeoutCircuitProvider(TimeoutSearchProvider):
    worst_case_call_seconds = 30.0

    def __init__(self) -> None:
        super().__init__(ProviderSearchResult(sources=[], assets=[]))
        self.calls = 0

    def search(
        self,
        query: str,
        goal: ResearchGoal,
        allowed_domains: list[str] | None = None,
    ) -> ProviderSearchResult:
        del query, goal, allowed_domains
        self.calls += 1
        raise TimeoutError("relay web search timed out")


def test_local_browser_search_replaces_model_web_search(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    provider = TimeoutCircuitProvider()
    parser = RecordingPublicSearchParser(
        [
            ParsedPageImage(
                url="https://cdn.example/local_browser-plan.png",
                alt="Ground floor plan",
            )
        ]
    )

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        leads = list(session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id)))
        events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))
    assert run is not None
    assert run.status == RunStatus.blocked.value
    assert provider.calls == 0
    assert parser.queries
    assert parser.queries[0].startswith("architecture project drawings:")
    assert "主问题：" not in parser.queries[0]
    assert "Untrusted user design context" not in parser.queries[0]
    assert parser.urls == ["https://studio.example/local_browser-project"]
    assert [lead.image_url for lead in leads] == ["https://cdn.example/local_browser-plan.png"]
    assert any(event.summary.get("reason") == "local_browser_search" for event in events)


def test_local_browser_search_keeps_progressing_without_model_web_search(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {**run.budget, "max_queries": 3}
        session.commit()
    provider = TimeoutCircuitProvider()
    parser = RecordingPublicSearchParser(
        [
            ParsedPageImage(
                url="https://cdn.example/local_browser-section.png",
                alt="Longitudinal section",
            )
        ]
    )

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))
    assert provider.calls == 0
    assert len(parser.queries) > 1
    assert parser.domain_batches[:3] == [
        ["archdaily.com"],
        ["designboom.com"],
        ["dezeen.com"],
    ]
    assert any(
        event.tool == provider.name
        and event.summary.get("status") == "skipped"
        and event.summary.get("reason") == "local_browser_search"
        for event in events
    )


def test_public_recovery_changes_search_strategy_for_the_same_uncovered_branch(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {
            **run.budget,
            "max_rounds": 2,
            "max_queries": 6,
            "completion_recovery_rounds": 2,
            "completion_recovery_pages_per_subquestion": 1,
        }
        run.question = "保留砖混外壳的旧工业厂房改造成社区文化中心，如何组织功能、流线与剖面？"
        run.subquestions = [
            {
                "id": "flows",
                "question": "公众与后勤流线如何通过独立入口和服务廊道分开？",
                "rationale": "需要平面图证据。",
            },
            {"id": "program", "question": "新旧功能怎样分区？", "rationale": "需要平面图。"},
            {
                "id": "section",
                "question": "采光剖面怎样通过天窗、高侧窗和庭院形成层次？",
                "rationale": "需要剖面图。",
            },
        ]
        session.commit()
    parser = RecordingPublicSearchParser([])

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(ProviderSearchResult(sources=[], assets=[])),
        public_page_parser=parser,
    )

    first_branch_queries = [parser.queries[index] for index in (0, 3, 6, 9)]
    assert len(set(first_branch_queries)) == 4
    assert parser.domain_batches[0] == ["archdaily.com"]
    assert parser.domain_batches[3] == ["designboom.com"]
    assert parser.domain_batches[6] == ["dezeen.com"]
    assert parser.domain_batches[9] == ["divisare.com"]
    assert first_branch_queries[0].endswith("site:archdaily.com")
    assert first_branch_queries[1].endswith("site:designboom.com")
    assert first_branch_queries[2].endswith("site:dezeen.com")
    assert first_branch_queries[3].endswith("site:divisare.com")
    assert "adaptive reuse industrial building" in first_branch_queries[0]
    assert "community cultural center" in first_branch_queries[0]
    assert "visitor circulation" in first_branch_queries[0]
    assert "staff circulation" in first_branch_queries[0]
    assert "back-of-house" in first_branch_queries[0]
    assert "loading dock" in first_branch_queries[0]
    assert "旧工业厂房改造成社区文化中心" not in first_branch_queries[0]
    daylight_branch_queries = [parser.queries[index] for index in (2, 5, 8, 11)]
    for query in (
        daylight_branch_queries[0],
        daylight_branch_queries[1],
        daylight_branch_queries[3],
    ):
        assert query.isascii()
        assert "skylight" in query
        assert "clerestory" in query
        assert "courtyard" in query
        assert "section" in query
        assert len(query) <= 300
    assert "天窗 高侧窗 庭院 采光 剖面图" in daylight_branch_queries[2]


class RankedPublicSearchParser(RecordingPublicPageParser):
    worst_case_call_seconds = 30.0

    def __init__(self) -> None:
        super().__init__([])

    def search(
        self,
        query: str,
        *,
        limit: int,
        include_domains: list[str],
    ) -> list[PublicSearchLead]:
        del query, limit, include_domains
        return [
            PublicSearchLead(
                url="https://weak.example/general-advice",
                title="General design advice",
            ),
            PublicSearchLead(
                url="https://www.archdaily.com/123456/adaptive-reuse-project",
                title="Adaptive Reuse Project",
            ),
        ]


class ArchitectureListingPriorityParser(RecordingPublicPageParser):
    worst_case_call_seconds = 30.0

    def __init__(self) -> None:
        super().__init__([])

    def search(
        self,
        query: str,
        *,
        limit: int,
        include_domains: list[str],
    ) -> list[PublicSearchLead]:
        del query, limit, include_domains
        return [
            PublicSearchLead(
                url=(
                    "https://www.archdaily.com/998949/"
                    "12-cultural-spaces-that-owe-their-power-to-adaptive-reuse"
                ),
                title="12 Cultural Spaces That Owe Their Power to Adaptive Reuse",
            ),
            PublicSearchLead(
                url="https://www.archdaily.com/tag/cultural-center",
                title="Cultural Center | Tag",
            ),
        ]


class RelevantTrustedPublicSearchParser(RecordingPublicPageParser):
    worst_case_call_seconds = 30.0

    def __init__(self) -> None:
        super().__init__([])

    def search(
        self,
        query: str,
        *,
        limit: int,
        include_domains: list[str],
    ) -> list[PublicSearchLead]:
        del query, limit, include_domains
        return [
            PublicSearchLead(
                url="https://www.archdaily.com/440/oslo-opera-house-snohetta",
                title="Oslo Opera House / Snohetta",
                description="A waterfront opera house in Norway.",
            ),
            PublicSearchLead(
                url="https://www.archdaily.com/123456/community-factory-reuse",
                title="Community Cultural Center / Studio Example",
                description="Architects convert a textile warehouse into a public headquarters.",
            ),
        ]


class UnrelatedTrustedPublicSearchParser(RecordingPublicPageParser):
    worst_case_call_seconds = 30.0

    def __init__(self) -> None:
        super().__init__([])

    def search(
        self,
        query: str,
        *,
        limit: int,
        include_domains: list[str],
    ) -> list[PublicSearchLead]:
        del query, limit, include_domains
        return [
            PublicSearchLead(
                url="https://www.archdaily.com/440/oslo-opera-house-snohetta",
                title="Oslo Opera House / Snohetta",
                description="A waterfront opera house in Norway.",
            )
        ]


def test_relevant_trusted_project_uses_the_page_slot_before_an_unrelated_project(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.question = "旧工业厂房改造成社区文化中心，如何分开公众与后勤流线和服务入口？"
        session.commit()
    parser = RelevantTrustedPublicSearchParser()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(ProviderSearchResult(sources=[], assets=[])),
        public_page_parser=parser,
    )

    assert parser.urls[0] == ("https://www.archdaily.com/123456/community-factory-reuse")


def test_unrelated_trusted_recovery_source_does_not_reenable_model_web_search(
    tmp_path: Path,
) -> None:
    class CountingEmptyProvider:
        name = "counting_empty"

        def __init__(self) -> None:
            self.calls = 0

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del query, goal, allowed_domains
            self.calls += 1
            return ProviderSearchResult(sources=[], assets=[])

    database, run_id = _database_with_run(tmp_path, max_pages=2)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {
            **run.budget,
            "max_rounds": 1,
            "max_queries": 3,
            "completion_recovery_rounds": 1,
            "completion_recovery_pages_per_subquestion": 1,
        }
        run.question = "旧工业厂房改造成社区文化中心，如何分开公众与后勤流线和服务入口？"
        session.commit()
    provider = CountingEmptyProvider()

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=UnrelatedTrustedPublicSearchParser(),
    )

    with database.session_factory() as session:
        events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))

    assert provider.calls == 0
    assert any(
        event.tool == provider.name and event.summary.get("reason") == "local_browser_search"
        for event in events
    )


def test_architecture_listing_uses_the_page_slot_before_an_editorial(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    parser = ArchitectureListingPriorityParser()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(ProviderSearchResult(sources=[], assets=[])),
        public_page_parser=parser,
    )

    assert parser.urls[0] == "https://www.archdaily.com/tag/cultural-center"


def test_trusted_architecture_result_uses_the_limited_page_slot_before_a_weak_source(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    parser = RankedPublicSearchParser()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(ProviderSearchResult(sources=[], assets=[])),
        public_page_parser=parser,
    )

    assert parser.urls[0] == "https://www.archdaily.com/123456/adaptive-reuse-project"
    with database.session_factory() as session:
        page = session.scalar(
            select(SourcePage).where(
                SourcePage.run_id == run_id,
                SourcePage.url == "https://www.archdaily.com/123456/adaptive-reuse-project",
            )
        )
    assert page is not None
    assert page.publication_tier == PublicationTier.trusted_secondary.value


def test_trusted_recovery_source_uses_only_local_browser_search(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=2)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {
            **run.budget,
            "max_rounds": 1,
            "max_queries": 6,
            "completion_recovery_rounds": 1,
            "completion_recovery_pages_per_subquestion": 1,
        }
        session.commit()
    provider = TimeoutCircuitProvider()

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=RankedPublicSearchParser(),
    )

    with database.session_factory() as session:
        events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))

    assert provider.calls == 0
    assert any(
        event.tool == provider.name
        and event.summary.get("status") == "skipped"
        and event.summary.get("reason") == "local_browser_search"
        for event in events
    )


class RecoveringPublicSearchParser(RecordingPublicPageParser):
    worst_case_call_seconds = 30.0

    def __init__(self) -> None:
        super().__init__(
            [
                ParsedPageImage(
                    url="https://cdn.example/recovered-floor-plan.png",
                    alt="Ground floor plan",
                )
            ]
        )
        self.search_calls = 0

    def search(
        self,
        query: str,
        *,
        limit: int,
        include_domains: list[str],
    ) -> list[PublicSearchLead]:
        del query, limit, include_domains
        self.search_calls += 1
        if self.search_calls == 1:
            raise ConnectionError("temporary Local browser connection failure")
        return [
            PublicSearchLead(
                url="https://www.archdaily.com/123456/recovered-project",
                title="Recovered Project / Studio Example",
            )
        ]


def test_one_batch_with_public_and_model_timeouts_continues_to_later_search_passes(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    parser = RecoveringPublicSearchParser()
    provider = TimeoutCircuitProvider()

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        recovered = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == "https://cdn.example/recovered-floor-plan.png",
            )
        )
    assert run is not None
    assert parser.search_calls > 1
    assert run.stop_reason != "provider_error:TimeoutError"
    assert recovered is not None
    assert recovered.result_tier == ResultTier.partial.value


def test_local_browser_search_continues_when_model_call_no_longer_fits_deadline(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    provider = ReservedSearchProvider()
    parser = RecordingPublicSearchParser(
        [
            ParsedPageImage(
                url="https://cdn.example/local_browser-section.png",
                alt="Longitudinal section",
            )
        ]
    )
    times = iter([0.0, 130.0, 250.0])

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=parser,
        clock=lambda: next(times, 250.0),
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        leads = list(session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id)))
    assert run is not None
    assert run.status == RunStatus.blocked.value
    assert provider.calls == 0
    assert len(parser.queries) == 1
    assert parser.urls == []
    assert leads == []


@pytest.mark.parametrize(
    ("branch_c_calls_required", "enrichment_branch", "expected_searches"),
    [
        (2, None, ["branch-a", "branch-b", "branch-c", "branch-c"]),
        (1, "branch-a", ["branch-a", "branch-b", "branch-c", "branch-a"]),
    ],
)
def test_precedent_normal_rounds_prioritize_coverage_before_enrichment(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    branch_c_calls_required: int,
    enrichment_branch: str | None,
    expected_searches: list[str],
) -> None:
    database, run_id = _database_with_run(tmp_path)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {
            **run.budget,
            "max_rounds": 2,
            "max_queries": 6,
        }
        session.commit()

    plan = ResearchPlan(
        subquestions=[
            ResearchSubquestion(id="branch-a", question="A 分支问题", rationale="先覆盖 A。"),
            ResearchSubquestion(id="branch-b", question="B 分支问题", rationale="再覆盖 B。"),
            ResearchSubquestion(id="branch-c", question="C 分支问题", rationale="最后覆盖 C。"),
        ]
    )

    class CoverageOrderProvider:
        name = "coverage-order"

        def __init__(self) -> None:
            self.searched_subquestions: list[str] = []

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            workspace_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, workspace_context
            return plan

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del goal, allowed_domains
            subquestion_id = next(item.id for item in plan.subquestions if f"[{item.id}]" in query)
            self.searched_subquestions.append(subquestion_id)
            return ProviderSearchResult(sources=[], assets=[])

    provider = CoverageOrderProvider()

    def coverage(*args: object, **kwargs: object) -> dict[str, object]:
        del args, kwargs
        searched = provider.searched_subquestions
        covered = [
            subquestion_id
            for subquestion_id in ("branch-a", "branch-b")
            if subquestion_id in searched
        ]
        if searched.count("branch-c") >= branch_c_calls_required:
            covered.append("branch-c")
        complete = len(covered) == 3
        enrichment_complete = complete and (
            enrichment_branch is None or searched.count(enrichment_branch) >= 2
        )
        return {
            "usable_assets": len(covered),
            "project_count": len(covered),
            "verified_or_partial": len(covered),
            "subquestion_count": 3,
            "covered_subquestions": len(covered),
            "covered_subquestion_ids": covered,
            "multi_asset_projects": 0,
            "subquestion_passes": {item: 1 for item in covered},
            "gaps": [] if complete else ["uncovered_subquestions"],
            "enrichment_gaps": ([] if enrichment_complete else ["insufficient_subquestion_assets"]),
        }

    monkeypatch.setattr("archresearch_api.workflow.calculate_coverage", coverage)

    execute_research_run(database, run_id, provider)

    assert provider.searched_subquestions == expected_searches


@pytest.mark.parametrize(
    ("coverage_complete", "expected_analysis_calls"),
    [(False, 3), (True, 4)],
)
def test_public_page_analysis_fairness_only_limits_uncovered_branch_queries(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    coverage_complete: bool,
    expected_analysis_calls: int,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=4)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {**run.budget, "completion_recovery_rounds": 0}
        session.commit()
    urls = [
        f"https://www.archdaily.com/{100000 + index}/community-factory-{index}"
        for index in range(4)
    ]
    page_text = "\n".join(
        [
            "# Community Factory / Studio Example",
            "The former factory was converted into a community cultural center.",
            (
                "Independent inserted volumes organize galleries and workshops "
                "inside the retained shell."
            ),
        ]
    )
    parser = ExpandingPublicPageParser(
        {
            url: ParsedPublicPage(
                source_url=url,
                title=f"Community Factory {index} / Studio Example",
                markdown=page_text,
            )
            for index, url in enumerate(urls)
        }
    )
    provider = TextFirstPageProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=url,
                    title=f"Community Factory {index} / Studio Example",
                    publication_tier=PublicationTier.primary,
                )
                for index, url in enumerate(urls)
            ],
            assets=[],
        )
    )
    if coverage_complete:
        complete_coverage = {
            "usable_assets": 3,
            "project_count": 3,
            "verified_or_partial": 3,
            "subquestion_count": 3,
            "covered_subquestions": 3,
            "covered_subquestion_ids": ["program", "circulation", "section"],
            "multi_asset_projects": 0,
            "subquestion_passes": {"program": 1, "circulation": 1, "section": 1},
            "gaps": [],
            "enrichment_gaps": ["insufficient_subquestion_assets"],
        }
        monkeypatch.setattr(
            "archresearch_api.workflow.calculate_coverage",
            lambda *args, **kwargs: {
                **complete_coverage,
                "covered_subquestion_ids": list(complete_coverage["covered_subquestion_ids"]),
                "subquestion_passes": dict(complete_coverage["subquestion_passes"]),
                "gaps": [],
                "enrichment_gaps": list(complete_coverage["enrichment_gaps"]),
            },
        )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    assert len(provider.analysis_calls) == expected_analysis_calls
    assert parser.urls == urls[:expected_analysis_calls]


def test_deep_analysis_fairness_preserves_missing_branch_recovery_windows(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    branch_ids = [f"branch-{letter}" for letter in "abcdef"]
    plan = ResearchPlan(
        subquestions=[
            ResearchSubquestion(
                id=branch_id,
                question=f"{branch_id} 的设计机制是什么？",
                rationale="验证六题公平轮转。",
            )
            for branch_id in branch_ids
        ]
    )
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget_mode = BudgetMode.deep.value
        run.budget = {
            **run.budget,
            "max_rounds": 2,
            "max_queries": 12,
            "completion_recovery_rounds": 0,
            "max_pages": 60,
            "max_seconds": 310,
        }
        session.commit()

    time_state = {"now": 0.0}
    page_text = "\n".join(
        [
            "# Community Factory / Studio Example",
            "The former factory was converted into a community cultural center.",
            (
                "Independent inserted volumes organize galleries and workshops "
                "inside the retained shell."
            ),
        ]
    )

    class InternalServerError(Exception):
        pass

    class FairnessDeepProvider(TextFirstPageProvider):
        worst_case_call_seconds = 45.0
        worst_case_page_analysis_seconds = 45.0

        def __init__(self) -> None:
            super().__init__(ProviderSearchResult(sources=[], assets=[]))
            self.searched_subquestions: list[str] = []
            self.analysis_query_keys: list[tuple[str, int]] = []

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, research_context
            return plan

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del goal, allowed_domains
            time_state["now"] += 2.0
            subquestion_id = next(item for item in branch_ids if f"[{item}]" in query)
            self.searched_subquestions.append(subquestion_id)
            branch_index = branch_ids.index(subquestion_id)
            query_index = self.searched_subquestions.count(subquestion_id)
            sources = [
                ProviderSource(
                    url=(
                        "https://www.archdaily.com/"
                        f"{200000 + branch_index * 100 + query_index * 10 + index}/"
                        f"{subquestion_id}-project-{query_index}-{index}"
                    ),
                    title=f"{subquestion_id} Project {query_index}-{index} / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
                for index in range(4)
            ]
            return ProviderSearchResult(sources=sources, assets=[])

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            time_state["now"] += 6.0
            subquestion_id = next(
                item.id for item in plan.subquestions if item.question == question
            )
            self.analysis_query_keys.append(
                (subquestion_id, self.searched_subquestions.count(subquestion_id))
            )
            return super().analyze_public_page(
                question=question,
                source_url=source_url,
                title=title,
                page_text=page_text,
                drawings=drawings,
                analysis_requirements=analysis_requirements,
            )

        def synthesis_worst_case_seconds(self, budget_mode: BudgetMode) -> float:
            assert budget_mode is BudgetMode.deep
            return 90.0

        def synthesize_research(self, **kwargs: object) -> ResearchSynthesis:
            del kwargs
            raise InternalServerError("relay failed after accepting the request")

    class FairnessPageParser:
        name = "local_browser"
        worst_case_call_seconds = 20.0

        def __init__(self) -> None:
            self.urls: list[str] = []

        def parse(self, url: str) -> ParsedPublicPage:
            time_state["now"] += 1.0
            self.urls.append(url)
            return ParsedPublicPage(
                source_url=url,
                title="Community Factory / Studio Example",
                markdown=page_text,
            )

    provider = FairnessDeepProvider()
    parser = FairnessPageParser()

    def coverage(*args: object, **kwargs: object) -> dict[str, object]:
        del args, kwargs
        covered_ids = [
            branch_id
            for branch_id in ("branch-b", "branch-c", "branch-d")
            if branch_id in provider.searched_subquestions
        ]
        for branch_id in ("branch-a", "branch-e", "branch-f"):
            if provider.searched_subquestions.count(branch_id) >= 2:
                covered_ids.append(branch_id)
        complete = len(covered_ids) == 6
        return {
            "usable_assets": len(covered_ids) * 3,
            "project_count": len(covered_ids),
            "verified_or_partial": len(covered_ids) * 3,
            "subquestion_count": 6,
            "covered_subquestions": len(covered_ids),
            "covered_subquestion_ids": covered_ids,
            "multi_asset_projects": 3 if complete else 2,
            "subquestion_passes": {item: 1 for item in covered_ids},
            "gaps": [] if complete else ["uncovered_subquestions"],
            "enrichment_gaps": [] if complete else ["insufficient_subquestion_assets"],
        }

    _, cases = _deterministic_synthesis_fixture()
    monkeypatch.setattr("archresearch_api.workflow.calculate_coverage", coverage)
    monkeypatch.setattr(
        "archresearch_api.workflow._research_synthesis_cases",
        lambda *args, **kwargs: cases,
    )

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=parser,
        clock=lambda: time_state["now"],
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        attempts = list(session.scalars(select(QueryAttempt).where(QueryAttempt.run_id == run_id)))
        synthesis_events = list(
            session.scalars(
                select(TraceEvent).where(
                    TraceEvent.run_id == run_id,
                    TraceEvent.tool == "research_synthesis",
                )
            )
        )
    assert run is not None
    assert run.status == RunStatus.completed.value, (
        run.coverage_report,
        provider.searched_subquestions,
        provider.analysis_query_keys,
        time_state,
    )
    assert run.coverage_report["covered_subquestions"] == 6
    recovery_branch_ids = ("branch-a", "branch-e", "branch-f")
    expected_searches = [*branch_ids, *recovery_branch_ids]
    assert [attempt.subquestion_id for attempt in attempts] == expected_searches
    assert provider.searched_subquestions == expected_searches
    expected_query_keys = {(branch_id, 1) for branch_id in branch_ids} | {
        (branch_id, 2) for branch_id in recovery_branch_ids
    }
    assert set(provider.analysis_query_keys) == expected_query_keys
    assert all(provider.analysis_query_keys.count((branch_id, 1)) <= 3 for branch_id in branch_ids)
    assert all(
        provider.analysis_query_keys.count((branch_id, 2)) == 1 for branch_id in recovery_branch_ids
    )
    assert len(provider.analysis_calls) <= 21
    assert parser.urls
    assert time_state["now"] < 220.0
    assert len(synthesis_events) == 1
    synthesis = run.coverage_report["synthesis"]
    assert synthesis["generation_mode"] == "deterministic_fallback"
    assert [
        len(synthesis["causal_chains"]),
        len(synthesis["comparisons"]),
        len(synthesis["conflicts"]),
        len(synthesis["applicability_boundaries"]),
        len(synthesis["recommendations"]),
    ] == [2, 2, 1, 2, 2]


def test_deep_research_preserves_synthesis_time_before_optional_enrichment(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget_mode = BudgetMode.deep.value
        run.budget = {**run.budget, "max_seconds": 250}
        session.commit()

    class DeepReserveProvider(ReservedSearchProvider):
        worst_case_call_seconds = 45.0

        def __init__(self) -> None:
            super().__init__()
            self.synthesis_calls = 0

        def synthesis_worst_case_seconds(self, budget_mode: BudgetMode) -> float:
            assert budget_mode is BudgetMode.deep
            return 90.0

        def synthesize_research(
            self,
            *,
            question: str,
            budget_mode: BudgetMode,
            subquestions: Sequence[ResearchSubquestion],
            cases: Sequence[ResearchSynthesisCase],
        ) -> ResearchSynthesis:
            del question, subquestions
            assert budget_mode is BudgetMode.deep
            self.synthesis_calls += 1
            finding = ResearchSynthesisFinding(
                statement="完整覆盖后应优先生成研究综合。",
                evidence_asset_ids=[cases[0].asset_id],
            )
            return ResearchSynthesis(
                answer=finding,
                causal_chains=[finding, finding],
                comparisons=[finding, finding],
                conflicts=[finding],
                applicability_boundaries=[finding, finding],
                recommendations=[finding, finding],
            )

    class TwoLeadPublicSearchParser(RecordingPublicSearchParser):
        def search(
            self,
            query: str,
            *,
            limit: int,
            include_domains: list[str],
        ) -> list[PublicSearchLead]:
            super().search(query, limit=limit, include_domains=include_domains)
            return [
                PublicSearchLead(
                    url="https://studio.example/first-project",
                    title="First project",
                ),
                PublicSearchLead(
                    url="https://studio.example/second-project",
                    title="Second project",
                ),
            ]

    coverage = {
        "usable_assets": 12,
        "project_count": 6,
        "verified_or_partial": 12,
        "subquestion_count": 6,
        "covered_subquestions": 6,
        "covered_subquestion_ids": [f"branch-{index}" for index in range(6)],
        "multi_asset_projects": 3,
        "subquestion_passes": {f"branch-{index}": 2 for index in range(6)},
        "gaps": [],
        "enrichment_gaps": ["insufficient_subquestion_assets"],
    }
    case = ResearchSynthesisCase(
        asset_id="deep-case",
        project_name="旧厂房更新",
        asset_type=ArchitectureAssetType.section,
        source_url="https://studio.example/deep-case",
        subquestion_ids=list(coverage["covered_subquestion_ids"]),
        project_context="项目保留原有厂房结构。",
        design_mechanism="独立插入体与旧结构脱开。",
        transfer_strategy=["先标出保留结构，再布置独立插入体。"],
        evidence=["The inserted volume is independent from the retained structure."],
    )
    monkeypatch.setattr(
        "archresearch_api.workflow.calculate_coverage",
        lambda *args, **kwargs: {
            **coverage,
            "covered_subquestion_ids": list(coverage["covered_subquestion_ids"]),
            "subquestion_passes": dict(coverage["subquestion_passes"]),
            "gaps": [],
            "enrichment_gaps": list(coverage["enrichment_gaps"]),
        },
    )
    monkeypatch.setattr(
        "archresearch_api.workflow._research_synthesis_cases",
        lambda *args, **kwargs: [case],
    )
    provider = DeepReserveProvider()
    parser = TwoLeadPublicSearchParser(
        [
            ParsedPageImage(
                url="https://cdn.example/optional-enrichment-section.png",
                alt="Optional enrichment section",
            )
        ]
    )
    times = iter([0.0, 120.0, 125.0, 135.0])

    def clock() -> float:
        return next(times, 135.0)

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=parser,
        clock=clock,
    )

    assert len(parser.queries) == 1
    assert parser.urls == ["https://studio.example/first-project"]
    assert provider.synthesis_calls == 1


def _deterministic_synthesis_fixture() -> tuple[
    list[ResearchSubquestion], list[ResearchSynthesisCase]
]:
    subquestions = [
        ResearchSubquestion(
            id="branch-a",
            question="如何组织公共序列？",
            rationale="验证公共序列策略。",
        ),
        ResearchSubquestion(
            id="branch-b",
            question="如何组织剖面层次？",
            rationale="验证剖面层次策略。",
        ),
    ]

    def synthesis_case(
        asset_id: str,
        project_name: str,
        subquestion_id: str,
    ) -> ResearchSynthesisCase:
        context = f"{project_name}保留既有建筑骨架。"
        mechanism = f"{project_name}以可识别的新构件组织空间。"
        transfer = f"先核验{project_name}对应的既有结构条件。"
        limitation = f"{project_name}未提供构造节点尺寸。"
        branch = ResearchSynthesisBranchAnalysis(
            project_context=context,
            design_mechanism=mechanism,
            transfer_strategy=[transfer],
            limitations=[limitation],
            evidence=[
                f"{context}｜原文：Retained existing structure in {project_name}.",
                f"{mechanism}｜原文：Added a legible new element in {project_name}.",
            ],
        )
        return ResearchSynthesisCase(
            asset_id=asset_id,
            project_name=project_name,
            asset_type=ArchitectureAssetType.section,
            source_url=f"https://studio.example/{asset_id}",
            subquestion_ids=[subquestion_id],
            project_context=context,
            design_mechanism=mechanism,
            transfer_strategy=[transfer],
            limitations=[limitation],
            evidence=list(branch.evidence),
            subquestion_analysis={subquestion_id: branch},
        )

    cases = [
        synthesis_case("a-one", "案例甲", "branch-a"),
        synthesis_case("a-two", "案例乙", "branch-a"),
        synthesis_case("b-one", "案例丙", "branch-b"),
        synthesis_case("b-two", "案例丁", "branch-b"),
    ]
    return subquestions, cases


def test_deep_four_of_six_with_cited_synthesis_finishes_partial(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    _, cases = _deterministic_synthesis_fixture()
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget_mode = BudgetMode.deep.value
        run.budget = {
            **run.budget,
            "max_rounds": 1,
            "max_queries": 6,
            "max_seconds": 250,
        }
        session.commit()

    covered_ids = ["program", "circulation", "section", "structure"]
    coverage = {
        "usable_assets": 12,
        "project_count": 4,
        "verified_or_partial": 12,
        "subquestion_count": 6,
        "covered_subquestions": 4,
        "covered_subquestion_ids": covered_ids,
        "multi_asset_projects": 2,
        "subquestion_passes": {item: 1 for item in covered_ids},
        "gaps": ["uncovered_subquestions", "article_analysis_incomplete"],
        "enrichment_gaps": ["insufficient_subquestion_assets"],
    }
    monkeypatch.setattr(
        "archresearch_api.workflow.calculate_coverage",
        lambda *args, **kwargs: {
            **coverage,
            "covered_subquestion_ids": list(covered_ids),
            "subquestion_passes": dict(coverage["subquestion_passes"]),
            "gaps": list(coverage["gaps"]),
            "enrichment_gaps": list(coverage["enrichment_gaps"]),
        },
    )
    monkeypatch.setattr(
        "archresearch_api.workflow._research_synthesis_cases",
        lambda *args, **kwargs: cases,
    )

    class PartialDeepProvider(SingleBatchProvider):
        def synthesize_research(
            self,
            *,
            question: str,
            budget_mode: BudgetMode,
            subquestions: Sequence[ResearchSubquestion],
            cases: Sequence[ResearchSynthesisCase],
        ) -> ResearchSynthesis:
            del question, subquestions
            assert budget_mode is BudgetMode.deep
            finding = ResearchSynthesisFinding(
                statement="已有四个分支形成逐字证据，另两个分支明确保留为空白。",
                evidence_asset_ids=[cases[0].asset_id],
            )
            return ResearchSynthesis(
                answer=finding,
                causal_chains=[finding, finding],
                comparisons=[finding, finding],
                conflicts=[finding],
                applicability_boundaries=[finding, finding],
                recommendations=[finding, finding],
            )

    class EmptyPublicSearchParser(RecordingPublicPageParser):
        worst_case_call_seconds = 0.0

        def search(
            self,
            query: str,
            *,
            limit: int,
            include_domains: list[str],
        ) -> list[PublicSearchLead]:
            del query, limit, include_domains
            return []

    execute_research_run(
        database,
        run_id,
        PartialDeepProvider(ProviderSearchResult(sources=[], assets=[])),
        public_page_parser=EmptyPublicSearchParser([]),
        clock=lambda: 0.0,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)

    assert run is not None
    assert run.status == RunStatus.partial.value
    assert run.coverage_report["covered_subquestions"] == 4
    assert run.coverage_report["synthesis"]["answer"]["statement"].startswith("已有四个分支")


def test_synthesis_fallback_stays_partial_when_enrichment_is_incomplete(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    subquestions, cases = _deterministic_synthesis_fixture()
    plan = ResearchPlan(
        subquestions=[
            *subquestions,
            ResearchSubquestion(
                id="branch-c",
                question="如何处理新旧结构？",
                rationale="验证新旧结构关系。",
            ),
            ResearchSubquestion(
                id="branch-d",
                question="如何组织自然采光？",
                rationale="验证采光策略。",
            ),
            ResearchSubquestion(
                id="branch-e",
                question="如何植入公共功能？",
                rationale="验证功能植入。",
            ),
            ResearchSubquestion(
                id="branch-f",
                question="如何处理新旧界面？",
                rationale="验证唯一未覆盖分支。",
            ),
        ]
    )
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget_mode = BudgetMode.deep.value
        run.budget = {
            **run.budget,
            "max_rounds": 1,
            "max_queries": 6,
            "max_pages": 2,
            "max_seconds": 250,
        }
        session.commit()

    class InternalServerError(Exception):
        pass

    class FailingDeepProvider(ReservedSearchProvider):
        worst_case_call_seconds = 45.0

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, research_context
            return plan

        def synthesis_worst_case_seconds(self, budget_mode: BudgetMode) -> float:
            assert budget_mode is BudgetMode.deep
            return 90.0

        def synthesize_research(self, **kwargs: object) -> ResearchSynthesis:
            del kwargs
            raise InternalServerError("relay failed after accepting the request")

    class TwoLeadPublicSearchParser(RecordingPublicSearchParser):
        def search(
            self,
            query: str,
            *,
            limit: int,
            include_domains: list[str],
        ) -> list[PublicSearchLead]:
            super().search(query, limit=limit, include_domains=include_domains)
            return [
                PublicSearchLead(
                    url="https://studio.example/missing-branch-project",
                    title="Missing branch project",
                ),
                PublicSearchLead(
                    url="https://studio.example/late-enrichment-project",
                    title="Late enrichment project",
                ),
            ]

    parser = TwoLeadPublicSearchParser([])

    def coverage(*args: object, **kwargs: object) -> dict[str, object]:
        del args, kwargs
        covered_ids = [f"branch-{letter}" for letter in "abcde"]
        if parser.queries:
            covered_ids.append("branch-f")
        complete = len(covered_ids) == 6
        return {
            "usable_assets": 18 if complete else 17,
            "project_count": 6,
            "verified_or_partial": 18 if complete else 17,
            "subquestion_count": 6,
            "covered_subquestions": len(covered_ids),
            "covered_subquestion_ids": covered_ids,
            "multi_asset_projects": 3,
            "subquestion_passes": {item: 2 for item in covered_ids},
            "gaps": [] if complete else ["uncovered_subquestions"],
            "enrichment_gaps": ["insufficient_subquestion_assets"],
        }

    monkeypatch.setattr(
        "archresearch_api.workflow.calculate_coverage",
        coverage,
    )
    monkeypatch.setattr(
        "archresearch_api.workflow._research_synthesis_cases",
        lambda *args, **kwargs: cases,
    )
    times = iter([0.0, 120.0, 125.0, 135.0, 160.0])

    def clock() -> float:
        return next(times, 160.0)

    provider = FailingDeepProvider()

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=parser,
        clock=clock,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        attempts = list(session.scalars(select(QueryAttempt).where(QueryAttempt.run_id == run_id)))
        event = session.scalar(
            select(TraceEvent).where(
                TraceEvent.run_id == run_id,
                TraceEvent.tool == "research_synthesis",
            )
        )
    assert run is not None
    assert run.status == RunStatus.partial.value
    assert run.stop_reason == "time_budget_exhausted"
    assert run.coverage_report["covered_subquestions"] == 6
    assert run.coverage_report["gaps"] == []
    assert provider.calls == 0
    assert len(parser.queries) == 1
    assert [attempt.subquestion_id for attempt in attempts] == ["branch-f"]
    assert parser.urls == ["https://studio.example/missing-branch-project"]
    synthesis = run.coverage_report["synthesis"]
    assert synthesis["generation_mode"] == "deterministic_fallback"
    assert [
        len(synthesis["causal_chains"]),
        len(synthesis["comparisons"]),
        len(synthesis["conflicts"]),
        len(synthesis["applicability_boundaries"]),
        len(synthesis["recommendations"]),
    ] == [2, 2, 1, 2, 2]
    assert event is not None
    assert event.summary["status"] == "completed"
    assert event.summary["provider_error_type"] == "InternalServerError"


def test_deterministic_synthesis_uses_only_evidence_grounded_case_fields() -> None:
    subquestions, cases = _deterministic_synthesis_fixture()

    synthesis = deterministic_research_synthesis(
        BudgetMode.deep,
        subquestions,
        cases,
    )

    assert synthesis is not None
    assert synthesis.answer.statement.startswith("【本地证据汇总】")
    assert [
        len(synthesis.causal_chains),
        len(synthesis.comparisons),
        len(synthesis.conflicts),
        len(synthesis.applicability_boundaries),
        len(synthesis.recommendations),
    ] == [2, 2, 1, 2, 2]
    allowed_asset_ids = {case.asset_id for case in cases}
    findings = [
        synthesis.answer,
        *synthesis.causal_chains,
        *synthesis.comparisons,
        *synthesis.conflicts,
        *synthesis.applicability_boundaries,
        *synthesis.recommendations,
    ]
    assert all(set(finding.evidence_asset_ids) <= allowed_asset_ids for finding in findings)
    assert cases[0].subquestion_analysis["branch-a"].project_context in (
        synthesis.causal_chains[0].statement
    )
    assert cases[0].subquestion_analysis["branch-a"].design_mechanism in (
        synthesis.comparisons[0].statement
    )
    assert cases[0].subquestion_analysis["branch-a"].limitations[0] in (
        synthesis.conflicts[0].statement
    )
    assert cases[0].subquestion_analysis["branch-a"].transfer_strategy[0] in (
        synthesis.recommendations[0].statement
    )
    assert cases[0].subquestion_analysis["branch-a"].transfer_strategy[0] in (
        synthesis.answer.statement
    )
    assert cases[0].subquestion_analysis["branch-a"].design_mechanism not in (
        synthesis.answer.statement
    )


@pytest.mark.parametrize(
    ("budget_mode", "expected_counts"),
    [
        (BudgetMode.quick, [1, 0, 0, 0, 1]),
        (BudgetMode.balanced, [2, 2, 1, 2, 2]),
        (BudgetMode.deep, [2, 2, 1, 2, 2]),
    ],
)
def test_deterministic_synthesis_matches_each_depth_contract(
    budget_mode: BudgetMode,
    expected_counts: list[int],
) -> None:
    subquestions, cases = _deterministic_synthesis_fixture()

    synthesis = deterministic_research_synthesis(
        budget_mode,
        subquestions,
        cases,
    )

    assert synthesis is not None
    assert [
        len(synthesis.causal_chains),
        len(synthesis.comparisons),
        len(synthesis.conflicts),
        len(synthesis.applicability_boundaries),
        len(synthesis.recommendations),
    ] == expected_counts


def test_recoverable_synthesis_failure_completes_with_deterministic_fallback(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    subquestions, cases = _deterministic_synthesis_fixture()
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget_mode = BudgetMode.deep.value
        run.subquestions = [item.model_dump(mode="json") for item in subquestions]
        session.commit()

    class InternalServerError(Exception):
        pass

    class FailingSynthesisProvider:
        def synthesize_research(self, **kwargs: object) -> ResearchSynthesis:
            del kwargs
            raise InternalServerError("relay failed after accepting the request")

    monkeypatch.setattr(
        "archresearch_api.workflow._research_synthesis_cases",
        lambda *args, **kwargs: cases,
    )

    result = workflow_module._try_research_synthesis(
        database,
        run_id,
        FailingSynthesisProvider(),
        question="如何更新旧建筑？",
        budget_mode=BudgetMode.deep,
    )

    assert result is not None
    assert result["generation_mode"] == "deterministic_fallback"
    assert len(result["causal_chains"]) == 2
    with database.session_factory() as session:
        events = list(
            session.scalars(
                select(TraceEvent).where(
                    TraceEvent.run_id == run_id,
                    TraceEvent.tool == "research_synthesis",
                )
            )
        )
    assert len(events) == 1
    assert events[0].summary == {
        "status": "completed",
        "generation_mode": "deterministic_fallback",
        "provider_error_type": "InternalServerError",
        "case_count": 4,
        "comparison_count": 2,
        "conflict_count": 1,
    }


def test_programming_synthesis_failure_is_not_hidden_by_deterministic_fallback(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    subquestions, cases = _deterministic_synthesis_fixture()
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget_mode = BudgetMode.deep.value
        run.subquestions = [item.model_dump(mode="json") for item in subquestions]
        session.commit()

    class BuggySynthesisProvider:
        def synthesize_research(self, **kwargs: object) -> ResearchSynthesis:
            del kwargs
            raise ValueError("programming invariant failed")

    monkeypatch.setattr(
        "archresearch_api.workflow._research_synthesis_cases",
        lambda *args, **kwargs: cases,
    )

    result = workflow_module._try_research_synthesis(
        database,
        run_id,
        BuggySynthesisProvider(),
        question="如何更新旧建筑？",
        budget_mode=BudgetMode.deep,
    )

    assert result is None
    with database.session_factory() as session:
        event = session.scalar(
            select(TraceEvent).where(
                TraceEvent.run_id == run_id,
                TraceEvent.tool == "research_synthesis",
            )
        )
    assert event is not None
    assert event.summary == {"status": "failed", "error_type": "ValueError"}


def test_local_browser_enriches_normal_browser_research_context_and_image_recall(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    result = _provider_result("https://studio.example/project")
    result.assets[0].asset_type = ArchitectureAssetType.section
    result.assets[0].image_url = None
    classifier = RecordingClassifier()
    parser = RecordingPublicPageParser(
        [
            ParsedPageImage(
                url="https://cdn.example/local_browser-section.png",
                alt="Longitudinal section",
            )
        ],
        markdown="# Courtyard Archive\nThe retained steel truss frames a stepped section.",
    )

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(result),
        browser_client=RecordingBrowser(),
        visual_classifier=classifier,
        candidate_root=tmp_path / "candidates",
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
    local_browser_lead = next(
        asset
        for asset in assets
        if asset.image_url == "https://cdn.example/local_browser-section.png"
    )
    provider_asset = next(
        asset for asset in assets if asset.result_tier == ResultTier.partial.value
    )
    assert parser.urls == ["https://studio.example/project"]
    assert classifier.calls
    assert all("retained steel truss" in call["project_text"] for call in classifier.calls)
    assert local_browser_lead.asset_type == ArchitectureAssetType.section.value
    assert local_browser_lead.result_tier == ResultTier.visual_lead.value
    assert local_browser_lead.relevance == 1
    assert local_browser_lead.project_identity == AssociationStatus.unknown.value
    assert local_browser_lead.asset_association == AssociationStatus.unknown.value
    assert local_browser_lead.rights_status == RightsStatus.unknown.value
    assert local_browser_lead.facts == []
    assert local_browser_lead.observations == []
    assert provider_asset.storage_path is not None
    assert provider_asset.perceptual_hash is not None


def test_local_browser_adds_typed_public_image_leads_without_a_browser_connection(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    parser = RecordingPublicPageParser(
        [
            ParsedPageImage(
                url="https://cdn.example/public-floor-plan.png",
                alt="Ground floor plan",
            )
        ]
    )

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/project")),
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        lead = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == "https://cdn.example/public-floor-plan.png",
            )
        )
    assert parser.urls == ["https://studio.example/project"]
    assert lead is not None
    assert lead.asset_type == ArchitectureAssetType.plan.value
    assert lead.result_tier == ResultTier.visual_lead.value
    assert lead.storage_path is None


def test_trusted_direct_project_page_promotes_exact_drawing_evidence(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    project_url = "https://www.archdaily.com/123456/courtyard-archive"
    image_url = "https://cdn.example/courtyard-circulation-diagram.png"
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url=image_url, alt="Public and service circulation diagram")]
    )
    result = ProviderSearchResult(
        sources=[
            ProviderSource(
                url=project_url,
                title="Courtyard Archive / Studio Example",
                publication_tier=PublicationTier.trusted_secondary,
            )
        ],
        assets=[],
    )

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(result),
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == image_url,
            )
        )
        claim = session.scalar(
            select(EvidenceClaim).where(
                EvidenceClaim.asset_candidate_id == candidate.id,
            )
        )
    assert candidate is not None
    assert candidate.result_tier == ResultTier.partial.value
    assert candidate.source_url == project_url
    assert candidate.asset_association == AssociationStatus.confirmed.value
    assert candidate.subquestion_ids == ["program"]
    assert claim is not None
    assert claim.source_url == project_url
    assert claim.text_excerpt == "Public and service circulation diagram"


def test_trusted_archdaily_editorial_does_not_promote_images_as_project_evidence(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    source_url = (
        "https://www.archdaily.com/998949/12-cultural-spaces-that-owe-their-power-to-adaptive-reuse"
    )
    image_url = "https://cdn.example/adaptive-reuse-photo.png"

    class EditorialParser(RecordingPublicPageParser):
        def parse(self, url: str) -> ParsedPublicPage:
            self.urls.append(url)
            return ParsedPublicPage(
                source_url=url,
                title="12 Cultural Spaces That Owe Their Power to Adaptive Reuse",
                markdown="# Editorial roundup",
                images=[ParsedPageImage(url=image_url, alt="Ground floor plan")],
            )

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(
            ProviderSearchResult(
                sources=[
                    ProviderSource(
                        url=source_url,
                        title="12 Cultural Spaces That Owe Their Power to Adaptive Reuse",
                        publication_tier=PublicationTier.trusted_secondary,
                    )
                ],
                assets=[],
            )
        ),
        public_page_parser=EditorialParser([]),
    )

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == image_url,
            )
        )

    assert candidate is not None
    assert candidate.result_tier == ResultTier.visual_lead.value
    assert candidate.project_identity == AssociationStatus.unknown.value
    assert candidate.asset_association == AssociationStatus.unknown.value


def test_collected_project_page_analysis_enriches_the_evidence_card_without_web_search(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    project_url = "https://www.archdaily.com/123456/courtyard-archive"
    image_url = (
        "https://images.adsttc.com/media/images/example/medium_jpg/intrusswetrust-seccion-1.jpg"
    )

    class ProjectPageParser(RecordingPublicPageParser):
        def parse(self, url: str) -> ParsedPublicPage:
            self.urls.append(url)
            return ParsedPublicPage(
                source_url=url,
                title="Courtyard Archive / Studio Example",
                description="Adaptive reuse project page",
                markdown=(
                    "The service entrance is located on the east side. "
                    "Visitors enter from the public courtyard."
                ),
                images=[
                    ParsedPageImage(
                        url=image_url,
                        alt="Courtyard Archive - Image 21 of 21",
                    )
                ],
            )

    class SynthesizingProvider(AnalyzingPageProvider):
        def __init__(self, result: ProviderSearchResult) -> None:
            super().__init__(result)
            self.synthesis_cases: list[ResearchSynthesisCase] = []

        def synthesize_research(
            self,
            *,
            question: str,
            budget_mode: BudgetMode,
            subquestions: Sequence[ResearchSubquestion],
            cases: Sequence[ResearchSynthesisCase],
        ) -> ResearchSynthesis:
            del question, subquestions
            assert budget_mode is BudgetMode.quick
            self.synthesis_cases = list(cases)
            finding = ResearchSynthesisFinding(
                statement="分置公众与后勤入口，减少路径冲突。",
                evidence_asset_ids=[cases[0].asset_id],
            )
            return ResearchSynthesis(
                answer=finding,
                causal_chains=[finding],
                recommendations=[finding],
            )

    provider = SynthesizingProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Courtyard Archive / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[],
        )
    )

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=ProjectPageParser([]),
    )

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == image_url,
            )
        )
        facts = list(
            session.scalars(
                select(EvidenceClaim).where(
                    EvidenceClaim.asset_candidate_id == candidate.id,
                    EvidenceClaim.statement == "项目将服务入口设置在东侧。",
                )
            )
        )
        events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))
        run = session.get(ResearchRun, run_id)

    assert len(provider.analysis_calls) == 3
    assert all(
        drawings[0].asset_type is ArchitectureAssetType.section
        for drawings in provider.analysis_calls
    )
    assert candidate is not None
    assert candidate.design_mechanism == "将后勤入口与公众入口分置在建筑两侧。"
    assert candidate.transfer_strategy == [
        "在总平面先标出两类入口。",
        "用独立服务廊道连接后台。",
    ]
    assert candidate.project_context == "项目将服务入口设置在东侧。"
    assert candidate.inferences == ["将后勤入口与公众入口分置在建筑两侧。"]
    assert candidate.subquestion_analysis["program"]["design_mechanism"] == (
        "将后勤入口与公众入口分置在建筑两侧。"
    )
    assert candidate.subquestion_analysis["program"]["project_name_zh"] == "服务入口示范馆"
    assert set(candidate.subquestion_analysis) == {"program", "circulation", "section"}
    assert len(facts) == 1
    assert facts[0].source_url == project_url
    assert facts[0].text_excerpt == "The service entrance is located on the east side."
    assert any(
        event.tool == "public_page_analysis" and event.summary.get("status") == "completed"
        for event in events
    )
    assert provider.synthesis_cases[0].evidence == [
        "项目将服务入口设置在东侧。｜原文：The service entrance is located on the east side.",
        "将后勤入口与公众入口分置在建筑两侧。｜原文：Visitors enter from the public courtyard.",
    ]
    assert set(provider.synthesis_cases[0].subquestion_analysis) == {
        "program",
        "circulation",
        "section",
    }
    assert (
        provider.synthesis_cases[0].subquestion_analysis["section"].design_mechanism
        == "将后勤入口与公众入口分置在建筑两侧。"
    )
    assert provider.synthesis_cases[0].subquestion_analysis["section"].evidence == [
        "项目将服务入口设置在东侧。｜原文：The service entrance is located on the east side.",
        "将后勤入口与公众入口分置在建筑两侧。｜原文：Visitors enter from the public courtyard.",
    ]
    assert run is not None
    assert run.coverage_report["synthesis"]["answer"]["statement"] == (
        "分置公众与后勤入口，减少路径冲突。"
    )
    assert any(
        event.tool == "research_synthesis" and event.summary.get("status") == "completed"
        for event in events
    )


def test_text_complete_page_analysis_uses_a_same_source_photo_only_as_preview(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    project_url = "https://www.archdaily.com/123456/cultural-factory"
    photo_url = "https://cdn.example/cultural-factory-photo.jpg"
    provider = TextFirstPageProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Cultural Factory / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[
                ProviderAsset(
                    project_name="Cultural Factory",
                    asset_type=ArchitectureAssetType.photograph,
                    source_url=project_url,
                    image_url=photo_url,
                    publication_tier=PublicationTier.trusted_secondary,
                    project_identity=AssociationStatus.confirmed,
                    asset_association=AssociationStatus.confirmed,
                    result_tier=ResultTier.partial,
                    relevance=3,
                )
            ],
        )
    )
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url=photo_url, alt="Project photograph")],
        markdown=(
            "The former factory was converted into a community cultural center. "
            "Independent inserted volumes organize galleries and workshops inside the "
            "retained shell."
        ),
    )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == photo_url,
            )
        )
        run = session.get(ResearchRun, run_id)
        claims = list(
            session.scalars(
                select(EvidenceClaim).where(EvidenceClaim.asset_candidate_id == candidate.id)
            )
        )

    assert provider.analysis_calls
    assert candidate is not None
    assert candidate.asset_type == ArchitectureAssetType.photograph.value
    assert candidate.design_mechanism == "独立插入体在保留外壳内组织展览和工作坊。"
    assert candidate.transfer_strategy
    assert len(claims) == 2
    assert run is not None
    assert run.coverage_report["covered_subquestions"] == 3
    assert "uncovered_subquestions" not in run.coverage_report["gaps"]


def test_text_complete_page_analysis_creates_a_case_without_any_image(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    project_url = "https://www.archdaily.com/123456/text-only-cultural-factory"
    provider = TextFirstPageProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Text-only Cultural Factory / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[],
        )
    )
    parser = RecordingPublicPageParser(
        [],
        markdown=(
            "The former factory was converted into a community cultural center. "
            "Independent inserted volumes organize galleries and workshops inside the "
            "retained shell."
        ),
    )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.source_url == project_url,
            )
        )
        run = session.get(ResearchRun, run_id)

    assert provider.analysis_calls == [[], [], []]
    assert candidate is not None
    assert candidate.image_url is None
    assert candidate.design_mechanism == "独立插入体在保留外壳内组织展览和工作坊。"
    assert run is not None
    assert run.coverage_report["covered_subquestions"] == 3
    assert "uncovered_subquestions" not in run.coverage_report["gaps"]


@pytest.mark.parametrize(
    (
        "raw_relevance",
        "complete_evidence",
        "direct_match",
        "expected_covered_subquestions",
    ),
    [
        (0, True, True, 3),
        (1, True, True, 3),
        (1, False, True, 0),
        (4, True, False, 0),
    ],
)
def test_page_analysis_requires_a_complete_directly_matching_verbatim_chain(
    tmp_path: Path,
    raw_relevance: int,
    complete_evidence: bool,
    direct_match: bool,
    expected_covered_subquestions: int,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    project_url = "https://www.archdaily.com/123456/low-score-cultural-factory"

    class LowRelevancePageProvider(TextFirstPageProvider):
        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            analysis = super().analyze_public_page(
                question=question,
                source_url=source_url,
                title=title,
                page_text=page_text,
                drawings=drawings,
                analysis_requirements=analysis_requirements,
            )
            return analysis.model_copy(
                update={
                    "relevance": raw_relevance,
                    "direct_match": direct_match,
                    "facts": analysis.facts if complete_evidence else analysis.facts[:1],
                }
            )

    provider = LowRelevancePageProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Low-score Cultural Factory / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[],
        )
    )
    parser = RecordingPublicPageParser(
        [],
        markdown=(
            "The former factory was converted into a community cultural center. "
            "Independent inserted volumes organize galleries and workshops inside the "
            "retained shell."
        ),
    )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.source_url == project_url,
            )
        )
        run = session.get(ResearchRun, run_id)

    assert run is not None
    assert run.coverage_report["covered_subquestions"] == expected_covered_subquestions
    if complete_evidence and direct_match:
        assert candidate is not None
        assert candidate.relevance == 2
        assert candidate.design_mechanism == "独立插入体在保留外壳内组织展览和工作坊。"
    elif not direct_match:
        assert candidate is None
    else:
        assert candidate is not None
        assert candidate.relevance == 2
        assert candidate.project_context == "项目将旧厂房改造为社区文化中心。"
        assert candidate.design_mechanism == ""
        assert candidate.subquestion_ids == []


@pytest.mark.parametrize(
    ("budget_mode", "expected_covered_subquestions"),
    [
        (BudgetMode.quick, 3),
        (BudgetMode.balanced, 4),
        (BudgetMode.deep, 6),
    ],
)
def test_project_evidence_merges_two_same_project_text_sources(
    tmp_path: Path,
    budget_mode: BudgetMode,
    expected_covered_subquestions: int,
) -> None:
    database, run_id = _database_with_run(
        tmp_path,
        max_pages=2,
        budget_mode=budget_mode,
    )
    primary_url = "https://www.archdaily.com/123456/foundry-arts-center"
    supplement_url = (
        "https://www.designboom.com/architecture/foundry-arts-center-renovation-01-01-2026"
    )
    context_excerpt = "The former foundry was converted into a public arts center."
    mechanism_excerpt = (
        "A freestanding timber volume organizes workshops inside the retained brick hall."
    )

    class SplitProjectEvidenceProvider(SingleBatchProvider):
        worst_case_page_analysis_seconds = 30.0

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            del question, title, page_text, drawings, analysis_requirements
            if source_url == primary_url:
                return PublicPageAnalysis(
                    relevance=3,
                    project_context="项目将旧铸造厂改造为公共艺术中心。",
                    facts=[
                        PublicPageSupportedFact(
                            statement="项目将旧铸造厂改造为公共艺术中心。",
                            text_excerpt=context_excerpt,
                        )
                    ],
                )
            return PublicPageAnalysis(
                relevance=3,
                design_mechanism="独立木构体量在保留砖厅内组织工作坊。",
                transfer_strategy=["用独立结构承载工作坊，并与原砖墙保留检修缝。"],
                facts=[
                    PublicPageSupportedFact(
                        statement="独立木构体量在保留砖厅内组织工作坊。",
                        text_excerpt=mechanism_excerpt,
                    )
                ],
            )

    provider = SplitProjectEvidenceProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=primary_url,
                    title="Foundry Arts Center / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                ),
                ProviderSource(
                    url=supplement_url,
                    title="Foundry Arts Center | Designboom",
                    publication_tier=PublicationTier.trusted_secondary,
                ),
            ],
            assets=[],
        )
    )
    parser = ExpandingPublicPageParser(
        {
            primary_url: ParsedPublicPage(
                source_url=primary_url,
                title="Foundry Arts Center / Studio Example",
                markdown=context_excerpt,
            ),
            supplement_url: ParsedPublicPage(
                source_url=supplement_url,
                title="Foundry Arts Center | Designboom",
                markdown=mechanism_excerpt,
            ),
        }
    )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    with database.session_factory() as session:
        candidates = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        run = session.get(ResearchRun, run_id)
        claims = list(
            session.scalars(
                select(EvidenceClaim).where(EvidenceClaim.asset_candidate_id == candidates[0].id)
            )
        )

    assert len(candidates) == 1
    assert candidates[0].project_name == "Foundry Arts Center"
    assert candidates[0].project_context == "项目将旧铸造厂改造为公共艺术中心。"
    assert candidates[0].design_mechanism == "独立木构体量在保留砖厅内组织工作坊。"
    assert {claim.source_url for claim in claims} == {primary_url, supplement_url}
    assert run is not None
    assert run.coverage_report["covered_subquestions"] == expected_covered_subquestions


def test_project_evidence_never_merges_different_project_titles(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=2)
    foundry_url = "https://www.archdaily.com/123456/foundry-arts-center"
    harbor_url = "https://www.designboom.com/architecture/harbor-museum-renovation-01-01-2026"
    context_excerpt = "The former foundry was converted into a public arts center."
    mechanism_excerpt = "Roof openings bring daylight into the harbor museum galleries."

    class DifferentProjectEvidenceProvider(SingleBatchProvider):
        worst_case_page_analysis_seconds = 30.0

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            del question, title, page_text, drawings, analysis_requirements
            if source_url == foundry_url:
                return PublicPageAnalysis(
                    relevance=3,
                    project_context="项目将旧铸造厂改造为公共艺术中心。",
                    facts=[
                        PublicPageSupportedFact(
                            statement="项目将旧铸造厂改造为公共艺术中心。",
                            text_excerpt=context_excerpt,
                        )
                    ],
                )
            return PublicPageAnalysis(
                relevance=3,
                design_mechanism="屋顶开口把自然光引入港口博物馆展厅。",
                transfer_strategy=["沿保留屋架设置连续采光开口。"],
                facts=[
                    PublicPageSupportedFact(
                        statement="屋顶开口把自然光引入港口博物馆展厅。",
                        text_excerpt=mechanism_excerpt,
                    )
                ],
            )

    provider = DifferentProjectEvidenceProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=foundry_url,
                    title="Foundry Arts Center / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                ),
                ProviderSource(
                    url=harbor_url,
                    title="Harbor Museum | Designboom",
                    publication_tier=PublicationTier.trusted_secondary,
                ),
            ],
            assets=[],
        )
    )
    parser = ExpandingPublicPageParser(
        {
            foundry_url: ParsedPublicPage(
                source_url=foundry_url,
                title="Foundry Arts Center / Studio Example",
                markdown=context_excerpt,
            ),
            harbor_url: ParsedPublicPage(
                source_url=harbor_url,
                title="Harbor Museum | Designboom",
                markdown=mechanism_excerpt,
            ),
        }
    )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    with database.session_factory() as session:
        candidates = list(
            session.scalars(
                select(AssetCandidate)
                .where(AssetCandidate.run_id == run_id)
                .order_by(AssetCandidate.project_name)
            )
        )
        claims = {
            candidate.project_name: {
                claim.source_url
                for claim in session.scalars(
                    select(EvidenceClaim).where(EvidenceClaim.asset_candidate_id == candidate.id)
                )
            }
            for candidate in candidates
        }
        run = session.get(ResearchRun, run_id)

    assert [candidate.project_name for candidate in candidates] == [
        "Foundry Arts Center",
        "Harbor Museum",
    ]
    assert claims == {
        "Foundry Arts Center": {foundry_url},
        "Harbor Museum": {harbor_url},
    }
    assert run is not None
    assert run.coverage_report["covered_subquestions"] == 0


def test_project_text_supplement_query_is_compact_and_branch_specific() -> None:
    sectional_query = workflow_module._project_text_supplement_query(
        "GATE M West Bund Dream Center",
        "哪些更新案例通过夹层、挑空、连桥或楼梯组织清晰剖面层次？",
    )
    public_interface_query = workflow_module._project_text_supplement_query(
        "Canal Hub 1958",
        "哪些社区文化中心通过前场、共享大厅和室内外连续空间建立公共界面？",
    )

    assert sectional_query == '"GATE M West Bund Dream Center" section mezzanine'
    assert public_interface_query == '"Canal Hub 1958" public interface shared lobby'


def test_partial_project_uses_one_bounded_text_supplement_search(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    primary_url = "https://www.archdaily.com/123456/foundry-arts-center"
    supplement_urls = [
        "https://www.designboom.com/architecture/foundry-arts-center-program-01-01-2026",
        "https://www.dezeen.com/2026/01/01/foundry-arts-center-interior",
        "https://www.designboom.com/architecture/foundry-arts-center-details-01-02-2026",
    ]
    context_excerpt = "The former foundry was converted into a public arts center."
    mechanism_excerpt = (
        "A freestanding timber volume organizes workshops inside the retained brick hall."
    )

    class SupplementSearchParser:
        name = "local_browser"
        worst_case_call_seconds = 20.0

        def __init__(self) -> None:
            self.general_returned = False
            self.supplement_limits: list[int] = []
            self.supplement_domains: list[list[str]] = []
            self.urls: list[str] = []

        def search(
            self,
            query: str,
            *,
            limit: int,
            include_domains: list[str],
        ) -> list[PublicSearchLead]:
            if '"Foundry Arts Center"' in query:
                self.supplement_limits.append(limit)
                self.supplement_domains.append(include_domains)
                return [
                    PublicSearchLead(
                        url=url,
                        title="Foundry Arts Center | Supporting article",
                    )
                    for url in supplement_urls
                ]
            if self.general_returned:
                return []
            self.general_returned = True
            return [
                PublicSearchLead(
                    url=primary_url,
                    title="Foundry Arts Center / Studio Example",
                )
            ]

        def parse(self, url: str) -> ParsedPublicPage:
            self.urls.append(url)
            if url == primary_url:
                return ParsedPublicPage(
                    source_url=url,
                    title="RENOVATION Foundry Arts Center / Studio Example",
                    markdown=context_excerpt,
                )
            return ParsedPublicPage(
                source_url=url,
                title="Foundry Arts Center | Supporting article",
                markdown=mechanism_excerpt,
            )

    class BundledProjectEvidenceProvider(SingleBatchProvider):
        worst_case_page_analysis_seconds = 30.0

        def __init__(self) -> None:
            super().__init__(ProviderSearchResult(sources=[], assets=[]))
            self.analysis_calls: list[tuple[str, str]] = []

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            del question, title, drawings, analysis_requirements
            self.analysis_calls.append((source_url, page_text))
            if mechanism_excerpt not in page_text:
                return PublicPageAnalysis(
                    relevance=3,
                    project_context="项目将旧铸造厂改造为公共艺术中心。",
                    facts=[
                        PublicPageSupportedFact(
                            statement="项目将旧铸造厂改造为公共艺术中心。",
                            text_excerpt=context_excerpt,
                        )
                    ],
                )
            return PublicPageAnalysis(
                relevance=1,
                project_context="项目将旧铸造厂改造为公共艺术中心。",
                design_mechanism="独立木构体量在保留砖厅内组织工作坊。",
                transfer_strategy=["用独立结构承载工作坊，并与原砖墙保留检修缝。"],
                facts=[
                    PublicPageSupportedFact(
                        statement="项目将旧铸造厂改造为公共艺术中心。",
                        text_excerpt=context_excerpt,
                    ),
                    PublicPageSupportedFact(
                        statement="独立木构体量在保留砖厅内组织工作坊。",
                        text_excerpt=mechanism_excerpt,
                    ),
                ],
            )

    parser = SupplementSearchParser()
    provider = BundledProjectEvidenceProvider()

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        candidate = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        claims = list(
            session.scalars(
                select(EvidenceClaim).where(EvidenceClaim.asset_candidate_id == candidate.id)
            )
        )

    assert parser.supplement_limits == [2]
    assert parser.supplement_domains == [
        ["archdaily.com", "archdaily.cn", "designboom.com", "dezeen.com", "divisare.com"]
    ]
    assert parser.urls == [primary_url, *supplement_urls[:2]]
    assert all(source_url == primary_url for source_url, _ in provider.analysis_calls)
    assert sum(mechanism_excerpt in text for _, text in provider.analysis_calls) == 3
    assert candidate is not None
    assert {claim.source_url for claim in claims} == {primary_url, supplement_urls[0]}
    assert run is not None
    assert run.coverage_report["covered_subquestions"] == 3


def test_project_text_supplement_uses_evidence_from_all_same_project_candidates(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    primary_url = "https://www.archdaily.com/123456/foundry-arts-center"
    supplement_url = (
        "https://www.designboom.com/architecture/foundry-arts-center-program-01-01-2026"
    )
    context_excerpt = "The former foundry was converted into a public arts center."
    existing_mechanism_excerpt = (
        "A steel mezzanine inserts studios above the retained production floor."
    )
    target_mechanism_excerpt = (
        "A public route links the foyer, workshops, and performance hall in sequence."
    )

    with database.session_factory() as session:
        session.add_all(
            [
                AssetCandidate(
                    run_id=run_id,
                    project_name="Foundry Arts Center",
                    asset_type=ArchitectureAssetType.photograph.value,
                    source_url=primary_url,
                    image_url="https://images.example/foundry-1.jpg",
                    publication_tier=PublicationTier.trusted_secondary.value,
                    project_identity=AssociationStatus.confirmed.value,
                    result_tier=ResultTier.partial.value,
                    relevance=2,
                    rank_index=0,
                ),
                AssetCandidate(
                    run_id=run_id,
                    project_name="Foundry Arts Center",
                    asset_type=ArchitectureAssetType.section.value,
                    source_url=primary_url,
                    image_url="https://images.example/foundry-2.jpg",
                    publication_tier=PublicationTier.trusted_secondary.value,
                    project_identity=AssociationStatus.confirmed.value,
                    result_tier=ResultTier.partial.value,
                    relevance=3,
                    subquestion_ids=["program_insertion"],
                    project_context="项目将旧铸造厂改造为公共艺术中心。",
                    design_mechanism="钢夹层在保留生产大厅上方植入工作室。",
                    transfer_strategy=["用独立钢结构承载新增工作室。"],
                    subquestion_analysis={
                        "program_insertion": {
                            "project_context": "项目将旧铸造厂改造为公共艺术中心。",
                            "design_mechanism": "钢夹层在保留生产大厅上方植入工作室。",
                            "transfer_strategy": ["用独立钢结构承载新增工作室。"],
                            "observations": [],
                            "limitations": [],
                        }
                    },
                    rank_index=1,
                ),
            ]
        )
        session.flush()
        analyzed_candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == "https://images.example/foundry-2.jpg",
            )
        )
        assert analyzed_candidate is not None
        session.add_all(
            [
                EvidenceClaim(
                    asset_candidate_id=analyzed_candidate.id,
                    claim_type="fact",
                    statement="项目将旧铸造厂改造为公共艺术中心。",
                    source_url=primary_url,
                    text_excerpt=context_excerpt,
                ),
                EvidenceClaim(
                    asset_candidate_id=analyzed_candidate.id,
                    claim_type="fact",
                    statement="钢夹层在保留生产大厅上方植入工作室。",
                    source_url=primary_url,
                    text_excerpt=existing_mechanism_excerpt,
                ),
            ]
        )
        session.commit()

    class SupplementParser:
        name = "local_browser"
        worst_case_call_seconds = 20.0

        def __init__(self) -> None:
            self.search_calls = 0
            self.search_queries: list[str] = []

        def search(
            self,
            query: str,
            *,
            limit: int,
            include_domains: list[str],
        ) -> list[PublicSearchLead]:
            del include_domains
            self.search_calls += 1
            self.search_queries.append(query)
            assert limit == 2
            return [
                PublicSearchLead(
                    url=supplement_url,
                    title="Foundry Arts Center | Designboom",
                )
            ]

        def parse(self, url: str) -> ParsedPublicPage:
            assert url == supplement_url
            return ParsedPublicPage(
                source_url=url,
                title="Foundry Arts Center | Designboom",
                markdown=target_mechanism_excerpt,
            )

    class SupplementProvider(SingleBatchProvider):
        worst_case_page_analysis_seconds = 30.0

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            del question, source_url, title, drawings, analysis_requirements
            assert context_excerpt in page_text
            assert target_mechanism_excerpt in page_text
            return PublicPageAnalysis(
                relevance=1,
                project_context="项目将旧铸造厂改造为公共艺术中心。",
                design_mechanism="公共路径依次连接门厅、工作坊与演出厅。",
                transfer_strategy=["把公共空间按到达、参与和集会顺序串联。"],
                facts=[
                    PublicPageSupportedFact(
                        statement="项目将旧铸造厂改造为公共艺术中心。",
                        text_excerpt=context_excerpt,
                    ),
                    PublicPageSupportedFact(
                        statement="公共路径依次连接门厅、工作坊与演出厅。",
                        text_excerpt=target_mechanism_excerpt,
                    ),
                ],
            )

    parser = SupplementParser()
    provider = SupplementProvider(ProviderSearchResult(sources=[], assets=[]))
    primary_source = ProviderSource(
        url=primary_url,
        title="Foundry Arts Center / Studio Example",
        publication_tier=PublicationTier.trusted_secondary,
    )
    added = workflow_module._try_project_text_supplement(
        database,
        run_id,
        provider,
        primary_source,
        ParsedPublicPage(
            source_url=primary_url,
            title="RENOVATION Foundry Arts Center / Studio Example",
            markdown=context_excerpt,
        ),
        question="如何按使用顺序组织新功能？",
        subquestion_id="program_sequence",
        analysis_requirements=[],
        public_search_provider=parser,
        public_page_parser=parser,
        parsed_pages={
            primary_url: ParsedPublicPage(
                source_url=primary_url,
                title="RENOVATION Foundry Arts Center / Studio Example",
                markdown=context_excerpt,
            )
        },
        supplement_attempted=set(),
        supplement_pages={},
        remaining_seconds=lambda: 300.0,
    )

    with database.session_factory() as session:
        candidates = list(
            session.scalars(
                select(AssetCandidate)
                .where(AssetCandidate.run_id == run_id)
                .order_by(AssetCandidate.rank_index)
            )
        )
        supplemented_candidate = next(
            candidate
            for candidate in candidates
            if "program_sequence" in (candidate.subquestion_ids or [])
        )
        claims = list(
            session.scalars(
                select(EvidenceClaim).where(
                    EvidenceClaim.asset_candidate_id == supplemented_candidate.id
                )
            )
        )

    assert parser.search_calls == 1
    assert parser.search_queries == ['"Foundry Arts Center" program insertion']
    assert added == 1
    assert supplemented_candidate.subquestion_ids == ["program_sequence"]
    assert {claim.source_url for claim in claims} == {primary_url, supplement_url}


def test_useful_partial_text_result_is_not_blocked_or_sent_to_visual_batch(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    project_url = "https://www.archdaily.com/123456/foundry-arts-center"
    context_excerpt = "The former foundry was converted into a public arts center."
    mechanism_excerpt = (
        "A freestanding timber volume organizes workshops inside the retained brick hall."
    )

    class OneBranchEvidenceProvider(SingleBatchProvider):
        worst_case_page_analysis_seconds = 30.0

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            del source_url, title, page_text, drawings, analysis_requirements
            if "新旧功能" not in question:
                return PublicPageAnalysis(relevance=0)
            return PublicPageAnalysis(
                relevance=3,
                project_context="项目将旧铸造厂改造为公共艺术中心。",
                design_mechanism="独立木构体量在保留砖厅内组织工作坊。",
                transfer_strategy=["用独立结构承载工作坊，并与原砖墙保留检修缝。"],
                facts=[
                    PublicPageSupportedFact(
                        statement="项目将旧铸造厂改造为公共艺术中心。",
                        text_excerpt=context_excerpt,
                    ),
                    PublicPageSupportedFact(
                        statement="独立木构体量在保留砖厅内组织工作坊。",
                        text_excerpt=mechanism_excerpt,
                    ),
                ],
            )

    provider = OneBranchEvidenceProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Foundry Arts Center / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[],
        )
    )
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url="https://cdn.example/foundry-gallery.jpg", alt="")],
        markdown=f"{context_excerpt} {mechanism_excerpt}",
    )
    classifier = RecordingRemoteClassifier()

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=parser,
        visual_classifier=classifier,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)

    assert run is not None
    assert run.status == RunStatus.partial.value
    assert run.coverage_report["covered_subquestions"] == 1
    assert classifier.remote_calls == []


def test_evidence_complete_page_analysis_prefers_an_intent_matching_preview(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    project_url = "https://www.archdaily.com/123456/courtyard-archive"
    plan_url = "https://cdn.example/courtyard-ground-floor-plan.jpg"
    photo_url = "https://cdn.example/courtyard-photo.jpg"

    class MissingDrawingBindingProvider(AnalyzingPageProvider):
        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            return (
                super()
                .analyze_public_page(
                    question=question,
                    source_url=source_url,
                    title=title,
                    page_text=page_text,
                    drawings=drawings,
                    analysis_requirements=analysis_requirements,
                )
                .model_copy(update={"drawing_ids": []})
            )

    provider = MissingDrawingBindingProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Courtyard Archive / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[],
        )
    )
    parser = RecordingPublicPageParser(
        [
            ParsedPageImage(url=plan_url, alt="Ground floor plan"),
            ParsedPageImage(url=photo_url, alt="Project photograph"),
        ],
        markdown=(
            "The service entrance is located on the east side. "
            "Visitors enter from the public courtyard."
        ),
    )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    with database.session_factory() as session:
        candidates = {
            candidate.image_url: candidate
            for candidate in session.scalars(
                select(AssetCandidate).where(AssetCandidate.run_id == run_id)
            )
        }

    assert candidates[plan_url].design_mechanism == ("将后勤入口与公众入口分置在建筑两侧。")
    assert candidates[plan_url].transfer_strategy
    assert any(
        branch.get("design_mechanism")
        for branch in candidates[plan_url].subquestion_analysis.values()
    )
    photo = candidates.get(photo_url)
    assert photo is None or (photo.design_mechanism == "" and photo.subquestion_analysis == {})


def test_research_synthesis_deduplicates_identical_same_type_page_cases(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    project_url = "https://www.archdaily.com/123456/courtyard-archive"
    images = [
        ParsedPageImage(url="https://cdn.example/section-a.jpg", alt="Section A"),
        ParsedPageImage(url="https://cdn.example/section-b.jpg", alt="Section B"),
        ParsedPageImage(url="https://cdn.example/ground-floor-plan.jpg", alt="Ground floor plan"),
    ]

    class MultiDrawingSynthesisProvider(AnalyzingPageProvider):
        def __init__(self) -> None:
            super().__init__(
                ProviderSearchResult(
                    sources=[
                        ProviderSource(
                            url=project_url,
                            title="Courtyard Archive / Studio Example",
                            publication_tier=PublicationTier.trusted_secondary,
                        )
                    ],
                    assets=[],
                )
            )
            self.synthesis_cases: list[ResearchSynthesisCase] = []

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            analysis = super().analyze_public_page(
                question=question,
                source_url=source_url,
                title=title,
                page_text=page_text,
                drawings=drawings,
                analysis_requirements=analysis_requirements,
            )
            return analysis.model_copy(
                update={"drawing_ids": [drawing.drawing_id for drawing in drawings]}
            )

        def synthesize_research(
            self,
            *,
            question: str,
            budget_mode: BudgetMode,
            subquestions: Sequence[ResearchSubquestion],
            cases: Sequence[ResearchSynthesisCase],
        ) -> ResearchSynthesis:
            del question, budget_mode, subquestions
            self.synthesis_cases = list(cases)
            finding = ResearchSynthesisFinding(
                statement="分置公众与后勤入口，减少路径冲突。",
                evidence_asset_ids=[cases[0].asset_id],
            )
            return ResearchSynthesis(
                answer=finding,
                causal_chains=[finding],
                recommendations=[finding],
            )

    provider = MultiDrawingSynthesisProvider()
    parser = RecordingPublicPageParser(
        images,
        markdown=(
            "The service entrance is located on the east side. "
            "Visitors enter from the public courtyard."
        ),
    )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    assert len(provider.synthesis_cases) == 2
    assert {case.asset_type for case in provider.synthesis_cases} == {
        ArchitectureAssetType.plan,
        ArchitectureAssetType.section,
    }


def test_research_synthesis_case_identity_preserves_distinct_analysis_and_evidence() -> None:
    branch = ResearchSynthesisBranchAnalysis(
        project_context="项目保留原有柱网。",
        design_mechanism="新体量从原柱网退让。",
        transfer_strategy=["先标出保留柱网。", "再控制新体量退界。"],
        limitations=["节点构造仍需核对。"],
        evidence=["项目保留原有柱网。｜原文：The existing grid is retained."],
    )
    case = ResearchSynthesisCase(
        asset_id="section-a",
        project_name="Courtyard Archive",
        asset_type=ArchitectureAssetType.section,
        source_url="https://www.archdaily.com/123456/courtyard-archive",
        subquestion_ids=["interface", "section"],
        project_context="项目保留原有柱网。",
        design_mechanism="新体量从原柱网退让。",
        transfer_strategy=["先标出保留柱网。", "再控制新体量退界。"],
        limitations=["节点构造仍需核对。"],
        evidence=[
            "项目保留原有柱网。｜原文：The existing grid is retained.",
            "新体量从原柱网退让。｜原文：The new volume steps back from the grid.",
        ],
        subquestion_analysis={"interface": branch},
    )
    reordered_duplicate = case.model_copy(
        update={
            "asset_id": "section-b",
            "subquestion_ids": list(reversed(case.subquestion_ids)),
            "evidence": list(reversed(case.evidence)),
        }
    )
    distinct_analysis = case.model_copy(
        update={
            "subquestion_analysis": {
                "interface": branch.model_copy(update={"design_mechanism": "新体量跨接原有柱网。"})
            }
        }
    )
    distinct_evidence = case.model_copy(
        update={"evidence": [*case.evidence, "补充证据｜原文：Additional evidence."]}
    )

    assert research_synthesis_case_identity(case) == research_synthesis_case_identity(
        reordered_duplicate
    )
    assert research_synthesis_case_identity(case) != research_synthesis_case_identity(
        distinct_analysis
    )
    assert research_synthesis_case_identity(case) != research_synthesis_case_identity(
        distinct_evidence
    )


@pytest.mark.parametrize(
    ("rejected_call", "expected_subquestion_ids"),
    [
        (None, {"program", "circulation", "section"}),
        (0, {"circulation", "section"}),
        (2, {"program", "circulation"}),
    ],
)
def test_cached_direct_project_page_is_reanalyzed_for_each_new_subquestion(
    tmp_path: Path,
    rejected_call: int | None,
    expected_subquestion_ids: set[str],
) -> None:
    case_root = tmp_path / ("all-supported" if rejected_call is None else "section-rejected")
    case_root.mkdir()
    database, run_id = _database_with_run(case_root, max_pages=3)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {**run.budget, "max_queries": 3}
        session.commit()

    project_url = "https://www.archdaily.com/123456/courtyard-archive"
    image_url = "https://cdn.example/courtyard-section.png"
    page_text = " ".join(
        f"Project condition {index}. Design mechanism {index}." for index in range(3)
    )

    class BranchAnalyzingProvider(AnalyzingPageProvider):
        def __init__(self, result: ProviderSearchResult) -> None:
            super().__init__(result)
            self.questions: list[str] = []

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            del source_url, title, page_text, analysis_requirements
            call_index = len(self.questions)
            self.questions.append(question)
            self.analysis_calls.append(drawings)
            if call_index == rejected_call:
                return PublicPageAnalysis(
                    relevance=4,
                    drawing_ids=[drawings[0].drawing_id],
                    limitations=["正文不支持这个子问题的设计机制。"],
                )
            context = f"项目条件 {call_index}"
            mechanism = f"设计机制 {call_index}"
            return PublicPageAnalysis(
                relevance=4,
                drawing_ids=[drawings[0].drawing_id],
                project_context=context,
                design_mechanism=mechanism,
                transfer_strategy=[f"转译步骤 {call_index}"],
                facts=[
                    PublicPageSupportedFact(
                        statement=context,
                        text_excerpt=f"Project condition {call_index}.",
                    ),
                    PublicPageSupportedFact(
                        statement=mechanism,
                        text_excerpt=f"Design mechanism {call_index}.",
                    ),
                ],
            )

    provider = BranchAnalyzingProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Courtyard Archive / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[],
        )
    )
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url=image_url, alt="Section")],
        markdown=page_text,
    )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == image_url,
            )
        )
        run = session.get(ResearchRun, run_id)

    assert parser.urls == [project_url]
    assert len(provider.questions) == 3
    assert len(set(provider.questions)) == 3
    assert candidate is not None
    assert set(candidate.subquestion_analysis) == {"program", "circulation", "section"}
    article_ready_analysis = {
        subquestion_id
        for subquestion_id, analysis in candidate.subquestion_analysis.items()
        if analysis["project_context"]
        and analysis["design_mechanism"]
        and analysis["transfer_strategy"]
    }
    assert article_ready_analysis == expected_subquestion_ids
    assert run is not None
    assert set(run.coverage_report["covered_subquestion_ids"]) == expected_subquestion_ids


def test_article_ready_page_without_images_is_reanalyzed_when_later_searches_do_not_return_it(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {**run.budget, "max_queries": 3}
        session.commit()

    strong_url = "https://www.archdaily.com/123456/courtyard-archive"
    weak_urls = [
        "https://www.archdaily.com/123457/weak-project-one",
        "https://www.archdaily.com/123458/weak-project-two",
    ]

    class DivergingSearchProvider(TextFirstPageProvider):
        def __init__(self) -> None:
            super().__init__(ProviderSearchResult(assets=[]))
            self.search_count = 0
            self.analysis_sources: list[str] = []
            self.analysis_questions: list[str] = []

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del query, goal, allowed_domains
            source_url = strong_url if self.search_count == 0 else weak_urls[self.search_count - 1]
            self.search_count += 1
            return ProviderSearchResult(
                sources=[
                    ProviderSource(
                        url=source_url,
                        title="Courtyard Archive / Studio Example",
                        publication_tier=PublicationTier.trusted_secondary,
                    )
                ],
                assets=[],
            )

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            self.analysis_sources.append(source_url)
            self.analysis_questions.append(question)
            return super().analyze_public_page(
                question=question,
                source_url=source_url,
                title=title,
                page_text=page_text,
                drawings=drawings,
                analysis_requirements=analysis_requirements,
            )

    parser = ExpandingPublicPageParser(
        {
            strong_url: ParsedPublicPage(
                source_url=strong_url,
                title="Courtyard Archive / Studio Example",
                markdown=(
                    "The former factory was converted into a community cultural center. "
                    "Independent inserted volumes organize galleries and workshops inside the "
                    "retained shell."
                ),
                images=[],
            ),
            **{
                weak_url: ParsedPublicPage(
                    source_url=weak_url,
                    title="Weak Project / Studio Example",
                    markdown="The article only identifies the project year.",
                )
                for weak_url in weak_urls
            },
        }
    )
    provider = DivergingSearchProvider()

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    assert provider.analysis_sources.count(strong_url) == 3
    assert len(set(provider.analysis_questions)) == 3
    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.source_url == strong_url,
            )
        )
    assert candidate is not None
    assert candidate.image_url is None
    assert set(candidate.subquestion_analysis) == {"program", "circulation", "section"}


def test_article_ready_page_reuse_prefers_more_issue_matching_drawings(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {**run.budget, "max_queries": 3}
        session.commit()

    first_url = "https://www.archdaily.com/123456/blue-warehouse-school"
    section_url = "https://www.archdaily.com/123457/layered-bank-renovation"
    weak_url = "https://www.archdaily.com/123458/weak-project"
    source_urls = [first_url, section_url, weak_url]

    class RankedReuseProvider(AnalyzingPageProvider):
        def __init__(self) -> None:
            super().__init__(ProviderSearchResult(assets=[]))
            self.search_count = 0
            self.analysis_sources: list[str] = []

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del query, goal, allowed_domains
            source_url = source_urls[self.search_count]
            self.search_count += 1
            return ProviderSearchResult(
                sources=[
                    ProviderSource(
                        url=source_url,
                        title="Adaptive Reuse Project / Studio Example",
                        publication_tier=PublicationTier.trusted_secondary,
                    )
                ],
                assets=[],
            )

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            self.analysis_sources.append(source_url)
            return super().analyze_public_page(
                question=question,
                source_url=source_url,
                title=title,
                page_text=page_text,
                drawings=drawings,
                analysis_requirements=analysis_requirements,
            )

    supported_text = (
        "The service entrance is located on the east side. "
        "Visitors enter from the public courtyard."
    )
    parser = ExpandingPublicPageParser(
        {
            first_url: ParsedPublicPage(
                source_url=first_url,
                title="Blue Warehouse School / Studio Example",
                markdown=supported_text,
                images=[ParsedPageImage(url="https://cdn.example/blue-section.jpg", alt="Section")],
            ),
            section_url: ParsedPublicPage(
                source_url=section_url,
                title="Layered Bank Renovation / Studio Example",
                markdown=supported_text,
                images=[
                    ParsedPageImage(
                        url="https://cdn.example/bank-section-a.jpg",
                        alt="Section A",
                    ),
                    ParsedPageImage(
                        url="https://cdn.example/bank-section-b.jpg",
                        alt="Section B",
                    ),
                ],
            ),
            weak_url: ParsedPublicPage(
                source_url=weak_url,
                title="Weak Project / Studio Example",
                markdown="The article only identifies the project year.",
            ),
        }
    )
    provider = RankedReuseProvider()

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    assert provider.analysis_sources[-2] == section_url
    assert len(provider.analysis_calls[-2]) == 2


def test_cached_direct_project_page_analysis_is_not_repeated_for_the_same_subquestion(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {
            **run.budget,
            "max_queries": 6,
            "completion_recovery_rounds": 1,
            "completion_recovery_pages_per_subquestion": 1,
        }
        session.commit()

    project_url = "https://www.archdaily.com/123456/courtyard-archive"
    image_url = "https://cdn.example/courtyard-section.png"

    class UnsupportedBranchProvider(AnalyzingPageProvider):
        def __init__(self, result: ProviderSearchResult) -> None:
            super().__init__(result)
            self.search_calls = 0
            self.questions: list[str] = []

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            self.search_calls += 1
            return super().search(query, goal, allowed_domains)

        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            del source_url, title, page_text, analysis_requirements
            self.questions.append(question)
            self.analysis_calls.append(drawings)
            return PublicPageAnalysis(
                relevance=4,
                drawing_ids=[drawings[0].drawing_id],
                limitations=["正文不支持这个子问题的设计机制。"],
            )

    provider = UnsupportedBranchProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Courtyard Archive / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[],
        )
    )
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url=image_url, alt="Section")],
        markdown="The article does not state a supported design mechanism.",
    )

    execute_research_run(database, run_id, provider, public_page_parser=parser)

    assert provider.search_calls > 3
    assert len(provider.questions) == 3
    assert len(set(provider.questions)) == 3
    assert parser.urls == [project_url]


def test_collected_page_analysis_rejects_facts_without_a_verbatim_source_excerpt(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    project_url = "https://www.archdaily.com/123456/courtyard-archive"
    image_url = "https://cdn.example/courtyard-floor-plan.png"

    class InvalidEvidenceProvider(AnalyzingPageProvider):
        def analyze_public_page(
            self,
            *,
            question: str,
            source_url: str,
            title: str,
            page_text: str,
            drawings: list[PublicPageDrawing],
            analysis_requirements: Sequence[str],
        ) -> PublicPageAnalysis:
            del question, source_url, title, page_text, analysis_requirements
            self.analysis_calls.append(drawings)
            return PublicPageAnalysis(
                relevance=4,
                drawing_ids=[drawings[0].drawing_id],
                project_context="项目将服务入口设置在东侧。",
                design_mechanism="将公众与后勤路径分置。",
                transfer_strategy=["分别标注两类入口。"],
                facts=[
                    PublicPageSupportedFact(
                        statement="项目将服务入口设置在东侧。",
                        text_excerpt="This sentence is not present on the page.",
                    )
                ],
            )

    provider = InvalidEvidenceProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Courtyard Archive / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[],
        )
    )
    parser = RecordingPublicPageParser([ParsedPageImage(url=image_url, alt="Ground floor plan")])

    execute_research_run(
        database,
        run_id,
        provider,
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == image_url,
            )
        )
        unsupported_claim = session.scalar(
            select(EvidenceClaim).where(
                EvidenceClaim.asset_candidate_id == candidate.id,
                EvidenceClaim.statement == "项目将服务入口设置在东侧。",
            )
        )
        run = session.get(ResearchRun, run_id)
    assert candidate is not None
    assert candidate.project_context == ""
    assert candidate.design_mechanism == ""
    assert candidate.transfer_strategy == []
    assert candidate.subquestion_analysis["program"]["design_mechanism"] == ""
    assert candidate.subquestion_analysis["program"]["transfer_strategy"] == []
    assert "项目将服务入口设置在东侧。" not in candidate.facts
    assert unsupported_claim is None
    assert run is not None
    assert "article_analysis_incomplete" in run.coverage_report["gaps"]


def test_local_browser_expands_one_project_page_and_promotes_exact_image_evidence(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    parent_url = "https://magazine.example/tag/adaptive-reuse"
    child_url = "https://magazine.example/projects/courtyard-archive"
    image_url = "https://cdn.example/courtyard-floor-plan.png"
    shared_image = ParsedPageImage(url=image_url, alt="Ground floor plan")
    parser = ExpandingPublicPageParser(
        {
            parent_url: ParsedPublicPage(
                source_url=parent_url,
                title="Adaptive reuse roundup",
                links=[child_url, "https://magazine.example/about"],
                images=[shared_image],
            ),
            child_url: ParsedPublicPage(
                source_url=child_url,
                title="Courtyard Archive",
                description="Adaptive reuse project page",
                images=[shared_image],
            ),
        }
    )
    result = _provider_result(parent_url)
    result.sources[0].publication_tier = PublicationTier.trusted_secondary

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(result),
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        promoted = list(
            session.scalars(
                select(AssetCandidate).where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.image_url == image_url,
                )
            )
        )
        child_source = session.scalar(
            select(SourcePage).where(
                SourcePage.run_id == run_id,
                SourcePage.url == child_url,
            )
        )
        claims = list(
            session.scalars(
                select(EvidenceClaim).where(
                    EvidenceClaim.asset_candidate_id == promoted[0].id,
                    EvidenceClaim.claim_type == "fact",
                )
            )
        )
        events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))

    assert parser.urls == [parent_url, child_url]
    assert child_source is not None
    assert child_source.publication_tier == PublicationTier.trusted_secondary.value
    assert len(promoted) == 1
    candidate = promoted[0]
    assert candidate.source_url == child_url
    assert candidate.project_name == "Courtyard Archive"
    assert candidate.result_tier == ResultTier.partial.value
    assert candidate.project_identity == AssociationStatus.probable.value
    assert candidate.asset_association == AssociationStatus.confirmed.value
    assert candidate.primary_source == PrimarySourceStatus.unknown.value
    assert candidate.rights_status == RightsStatus.unknown.value
    assert candidate.facts == ["Courtyard Archive 项目页直接列出了这张平面图。"]
    assert [claim.source_url for claim in claims] == [child_url]
    assert claims[0].text_excerpt == "Ground floor plan"
    assert any(
        event.tool == "local_browser_expand"
        and event.summary.get("status") == "completed"
        and event.summary.get("promoted") == 1
        for event in events
    )


def test_expanded_project_prefers_the_same_source_candidate_for_a_shared_image(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    shared_image_url = "https://cdn.example/shared-sidebar-plan.png"
    other_url = "https://magazine.example/projects/other"
    target_url = "https://magazine.example/projects/target"
    with database.session_factory() as session:
        session.add_all(
            [
                SourcePage(run_id=run_id, url=other_url),
                SourcePage(run_id=run_id, url=target_url),
                AssetCandidate(
                    run_id=run_id,
                    project_name="Other project",
                    asset_type="plan",
                    source_url=other_url,
                    image_url=shared_image_url,
                ),
                AssetCandidate(
                    run_id=run_id,
                    project_name="Target project",
                    asset_type="plan",
                    source_url=target_url,
                    image_url=shared_image_url,
                ),
            ]
        )
        session.commit()

    promoted = _persist_expanded_project_page(
        database,
        run_id,
        ProviderSource(
            url=target_url,
            publication_tier=PublicationTier.trusted_secondary,
        ),
        ParsedPublicPage(
            source_url=target_url,
            title="Target project",
            images=[ParsedPageImage(url=shared_image_url, alt="Ground floor plan")],
        ),
        subquestion_id="flow_separation",
    )

    with database.session_factory() as session:
        candidates = list(
            session.scalars(
                select(AssetCandidate)
                .where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.image_url == shared_image_url,
                )
                .order_by(AssetCandidate.source_url)
            )
        )

    assert promoted == 1
    assert len(candidates) == 2
    assert candidates[0].source_url == other_url
    assert candidates[0].result_tier == ResultTier.visual_lead.value
    assert candidates[1].source_url == target_url
    assert candidates[1].result_tier == ResultTier.partial.value


def test_remote_visual_batch_is_reserved_for_the_expanded_project_drawings(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    parent_url = "https://magazine.example/tag/adaptive-reuse"
    child_url = "https://magazine.example/projects/courtyard-archive"
    circulation_url = "https://cdn.example/courtyard-circulation-diagram.png"
    plan_url = "https://cdn.example/courtyard-floor-plan.png"
    parser = ExpandingPublicPageParser(
        {
            parent_url: ParsedPublicPage(
                source_url=parent_url,
                title="Adaptive reuse roundup",
                links=[child_url],
                images=[
                    ParsedPageImage(
                        url=f"https://cdn.example/roundup-photo-{index}.jpg",
                        alt="",
                    )
                    for index in range(1, 5)
                ],
            ),
            child_url: ParsedPublicPage(
                source_url=child_url,
                title="Courtyard Archive",
                description="Adaptive reuse project page",
                images=[
                    ParsedPageImage(url=plan_url, alt="Ground floor plan"),
                    ParsedPageImage(url=circulation_url, alt="Circulation diagram"),
                ],
            ),
        }
    )
    classifier = RecordingRemoteClassifier()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result(parent_url)),
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    assert len(classifier.remote_calls) == 1
    assert [candidate.image_url for candidate in classifier.remote_calls[0]] == [
        circulation_url,
        plan_url,
    ]
    with database.session_factory() as session:
        circulation = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == circulation_url,
            )
        )
    assert circulation is not None
    assert circulation.result_tier == ResultTier.partial.value
    assert circulation.observations == ["可见错层楼板、贯通楼梯和挑空空间。"]
    branch_analysis = circulation.subquestion_analysis["program"]
    assert branch_analysis["observations"] == ["可见错层楼板、贯通楼梯和挑空空间。"]


def test_article_analysis_does_not_wait_for_remote_visual_classification(
    tmp_path: Path,
) -> None:
    class DrawingOnlyRemoteClassifier(RecordingRemoteClassifier):
        def classify_remote_batch(
            self,
            candidates: list[RemoteVisualCandidate],
            *,
            question: str,
            project_text: str,
        ) -> RemoteVisualClassificationBatch:
            del question, project_text
            self.remote_calls.append(candidates)
            return RemoteVisualClassificationBatch(
                classifications=[
                    RemoteVisualClassification(
                        candidate_id=candidate.candidate_id,
                        asset_type=(
                            ArchitectureAssetType.section
                            if candidate.image_url.endswith("strong-drawing.jpg")
                            else None
                        ),
                        relevance=(4 if candidate.image_url.endswith("strong-drawing.jpg") else 0),
                        observations=(
                            ["可见新夹层、贯通楼梯与既有高跨共同形成剖面层次。"]
                            if candidate.image_url.endswith("strong-drawing.jpg")
                            else []
                        ),
                    )
                    for candidate in candidates
                ]
            )

    database, run_id = _database_with_run(tmp_path, max_pages=2)
    weak_url = "https://www.archdaily.com/100001/weak-hall"
    strong_url = "https://www.archdaily.com/100002/layered-hall"
    strong_image_url = "https://cdn.example/strong-drawing.jpg"
    parser = ExpandingPublicPageParser(
        {
            weak_url: ParsedPublicPage(
                source_url=weak_url,
                title="Weak Hall / Example Studio",
                markdown="The article only describes the renovated facade and material palette.",
                images=[
                    ParsedPageImage(
                        url=f"https://cdn.example/weak-photo-{index}.jpg",
                        alt="",
                    )
                    for index in range(1, 5)
                ],
            ),
            strong_url: ParsedPublicPage(
                source_url=strong_url,
                title="Layered Hall / Example Studio",
                markdown=(
                    "The service entrance is located on the east side. "
                    "Visitors enter from the public courtyard."
                ),
                images=[ParsedPageImage(url=strong_image_url, alt="")],
            ),
        }
    )
    provider = AnalyzingPageProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=weak_url,
                    title="Weak Hall / Example Studio",
                    publication_tier=PublicationTier.trusted_secondary,
                ),
                ProviderSource(
                    url=strong_url,
                    title="Layered Hall / Example Studio",
                    publication_tier=PublicationTier.trusted_secondary,
                ),
            ],
            assets=[],
        )
    )
    classifier = DrawingOnlyRemoteClassifier()

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    assert len(classifier.remote_calls) == 1
    assert provider.analysis_calls
    assert any(
        drawings and drawings[0].image_url == strong_image_url
        for drawings in provider.analysis_calls
    )
    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == strong_image_url,
            )
        )
    assert candidate is not None
    assert candidate.design_mechanism == "将后勤入口与公众入口分置在建筑两侧。"


def test_cross_page_remote_batch_prefers_current_project_identity(tmp_path: Path) -> None:
    page_urls = [
        f"https://www.archdaily.com/10000{index}/archive-hall-{index}" for index in range(1, 5)
    ]
    current_images = [
        f"https://cdn.example/archive-hall-{index}-project-image.jpg" for index in range(1, 5)
    ]
    parser = ExpandingPublicPageParser(
        {
            page_url: ParsedPublicPage(
                source_url=page_url,
                title=f"Archive Hall {index} / Example Studio",
                markdown=(
                    "The project article describes the existing hall and inserted public rooms."
                ),
                images=[
                    ParsedPageImage(
                        url=current_images[index - 1],
                        alt=f"Archive Hall {index}",
                    ),
                    ParsedPageImage(
                        url=f"https://cdn.example/unrelated-school-news-{index}.jpg",
                        alt="Related school news",
                    ),
                ],
            )
            for index, page_url in enumerate(page_urls, start=1)
        }
    )
    classifier = RecordingRemoteClassifier()
    database, run_id = _database_with_run(tmp_path, max_pages=4)

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result(*page_urls)),
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    assert len(classifier.remote_calls) == 1
    assert [candidate.image_url for candidate in classifier.remote_calls[0]] == current_images


def test_remote_visual_batch_stays_deferred_until_all_text_branches_are_covered(
    tmp_path: Path,
) -> None:
    class RecoveryProjectProvider(AnalyzingPageProvider):
        def __init__(self) -> None:
            super().__init__(ProviderSearchResult(sources=[], assets=[]))
            self.program_calls = 0

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del goal, allowed_domains
            if "[program]" not in query:
                return ProviderSearchResult(sources=[], assets=[])
            self.program_calls += 1
            url = weak_url if self.program_calls == 1 else strong_url
            return ProviderSearchResult(
                sources=[
                    ProviderSource(
                        url=url,
                        title=(
                            "Weak Hall / Example Studio"
                            if url == weak_url
                            else "Strong Factory / Example Studio"
                        ),
                        publication_tier=PublicationTier.trusted_secondary,
                    )
                ],
                assets=[],
            )

    class RecoveryDrawingClassifier(RecordingRemoteClassifier):
        def classify_remote_batch(
            self,
            candidates: list[RemoteVisualCandidate],
            *,
            question: str,
            project_text: str,
        ) -> RemoteVisualClassificationBatch:
            del question, project_text
            self.remote_calls.append(candidates)
            return RemoteVisualClassificationBatch(
                classifications=[
                    RemoteVisualClassification(
                        candidate_id=candidate.candidate_id,
                        asset_type=(
                            ArchitectureAssetType.section
                            if candidate.image_url.endswith("recovery-drawing.jpg")
                            else None
                        ),
                        relevance=(
                            4 if candidate.image_url.endswith("recovery-drawing.jpg") else 0
                        ),
                        observations=(
                            ["可见恢复轮项目的新夹层、楼梯与既有厂房高跨。"]
                            if candidate.image_url.endswith("recovery-drawing.jpg")
                            else []
                        ),
                    )
                    for candidate in candidates
                ]
            )

    database, run_id = _database_with_run(tmp_path, max_pages=1)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {
            **run.budget,
            "max_rounds": 1,
            "max_queries": 1,
            "completion_recovery_rounds": 1,
            "completion_recovery_pages_per_subquestion": 1,
        }
        session.commit()
    weak_url = "https://www.archdaily.com/100003/weak-hall"
    strong_url = "https://www.archdaily.com/100004/strong-factory"
    strong_image_url = "https://cdn.example/recovery-drawing.jpg"
    parser = ExpandingPublicPageParser(
        {
            weak_url: ParsedPublicPage(
                source_url=weak_url,
                title="Weak Hall / Example Studio",
                markdown="The article describes only facade materials.",
                images=[
                    ParsedPageImage(url=f"https://cdn.example/weak-{index}.jpg", alt="")
                    for index in range(1, 5)
                ],
            ),
            strong_url: ParsedPublicPage(
                source_url=strong_url,
                title="Strong Factory / Example Studio",
                markdown=(
                    "The service entrance is located on the east side. "
                    "Visitors enter from the public courtyard."
                ),
                images=[ParsedPageImage(url=strong_image_url, alt="")],
            ),
        }
    )
    provider = RecoveryProjectProvider()
    classifier = RecoveryDrawingClassifier()

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    assert provider.program_calls == 2
    assert classifier.remote_calls == []
    assert provider.analysis_calls
    assert any(
        drawings and drawings[0].image_url == strong_image_url
        for drawings in provider.analysis_calls
    )


def test_cached_project_page_evidence_is_reassociated_when_later_questions_find_it(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {**run.budget, "max_queries": 3}
        session.commit()

    parent_url = "https://magazine.example/tag/adaptive-reuse"
    child_url = "https://magazine.example/projects/courtyard-archive"
    image_url = "https://cdn.example/courtyard-floor-plan.png"
    shared_image = ParsedPageImage(url=image_url, alt="Ground floor plan")
    parser = ExpandingPublicPageParser(
        {
            parent_url: ParsedPublicPage(
                source_url=parent_url,
                title="Adaptive reuse roundup",
                links=[child_url],
                images=[shared_image],
            ),
            child_url: ParsedPublicPage(
                source_url=child_url,
                title="Courtyard Archive",
                images=[shared_image],
            ),
        }
    )

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result(parent_url)),
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == image_url,
            )
        )
        run = session.get(ResearchRun, run_id)

    assert parser.urls == [parent_url, child_url]
    assert candidate is not None
    assert set(candidate.subquestion_ids) == {"program", "circulation", "section"}
    assert run is not None
    assert run.coverage_report["covered_subquestions"] == 3


def test_local_browser_expansion_respects_the_existing_page_budget(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    parent_url = "https://magazine.example/tag/adaptive-reuse"
    child_url = "https://magazine.example/projects/courtyard-archive"
    parser = ExpandingPublicPageParser(
        {
            parent_url: ParsedPublicPage(source_url=parent_url, links=[child_url]),
            child_url: ParsedPublicPage(source_url=child_url, title="Courtyard Archive"),
        }
    )

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result(parent_url)),
        public_page_parser=parser,
    )

    assert parser.urls == [parent_url]


def test_local_browser_expansion_is_skipped_without_parser_deadline_reserve(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=3)
    parent_url = "https://magazine.example/tag/adaptive-reuse"
    child_url = "https://magazine.example/projects/courtyard-archive"
    parser = ExpandingPublicPageParser(
        {
            parent_url: ParsedPublicPage(source_url=parent_url, links=[child_url]),
            child_url: ParsedPublicPage(source_url=child_url, title="Courtyard Archive"),
        }
    )
    times = iter([0.0, 0.0, 0.0, 230.0])

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result(parent_url)),
        public_page_parser=parser,
        clock=lambda: next(times, 230.0),
    )

    assert parser.urls == [parent_url]


def test_local_browser_remote_visual_batch_classifies_untyped_images_once_per_run(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.goal = ResearchGoal.visual_reference_search.value
        session.commit()
    parser = RecordingPublicPageParser(
        [
            ParsedPageImage(url=f"https://cdn.example/asset-{index}.jpg", alt="")
            for index in range(1, 6)
        ]
    )
    classifier = RecordingRemoteClassifier()
    provider_result = _provider_result("https://studio.example/project")
    provider_result.sources[0].publication_tier = PublicationTier.unknown
    provider = SingleBatchProvider(provider_result)

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        leads = list(
            session.scalars(
                select(AssetCandidate).where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.result_tier == ResultTier.visual_lead.value,
                )
            )
        )
        events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))
        session.execute(delete(QueryAttempt).where(QueryAttempt.run_id == run_id))
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.attempt += 1
        run.status = RunStatus.created.value
        run.stop_reason = None
        session.commit()

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    assert len(classifier.remote_calls) == 1
    assert len(classifier.remote_calls[0]) == 4
    assert [lead.image_url for lead in leads] == ["https://cdn.example/asset-1.jpg"]
    lead = leads[0]
    assert lead.asset_type == ArchitectureAssetType.section.value
    assert lead.relevance == 4
    assert lead.observations == ["可见错层楼板、贯通楼梯和挑空空间。"]
    assert lead.facts == []
    assert lead.inferences == []
    assert lead.project_identity == AssociationStatus.unknown.value
    assert lead.asset_association == AssociationStatus.unknown.value
    assert lead.primary_source == PrimarySourceStatus.unknown.value
    assert lead.rights_status == RightsStatus.unknown.value
    assert sum(event.tool == "remote_visual_batch" for event in events) == 2


def test_precedent_remote_visual_batch_does_not_spend_on_an_unknown_page(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url="https://cdn.example/untyped-image.jpg", alt="")]
    )
    classifier = RecordingRemoteClassifier()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(
            ProviderSearchResult(
                sources=[
                    ProviderSource(
                        url="https://unknown.example/general-article",
                        title="General architecture article",
                        publication_tier=PublicationTier.unknown,
                    )
                ],
                assets=[],
            )
        ),
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        remote_events = list(
            session.scalars(
                select(TraceEvent).where(
                    TraceEvent.run_id == run_id,
                    TraceEvent.tool == "remote_visual_batch",
                )
            )
        )

    assert classifier.remote_calls == []
    assert remote_events == []


def test_local_browser_remote_visual_batch_allows_new_fingerprint_on_next_attempt(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url="https://cdn.example/attempt-one.jpg", alt="")]
    )
    classifier = RecordingRemoteClassifier()
    provider = SingleBatchProvider(_provider_result("https://studio.example/project"))

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    parser.images = [ParsedPageImage(url="https://cdn.example/attempt-two.jpg", alt="")]
    with database.session_factory() as session:
        session.execute(delete(QueryAttempt).where(QueryAttempt.run_id == run_id))
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.attempt += 1
        run.status = RunStatus.created.value
        run.stop_reason = None
        session.commit()

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    assert [[item.image_url for item in call] for call in classifier.remote_calls] == [
        ["https://cdn.example/attempt-one.jpg"],
        ["https://cdn.example/attempt-two.jpg"],
    ]


def test_failed_remote_visual_batch_can_retry_same_fingerprint_on_next_attempt(
    tmp_path: Path,
) -> None:
    class FailOnceRemoteClassifier(RecordingRemoteClassifier):
        def classify_remote_batch(
            self,
            candidates: list[RemoteVisualCandidate],
            *,
            question: str,
            project_text: str,
        ) -> RemoteVisualClassificationBatch:
            del question, project_text
            self.remote_calls.append(candidates)
            if len(self.remote_calls) == 1:
                raise RuntimeError("temporary relay failure")
            return RemoteVisualClassificationBatch(
                classifications=[
                    RemoteVisualClassification(
                        candidate_id=candidates[0].candidate_id,
                        asset_type=ArchitectureAssetType.circulation,
                        relevance=4,
                        observations=["可见访客与后勤两套独立流线。"],
                    )
                ]
            )

    database, run_id = _database_with_run(tmp_path)
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url="https://cdn.example/same-batch.jpg", alt="")]
    )
    classifier = FailOnceRemoteClassifier()
    provider = SingleBatchProvider(_provider_result("https://studio.example/project"))

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        public_page_parser=parser,
    )
    with database.session_factory() as session:
        session.execute(delete(QueryAttempt).where(QueryAttempt.run_id == run_id))
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.attempt += 1
        run.status = RunStatus.created.value
        run.stop_reason = None
        session.commit()

    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    assert len(classifier.remote_calls) == 2


def test_remote_visual_batch_is_fair_per_subquestion(tmp_path: Path) -> None:
    class SequentialSourceProvider:
        name = "sequential"

        def __init__(self) -> None:
            self.calls = 0

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del query, goal, allowed_domains
            self.calls += 1
            url = f"https://studio.example/project-{self.calls}"
            return ProviderSearchResult(
                sources=[
                    ProviderSource(
                        url=url,
                        title=f"Project {self.calls}",
                        publication_tier=PublicationTier.primary,
                    )
                ],
                assets=[],
            )

    class PerPageParser(RecordingPublicPageParser):
        def parse(self, url: str) -> ParsedPublicPage:
            self.urls.append(url)
            index = url.rsplit("-", 1)[-1]
            return ParsedPublicPage(
                source_url=url,
                title=f"Project {index}",
                images=[ParsedPageImage(url=f"https://cdn.example/project-{index}.jpg", alt="")],
            )

    database, run_id = _database_with_run(tmp_path, max_pages=3)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {**run.budget, "max_queries": 3, "max_pages": 3}
        session.commit()
    classifier = RecordingRemoteClassifier()

    execute_research_run(
        database,
        run_id,
        SequentialSourceProvider(),
        visual_classifier=classifier,
        public_page_parser=PerPageParser([]),
    )

    assert len(classifier.remote_calls) == 3


def test_remote_visual_batch_samples_an_untyped_gallery_across_the_page(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path)
    parser = RecordingPublicPageParser(
        [
            ParsedPageImage(url=f"https://cdn.example/gallery-{index}.jpg", alt="")
            for index in range(1, 11)
        ]
    )
    classifier = RecordingRemoteClassifier()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/project")),
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    assert [item.image_url for item in classifier.remote_calls[0]] == [
        "https://cdn.example/gallery-1.jpg",
        "https://cdn.example/gallery-4.jpg",
        "https://cdn.example/gallery-7.jpg",
        "https://cdn.example/gallery-10.jpg",
    ]


def test_untyped_trusted_project_image_stays_a_preview_while_text_becomes_partial(
    tmp_path: Path,
) -> None:
    class FlowRemoteClassifier(RecordingRemoteClassifier):
        def classify_remote_batch(
            self,
            candidates: list[RemoteVisualCandidate],
            *,
            question: str,
            project_text: str,
        ) -> RemoteVisualClassificationBatch:
            del question, project_text
            self.remote_calls.append(candidates)
            return RemoteVisualClassificationBatch(
                classifications=[
                    RemoteVisualClassification(
                        candidate_id=candidates[-1].candidate_id,
                        asset_type=ArchitectureAssetType.circulation,
                        relevance=4,
                        observations=["可见访客入口与后勤装卸入口分别连接两套路径。"],
                    )
                ]
            )

    database, run_id = _database_with_run(tmp_path)
    project_url = "https://www.archdaily.com/123456/courtyard-archive"
    image_url = "https://cdn.example/flow-drawing.jpg"
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url=image_url, alt="")],
        markdown=(
            "The service entrance is located on the east side. "
            "Visitors enter from the public courtyard."
        ),
    )
    provider = AnalyzingPageProvider(
        ProviderSearchResult(
            sources=[
                ProviderSource(
                    url=project_url,
                    title="Courtyard Archive / Studio Example",
                    publication_tier=PublicationTier.trusted_secondary,
                )
            ],
            assets=[],
        )
    )

    classifier = FlowRemoteClassifier()
    execute_research_run(
        database,
        run_id,
        provider,
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.image_url == image_url,
            )
        )
        assert candidate is not None
        claim = session.scalar(
            select(EvidenceClaim).where(EvidenceClaim.asset_candidate_id == candidate.id)
        )
        run = session.get(ResearchRun, run_id)

    assert len(classifier.remote_calls) == 1
    assert candidate.asset_type == ArchitectureAssetType.photograph.value
    assert candidate.result_tier == ResultTier.partial.value
    assert candidate.asset_association == AssociationStatus.confirmed.value
    assert candidate.publication_tier == PublicationTier.trusted_secondary.value
    assert candidate.observations == ["可见访客入口与后勤装卸入口分别连接两套路径。"]
    assert claim is not None
    assert claim.source_url == project_url
    assert provider.analysis_calls[0][0].asset_type == ArchitectureAssetType.photograph
    assert run is not None
    assert "program" in run.coverage_report["covered_subquestion_ids"]


def test_local_browser_remote_visual_batch_is_skipped_without_deadline_reserve(
    tmp_path: Path,
) -> None:
    class SlowRemoteClassifier(RecordingRemoteClassifier):
        worst_case_remote_batch_seconds = 300.0

    database, run_id = _database_with_run(tmp_path)
    parser = RecordingPublicPageParser(
        [ParsedPageImage(url="https://cdn.example/asset-1.jpg", alt="")]
    )
    classifier = SlowRemoteClassifier()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/project")),
        visual_classifier=classifier,
        public_page_parser=parser,
    )

    assert classifier.remote_calls == []


def test_browser_failure_uses_local_browser_to_enrich_one_unambiguous_drawing_lead(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    result = _provider_result("https://studio.example/project")
    result.assets[0].asset_type = ArchitectureAssetType.section
    result.assets[0].image_url = None
    parser = RecordingPublicPageParser(
        [
            ParsedPageImage(
                url="https://cdn.example/longitudinal-section.png",
                alt="Longitudinal section",
            )
        ]
    )

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(result),
        browser_client=RecordingBrowser(fail_action="enumerate_media"),
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        asset = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))
    assert asset is not None
    assert asset.image_url == "https://cdn.example/longitudinal-section.png"
    assert asset.result_tier == ResultTier.partial.value
    assert asset.rights_status == RightsStatus.unknown.value
    assert parser.urls == ["https://studio.example/project"]
    local_browser_events = [event for event in events if event.tool == "local_browser"]
    assert local_browser_events
    assert local_browser_events[-1].summary == {
        "source_url": "https://studio.example/project",
        "status": "completed",
        "markdown_chars": len("# Courtyard Archive"),
        "image_leads": 1,
        "link_leads": 0,
        "enriched": 1,
    }


def test_local_browser_persists_ambiguous_same_type_images_as_unverified_visual_leads(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    result = _provider_result("https://studio.example/project")
    result.assets[0].asset_type = ArchitectureAssetType.section
    result.assets[0].image_url = None
    parser = RecordingPublicPageParser(
        [
            ParsedPageImage(url="https://cdn.example/section-a.png", alt="Section A"),
            ParsedPageImage(url="https://cdn.example/section-b.png", alt="Section B"),
        ]
    )

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(result),
        browser_client=RecordingBrowser(fail_action="enumerate_media"),
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
    provider_asset = next(
        asset for asset in assets if asset.result_tier == ResultTier.partial.value
    )
    public_leads = [asset for asset in assets if asset.result_tier == ResultTier.visual_lead.value]
    assert provider_asset.image_url is None
    assert {asset.image_url for asset in public_leads} == {
        "https://cdn.example/section-a.png",
        "https://cdn.example/section-b.png",
    }
    assert all(asset.relevance == 1 for asset in public_leads)
    assert all(asset.project_identity == AssociationStatus.unknown.value for asset in public_leads)


def test_undecodable_browser_crops_are_not_sent_to_the_visual_classifier(tmp_path: Path) -> None:
    class InvalidCropBrowser(RecordingBrowser):
        def send_command_sync(
            self,
            action: str,
            payload: dict[str, Any],
            *,
            timeout_seconds: float = 30,
        ) -> Any:
            if action == "capture_region":
                self.calls.append((action, payload))
                encoded = base64.b64encode(b"not-an-image").decode()
                return {
                    "image_data_url": f"data:image/png;base64,{encoded}",
                    "media_type": "image/png",
                }
            return super().send_command_sync(
                action,
                payload,
                timeout_seconds=timeout_seconds,
            )

    database, run_id = _database_with_run(tmp_path)
    browser = InvalidCropBrowser()
    classifier = RecordingClassifier()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/project")),
        browser_client=browser,
        visual_classifier=classifier,
        candidate_root=tmp_path / "candidates",
    )

    assert classifier.calls == []
    with database.session_factory() as session:
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
    assert len(assets) == 1
    assert assets[0].project_name == "已检索项目"
    assert list((tmp_path / "candidates").rglob("*.png")) == []


def test_shared_inspection_budget_deduplicates_before_classification_across_pages(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    browser = RecordingBrowser()
    classifier = RecordingClassifier()
    budget = InspectionBudget(max_calls=8, max_bytes=24 * 1024 * 1024)
    writes: list[Path] = []
    original_write_bytes = Path.write_bytes

    def record_write(path: Path, data: bytes) -> int:
        writes.append(path)
        return original_write_bytes(path, data)

    monkeypatch.setattr(Path, "write_bytes", record_write)

    first = inspect_source_page(
        browser,
        classifier,
        run_id="shared-run",
        source_url="https://studio.example/one",
        question="旧建筑中如何形成有层次的剖面？",
        candidate_root=tmp_path,
        budget=budget,
    )
    second = inspect_source_page(
        browser,
        classifier,
        run_id="shared-run",
        source_url="https://studio.example/two",
        question="旧建筑中如何形成有层次的剖面？",
        candidate_root=tmp_path,
        budget=budget,
    )

    assert len(first) == 6
    assert len(second) == 2
    assert all(item.source_url == "https://studio.example/two" for item in second)
    assert all(item.storage_path is None for item in second)
    assert [item.perceptual_hash for item in second] == [item.perceptual_hash for item in first[:2]]
    assert all(item.asset_type == ArchitectureAssetType.section for item in second)
    assert all(item.relevance == 4 for item in second)
    assert all(item.observations == ["可见剖切构件与多层空间关系。"] for item in second)
    assert len(classifier.calls) == 6
    assert [action for action, _ in browser.calls].count("capture_region") == 8
    assert budget.used_calls == 8
    assert len(budget.seen_perceptual_hashes) == 6
    assert len(writes) == 6


def test_failed_classification_is_retried_before_a_duplicate_relation_is_reused(
    tmp_path: Path,
) -> None:
    class SingleMediaBrowser(RecordingBrowser):
        def send_command_sync(
            self,
            action: str,
            payload: dict[str, Any],
            *,
            timeout_seconds: float = 30,
        ) -> Any:
            response = super().send_command_sync(
                action,
                payload,
                timeout_seconds=timeout_seconds,
            )
            if action == "enumerate_media":
                response["media"] = response["media"][:1]
            return response

    class FailOnceClassifier(RecordingClassifier):
        def classify(
            self,
            image_data_url: str,
            *,
            question: str,
            caption: str,
            project_text: str,
        ) -> VisualClassification:
            if not self.calls:
                self.calls.append(
                    {
                        "image_data_url": image_data_url,
                        "question": question,
                        "caption": caption,
                        "project_text": project_text,
                    }
                )
                raise RuntimeError("temporary classifier failure")
            return super().classify(
                image_data_url,
                question=question,
                caption=caption,
                project_text=project_text,
            )

    browser = SingleMediaBrowser()
    classifier = FailOnceClassifier()
    budget = InspectionBudget(max_calls=3, max_bytes=6 * 1024 * 1024)

    failed = inspect_source_page(
        browser,
        classifier,
        run_id="retry-classification-run",
        source_url="https://aggregator.example/project",
        question="分析剖面。",
        candidate_root=tmp_path,
        budget=budget,
    )
    accepted = inspect_source_page(
        browser,
        classifier,
        run_id="retry-classification-run",
        source_url="https://studio.example/project",
        question="分析剖面。",
        candidate_root=tmp_path,
        budget=budget,
    )
    reused = inspect_source_page(
        browser,
        classifier,
        run_id="retry-classification-run",
        source_url="https://archive.example/project",
        question="分析剖面。",
        candidate_root=tmp_path,
        budget=budget,
    )

    assert failed == []
    assert len(accepted) == 1
    assert accepted[0].storage_path is not None
    assert len(reused) == 1
    assert reused[0].source_url == "https://archive.example/project"
    assert reused[0].storage_path is None
    assert reused[0].perceptual_hash == accepted[0].perceptual_hash
    assert len(classifier.calls) == 2
    assert len(list(tmp_path.rglob("*.png"))) == 1


def test_duplicate_classification_cache_is_scoped_to_the_research_question(
    tmp_path: Path,
) -> None:
    class SingleMediaBrowser(RecordingBrowser):
        def send_command_sync(
            self,
            action: str,
            payload: dict[str, Any],
            *,
            timeout_seconds: float = 30,
        ) -> Any:
            response = super().send_command_sync(
                action,
                payload,
                timeout_seconds=timeout_seconds,
            )
            if action == "enumerate_media":
                response["media"] = response["media"][:1]
            return response

    class QuestionAwareClassifier(RecordingClassifier):
        def classify(
            self,
            image_data_url: str,
            *,
            question: str,
            caption: str,
            project_text: str,
        ) -> VisualClassification:
            self.calls.append(
                {
                    "image_data_url": image_data_url,
                    "question": question,
                    "caption": caption,
                    "project_text": project_text,
                }
            )
            return VisualClassification(
                asset_type=ArchitectureAssetType.section,
                relevance=4 if "流线" in question else 2,
                observations=[f"针对{question}的可见观察。"],
            )

    browser = SingleMediaBrowser()
    classifier = QuestionAwareClassifier()
    budget = InspectionBudget(max_calls=3, max_bytes=6 * 1024 * 1024)

    circulation = inspect_source_page(
        browser,
        classifier,
        run_id="question-cache-run",
        source_url="https://studio.example/project",
        question="如何组织流线？",
        candidate_root=tmp_path,
        budget=budget,
    )
    section = inspect_source_page(
        browser,
        classifier,
        run_id="question-cache-run",
        source_url="https://studio.example/project",
        question="如何形成剖面层次？",
        candidate_root=tmp_path,
        budget=budget,
    )
    section_reused = inspect_source_page(
        browser,
        classifier,
        run_id="question-cache-run",
        source_url="https://archive.example/project",
        question="如何形成剖面层次？",
        candidate_root=tmp_path,
        budget=budget,
    )

    assert circulation[0].relevance == 4
    assert circulation[0].storage_path is not None
    assert section[0].relevance == 2
    assert section[0].observations == ["针对如何形成剖面层次？的可见观察。"]
    assert section[0].storage_path is None
    assert section_reused[0].relevance == 2
    assert section_reused[0].storage_path is None
    assert len(classifier.calls) == 2
    assert len(list(tmp_path.rglob("*.png"))) == 1


def test_classifier_receives_a_bounded_preview_while_original_crop_is_preserved(
    tmp_path: Path,
) -> None:
    browser = SingleLargeCropBrowser()
    classifier = RecordingClassifier()

    inspected = inspect_source_page(
        browser,
        classifier,
        run_id="preview-run",
        source_url="https://studio.example/large-drawing",
        question="分析剖面的空间层次。",
        candidate_root=tmp_path,
    )

    assert len(inspected) == 1
    preview_data_url = classifier.calls[0]["image_data_url"]
    preview_header, encoded_preview = preview_data_url.split(",", maxsplit=1)
    assert preview_header in {"data:image/jpeg;base64", "data:image/png;base64"}
    preview_bytes = base64.b64decode(encoded_preview)
    assert len(preview_bytes) <= 2 * 1024 * 1024
    with Image.open(BytesIO(preview_bytes)) as preview:
        assert max(preview.size) <= 1_600
    assert inspected[0].storage_path.read_bytes() == browser.original_crop


def test_shared_inspection_budget_caps_capture_attempts_and_discards_rejected_crops(
    tmp_path: Path,
) -> None:
    call_browser = RecordingBrowser()
    call_classifier = RecordingClassifier()
    call_budget = InspectionBudget(max_calls=2, max_bytes=4 * 1024 * 1024)
    call_results = inspect_source_page(
        call_browser,
        call_classifier,
        run_id="call-capped-run",
        source_url="https://studio.example/call-cap",
        question="分析剖面。",
        candidate_root=tmp_path / "calls",
        budget=call_budget,
    )

    assert len(call_results) == 2
    assert len(call_classifier.calls) == 2
    assert call_budget.used_calls == 2
    assert call_budget.used_bytes <= call_budget.max_bytes
    assert [action for action, _ in call_browser.calls].count("capture_region") == 2
    assert len(list((tmp_path / "calls" / "call-capped-run" / "candidates").glob("*.png"))) == 2

    byte_browser = RecordingBrowser()
    byte_classifier = RecordingClassifier()
    byte_budget = InspectionBudget(max_calls=6, max_bytes=1)
    byte_results = inspect_source_page(
        byte_browser,
        byte_classifier,
        run_id="byte-capped-run",
        source_url="https://studio.example/byte-cap",
        question="分析剖面。",
        candidate_root=tmp_path / "bytes",
        budget=byte_budget,
    )

    assert byte_results == []
    assert byte_classifier.calls == []
    assert byte_budget.used_bytes <= byte_budget.max_bytes
    assert [action for action, _ in byte_browser.calls].count("capture_region") == 1
    assert list((tmp_path / "bytes").rglob("*.png")) == []


def test_inspection_budget_reports_only_successful_reservations_and_limit_changes() -> None:
    changes: list[tuple[int, int, bool]] = []
    budget = InspectionBudget(
        max_calls=1,
        max_bytes=10,
        on_change=lambda changed: changes.append(
            (changed.used_calls, changed.used_bytes, changed.byte_limit_reached)
        ),
    )

    assert budget.reserve_capture() is True
    assert budget.reserve_capture() is False
    assert budget.reserve_preview(6) is True
    assert budget.reserve_preview(5) is False

    assert changes == [
        (1, 0, False),
        (1, 6, False),
        (1, 6, True),
    ]


def test_zero_inspection_call_budget_never_captures_or_writes_candidates(
    tmp_path: Path,
) -> None:
    browser = RecordingBrowser()
    classifier = RecordingClassifier()

    inspected = inspect_source_page(
        browser,
        classifier,
        run_id="zero-call-run",
        source_url="https://studio.example/no-capture",
        question="分析剖面。",
        candidate_root=tmp_path,
        budget=InspectionBudget(max_calls=0, max_bytes=4 * 1024 * 1024),
    )

    assert inspected == []
    assert classifier.calls == []
    assert [action for action, _ in browser.calls].count("capture_region") == 0
    assert list(tmp_path.rglob("*.png")) == []


def test_page_budget_allows_one_normal_and_one_recovery_browser_attempt(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=1)
    browser = RecordingBrowser(fail_action="open_url")
    source_urls = ("https://studio.example/one", "https://studio.example/two")

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result(*source_urls)),
        browser_client=browser,
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
    )

    opened_urls = [payload["url"] for action, payload in browser.calls if action == "open_url"]
    assert opened_urls == list(source_urls)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
    assert run is not None
    assert run.status == RunStatus.blocked.value
    assert run.stop_reason == "browser_inspection_incomplete"
    assert run.coverage_report["gaps"] == ["browser_inspection_incomplete"]
    assert run.browser_pages_attempted == 2
    assert len(assets) == 1


def test_workflow_shares_a_quick_run_inspection_budget_across_pages(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=2)
    observed_budgets: list[InspectionBudget] = []

    def record_budget(*args: Any, budget: InspectionBudget, **kwargs: Any) -> list[Any]:
        del args, kwargs
        observed_budgets.append(budget)
        return []

    monkeypatch.setattr("archresearch_api.workflow.inspect_source_page", record_budget)
    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(
            _provider_result("https://studio.example/one", "https://studio.example/two")
        ),
        browser_client=RecordingBrowser(),
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
    )

    assert len(observed_budgets) == 2
    assert observed_budgets[0] is observed_budgets[1]
    assert observed_budgets[0].max_calls == 12
    assert observed_budgets[0].max_bytes == 24 * 1024 * 1024


def test_workflow_restores_and_persists_the_run_wide_inspection_budget(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.visual_calls_used = 11
        session.commit()
    browser = RecordingBrowser()

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result("https://studio.example/project")),
        browser_client=browser,
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
    assert run is not None
    assert [action for action, _ in browser.calls].count("capture_region") == 1
    assert run.visual_calls_used == 12
    assert run.visual_bytes_used > 0


def test_real_inspection_upgrades_a_provider_asset_to_its_stronger_duplicate_source(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=2)
    aggregator_url = "https://aggregator.example/foundry"
    primary_url = "https://studio.example/foundry"
    result = ProviderSearchResult(
        assets=[
            ProviderAsset(
                project_name="Foundry project",
                asset_type="section",
                source_url=aggregator_url,
                image_url="https://images.example/drawing-0.png",
                publication_tier=PublicationTier.aggregator,
                result_tier=ResultTier.partial,
                relevance=4,
                facts=["聚合页面展示了该图纸。"],
            )
        ],
        sources=[
            ProviderSource(
                url=aggregator_url,
                publisher="Aggregator",
                title="Foundry repost",
                publication_tier=PublicationTier.aggregator,
            ),
            ProviderSource(
                url=primary_url,
                publisher="Studio",
                title="Foundry project",
                publication_tier=PublicationTier.primary,
            ),
        ],
    )

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(result),
        browser_client=RecordingBrowser(),
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
    )

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.project_name == "Foundry project",
            )
        )
        assert candidate is not None
        claims = list(
            session.scalars(
                select(EvidenceClaim).where(
                    EvidenceClaim.asset_candidate_id == candidate.id,
                    EvidenceClaim.claim_type == "observation",
                )
            )
        )

    assert candidate.source_url == primary_url
    assert candidate.publication_tier == PublicationTier.primary.value
    assert candidate.perceptual_hash is not None
    assert candidate.storage_path is not None
    assert Path(candidate.storage_path).is_file()
    assert {claim.source_url for claim in claims} == {aggregator_url, primary_url}


def test_identical_browser_crops_are_deduplicated_across_source_pages(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, max_pages=2)
    browser = RecordingBrowser()
    source_urls = ("https://studio.example/one", "https://studio.example/two")

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result(*source_urls)),
        browser_client=browser,
        visual_classifier=RecordingClassifier(),
        candidate_root=tmp_path / "candidates",
    )

    with database.session_factory() as session:
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
    browser_assets = [asset for asset in assets if asset.project_name == "待核验项目"]
    assert len(browser_assets) == 6
    assert len({asset.perceptual_hash for asset in browser_assets}) == 6


def test_browser_broker_can_send_a_command_from_a_sync_worker_thread() -> None:
    broker = BrowserBroker()
    loop = asyncio.new_event_loop()

    class ReplyingSocket:
        async def send_json(self, message: dict[str, Any]) -> None:
            await broker.receive_result(
                {
                    "type": "browser.result",
                    "protocol_version": 1,
                    "id": message["id"],
                    "ok": True,
                    "result": {"waited_ms": message["payload"]["milliseconds"]},
                }
            )

    async def setup() -> None:
        broker.bind_loop()
        await broker.attach(ReplyingSocket())

    thread = threading.Thread(target=loop.run_forever)
    thread.start()
    try:
        asyncio.run_coroutine_threadsafe(setup(), loop).result(timeout=2)
        assert broker.send_command_sync("wait", {"milliseconds": 25}) == {"waited_ms": 25}
    finally:
        loop.call_soon_threadsafe(loop.stop)
        thread.join(timeout=2)
        loop.close()


def test_create_app_injects_browser_and_visual_dependencies_into_inline_runs(
    tmp_path: Path,
) -> None:
    browser = RecordingBrowser()
    classifier = RecordingClassifier()
    provider = SingleBatchProvider(_provider_result("https://studio.example/project"))
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )

    with TestClient(
        create_app(
            settings,
            research_provider=provider,
            browser_broker=browser,  # type: ignore[arg-type]
            visual_classifier=classifier,
        )
    ) as client:
        workspace = client.post("/v1/workspaces", json={"name": "注入测试"}).json()
        response = client.post(
            f"/v1/workspaces/{workspace['id']}/runs",
            json={
                "question": "旧建筑中如何形成有层次的剖面？",
                "goal": "precedent_research",
                "budget_mode": "quick",
            },
        )
        results = client.get(f"/v1/runs/{response.json()['id']}/results").json()

    assert response.status_code == 201
    assert len(results) == 7
    assert len(classifier.calls) == 6


def test_retry_keeps_browser_and_visual_dependencies_for_inline_runs(tmp_path: Path) -> None:
    browser = RecordingBrowser()
    classifier = RecordingClassifier()
    result = _provider_result("https://studio.example/project")
    result.assets[0] = result.assets[0].model_copy(update={"facts": []})
    provider = SingleBatchProvider(result)
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'retry-app.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )

    with TestClient(
        create_app(
            settings,
            research_provider=provider,
            browser_broker=browser,  # type: ignore[arg-type]
            visual_classifier=classifier,
        )
    ) as client:
        workspace = client.post("/v1/workspaces", json={"name": "重试注入测试"}).json()
        run = client.post(
            f"/v1/workspaces/{workspace['id']}/runs",
            json={
                "question": "旧建筑中如何形成有层次的剖面？",
                "goal": "precedent_research",
                "budget_mode": "quick",
            },
        ).json()
        assert run["status"] == "blocked"
        browser.calls.clear()
        classifier.calls.clear()

        retried = client.post(f"/v1/runs/{run['id']}/retry")

    assert retried.status_code == 200
    assert any(action == "open_url" for action, _ in browser.calls)
    assert len(classifier.calls) == 6
