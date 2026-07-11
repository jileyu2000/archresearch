from __future__ import annotations

import asyncio
import base64
import json
import struct
import threading
import zlib
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from archresearch_api.browser import BrowserBroker
from archresearch_api.config import Settings
from archresearch_api.database import Database
from archresearch_api.main import create_app
from archresearch_api.models import AssetCandidate, ResearchRun, TraceEvent, Workspace
from archresearch_api.providers import ProviderAsset, ProviderSearchResult, ProviderSource
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
from archresearch_api.visual import ArchitectureAssetType, VisualClassification
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
                    for index in range(4)
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


def test_workflow_inspects_pages_with_read_only_actions_and_persists_three_visual_leads(
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
        "enumerate_media",
        "capture_region",
        "capture_region",
        "capture_region",
        "close_tab",
    ]
    assert not ({"safe_click", "type_search_query", "scroll"} & set(actions))
    assert len(classifier.calls) == 3
    assert all(len(call["caption"]) <= 500 for call in classifier.calls)
    assert all(len(call["project_text"]) <= 1_200 for call in classifier.calls)
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

    assert len(assets) == 4
    assert len(browser_assets) == 3
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
    assert len(browser_assets) == 3
    assert len({asset.perceptual_hash for asset in browser_assets}) == 3


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
    assert len(results) == 4
    assert len(classifier.calls) == 3


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
    assert len(classifier.calls) == 3
