from pathlib import Path
from types import SimpleNamespace
from typing import Any

import fitz
from sqlalchemy import func, select

from archresearch_api.database import Database
from archresearch_api.inspection import InspectedVisual
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
    DEPTH_TARGETS,
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
from archresearch_api.visual import ArchitectureAssetType
from archresearch_api.workflow import (
    _persist_assets,
    _persist_inspected_assets,
    _persist_sources,
    _queries_for,
    execute_research_run,
)


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
        batch = (
            self.batches[len(self.queries) - 1]
            if len(self.queries) <= len(self.batches)
            else _batch()
        )
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


def _quick_research_plan() -> ResearchPlan:
    return ResearchPlan(
        subquestions=[
            ResearchSubquestion(
                id="program", question="新功能怎样植入？", rationale="研究新旧关系"
            ),
            ResearchSubquestion(
                id="circulation", question="公共与后勤怎样分开？", rationale="研究冲突节点"
            ),
            ResearchSubquestion(
                id="section", question="剖面怎样形成层次？", rationale="研究竖向联系"
            ),
        ]
    )


def _database_with_run(
    tmp_path: Path,
    mode: BudgetMode,
    goal: ResearchGoal = ResearchGoal.precedent_research,
) -> tuple[Database, str]:
    database = Database(f"sqlite:///{(tmp_path / 'workflow.db').as_posix()}")
    database.create_all()
    with database.session_factory() as session:
        workspace = Workspace(name="研究任务")
        session.add(workspace)
        session.flush()
        run = ResearchRun(
            workspace_id=workspace.id,
            question="旧建筑中如何植入新功能并形成有层次的剖面？",
            goal=goal.value,
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


def _advance_retry_attempt(database: Database, run_id: str) -> None:
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.attempt += 1
        run.status = RunStatus.created.value
        run.stop_reason = None
        session.commit()


def test_query_plan_carries_the_selected_analysis_depth() -> None:
    target = DEPTH_TARGETS[BudgetMode.balanced]

    queries = _queries_for(
        "旧厂房怎样更新？",
        ResearchGoal.precedent_research,
        _quick_research_plan().subquestions,
        max_rounds=target.research_passes,
        max_queries=target.research_passes * 3,
        analysis_requirements=target.analysis_requirements,
    )

    assert "转译步骤" in queries[0][3]
    assert "适用边界" in queries[0][3]
    assert "多来源核验" not in queries[0][3]


def test_run_persists_subquestions_and_binds_queries_and_assets_to_them(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class PlannedProvider(SequencedProvider):
        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, research_context
            return ResearchPlan(
                subquestions=[
                    ResearchSubquestion(
                        id="program", question="新功能怎样植入？", rationale="研究新旧关系"
                    ),
                    ResearchSubquestion(
                        id="circulation", question="公共与后勤怎样分开？", rationale="研究冲突节点"
                    ),
                    ResearchSubquestion(
                        id="section", question="剖面怎样形成层次？", rationale="研究竖向联系"
                    ),
                ]
            )

    provider = PlannedProvider(
        [
            _batch(_asset("factory", 1), _asset("factory", 2)),
            _batch(_asset("station", 3), _asset("station", 4)),
            _batch(_asset("dock", 5), _asset("dock", 6)),
        ]
    )

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        queries = list(
            session.scalars(
                select(QueryAttempt)
                .where(QueryAttempt.run_id == run_id)
                .order_by(QueryAttempt.created_at)
            )
        )
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )

    assert run is not None
    assert [item["id"] for item in run.subquestions] == ["program", "circulation", "section"]
    assert [query.subquestion_id for query in queries] == ["program", "circulation", "section"]
    assert {subquestion_id for asset in assets for subquestion_id in asset.subquestion_ids} == {
        "program",
        "circulation",
        "section",
    }
    assert run.coverage_report["covered_subquestions"] == 3
    assert run.coverage_report["multi_asset_projects"] == 3
    assert run.status == RunStatus.completed.value


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
            _batch(_asset("factory", 1), _asset("factory", 2), _asset("factory", 3)),
            _batch(_asset("station", 4), _asset("station", 5), _asset("station", 6)),
            _batch(_asset("dock", 7), _asset("dock", 8), _asset("dock", 9)),
            _batch(_asset("library", 10), _asset("library", 11), _asset("library", 12)),
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
        assert run.coverage_report["usable_assets"] == 12
        assert run.coverage_report["covered_subquestions"] == 4
        assert query_count == 4
    assert len(provider.queries) == 4
    assert len(set(provider.queries)) == 4


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
    assert len(provider.queries) == 6


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
            self.calls += 1
            if kwargs["text_format"] is ResearchPlan:
                return SimpleNamespace(
                    output_parsed=ResearchPlan(
                        subquestions=[
                            ResearchSubquestion(
                                id="program",
                                question="新功能怎样植入？",
                                rationale="研究功能组织。",
                            ),
                            ResearchSubquestion(
                                id="circulation",
                                question="流线怎样分开？",
                                rationale="研究冲突节点。",
                            ),
                            ResearchSubquestion(
                                id="section",
                                question="剖面怎样分层？",
                                rationale="研究竖向联系。",
                            ),
                        ]
                    )
                )
            return SimpleNamespace(output_parsed=_batch(_asset("factory", 1)))

    class FakeClock:
        def __init__(self) -> None:
            self._values = iter([0.0, 0.0, 31.0, 62.0, 93.0, 124.0, 155.0])
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
        assert run.stop_reason == "no_new_assets"
        assert query_count == 6
    assert responses.calls == 7
    assert clock.observed == [0.0, 0.0, 31.0, 62.0, 93.0, 124.0, 155.0]


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
    database, run_id = _database_with_run(tmp_path, BudgetMode.balanced)
    repeated = _batch(_asset("factory", 1))
    provider = SequencedProvider([repeated] * 8)

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
    assert len(provider.queries) == 8


def test_empty_quick_research_finishes_two_fair_passes_for_every_subquestion(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    provider = SequencedProvider([_batch()] * 6)

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        attempts = list(
            session.scalars(
                select(QueryAttempt)
                .where(QueryAttempt.run_id == run_id)
                .order_by(QueryAttempt.created_at, QueryAttempt.id)
            )
        )
        run = session.get(ResearchRun, run_id)

    assert run is not None
    assert [attempt.subquestion_id for attempt in attempts] == [
        "program",
        "circulation",
        "section",
        "program",
        "circulation",
        "section",
    ]
    assert run.coverage_report["subquestion_passes"] == {
        "program": 2,
        "circulation": 2,
        "section": 2,
    }


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


def test_retry_skips_completed_queries_and_resumes_the_failed_subquestion(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class FailsOnceOnThirdSubquestion:
        name = "resume"

        def __init__(self) -> None:
            self.queries: list[str] = []
            self.section_failed = False

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, research_context
            return _quick_research_plan()

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del goal, allowed_domains
            self.queries.append(query)
            if "新功能怎样植入" in query:
                return _batch(_asset("factory", 1), _asset("factory", 2))
            if "公共与后勤怎样分开" in query:
                return _batch(_asset("station", 3), _asset("station", 4))
            if not self.section_failed:
                self.section_failed = True
                raise RuntimeError("temporary provider failure")
            return _batch(_asset("dock", 5), _asset("dock", 6))

    provider = FailsOnceOnThirdSubquestion()
    execute_research_run(database, run_id, provider)
    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        attempts = list(
            session.scalars(
                select(QueryAttempt)
                .where(QueryAttempt.run_id == run_id)
                .order_by(QueryAttempt.created_at, QueryAttempt.id)
            )
        )

    assert run is not None
    assert run.status == RunStatus.completed.value
    assert sum("新功能怎样植入" in query for query in provider.queries) == 1
    assert sum("公共与后勤怎样分开" in query for query in provider.queries) == 1
    assert sum("剖面怎样形成层次" in query for query in provider.queries) == 2
    assert [attempt.status for attempt in attempts] == [
        "completed",
        "completed",
        "started",
        "completed",
    ]


def test_retry_replays_completed_queries_after_a_resumed_run_finishes_partial(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class PartialAfterResumeProvider:
        name = "partial-resume"

        def __init__(self) -> None:
            self.queries: list[str] = []
            self.section_failed = False

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, research_context
            return _quick_research_plan()

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del goal, allowed_domains
            self.queries.append(query)
            if "剖面怎样形成层次" in query and not self.section_failed:
                self.section_failed = True
                raise RuntimeError("temporary provider failure")
            if "新功能怎样植入" in query:
                return _batch(_asset("factory", 1))
            if "公共与后勤怎样分开" in query:
                return _batch(_asset("station", 2))
            return _batch(_asset("dock", 3))

    provider = PartialAfterResumeProvider()
    execute_research_run(database, run_id, provider)
    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
    assert run is not None
    assert run.status == RunStatus.partial.value

    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)

    assert sum("新功能怎样植入" in query for query in provider.queries) == 4
    assert sum("公共与后勤怎样分开" in query for query in provider.queries) == 4
    assert sum("剖面怎样形成层次" in query for query in provider.queries) == 5


def test_retry_resume_uses_only_the_immediately_previous_failed_execution(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class CrashesOnSecondSectionQuery:
        name = "retry-generation"

        def __init__(self) -> None:
            self.counts = {"program": 0, "circulation": 0, "section": 0}

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, research_context
            return _quick_research_plan()

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del goal, allowed_domains
            if "新功能怎样植入" in query:
                key = "program"
            elif "公共与后勤怎样分开" in query:
                key = "circulation"
            else:
                key = "section"
            self.counts[key] += 1
            if key == "section" and self.counts[key] == 2:
                raise RuntimeError("retry crashed on section")
            index = sum(self.counts.values())
            return _batch(_asset(f"{key}-{self.counts[key]}", index))

    provider = CrashesOnSecondSectionQuery()
    execute_research_run(database, run_id, provider)
    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)
    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)

    assert provider.counts["program"] == 4
    assert provider.counts["circulation"] == 4
    assert provider.counts["section"] == 5


def test_service_resume_keeps_completed_keys_inherited_by_the_current_retry(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class SectionFailsTwice:
        name = "retry-restart"

        def __init__(self) -> None:
            self.counts = {"program": 0, "circulation": 0, "section": 0}

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, research_context
            return _quick_research_plan()

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del goal, allowed_domains
            if "新功能怎样植入" in query:
                key = "program"
            elif "公共与后勤怎样分开" in query:
                key = "circulation"
            else:
                key = "section"
            self.counts[key] += 1
            if key == "section" and self.counts[key] <= 2:
                raise RuntimeError("section search interrupted")
            return _batch(_asset(key, self.counts[key]))

    provider = SectionFailsTwice()
    execute_research_run(database, run_id, provider)
    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)
    execute_research_run(database, run_id, provider)

    assert provider.counts == {"program": 2, "circulation": 2, "section": 4}

    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)

    assert provider.counts == {"program": 3, "circulation": 2, "section": 4}


def test_duplicate_asset_keeps_analysis_for_each_supported_subquestion(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    shared = _asset("shared", 1)

    class MultiQuestionProvider:
        name = "multi-question"

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, research_context
            return _quick_research_plan()

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del goal, allowed_domains
            if "新功能怎样植入" in query:
                return _batch(
                    shared.model_copy(
                        update={
                            "design_mechanism": "功能盒与旧结构脱开。",
                            "transfer_strategy": ["先标保留结构", "再放独立功能盒"],
                        }
                    ),
                    _asset("program-only", 2),
                )
            if "公共与后勤怎样分开" in query:
                return _batch(
                    shared.model_copy(
                        update={
                            "design_mechanism": "公共路径与后勤路径只在门厅交叉。",
                            "transfer_strategy": ["分别画完整路径", "集中交叉节点"],
                        }
                    ),
                    _asset("circulation-only", 3),
                )
            return _batch(
                _asset("section-only", 4),
                _asset("section-only", 5),
                _asset("section-only", 6),
            )

    execute_research_run(database, run_id, MultiQuestionProvider())

    with database.session_factory() as session:
        candidate = session.scalar(
            select(AssetCandidate).where(
                AssetCandidate.run_id == run_id,
                AssetCandidate.project_name == "shared",
            )
        )

    assert candidate is not None
    assert candidate.subquestion_ids == ["program", "circulation"]
    assert candidate.subquestion_analysis == {
        "program": {
            "project_context": "",
            "design_mechanism": "功能盒与旧结构脱开。",
            "transfer_strategy": ["先标保留结构", "再放独立功能盒"],
            "observations": ["可见清晰的平面与剖面关系。"],
            "limitations": ["需核对项目尺度。"],
        },
        "circulation": {
            "project_context": "",
            "design_mechanism": "公共路径与后勤路径只在门厅交叉。",
            "transfer_strategy": ["分别画完整路径", "集中交叉节点"],
            "observations": ["可见清晰的平面与剖面关系。"],
            "limitations": ["需核对项目尺度。"],
        },
    }


def test_workflow_discards_project_context_without_an_exact_supporting_fact(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    unsupported = _asset("factory", 1).model_copy(
        update={
            "project_context": "项目位于滨水工业遗址。",
            "facts": ["该图纸由项目页发布。"],
        }
    )
    provider = SequencedProvider([_batch(unsupported), _batch(), _batch()])

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        candidate = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
    assert candidate is not None
    assert candidate.project_context == ""
    assert candidate.subquestion_analysis["program"]["project_context"] == ""


def test_perceptual_duplicate_preserves_both_sources_and_prefers_primary_page(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    aggregator = ProviderSource(
        url="https://aggregator.example/foundry",
        publisher="Aggregator",
        title="Foundry repost",
        publication_tier=PublicationTier.aggregator,
    )
    primary = ProviderSource(
        url="https://studio.example/foundry",
        publisher="Studio",
        title="Foundry project",
        publication_tier=PublicationTier.primary,
    )
    first_path = tmp_path / "aggregator.png"
    second_path = tmp_path / "primary.png"
    first_path.write_bytes(b"first")
    second_path.write_bytes(b"second")
    _persist_sources(database, run_id, ProviderSearchResult(assets=[], sources=[aggregator]))
    _persist_inspected_assets(
        database,
        run_id,
        aggregator,
        [
            InspectedVisual(
                source_url=aggregator.url,
                image_url="https://aggregator.example/foundry.png",
                storage_path=first_path,
                perceptual_hash="same-visual",
                asset_type=ArchitectureAssetType.section,
                relevance=4,
                observations=["可见连续剖面平台。"],
            )
        ],
    )
    _persist_sources(database, run_id, ProviderSearchResult(assets=[], sources=[primary]))
    _persist_inspected_assets(
        database,
        run_id,
        primary,
        [
            InspectedVisual(
                source_url=primary.url,
                image_url="https://studio.example/foundry.png",
                storage_path=second_path,
                perceptual_hash="same-visual",
                asset_type=ArchitectureAssetType.section,
                relevance=4,
                observations=["同一图纸出现在设计方项目页。"],
            )
        ],
    )

    with database.session_factory() as session:
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        pages = {
            page.url: page.id
            for page in session.scalars(select(SourcePage).where(SourcePage.run_id == run_id))
        }
        claims = list(
            session.scalars(
                select(EvidenceClaim).where(
                    EvidenceClaim.asset_candidate_id == assets[0].id,
                    EvidenceClaim.claim_type == "observation",
                )
            )
        )

    assert len(assets) == 1
    assert assets[0].source_url == primary.url
    assert assets[0].source_page_id == pages[primary.url]
    assert assets[0].publication_tier == PublicationTier.primary.value
    assert assets[0].rights_status == RightsStatus.unknown.value
    assert assets[0].primary_source == PrimarySourceStatus.unknown.value
    assert {claim.source_url for claim in claims} == {aggregator.url, primary.url}
    assert first_path.is_file()
    assert not second_path.exists()


def test_browser_observation_enriches_provider_analysis_without_clearing_it(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    source = ProviderSource(
        url="https://studio.example/foundry",
        publisher="Studio",
        title="Foundry project",
        publication_tier=PublicationTier.primary,
    )
    context = "原铸造车间保留连续钢桁架。"
    provider_asset = _asset("foundry", 1).model_copy(
        update={
            "source_url": source.url,
            "image_url": "https://studio.example/foundry-section.png",
            "project_context": context,
            "design_mechanism": "独立功能盒与旧桁架脱开。",
            "transfer_strategy": ["标出保留跨", "将新功能压成独立盒"],
            "facts": [context],
            "observations": ["项目页图注显示保留桁架。"],
            "limitations": ["需核对原柱网跨度。"],
        }
    )
    result = ProviderSearchResult(assets=[provider_asset], sources=[source])
    _persist_sources(database, run_id, result)
    _persist_assets(database, run_id, result, subquestion_id="program")
    crop_path = tmp_path / "foundry-section.png"
    crop_path.write_bytes(b"crop")

    _persist_inspected_assets(
        database,
        run_id,
        source,
        [
            InspectedVisual(
                source_url=source.url,
                image_url=provider_asset.image_url,
                storage_path=crop_path,
                perceptual_hash="foundry-section",
                asset_type=ArchitectureAssetType.section,
                relevance=4,
                observations=["裁图中可见新盒体未触碰旧桁架。"],
            )
        ],
        subquestion_id="program",
    )
    followup_asset = provider_asset.model_copy(
        update={
            "project_context": "",
            "design_mechanism": "",
            "transfer_strategy": ["补充核对新盒体的独立基础"],
            "facts": [],
            "observations": ["第二轮项目文字确认盒体采用独立支承。"],
            "limitations": ["独立基础仍需结构顾问核算。"],
        }
    )
    _persist_assets(
        database,
        run_id,
        ProviderSearchResult(assets=[followup_asset], sources=[source]),
        subquestion_id="program",
    )

    with database.session_factory() as session:
        candidate = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
    assert candidate is not None
    analysis = candidate.subquestion_analysis["program"]
    assert analysis["project_context"] == context
    assert analysis["design_mechanism"] == "独立功能盒与旧桁架脱开。"
    assert analysis["transfer_strategy"] == [
        "标出保留跨",
        "将新功能压成独立盒",
        "补充核对新盒体的独立基础",
    ]
    assert analysis["limitations"] == [
        "需核对原柱网跨度。",
        "独立基础仍需结构顾问核算。",
    ]
    assert analysis["observations"] == [
        "项目页图注显示保留桁架。",
        "裁图中可见新盒体未触碰旧桁架。",
        "第二轮项目文字确认盒体采用独立支承。",
    ]
    assert candidate.observations == analysis["observations"]


def test_browser_crop_attaches_to_unique_same_source_provider_candidate_without_image(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    source = ProviderSource(
        url="https://studio.example/foundry",
        publisher="Studio",
        title="Foundry project",
        publication_tier=PublicationTier.primary,
    )
    provider_asset = _asset("foundry", 1).model_copy(
        update={
            "source_url": source.url,
            "image_url": None,
            "asset_type": ArchitectureAssetType.section,
        }
    )
    result = ProviderSearchResult(assets=[provider_asset], sources=[source])
    _persist_sources(database, run_id, result)
    _persist_assets(database, run_id, result, subquestion_id="program")
    crop_path = tmp_path / "foundry-section.png"
    crop_path.write_bytes(b"crop")

    added = _persist_inspected_assets(
        database,
        run_id,
        source,
        [
            InspectedVisual(
                source_url=source.url,
                image_url="https://studio.example/images/foundry-section.png",
                storage_path=crop_path,
                perceptual_hash="foundry-section",
                asset_type=ArchitectureAssetType.section,
                relevance=4,
                observations=["裁图中可见新功能层与旧桁架脱开。"],
            )
        ],
        subquestion_id="program",
    )

    with database.session_factory() as session:
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
    assert added == 0
    assert len(assets) == 1
    assert assets[0].project_name == provider_asset.project_name
    assert assets[0].asset_type == ArchitectureAssetType.section.value
    assert assets[0].image_url == "https://studio.example/images/foundry-section.png"
    assert assets[0].storage_path == str(crop_path)
    assert assets[0].perceptual_hash == "foundry-section"
    assert assets[0].observations[-1] == "裁图中可见新功能层与旧桁架脱开。"


def test_same_url_source_and_candidate_publication_tiers_only_upgrade(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    url = "https://publisher.example/foundry"
    low_source = ProviderSource(
        url=url,
        publisher="Publisher",
        title="Foundry",
        publication_tier=PublicationTier.aggregator,
    )
    high_source = low_source.model_copy(update={"publication_tier": PublicationTier.primary})
    low_asset = _asset("foundry", 1).model_copy(
        update={
            "source_url": url,
            "publication_tier": PublicationTier.aggregator,
        }
    )
    high_asset = low_asset.model_copy(update={"publication_tier": PublicationTier.primary})
    low_result = ProviderSearchResult(assets=[low_asset], sources=[low_source])
    high_result = ProviderSearchResult(assets=[high_asset], sources=[high_source])

    _persist_sources(database, run_id, low_result)
    _persist_assets(database, run_id, low_result, subquestion_id="program")
    _persist_sources(database, run_id, high_result)
    _persist_assets(database, run_id, high_result, subquestion_id="program")

    with database.session_factory() as session:
        page = session.scalar(select(SourcePage).where(SourcePage.run_id == run_id))
        candidate = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
    assert page is not None
    assert candidate is not None
    assert page.publication_tier == PublicationTier.primary.value
    assert candidate.publication_tier == PublicationTier.primary.value


def test_source_relation_without_an_existing_asset_never_creates_a_fake_local_path(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    source = ProviderSource(
        url="https://studio.example/unmatched",
        publisher="Studio",
        title="Unmatched project",
        publication_tier=PublicationTier.primary,
    )
    _persist_sources(database, run_id, ProviderSearchResult(assets=[], sources=[source]))

    added = _persist_inspected_assets(
        database,
        run_id,
        source,
        [
            InspectedVisual(
                source_url=source.url,
                image_url="https://studio.example/unmatched.png",
                storage_path=None,
                perceptual_hash="missing-original",
                asset_type=ArchitectureAssetType.plan,
                relevance=4,
                observations=["轻量来源关系没有本地图像。"],
            )
        ],
    )

    with database.session_factory() as session:
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
    assert added == 0
    assert assets == []


def test_precedent_coverage_requires_displayable_evidence_for_every_subquestion(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class MissingSectionImagesProvider:
        name = "missing-images"

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del question, goal, budget_mode, research_context
            return _quick_research_plan()

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del goal, allowed_domains
            if "新功能怎样植入" in query:
                return _batch(_asset("factory", 1), _asset("factory", 2))
            if "公共与后勤怎样分开" in query:
                return _batch(_asset("station", 3), _asset("station", 4))
            if "剖面怎样形成层次" in query:
                return _batch(
                    _asset("dock", 5).model_copy(update={"image_url": None}),
                    _asset("dock", 6).model_copy(update={"image_url": None}),
                )
            return _batch()

    execute_research_run(database, run_id, MissingSectionImagesProvider())

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)

    assert run is not None
    assert run.status == RunStatus.partial.value
    assert run.coverage_report["usable_assets"] == 4
    assert run.coverage_report["covered_subquestions"] == 2
    assert "uncovered_subquestions" in run.coverage_report["gaps"]


def test_source_lookup_does_not_finish_before_every_planned_subquestion_has_evidence(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(
        tmp_path,
        BudgetMode.quick,
        ResearchGoal.source_lookup,
    )
    provider = SequencedProvider(
        [
            _batch(_asset("factory", 1), _asset("factory", 2), _asset("factory", 3)),
            _batch(_asset("station", 4), _asset("station", 5), _asset("station", 6)),
            _batch(),
            _batch(),
        ]
    )

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
    assert run is not None
    assert run.status == RunStatus.partial.value
    assert run.coverage_report["covered_subquestions"] == 2
    assert "uncovered_subquestions" in run.coverage_report["gaps"]
    assert len(provider.queries) >= 3


def test_deep_source_lookup_requires_more_assets_than_quick(tmp_path: Path) -> None:
    database, run_id = _database_with_run(
        tmp_path,
        BudgetMode.deep,
        ResearchGoal.source_lookup,
    )
    provider = SequencedProvider(
        [
            *[_batch(_asset(f"project-{index}", index)) for index in range(1, 7)],
            _batch(),
            _batch(),
        ]
    )

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
    assert run is not None
    assert run.status == RunStatus.partial.value
    assert run.coverage_report["usable_assets"] == 6
    assert run.coverage_report["covered_subquestions"] == 6
    assert "insufficient_usable_assets" in run.coverage_report["gaps"]


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
            ),
            _batch(),
            _batch(),
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
    assert len(web_provider.queries) == 6
