from __future__ import annotations

import asyncio
import base64
import json
import struct
import threading
import zlib
from io import BytesIO
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import delete, select

from archresearch_api.browser import BrowserBroker
from archresearch_api.config import Settings
from archresearch_api.database import Database
from archresearch_api.inspection import InspectionBudget, inspect_source_page
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
from archresearch_api.providers import ProviderAsset, ProviderSearchResult, ProviderSource
from archresearch_api.public_pages import ParsedPageImage, ParsedPublicPage, PublicSearchLead
from archresearch_api.schemas import (
    AssociationStatus,
    BudgetMode,
    PrimarySourceStatus,
    PublicationTier,
    ResearchGoal,
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
from archresearch_api.workflow import execute_research_run


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


def _database_with_run(tmp_path: Path, *, max_pages: int = 1) -> tuple[Database, str]:
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
            budget_mode=BudgetMode.quick.value,
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
    assert not ({"safe_click", "type_search_query", "scroll"} & set(actions))
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
    assert run.status == RunStatus.partial.value
    assert len(assets) == 1
    assert assets[0].project_name == "已检索项目"


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
    name = "firecrawl"

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

    def search(
        self,
        query: str,
        *,
        limit: int,
        include_domains: list[str],
    ) -> list[PublicSearchLead]:
        del limit, include_domains
        self.queries.append(query)
        return [
            PublicSearchLead(
                url="https://studio.example/firecrawl-project",
                title="Firecrawl Project",
                description="Public source lead",
            )
        ]

    def parse(self, url: str) -> ParsedPublicPage:
        self.urls.append(url)
        return ParsedPublicPage(
            source_url=url,
            title="Firecrawl Project",
            markdown="# Firecrawl Project",
            images=self.images,
        )


class ExpandingPublicPageParser:
    name = "firecrawl"
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
        if self.calls == 1:
            raise TimeoutError("relay web search timed out")
        raise AssertionError("model search circuit should remain open for this run")


def test_firecrawl_search_preserves_visual_leads_when_model_search_times_out(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    parser = RecordingPublicSearchParser(
        [
            ParsedPageImage(
                url="https://cdn.example/firecrawl-plan.png",
                alt="Ground floor plan",
            )
        ]
    )

    execute_research_run(
        database,
        run_id,
        TimeoutSearchProvider(ProviderSearchResult(sources=[], assets=[])),
        public_page_parser=parser,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        leads = list(session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id)))
        events = list(session.scalars(select(TraceEvent).where(TraceEvent.run_id == run_id)))
    assert run is not None
    assert run.status == RunStatus.partial.value
    assert parser.queries
    assert parser.queries[0].startswith("建筑项目图纸：")
    assert "主问题：" not in parser.queries[0]
    assert "Untrusted user design context" not in parser.queries[0]
    assert parser.urls == ["https://studio.example/firecrawl-project"]
    assert [lead.image_url for lead in leads] == ["https://cdn.example/firecrawl-plan.png"]
    assert any(
        event.tool == "firecrawl_search" and event.summary["result_count"] == 1 for event in events
    )
    assert any(event.tool == "single" and event.summary["status"] == "degraded" for event in events)


def test_model_timeout_opens_run_circuit_while_public_search_keeps_progressing(
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
                url="https://cdn.example/firecrawl-section.png",
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
    assert provider.calls == 1
    assert len(parser.queries) > 1
    assert any(
        event.tool == provider.name
        and event.summary.get("status") == "skipped"
        and event.summary.get("reason") == "previous_timeout"
        for event in events
    )


def test_firecrawl_search_continues_when_model_call_no_longer_fits_deadline(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    provider = ReservedSearchProvider()
    parser = RecordingPublicSearchParser(
        [
            ParsedPageImage(
                url="https://cdn.example/firecrawl-section.png",
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
        clock=lambda: next(times),
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        leads = list(session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id)))
    assert run is not None
    assert run.status == RunStatus.partial.value
    assert provider.calls == 0
    assert len(parser.queries) == 1
    assert [lead.image_url for lead in leads] == ["https://cdn.example/firecrawl-section.png"]


def test_firecrawl_enriches_normal_browser_research_context_and_image_recall(
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
                url="https://cdn.example/firecrawl-section.png",
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
    firecrawl_lead = next(
        asset for asset in assets if asset.image_url == "https://cdn.example/firecrawl-section.png"
    )
    provider_asset = next(
        asset for asset in assets if asset.result_tier == ResultTier.partial.value
    )
    assert parser.urls == ["https://studio.example/project"]
    assert classifier.calls
    assert all("retained steel truss" in call["project_text"] for call in classifier.calls)
    assert firecrawl_lead.asset_type == ArchitectureAssetType.section.value
    assert firecrawl_lead.result_tier == ResultTier.visual_lead.value
    assert firecrawl_lead.relevance == 1
    assert firecrawl_lead.project_identity == AssociationStatus.unknown.value
    assert firecrawl_lead.asset_association == AssociationStatus.unknown.value
    assert firecrawl_lead.rights_status == RightsStatus.unknown.value
    assert firecrawl_lead.facts == []
    assert firecrawl_lead.observations == []
    assert provider_asset.storage_path is not None
    assert provider_asset.perceptual_hash is not None


def test_firecrawl_adds_typed_public_image_leads_without_a_browser_connection(
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


def test_firecrawl_expands_one_project_page_and_promotes_exact_image_evidence(
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
        event.tool == "firecrawl_expand"
        and event.summary.get("status") == "completed"
        and event.summary.get("promoted") == 1
        for event in events
    )


def test_firecrawl_expansion_respects_the_existing_page_budget(tmp_path: Path) -> None:
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


def test_firecrawl_expansion_is_skipped_without_parser_deadline_reserve(
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
    times = iter([0.0, 0.0, 230.0])

    execute_research_run(
        database,
        run_id,
        SingleBatchProvider(_provider_result(parent_url)),
        public_page_parser=parser,
        clock=lambda: next(times),
    )

    assert parser.urls == [parent_url]


def test_firecrawl_remote_visual_batch_classifies_untyped_images_once_per_run(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path)
    parser = RecordingPublicPageParser(
        [
            ParsedPageImage(url=f"https://cdn.example/asset-{index}.jpg", alt="")
            for index in range(1, 6)
        ]
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


def test_firecrawl_remote_visual_batch_is_skipped_without_deadline_reserve(
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


def test_browser_failure_uses_firecrawl_to_enrich_one_unambiguous_drawing_lead(
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
    firecrawl_events = [event for event in events if event.tool == "firecrawl"]
    assert firecrawl_events
    assert firecrawl_events[-1].summary == {
        "source_url": "https://studio.example/project",
        "status": "completed",
        "markdown_chars": len("# Courtyard Archive"),
        "image_leads": 1,
        "link_leads": 0,
        "enriched": 1,
    }


def test_firecrawl_persists_ambiguous_same_type_images_as_unverified_visual_leads(
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


def test_page_budget_limits_browser_attempts_without_limiting_web_results(tmp_path: Path) -> None:
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
    assert opened_urls == [source_urls[0]]
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
    assert run is not None
    assert run.status == RunStatus.partial.value
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
    provider = SingleBatchProvider(_provider_result("https://studio.example/project"))
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
        assert run["status"] == "partial"
        browser.calls.clear()
        classifier.calls.clear()

        retried = client.post(f"/v1/runs/{run['id']}/retry")

    assert retried.status_code == 200
    assert any(action == "open_url" for action, _ in browser.calls)
    assert len(classifier.calls) == 6
