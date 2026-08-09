from collections.abc import Sequence
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import fitz
import pytest
from sqlalchemy import func, select

import archresearch_api.workflow as workflow_module
from archresearch_api.agent.planning import build_public_search_query, build_queries
from archresearch_api.agent.verification import calculate_coverage
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
    PublicPageAnalysis,
    PublicPageDrawing,
    PublicPageSupportedFact,
    ResearchSynthesis,
    ResearchSynthesisCase,
    ResearchSynthesisFinding,
)
from archresearch_api.public_pages import ParsedPageImage, ParsedPublicPage, PublicSearchLead
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
    _inspection_source_sort_key,
    _persist_assets,
    _persist_inspected_assets,
    _persist_sources,
    _public_page_analysis_text,
    _try_xiaohongshu_search,
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
    *,
    question: str = "旧建筑中如何植入新功能并形成有层次的剖面？",
) -> tuple[Database, str]:
    database = Database(f"sqlite:///{(tmp_path / 'workflow.db').as_posix()}")
    database.create_all()
    with database.session_factory() as session:
        workspace = Workspace(name="研究任务")
        session.add(workspace)
        session.flush()
        run = ResearchRun(
            workspace_id=workspace.id,
            question=question,
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


def test_three_depths_complete_across_distinct_question_families(tmp_path: Path) -> None:
    question_families = {
        "library_climate": (
            "高密度社区图书馆如何通过中庭、采光井和剖面层次改善自然采光与通风？",
            [
                "solar_orientation",
                "daylight",
                "thermal_buffer",
                "natural_ventilation",
                "public_program",
                "section",
            ],
        ),
        "mountain_campus": (
            "山地校园如何组织高差交通、无障碍路径、人车分流和紧急疏散？",
            [
                "arrival",
                "accessible_gradient",
                "pedestrian_vehicle",
                "vertical_core",
                "evacuation",
                "landscape",
            ],
        ),
        "waterfront_reuse": (
            "滨水工业遗址更新如何兼顾防洪、公共开放、结构保留和分期运营？",
            [
                "flood_level",
                "public_edge",
                "retained_structure",
                "service_access",
                "adaptive_program",
                "phasing",
            ],
        ),
    }

    class CrossQuestionProvider:
        name = "cross_question"
        worst_case_call_seconds = 0.0
        worst_case_page_analysis_seconds = 0.0

        def __init__(self, question: str, dimensions: list[str]) -> None:
            self.question = question
            self.dimensions = dimensions
            self.mode: BudgetMode | None = None
            self.queries: list[str] = []

        def synthesis_worst_case_seconds(self, budget_mode: BudgetMode) -> float:
            assert budget_mode is self.mode
            return 0.0

        def plan(
            self,
            question: str,
            goal: ResearchGoal,
            budget_mode: BudgetMode,
            research_context: str,
        ) -> ResearchPlan:
            del research_context
            assert question == self.question
            assert goal is ResearchGoal.precedent_research
            self.mode = budget_mode
            target = DEPTH_TARGETS[budget_mode].subquestions
            return ResearchPlan(
                subquestions=[
                    ResearchSubquestion(
                        id=dimension,
                        question=f"{question}：重点核验 {dimension} 的案例机制？",
                        rationale=f"比较 {dimension} 的项目条件、设计操作和适用边界。",
                    )
                    for dimension in self.dimensions[:target]
                ]
            )

        def search(
            self,
            query: str,
            goal: ResearchGoal,
            allowed_domains: list[str] | None = None,
        ) -> ProviderSearchResult:
            del allowed_domains
            assert goal is ResearchGoal.precedent_research
            assert self.question in query
            self.queries.append(query)
            query_index = len(self.queries)
            project = f"case-{query_index}"
            source_url = f"https://www.archdaily.com/{100000 + query_index}/{project}"
            first_asset_index = (query_index - 1) * 3 + 1
            assets = [
                _asset(project, first_asset_index + offset).model_copy(
                    update={
                        "source_url": source_url,
                        "image_url": f"https://images.example/{project}/{offset + 1}.jpg",
                    }
                )
                for offset in range(3)
            ]
            return ProviderSearchResult(
                assets=assets,
                sources=[
                    ProviderSource(
                        url=source_url,
                        publisher="Studio",
                        title=project,
                        publication_tier=PublicationTier.primary,
                    )
                ],
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
            del source_url, analysis_requirements
            assert question
            context = f"{title}回应了场地与使用条件。"
            mechanism = f"{title}以清晰空间机制组织交通、气候与结构。"
            context_excerpt = "The project responds to its site and program constraints."
            mechanism_excerpt = "A clear spatial mechanism organizes access, climate and structure."
            assert context_excerpt in page_text
            assert mechanism_excerpt in page_text
            return PublicPageAnalysis(
                relevance=4,
                drawing_ids=[drawing.drawing_id for drawing in drawings[:3]],
                project_context=context,
                design_mechanism=mechanism,
                transfer_strategy=[f"先核验 {title} 的适用条件，再转译其空间机制。"],
                facts=[
                    PublicPageSupportedFact(
                        statement=context,
                        text_excerpt=context_excerpt,
                    ),
                    PublicPageSupportedFact(
                        statement=mechanism,
                        text_excerpt=mechanism_excerpt,
                    ),
                ],
                limitations=[f"{title} 的尺度和技术条件仍需逐项核对。"],
            )

        def synthesize_research(
            self,
            *,
            question: str,
            budget_mode: BudgetMode,
            subquestions: Sequence[ResearchSubquestion],
            cases: Sequence[ResearchSynthesisCase],
        ) -> ResearchSynthesis:
            assert question == self.question
            assert budget_mode is self.mode
            assert len(subquestions) == DEPTH_TARGETS[budget_mode].subquestions
            asset_ids = [case.asset_id for case in cases]
            assert asset_ids

            def finding(label: str, offset: int = 0) -> ResearchSynthesisFinding:
                return ResearchSynthesisFinding(
                    statement=f"{label}：{question}",
                    evidence_asset_ids=[asset_ids[offset % len(asset_ids)]],
                )

            if budget_mode is BudgetMode.quick:
                return ResearchSynthesis(
                    answer=finding("快速结论"),
                    causal_chains=[finding("因果链")],
                    recommendations=[finding("建议")],
                )
            return ResearchSynthesis(
                answer=finding("综合结论"),
                causal_chains=[finding("因果链一"), finding("因果链二", 1)],
                comparisons=[finding("比较一"), finding("比较二", 1)],
                conflicts=[finding("证据冲突")],
                applicability_boundaries=[finding("边界一"), finding("边界二", 1)],
                recommendations=[finding("建议一"), finding("建议二", 1)],
            )

    class MatrixPublicPageParser:
        name = "matrix_public_pages"
        worst_case_call_seconds = 0.0

        def __init__(self) -> None:
            self.search_count = 0

        def search(
            self,
            query: str,
            *,
            limit: int,
            include_domains: list[str],
        ) -> list[PublicSearchLead]:
            del query, limit, include_domains
            self.search_count += 1
            project = f"matrix-case-{self.search_count}"
            return [
                PublicSearchLead(
                    url=(f"https://www.archdaily.com/{200000 + self.search_count}/{project}"),
                    title=f"{project} / Matrix Studio",
                    description="Deterministic article-ready architecture case",
                )
            ]

        def parse(self, url: str) -> ParsedPublicPage:
            project = url.rstrip("/").rsplit("/", 1)[-1]
            return ParsedPublicPage(
                source_url=url,
                title=f"{project} / Matrix Studio",
                markdown=(
                    "The project responds to its site and program constraints. "
                    "A clear spatial mechanism organizes access, climate and structure."
                ),
                images=[
                    ParsedPageImage(
                        url=f"https://images.example/{project}/{index}.jpg",
                        alt=f"{project} {'plan' if index % 2 else 'section'} {index}",
                    )
                    for index in range(1, 4)
                ],
            )

    for family, (question, dimensions) in question_families.items():
        for mode in BudgetMode:
            case_root = tmp_path / f"{family}-{mode.value}"
            case_root.mkdir()
            database, run_id = _database_with_run(
                case_root,
                mode,
                question=question,
            )
            provider = CrossQuestionProvider(question, dimensions)

            execute_research_run(
                database,
                run_id,
                provider,
                public_page_parser=MatrixPublicPageParser(),
            )

            with database.session_factory() as session:
                run = session.get(ResearchRun, run_id)
            assert run is not None
            target = DEPTH_TARGETS[mode]
            assert run.status == RunStatus.completed.value, (
                family,
                mode,
                run.stop_reason,
                run.coverage_report,
            )
            assert run.coverage_report["subquestion_count"] == target.subquestions
            assert run.coverage_report["covered_subquestions"] == target.subquestions
            assert run.coverage_report["gaps"] == []
            assert run.coverage_report["usable_assets"] >= target.assets
            assert run.coverage_report["project_count"] >= target.projects
            synthesis = run.coverage_report["synthesis"]
            expected_counts = (1, 0, 0, 0, 1) if mode is BudgetMode.quick else (2, 2, 1, 2, 2)
            assert (
                len(synthesis["causal_chains"]),
                len(synthesis["comparisons"]),
                len(synthesis["conflicts"]),
                len(synthesis["applicability_boundaries"]),
                len(synthesis["recommendations"]),
            ) == expected_counts


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

    queries = build_queries(
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


def test_public_page_analysis_text_keeps_a_mechanism_after_six_thousand_characters() -> None:
    mechanism = "TAIL_MECHANISM: the inserted volume is detached from the old frame."
    page = ParsedPublicPage(
        source_url="https://studio.example/foundry",
        title="Foundry reuse",
        markdown=f"{'A' * 6_500}{mechanism}",
    )

    assert mechanism in _public_page_analysis_text(page)


def test_public_page_analysis_question_does_not_add_solution_mechanisms() -> None:
    broad = "新功能如何在图纸中表达可辨识的新旧关系？"
    narrow = "盒中盒、夹层或独立结构如何植入？"

    broad_prompt = workflow_module._public_page_analysis_question(broad)
    narrow_prompt = workflow_module._public_page_analysis_question(narrow)

    assert broad_prompt == broad
    assert narrow_prompt == narrow

    interface = (
        "新植入功能与保留柱网、楼板和桁架如何通过开洞、退让、跨接形成界面，"
        "并支持公共空间和后勤设施同时运行？"
    )
    interface_prompt = workflow_module._public_page_analysis_question(interface)
    assert interface_prompt == interface


def test_public_page_analysis_question_preserves_only_explicit_technical_terms() -> None:
    question = "新建铁路客运站如何通过多层站厅和竖向交通连接站台与城市广场？"
    prompt = workflow_module._public_page_analysis_question(question)

    assert prompt == question
    for invented_term in ("夹层", "挑空", "地下空间", "屋盖", "核心筒", "消防流线"):
        assert invented_term not in prompt


def test_public_search_query_keeps_workspace_typology_for_a_generic_question() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "公众与后勤流线如何通过独立入口和服务廊道分开？",
        1,
        research_question="旧建筑更新中如何组织流线？",
        research_context="Brief: 验证旧工业建筑更新的图纸研究闭环",
        trusted_domain="archdaily.com",
    )

    assert "adaptive reuse industrial building" in query
    assert "visitor circulation" in query
    assert query.endswith("site:archdaily.com")


def test_public_search_query_prioritizes_program_insertion_over_drawing_media_words() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "新功能通过插入、嵌套或独立盒体植入旧结构，平面图与剖面图如何表达？",
        1,
        research_question="旧建筑更新中如何植入新功能？",
        research_context="Brief: 旧工业建筑更新",
        trusted_domain="archdaily.com",
    )

    assert "program insertion" in query
    assert "inserted volume" in query
    assert "retained structure" in query
    assert "spatial relationships" in query
    assert "exhibition" not in query
    assert "workshop" not in query
    assert "old new structure daylight void section" not in query


def test_public_search_query_routes_overlapping_words_by_primary_design_intent() -> None:
    cases = [
        (
            "新功能通过插入盒体植入旧结构，剖面图如何表达新旧关系？",
            ("program insertion", "inserted volume", "retained structure"),
            ("box-in-box", "workshop", "skylight clerestory"),
        ),
        (
            "原有大跨空间如何通过挑空、夹层、下沉和屋顶加建形成剖面层次？",
            ("sectional hierarchy", "double-height", "mezzanine", "sunken space"),
            ("program insertion", "vertical circulation", "skylight clerestory"),
        ),
        (
            "如何插入天窗和高侧窗，让庭院组织稳定的采光策略与剖面？",
            ("skylight", "clerestory", "courtyard", "daylight"),
            ("program insertion", "sectional hierarchy"),
        ),
        (
            "加建区域如何通过独立入口、服务廊道和核心筒分离访客与后勤流线？",
            ("visitor circulation", "back-of-house", "independent entrance", "service corridor"),
            ("loading dock", "program insertion", "sectional hierarchy"),
        ),
        (
            "How can a roof extension, mezzanine and sunken floor create a sectional hierarchy?",
            ("sectional hierarchy", "mezzanine", "sunken space"),
            ("program insertion", "skylight clerestory"),
        ),
        (
            "How does the section organize the vertical relationship between public levels?",
            ("section", "vertical relationships"),
            ("vertical circulation", "program insertion", "skylight clerestory"),
        ),
        (
            "How do retained columns, slabs and trusses meet new openings, setbacks and "
            "bridges while supporting public and back-of-house uses?",
            ("retained columns", "slabs", "trusses", "openings", "setbacks", "bridges"),
            ("visitor circulation", "program insertion"),
        ),
    ]

    for subquestion, expected_terms, excluded_terms in cases:
        query = build_public_search_query(
            ResearchGoal.precedent_research,
            "en",
            subquestion,
            1,
            research_question="How should an existing industrial building be reused?",
            research_context="Brief: adaptive reuse research",
            trusted_domain="archdaily.com",
        )

        for term in expected_terms:
            assert term in query, (subquestion, query)
        for term in excluded_terms:
            assert term not in query, (subquestion, query)


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


def test_quick_run_completes_when_coverage_is_complete_but_enrichment_stays_incomplete(
    tmp_path: Path,
) -> None:
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
        assert run.status == RunStatus.completed.value
        assert run.stop_reason == "coverage_satisfied"
        assert asset_count == 4
        assert run.coverage_report["covered_subquestions"] == 3
        assert run.coverage_report["gaps"] == []
        assert "insufficient_usable_assets" in run.coverage_report["enrichment_gaps"]
        assert "insufficient_subquestion_assets" in run.coverage_report["enrichment_gaps"]
    assert (
        len(provider.queries)
        == (
            BUDGETS[BudgetMode.quick].max_rounds
            + BUDGETS[BudgetMode.quick].completion_recovery_rounds
        )
        * DEPTH_TARGETS[BudgetMode.quick].subquestions
    )


def test_article_ready_project_counts_distinct_drawings_from_its_verified_source(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    subquestion_id = "spatial_relations"

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.subquestions = [
            {
                "id": subquestion_id,
                "question": "不同案例呈现了哪些可迁移的空间关系？",
                "rationale": "比较空间组织与实际使用之间的联系。",
            }
        ]

        def add_project_assets(
            project_name: str,
            evidence_url: str,
            supporting_url: str,
            asset_suffix: str = "",
        ) -> None:
            context = f"{project_name} 的项目条件。"
            mechanism = f"{project_name} 的空间机制。"
            article_asset = AssetCandidate(
                run_id=run_id,
                project_name=project_name,
                asset_type=ArchitectureAssetType.section.value,
                source_url=evidence_url,
                image_url=f"{evidence_url}/section{asset_suffix}.jpg",
                result_tier=ResultTier.partial.value,
                relevance=3,
                subquestion_ids=[subquestion_id],
                project_context=context,
                design_mechanism=mechanism,
                transfer_strategy=["核验条件后转译空间机制。"],
                subquestion_analysis={
                    subquestion_id: {
                        "project_context": context,
                        "design_mechanism": mechanism,
                        "transfer_strategy": ["核验条件后转译空间机制。"],
                    }
                },
            )
            supporting_asset = AssetCandidate(
                run_id=run_id,
                project_name=project_name,
                asset_type=ArchitectureAssetType.axonometric.value,
                source_url=supporting_url,
                image_url=f"{supporting_url}/axonometric{asset_suffix}.jpg",
                result_tier=ResultTier.partial.value,
                relevance=3,
            )
            session.add_all([article_asset, supporting_asset])
            session.flush()
            session.add_all(
                [
                    EvidenceClaim(
                        asset_candidate_id=article_asset.id,
                        claim_type="fact",
                        statement=statement,
                        source_url=evidence_url,
                        text_excerpt=excerpt,
                    )
                    for statement, excerpt in (
                        (context, "Verified project context."),
                        (mechanism, "Verified spatial mechanism."),
                    )
                ]
            )

        same_source = "https://studio.example/verified-project"
        add_project_assets("Verified project", same_source, same_source)
        add_project_assets("Verified project", same_source, same_source, "-alternate")
        add_project_assets(
            "Name collision project",
            "https://studio.example/name-collision",
            "https://unrelated.example/name-collision",
        )
        session.commit()

    coverage = calculate_coverage(database, run_id, require_article_analysis=True)

    assert coverage["project_count"] == 2
    assert coverage["multi_asset_projects"] == 1
    assert coverage["projects_per_subquestion"] == {subquestion_id: 2}


def test_partial_asset_without_a_source_claim_does_not_complete_its_subquestion(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    unsupported = _asset("dock", 3).model_copy(update={"facts": []})
    provider = SequencedProvider(
        [
            _batch(_asset("factory", 1)),
            _batch(_asset("station", 2)),
            _batch(unsupported),
            _batch(),
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
    assert run.coverage_report["gaps"] == ["uncovered_subquestions"]


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
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {**run.budget, "max_seconds": 200}
        session.commit()

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
            self._values = iter([0.0, 0.0, 31.0, 62.0, 93.0, 124.0, 155.0, 186.0])
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
        assert run.status == RunStatus.completed.value
        assert run.stop_reason == "coverage_satisfied"
        assert query_count == 6
    assert responses.calls == 7
    assert clock.observed == [0.0, 0.0, 31.0, 62.0, 93.0, 124.0, 155.0, 186.0]


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


def test_repeated_asset_stops_enrichment_without_creating_duplicates(tmp_path: Path) -> None:
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
        assert run.status == RunStatus.completed.value
        assert run.stop_reason == "coverage_satisfied"
        assert asset_count == 1
        assert run.coverage_report["gaps"] == []
        assert run.coverage_report["enrichment_gaps"]
    assert (
        len(provider.queries)
        == (
            BUDGETS[BudgetMode.balanced].max_rounds
            + BUDGETS[BudgetMode.balanced].completion_recovery_rounds
        )
        * DEPTH_TARGETS[BudgetMode.balanced].subquestions
    )


def test_empty_quick_research_exhausts_all_completion_recovery_passes_for_every_subquestion(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    expected_passes = (
        BUDGETS[BudgetMode.quick].max_rounds + BUDGETS[BudgetMode.quick].completion_recovery_rounds
    )
    provider = SequencedProvider(
        [_batch()] * expected_passes * DEPTH_TARGETS[BudgetMode.quick].subquestions
    )

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
        "spatial_options",
        "use_experience",
        "environment_system",
    ] * expected_passes
    assert run.coverage_report["subquestion_passes"] == {
        "spatial_options": expected_passes,
        "use_experience": expected_passes,
        "environment_system": expected_passes,
    }
    assert run.status == RunStatus.blocked.value


def test_quick_completion_recovery_can_fill_branches_missed_by_normal_depth(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    provider = SequencedProvider(
        [
            _batch(_asset("factory", 1)),
            _batch(),
            _batch(),
            _batch(),
            _batch(),
            _batch(),
            _batch(_asset("station", 2)),
            _batch(_asset("dock", 3)),
        ]
    )

    execute_research_run(database, run_id, provider)

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        attempts = list(session.scalars(select(QueryAttempt).where(QueryAttempt.run_id == run_id)))

    assert run is not None
    assert run.status == RunStatus.completed.value
    assert run.stop_reason == "coverage_satisfied"
    assert run.coverage_report["covered_subquestions"] == 3
    assert run.coverage_report["gaps"] == []
    assert run.coverage_report["enrichment_gaps"]
    assert len(provider.queries) == 18
    assert [attempt.subquestion_id for attempt in attempts] == [
        "spatial_options",
        "use_experience",
        "environment_system",
        "use_experience",
        "environment_system",
        "use_experience",
        "environment_system",
        "use_experience",
        "environment_system",
        "spatial_options",
        "use_experience",
        "environment_system",
        "spatial_options",
        "use_experience",
        "environment_system",
        "spatial_options",
        "use_experience",
        "environment_system",
    ]


def test_incomplete_retry_only_researches_branches_that_still_lack_evidence(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class GapAwareProvider:
        name = "gap-aware"

        def __init__(self) -> None:
            self.queries: list[str] = []
            self.generation = 0

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
                return _batch(_asset("factory", 1))
            if self.generation > 0 and "公共与后勤怎样分开" in query:
                return _batch(_asset("station", 2))
            if self.generation > 0 and "剖面怎样形成层次" in query:
                return _batch(_asset("dock", 3))
            return _batch()

    provider = GapAwareProvider()
    execute_research_run(database, run_id, provider)
    first_generation_program_queries = sum("新功能怎样植入" in query for query in provider.queries)

    provider.generation = 1
    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)

    assert sum("新功能怎样植入" in query for query in provider.queries) == (
        first_generation_program_queries
    )
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
    assert run is not None
    assert run.status == RunStatus.completed.value
    assert run.stop_reason == "coverage_satisfied"
    assert run.coverage_report["covered_subquestions"] == 3
    assert run.coverage_report["enrichment_gaps"]


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


def test_removed_pinterest_provider_result_is_not_persisted(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    source = ProviderSource(
        url="https://www.pinterest.com/pin/123456789/",
        publisher="Pinterest",
        title="Adaptive reuse section drawing",
        publication_tier=PublicationTier.primary,
    )
    result = ProviderSearchResult(
        sources=[source],
        assets=[
            ProviderAsset(
                project_name="Unverified Pin project",
                asset_type=ArchitectureAssetType.section,
                source_url=source.url,
                image_url="https://images.example/pin-section.jpg",
                publication_tier=PublicationTier.primary,
                project_identity=AssociationStatus.confirmed,
                asset_association=AssociationStatus.confirmed,
                primary_source=PrimarySourceStatus.confirmed,
                rights_status=RightsStatus.open_license,
                result_tier=ResultTier.verified,
                relevance=4,
                facts=["该项目采用了插入式公共步道。"],
                observations=["图中可见一条抬高的红色路径。"],
            )
        ],
    )

    _persist_sources(database, run_id, result)
    _persist_assets(database, run_id, result, subquestion_id="program")

    with database.session_factory() as session:
        asset = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        page = session.scalar(select(SourcePage).where(SourcePage.run_id == run_id))
    assert asset is None
    assert page is None


def test_visual_xiaohongshu_browser_fallback_does_not_call_model_search(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.question = "帮我找几种建筑分析图视觉风格"
        run.goal = ResearchGoal.visual_reference_search.value
        run.research_sources = ["xiaohongshu"]
        session.commit()

    class UnexpectedProvider(SequencedProvider):
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
            raise AssertionError("visual XHS-only path must not call model search")

    class XiaohongshuBrowser:
        connected = True

        def __init__(self) -> None:
            self.calls: list[tuple[str, dict[str, Any]]] = []
            self.tab_id = 20

        def send_command_sync(
            self,
            action: str,
            payload: dict[str, Any],
            *,
            timeout_seconds: float = 30,
        ) -> Any:
            del timeout_seconds
            self.calls.append((action, payload))
            if action == "open_url":
                self.tab_id += 1
                return {"tab_id": self.tab_id, "url": payload["url"]}
            if action == "wait":
                return {"waited_ms": payload["milliseconds"]}
            if action == "scroll":
                return {"scrolled": True}
            if action == "enumerate_media":
                return {
                    "media": [
                        {
                            "media_type": "image",
                            "url": f"https://sns-img.example/{self.tab_id}.jpg",
                            "link_url": (f"https://www.xiaohongshu.com/explore/note-{self.tab_id}"),
                            "alt": "建筑分析图",
                            "adjacent_text": "建筑形体生成与分析图表达",
                            "intrinsic_width": 1200,
                            "intrinsic_height": 900,
                            "region": {
                                "x": 0,
                                "y": 0,
                                "width": 600,
                                "height": 450,
                            },
                        }
                    ]
                }
            if action == "close_tab":
                return {"closed": True}
            raise AssertionError(f"unexpected browser action: {action}")

    provider = UnexpectedProvider([])
    browser = XiaohongshuBrowser()

    class FailingOpenCliSearch:
        name = "failing-opencli"

        def __init__(self) -> None:
            self.calls = 0

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            del query, limit
            self.calls += 1
            raise TimeoutError("OpenCLI Browser Bridge is unavailable")

    opencli = FailingOpenCliSearch()

    execute_research_run(
        database,
        run_id,
        provider,
        browser_client=browser,
        xiaohongshu_search=opencli,
    )

    search_opens = [
        payload["url"]
        for action, payload in browser.calls
        if action == "open_url" and "/search_result?" in payload["url"]
    ]
    assert len(search_opens) == 6
    assert opencli.calls == 1
    assert provider.queries == []
    with database.session_factory() as session:
        xiaohongshu_pages = list(
            session.scalars(
                select(SourcePage).where(
                    SourcePage.run_id == run_id,
                    SourcePage.publisher == "小红书",
                )
            )
        )
        run = session.get(ResearchRun, run_id)
    assert len(xiaohongshu_pages) == 6
    assert all(
        page.publication_tier == PublicationTier.aggregator.value for page in xiaohongshu_pages
    )
    assert run is not None
    assert run.browser_pages_attempted == 6


def test_empty_opencli_result_falls_back_to_connected_browser_search(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class EmptyOpenCli:
        name = "opencli-xiaohongshu"

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            assert query == "建筑分析图"
            assert limit == 4
            return []

    class BrowserFallback:
        name = "archresearch-extension-xiaohongshu"

        def __init__(self) -> None:
            self.calls = 0

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            self.calls += 1
            assert query == "建筑分析图"
            assert limit == 4
            return [
                ProviderSource(
                    url="https://www.xiaohongshu.com/explore/note-fallback",
                    publisher="小红书",
                    title="建筑分析图参考",
                    publication_tier=PublicationTier.aggregator,
                )
            ]

    browser = BrowserFallback()
    searches = [EmptyOpenCli(), browser]

    sources, failed = _try_xiaohongshu_search(database, run_id, searches, "建筑分析图")

    assert failed is False
    assert browser.calls == 1
    assert [source.title for source in sources] == ["建筑分析图参考"]


def test_precedent_research_ignores_legacy_xiaohongshu_source_flag(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.research_sources = ["xiaohongshu"]
        session.commit()

    class UnexpectedXiaohongshuSearch:
        name = "unexpected-xiaohongshu"

        def __init__(self) -> None:
            self.calls = 0

        def search(self, query: str, *, limit: int = 4) -> list[ProviderSource]:
            del query, limit
            self.calls += 1
            return []

    xiaohongshu = UnexpectedXiaohongshuSearch()

    execute_research_run(
        database,
        run_id,
        SequencedProvider(
            [
                _batch(_asset("factory", 1)),
                _batch(_asset("station", 2)),
                _batch(_asset("dock", 3)),
            ]
        ),
        xiaohongshu_search=xiaohongshu,
    )

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
    assert run is not None
    assert run.status == RunStatus.completed.value
    assert run.stop_reason == "coverage_satisfied"
    assert xiaohongshu.calls == 0
    assert run.coverage_report["covered_subquestions"] == 3
    assert run.coverage_report["enrichment_gaps"]
    assert "browser_inspection_incomplete" not in run.coverage_report["gaps"]


def test_precedent_research_drops_visual_platform_provider_results(tmp_path: Path) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    batches: list[ProviderSearchResult] = []
    for index, project in enumerate(("factory", "station", "dock"), start=1):
        public_asset = _asset(project, index)
        visual_platform_asset = _asset(f"{project}-social", index).model_copy(
            update={
                "source_url": f"https://www.xiaohongshu.com/explore/{project}-{index}",
            }
        )
        batches.append(_batch(public_asset, visual_platform_asset))

    execute_research_run(database, run_id, SequencedProvider(batches))

    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )

    assert run is not None
    assert run.status == RunStatus.completed.value
    assert len(assets) == 3
    assert all("xiaohongshu.com" not in asset.source_url for asset in assets)


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
        assert run.status == RunStatus.blocked.value
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
            return _batch(_asset("dock", 5))

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
    assert run.stop_reason == "coverage_satisfied"
    assert run.coverage_report["enrichment_gaps"]
    assert sum("新功能怎样植入" in query for query in provider.queries) == 1
    assert sum("公共与后勤怎样分开" in query for query in provider.queries) == 1
    assert sum("剖面怎样形成层次" in query for query in provider.queries) == 2
    assert [attempt.status for attempt in attempts] == [
        "completed",
        "completed",
        "started",
        "completed",
    ]


def test_zero_coverage_retry_repeats_completed_queries_from_the_failed_attempt(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)

    class EmptyThenRecoveringProvider:
        name = "empty-then-recovering"

        def __init__(self) -> None:
            self.generation = 0
            self.queries: list[str] = []

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
            if self.generation == 0:
                if "剖面怎样形成层次" in query:
                    raise RuntimeError("temporary provider failure")
                return _batch()
            index = len(self.queries)
            return _batch(_asset(f"recovered-{index}", index))

    provider = EmptyThenRecoveringProvider()
    execute_research_run(database, run_id, provider)
    first_program_query = provider.queries[0]
    first_circulation_query = provider.queries[1]

    provider.generation = 1
    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)

    assert provider.queries.count(first_program_query) == 2
    assert provider.queries.count(first_circulation_query) == 2


def test_retry_continues_only_uncovered_queries_after_a_resumed_run_stays_partial(
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
            return _batch(_asset("dock", 3).model_copy(update={"facts": []}))

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

    assert sum("新功能怎样植入" in query for query in provider.queries) == 1
    assert sum("公共与后勤怎样分开" in query for query in provider.queries) == 1
    assert sum("剖面怎样形成层次" in query for query in provider.queries) == 15


def test_retry_resume_uses_only_the_immediately_previous_failed_execution(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    quick_target = workflow_module.DEPTH_TARGETS[BudgetMode.quick]
    monkeypatch.setitem(
        workflow_module.DEPTH_TARGETS,
        BudgetMode.quick,
        quick_target.model_copy(update={"projects": 3, "multi_asset_projects": 1}),
    )
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

    assert provider.counts == {"program": 14, "circulation": 14, "section": 15}


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

    assert provider.counts == {"program": 1, "circulation": 1, "section": 3}

    _advance_retry_attempt(database, run_id)
    execute_research_run(database, run_id, provider)

    assert provider.counts == {"program": 2, "circulation": 2, "section": 4}


def test_service_resume_skips_completed_query_after_model_updates_its_language(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    with database.session_factory() as session:
        run = session.get(ResearchRun, run_id)
        assert run is not None
        run.budget = {
            **run.budget,
            "max_rounds": 1,
            "max_queries": 3,
            "completion_recovery_rounds": 0,
        }
        session.commit()

    class SimulatedProcessExit(BaseException):
        pass

    class InterruptsOnSecondQuery:
        name = "language-changing-resume"

        def __init__(self) -> None:
            self.interrupt = True
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
            if key == "circulation" and self.interrupt:
                self.interrupt = False
                raise SimulatedProcessExit
            return _batch()

    provider = InterruptsOnSecondQuery()
    try:
        execute_research_run(database, run_id, provider)
    except SimulatedProcessExit:
        pass
    else:
        raise AssertionError("the first execution should simulate a process exit")

    with database.session_factory() as session:
        completed = session.scalar(
            select(QueryAttempt).where(
                QueryAttempt.run_id == run_id,
                QueryAttempt.subquestion_id == "program",
                QueryAttempt.status == "completed",
            )
        )
        assert completed is not None
        completed.language = "en"
        session.commit()

    execute_research_run(database, run_id, provider)

    assert provider.counts == {"program": 1, "circulation": 2, "section": 1}


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
    assert candidate.subquestion_analysis["spatial_options"]["project_context"] == ""


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


def test_research_goal_changes_visual_platform_inspection_priority() -> None:
    studio = ProviderSource(
        url="https://studio.example/foundry",
        publication_tier=PublicationTier.primary,
    )
    xiaohongshu = ProviderSource(
        url="https://www.xiaohongshu.com/explore/note-42",
        publication_tier=PublicationTier.aggregator,
    )

    visual_order = sorted(
        [studio, xiaohongshu],
        key=lambda source: _inspection_source_sort_key(
            source, ResearchGoal.visual_reference_search
        ),
        reverse=True,
    )
    precedent_order = sorted(
        [studio, xiaohongshu],
        key=lambda source: _inspection_source_sort_key(source, ResearchGoal.precedent_research),
        reverse=True,
    )

    assert visual_order == [xiaohongshu, studio]
    assert precedent_order == [studio, xiaohongshu]


def test_xiaohongshu_inspected_asset_keeps_note_identity_and_platform_boundary(
    tmp_path: Path,
) -> None:
    database, run_id = _database_with_run(tmp_path, BudgetMode.quick)
    source = ProviderSource(
        url="https://www.xiaohongshu.com/explore/note-84",
        publisher="小红书",
        title="旧厂房剖面与蓝灰分析图",
        publication_tier=PublicationTier.aggregator,
    )
    crop_path = tmp_path / "xiaohongshu-section.png"
    crop_path.write_bytes(b"crop")
    _persist_sources(database, run_id, ProviderSearchResult(assets=[], sources=[source]))

    _persist_inspected_assets(
        database,
        run_id,
        source,
        [
            InspectedVisual(
                source_url=source.url,
                image_url="https://sns-img.example/section.png",
                storage_path=crop_path,
                perceptual_hash="xiaohongshu-section",
                asset_type=ArchitectureAssetType.section,
                relevance=4,
                observations=["剖面以蓝灰色块区分新旧空间，并用连续箭头标出公共路径。"],
            )
        ],
        subquestion_id="section",
    )

    with database.session_factory() as session:
        candidate = session.scalar(select(AssetCandidate).where(AssetCandidate.run_id == run_id))

    assert candidate is not None
    assert candidate.project_name == "旧厂房剖面与蓝灰分析图"
    assert candidate.result_tier == ResultTier.visual_lead.value
    assert candidate.facts == []
    assert candidate.design_mechanism == ""
    assert candidate.limitations == [
        "视觉平台帖子只支持可见图像观察，不能单独确认完整项目事实、图纸归属或使用权。"
    ]


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


def test_precedent_coverage_does_not_require_a_displayable_image_for_every_subquestion(
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
    assert run.status == RunStatus.completed.value
    assert run.stop_reason == "coverage_satisfied"
    assert run.coverage_report["usable_assets"] == 4
    assert run.coverage_report["verified_or_partial"] == 6
    assert run.coverage_report["covered_subquestions"] == 3
    assert "uncovered_subquestions" not in run.coverage_report["gaps"]
    assert run.coverage_report["enrichment_gaps"]


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
