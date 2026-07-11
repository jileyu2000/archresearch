from pathlib import Path
from types import SimpleNamespace
from typing import Any

import fitz
from sqlalchemy import func, select

from archresearch_api.database import Database
from archresearch_api.models import (
    AssetCandidate,
    EvidenceClaim,
    InputArtifact,
    QueryAttempt,
    ResearchRun,
    SourcePage,
    Workspace,
)
from archresearch_api.providers import (
    OpenAIResearchProvider,
    ProviderAsset,
    ProviderSearchResult,
    ProviderSource,
    TinEyeBacklink,
    TinEyeMatch,
)
from archresearch_api.schemas import (
    BUDGETS,
    AssociationStatus,
    BudgetMode,
    PrimarySourceStatus,
    PublicationTier,
    ResearchGoal,
    ResultTier,
    RightsStatus,
    RunStatus,
)
from archresearch_api.visual import ArchitectureAssetType
from archresearch_api.workflow import execute_research_run


class SequencedProvider:
    name = "sequence"

    def __init__(self, batches: list[ProviderSearchResult | Exception]) -> None:
        self.batches = batches
        self.queries: list[str] = []

    def search(
        self,
        query: str,
        goal: ResearchGoal,
        allowed_domains: list[str] | None = None,
    ) -> ProviderSearchResult:
        del goal, allowed_domains
        self.queries.append(query)
        batch = self.batches[len(self.queries) - 1]
        if isinstance(batch, Exception):
            raise batch
        return batch


def _asset(project: str, index: int) -> ProviderAsset:
    source_url = f"https://studio.example/{project}/{index}"
    return ProviderAsset(
        project_name=project,
        asset_type="section" if index % 2 else "plan",
        source_url=source_url,
        image_url=f"https://images.example/{project}/{index}.jpg",
        publication_tier=PublicationTier.primary,
        project_identity=AssociationStatus.confirmed,
        asset_association=AssociationStatus.confirmed,
        primary_source=PrimarySourceStatus.confirmed,
        rights_status=RightsStatus.unknown,
        result_tier=ResultTier.verified,
        relevance=4,
        facts=[f"{project} 的图纸由项目页发布。"],
        observations=["可见清晰的平面与剖面关系。"],
        inferences=["可用于比较空间层次。"],
        limitations=["需核对项目尺度。"],
    )


def _batch(*assets: ProviderAsset) -> ProviderSearchResult:
    return ProviderSearchResult(
        assets=list(assets),
        sources=[
            ProviderSource(
                url=asset.source_url,
                publisher="Studio",
                title=asset.project_name,
                publication_tier=asset.publication_tier,
            )
            for asset in assets
        ],
    )


def _database_with_run(tmp_path: Path, mode: BudgetMode) -> tuple[Database, str]:
    database = Database(f"sqlite:///{(tmp_path / 'workflow.db').as_posix()}")
    database.create_all()
    with database.session_factory() as session:
        workspace = Workspace(name="研究任务")
        session.add(workspace)
        session.flush()
        run = ResearchRun(
            workspace_id=workspace.id,
            question="旧建筑中如何植入新功能并形成有层次的剖面？",
            goal=ResearchGoal.precedent_research.value,
            budget_mode=mode.value,
            budget=BUDGETS[mode].model_dump(),
            allowed_domains=[],
            status=RunStatus.created.value,
            coverage_report={},
        )
        session.add(run)
        session.commit()
        return database, run.id


def _database_with_source_lookup_run(tmp_path: Path) -> tuple[Database, str, Path]:
    database = Database(f"sqlite:///{(tmp_path / 'source-lookup.db').as_posix()}")
    database.create_all()
    image_path = tmp_path / "uploaded-section.png"
    image_path.write_bytes(b"\x89PNG\r\n\x1a\nfixture")
    with database.session_factory() as session:
        workspace = Workspace(name="截图反查")
        session.add(workspace)
        session.flush()
        session.add(
            InputArtifact(
                workspace_id=workspace.id,
                kind="image",
                filename=image_path.name,
                mime_type="image/png",
                storage_path=str(image_path),
            )
        )
        run = ResearchRun(
            workspace_id=workspace.id,
            question="找到这张剖面截图的原项目与来源",
            goal=ResearchGoal.source_lookup.value,
            budget_mode=BudgetMode.quick.value,
            budget=BUDGETS[BudgetMode.quick].model_dump(),
            allowed_domains=[],
            status=RunStatus.created.value,
            coverage_report={},
        )
        session.add(run)
        session.commit()
        return database, run.id, image_path


class ReverseImageProvider:
    name = "tineye"

    def __init__(self, result: list[TinEyeMatch] | Exception) -> None:
        self.result = result
        self.paths: list[Path] = []

    def search_file(self, image_path: Path, limit: int = 10) -> list[TinEyeMatch]:
        del limit
        self.paths.append(image_path)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def test_balanced_run_stops_after_multiple_batches_satisfy_coverage(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.balanced)
    provider = SequencedProvider(
        [
            _batch(_asset("factory", 1), _asset("factory", 2)),
            _batch(_asset("station", 3), _asset("station", 4)),
            _batch(_asset("dock", 5), _asset("dock", 6)),
        ]
    )

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        query_count = session.scalar(
            select(func.count()).select_from(QueryAttempt).where(QueryAttempt.run_id == run_id)
        )
        assert run is not None
        assert run.status == RunStatus.completed.value
        assert run.stop_reason == "coverage_satisfied"
        assert run.coverage_report["usable_assets"] == 6
        assert query_count == 3
    assert len(provider.queries) == 3
    assert len(set(provider.queries)) == 3


def test_quick_run_returns_partial_results_when_budget_is_exhausted(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    provider = SequencedProvider(
        [_batch(_asset(f"project-{index}", index)) for index in range(1, 5)]
    )

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        asset_count = session.scalar(
            select(func.count()).select_from(AssetCandidate).where(AssetCandidate.run_id == run_id)
        )
        assert run is not None
        assert run.status == RunStatus.partial.value
        assert run.stop_reason == "budget_exhausted"
        assert asset_count == 4
    assert len(provider.queries) == 4


def test_run_deadline_stops_before_starting_another_provider_call(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {**run.budget, "max_seconds": 1}
        session.commit()
    provider = SequencedProvider([_batch(_asset("factory", 1)), _batch(_asset("station", 2))])
    times = iter([0.0, 0.0, 2.0])

    execute_research_run(database, run_id, provider, clock=lambda: next(times))

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        assert run.status == RunStatus.partial.value
        assert run.stop_reason == "time_budget_exhausted"
    assert len(provider.queries) == 1


def test_quick_openai_run_reserves_time_for_one_worst_case_call(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class FakeResponses:
        def __init__(self) -> None:
            self.calls = 0

        def parse(self, **kwargs: Any) -> SimpleNamespace:
            del kwargs
            self.calls += 1
            return SimpleNamespace(output_parsed=_batch(_asset("factory", 1)))

    class FakeClock:
        def __init__(self) -> None:
            self._values = iter([0.0, 0.0, 121.0, 241.0])
            self.observed: list[float] = []

        def __call__(self) -> float:
            value = next(self._values)
            self.observed.append(value)
            return value

    responses = FakeResponses()
    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=responses),
    )
    clock = FakeClock()

    execute_research_run(database, run_id, provider, clock=clock)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        query_count = session.scalar(
            select(func.count()).select_from(QueryAttempt).where(QueryAttempt.run_id == run_id)
        )
        assert run is not None
        assert run.status == RunStatus.partial.value
        assert run.stop_reason == "time_budget_exhausted"
        assert query_count == 1
    assert responses.calls == 1
    assert clock.observed == [0.0, 0.0, 121.0]


def test_cancellation_during_provider_call_is_not_overwritten(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class CancellingProvider:
        name = "cancelling"

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del query, goal, allowed_domains
            with database.session_factory() as session:
                run = session.get(ResearchRun, run_id)
                assert run is not None
                run.status = RunStatus.cancelled.value
                run.stop_reason = "user_cancelled"
                session.commit()
            return _batch(_asset("factory", 1))

    terminal: list[str] = []
    execute_research_run(database, run_id, CancellingProvider(), terminal.append)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        assert run.status == RunStatus.cancelled.value
        assert run.stop_reason == "user_cancelled"
    assert terminal == [RunStatus.cancelled.value]


def test_workspace_url_and_pdf_text_are_included_in_bounded_research_queries(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    pdf_path = tmp_path / "brief.pdf"
    with fitz.open() as document:
        page = document.new_page()
        page.insert_text((72, 72), "Retain the north sawtooth roof and separate service access.")
        document.save(pdf_path)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        workspace = session.get(Workspace, run.workspace_id)
        assert workspace is not None
        workspace.brief = "Convert the mill into a public exhibition hall."
        workspace.constraints = ["Keep the original steel frame"]
        session.add_all(
            [
                InputArtifact(
                    workspace_id=workspace.id,
                    kind="url",
                    url="https://studio.example/reference-project",
                ),
                InputArtifact(
                    workspace_id=workspace.id,
                    kind="pdf",
                    filename="brief.pdf",
                    mime_type="application/pdf",
                    storage_path=str(pdf_path),
                    page_count=1,
                ),
            ]
        )
        session.commit()
    provider = SequencedProvider([_batch(_asset("factory", 1)), _batch(), _batch()])

    execute_research_run(database, run_id, provider)

    first_query = provider.queries[0]
    assert "public exhibition hall" in first_query
    assert "original steel frame" in first_query
    assert "https://studio.example/reference-project" in first_query
    assert "north sawtooth roof" in first_query
    assert len(first_query) <= 8_000


def test_two_batches_without_new_assets_stop_the_run_without_duplicates(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    repeated = _batch(_asset("factory", 1))
    provider = SequencedProvider([repeated, repeated, repeated, repeated])

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        asset_count = session.scalar(
            select(func.count()).select_from(AssetCandidate).where(AssetCandidate.run_id == run_id)
        )
        assert run is not None
        assert run.status == RunStatus.partial.value
        assert run.stop_reason == "no_new_assets"
        assert asset_count == 1
    assert len(provider.queries) == 3


def test_web_search_urls_are_not_stored_as_perceptual_hashes(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    provider = SequencedProvider([_batch(_asset("factory", 1)), _batch(), _batch()])

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        asset = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
    assert asset is not None
    assert asset.perceptual_hash is None


def test_provider_asset_type_is_persisted_as_a_plain_string(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    provider = SequencedProvider([_batch(_asset("factory", 1)), _batch(), _batch()])

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        asset_type = session.scalar(
            select(AssetCandidate.asset_type).where(AssetCandidate.run_id == run_id)
        )
    assert type(asset_type) is str
    assert asset_type == ArchitectureAssetType.section.value


def test_provider_failure_preserves_assets_from_completed_batches(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    provider = SequencedProvider([_batch(_asset("factory", 1)), RuntimeError("rate limited")])

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        assert run is not None
        assert run.status == RunStatus.partial.value
        assert run.stop_reason == "provider_error:RuntimeError"
        assert len(assets) == 1


def test_ranking_diversifies_projects_within_the_same_tier_and_relevance(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.balanced)
    provider = SequencedProvider(
        [
            _batch(
                _asset("factory", 1),
                _asset("factory", 2),
                _asset("station", 3),
                _asset("station", 4),
                _asset("dock", 5),
                _asset("dock", 6),
            )
        ]
    )

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        ranked = list(
            session.scalars(
                select(AssetCandidate)
                .where(AssetCandidate.run_id == run_id)
                .order_by(AssetCandidate.rank_index)
            )
        )
    assert {asset.project_name for asset in ranked[:3]} == {"factory", "station", "dock"}


def test_source_lookup_turns_tineye_backlinks_into_conservative_task_evidence(
    tmp_path: Path,
) -> None:
    database, run_id, image_path = _database_with_source_lookup_run(tmp_path)
    reverse_provider = ReverseImageProvider(
        [
            TinEyeMatch(
                image_url="https://studio.example/images/section.jpg",
                domain="studio.example",
                score=93.0,
                backlinks=[
                    TinEyeBacklink(
                        page_url="https://studio.example/projects/unknown",
                        image_url="https://studio.example/images/section.jpg",
                        crawl_date="2025-04-03",
                    )
                ],
            )
        ]
    )
    web_provider = SequencedProvider(
        [ProviderSearchResult(assets=[], sources=[]), ProviderSearchResult(assets=[], sources=[])]
    )

    execute_research_run(database, run_id, web_provider, source_lookup_provider=reverse_provider)

    assert reverse_provider.paths == [image_path]
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        asset = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        source = session.scalar(select(SourcePage).where(SourcePage.run_id == run_id))
        claims = (
            list(
                session.scalars(
                    select(EvidenceClaim).where(EvidenceClaim.asset_candidate_id == asset.id)
                )
            )
            if asset is not None
            else []
        )

        assert run is not None
        assert run.status == RunStatus.partial.value
        assert asset is not None
        assert source is not None
        assert asset.source_page_id == source.id
        assert asset.project_name == "待核验项目"
        assert asset.asset_type == ArchitectureAssetType.photograph.value
        assert asset.publication_tier == PublicationTier.unknown.value
        assert asset.project_identity == AssociationStatus.unknown.value
        assert asset.asset_association == AssociationStatus.unknown.value
        assert asset.primary_source == PrimarySourceStatus.unknown.value
        assert asset.rights_status == RightsStatus.unknown.value
        assert asset.result_tier == ResultTier.visual_lead.value
        assert asset.limitations == [
            "photograph 仅是未分类图片占位，不代表内容被识别为建筑照片；需视觉分类后改写。"
        ]
        assert claims and claims[0].source_url == source.url
        assert "crawl" not in str(asset.facts).lower()
        assert "2025-04-03" not in str(asset.facts)
        assert "2025-04-03" not in claims[0].statement


def test_source_lookup_preserves_web_results_and_returns_partial_when_tineye_fails(
    tmp_path: Path,
) -> None:
    database, run_id, _ = _database_with_source_lookup_run(tmp_path)
    reverse_provider = ReverseImageProvider(RuntimeError("TinEye unavailable"))
    web_provider = SequencedProvider(
        [
            _batch(
                _asset("factory", 1),
                _asset("factory", 2),
                _asset("station", 3),
                _asset("station", 4),
                _asset("dock", 5),
                _asset("dock", 6),
            )
        ]
    )

    execute_research_run(database, run_id, web_provider, source_lookup_provider=reverse_provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        asset_count = session.scalar(
            select(func.count()).select_from(AssetCandidate).where(AssetCandidate.run_id == run_id)
        )
        assert run is not None
        assert run.status == RunStatus.partial.value
        assert run.stop_reason == "source_lookup_error:RuntimeError"
        assert asset_count == 6
    assert len(web_provider.queries) == 1
