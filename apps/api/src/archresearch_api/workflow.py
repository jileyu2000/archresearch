from __future__ import annotations

import hashlib
import re
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from time import monotonic
from typing import Literal, NamedTuple, TypedDict
from urllib.parse import unquote, urlparse

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .agent.execution import (
    ResearchCancelled,
    build_research_context,
    checkpoint,
    completed_query_keys_for_resume,
    get_run,
    is_timeout_error,
    mark_query_completed,
    page_budget_available,
    persist_browser_page_attempts,
    persist_inspection_budget,
    raise_if_cancelled,
    record_query,
)
from .agent.planning import (
    build_public_search_query,
    build_queries,
    build_research_plan,
    select_public_search_domains,
)
from .agent.synthesis import (
    deterministic_research_synthesis,
    is_recoverable_research_synthesis_error,
    research_synthesis_branch_analysis,
    research_synthesis_case_identity,
)
from .agent.verification import (
    calculate_coverage,
    completion_satisfied,
    enrichment_satisfied,
)
from .database import Database
from .inspection import (
    BrowserCommandClient,
    InspectedVisual,
    InspectionBudget,
    inspect_local_images,
    inspect_source_page,
)
from .models import (
    AssetCandidate,
    EvidenceClaim,
    QueryAttempt,
    SourcePage,
    TraceEvent,
)
from .providers import (
    PUBLIC_PAGE_ANALYSIS_TEXT_LIMIT,
    CallBudgetAwareResearchProvider,
    CandidateRerankingProvider,
    LocalSearchCandidate,
    ProviderAsset,
    ProviderSearchResult,
    ProviderSource,
    PublicPageAnalysis,
    PublicPageAnalysisProvider,
    PublicPageDrawing,
    PublicPageSupportedFact,
    ResearchProvider,
    ResearchSynthesisCase,
    ResearchSynthesisProvider,
    SearchQuery,
    SearchQueryPlan,
    SearchQueryPlanningProvider,
    architecture_retrieval_lane,
    architecture_retrieval_strategy,
    deterministic_public_page_analysis,
    explicit_project_names,
    is_recoverable_public_page_analysis_error,
    requested_visual_drawing_type,
)
from .public_pages import (
    ParsedPageImage,
    ParsedPublicPage,
    PublicPageParser,
    PublicSearchLead,
    PublicSearchProvider,
    infer_architecture_asset_type,
    infer_research_issue_intent,
    is_concrete_project_page,
    project_image_identity_score,
    public_search_relevance_score,
    search_lead_matches_building_type,
    select_project_page_links,
)
from .research_paths import policy_for_goal
from .research_paths.types import ResearchPathPolicy
from .schemas import (
    DEPTH_TARGETS,
    AssociationStatus,
    BudgetMode,
    PrimarySourceStatus,
    PublicationTier,
    ResearchGoal,
    ResearchSource,
    ResearchSubquestion,
    ResultTier,
    RightsStatus,
    RunStatus,
)
from .visual import (
    ArchitectureAssetType,
    DeterministicFallbackVisualClassifier,
    RemoteVisualCandidate,
    RemoteVisualClassification,
    RemoteVisualClassifier,
    VisualClassifier,
)
from .xiaohongshu import (
    XiaohongshuAssetDownloader,
    XiaohongshuBrowserSearch,
    XiaohongshuSearch,
)

ACTIVE_STAGES = (
    RunStatus.planning,
    RunStatus.searching,
    RunStatus.inspecting,
    RunStatus.analyzing,
    RunStatus.verifying,
    RunStatus.gap_check,
    RunStatus.composing,
)

VISUAL_INSPECTION_LIMITS: dict[BudgetMode, tuple[int, int]] = {
    BudgetMode.quick: (15, 30 * 1024 * 1024),
    BudgetMode.balanced: (45, 90 * 1024 * 1024),
    BudgetMode.deep: (90, 180 * 1024 * 1024),
}
VISUAL_REFERENCE_INSPECTION_LIMIT = (60, 60 * 1024 * 1024)

REMOTE_VISUAL_BATCH_LIMIT = 4
REMOTE_VISUAL_MIN_RELEVANCE = 2
XIAOHONGSHU_VISUAL_NOTE_LIMIT = 5
XIAOHONGSHU_VISUAL_NOTE_TARGET = 3
XIAOHONGSHU_VISUAL_SOURCE_POOL_LIMIT = 10
XIAOHONGSHU_ARCHITECTURE_DRAWING_TITLE_TERMS = (
    "建筑",
    "图纸",
    "空间设计",
    "室内设计",
    "景观设计",
    "建筑渲染",
    "室内",
    "景观",
    "方案",
    "作品集",
    "制图",
)
XIAOHONGSHU_NON_ARCHITECTURE_VISUAL_TITLE_TERMS = (
    "摄影",
    "电影",
    "影视",
    "分镜",
    "产品",
    "包装",
    "海报",
    "插画",
    "美妆",
    "穿搭",
)
UNCOVERED_BRANCH_PAGE_ANALYSIS_LIMIT = 3
UNCOVERED_BRANCH_FOLLOWUP_PAGE_ANALYSIS_LIMIT = 1
PROJECT_TEXT_SUPPLEMENT_PAGE_LIMIT = 2


TRUSTED_ARCHITECTURE_PUBLICATION_DOMAINS = (
    "archdaily.com",
    "archdaily.cn",
    "designboom.com",
    "dezeen.com",
    "divisare.com",
)

PUBLICATION_TIER_STRENGTH = {
    PublicationTier.unknown.value: 0,
    PublicationTier.aggregator.value: 1,
    PublicationTier.trusted_secondary.value: 2,
    PublicationTier.primary.value: 3,
}


class RemotePublicPageBatchItem(TypedDict):
    source: ProviderSource
    page: ParsedPublicPage
    exact_project_evidence: bool
    article_analysis_eligible: bool


def execute_research_run(
    db: Database,
    run_id: str,
    provider: ResearchProvider,
    on_terminal: Callable[[str], None] | None = None,
    *,
    browser_client: BrowserCommandClient | None = None,
    visual_classifier: VisualClassifier | None = None,
    candidate_root: Path | None = None,
    public_page_parser: PublicPageParser | None = None,
    xiaohongshu_search: XiaohongshuSearch | None = None,
    clock: Callable[[], float] = monotonic,
) -> None:
    """Dispatch once to the goal-specific execution runner."""
    with db.session_factory() as session:
        goal = ResearchGoal(get_run(session, run_id).goal)
    if goal is ResearchGoal.precedent_research:
        from .research_paths.precedent_runner import execute_precedent_run

        execute_precedent_run(
            db,
            run_id,
            provider,
            on_terminal,
            browser_client=browser_client,
            visual_classifier=visual_classifier,
            candidate_root=candidate_root,
            public_page_parser=public_page_parser,
            clock=clock,
        )
        return
    if goal is ResearchGoal.visual_reference_search:
        from .research_paths.drawing_runner import execute_drawing_run

        execute_drawing_run(
            db,
            run_id,
            provider,
            on_terminal,
            browser_client=browser_client,
            visual_classifier=visual_classifier,
            candidate_root=candidate_root,
            xiaohongshu_search=xiaohongshu_search,
            clock=clock,
        )
        return
    raise ValueError(f"Unsupported research goal: {goal}")


def _execute_run_with_policy(
    db: Database,
    run_id: str,
    provider: ResearchProvider,
    on_terminal: Callable[[str], None] | None = None,
    *,
    path: ResearchPathPolicy,
    browser_client: BrowserCommandClient | None = None,
    visual_classifier: VisualClassifier | None = None,
    candidate_root: Path | None = None,
    public_page_parser: PublicPageParser | None = None,
    xiaohongshu_search: XiaohongshuSearch | None = None,
    clock: Callable[[], float] = monotonic,
) -> None:
    terminal_state: str | None = None
    try:
        started_at = clock()
        checkpoint(db, run_id, RunStatus.planning, {"message": "正在拆解研究问题"})
        raise_if_cancelled(db, run_id)
        with db.session_factory() as session:
            run = get_run(session, run_id)
            goal = ResearchGoal(run.goal)
            budget_mode = BudgetMode(run.budget_mode)
            workspace_id = run.workspace_id
            allowed_domains = run.allowed_domains
            stored_research_sources = {
                ResearchSource(value) for value in (run.research_sources or [])
            }
            research_sources = path.normalize_research_sources(stored_research_sources)
            budget = run.budget
            max_pages = budget["max_pages"]
            deadline = started_at + budget["max_seconds"]
            research_context = build_research_context(session, workspace_id)
            question = run.question
            existing_subquestions = list(run.subquestions or [])
            run_attempt = run.attempt
            visual_calls_used = run.visual_calls_used
            visual_bytes_used = run.visual_bytes_used
            visual_byte_limit_reached = run.visual_byte_limit_reached
            browser_pages_attempted = run.browser_pages_attempted

        plan, planning_source, planning_error = build_research_plan(
            provider,
            question=question,
            goal=goal,
            budget_mode=budget_mode,
            research_context=research_context,
            existing_subquestions=existing_subquestions,
        )
        with db.session_factory() as session:
            run = get_run(session, run_id)
            run.subquestions = [item.model_dump() for item in plan.subquestions]
            session.commit()
        planning_summary: dict[str, object] = {
            "message": "研究问题已拆解",
            "subquestion_count": len(plan.subquestions),
            "planner": planning_source,
        }
        if planning_error is not None:
            planning_summary["planner_error_type"] = planning_error
        checkpoint(db, run_id, RunStatus.planning, planning_summary)
        subquestion_text = {item.id: item.question for item in plan.subquestions}
        subquestions_by_id = {item.id: item for item in plan.subquestions}
        subquestion_domain_slots = {
            item.id: index for index, item in enumerate(plan.subquestions, start=1)
        }
        if path.uses_visual_platform and visual_classifier is not None:
            visual_classifier = DeterministicFallbackVisualClassifier(
                visual_classifier,
                on_fallback=lambda error_type: checkpoint(
                    db,
                    run_id,
                    RunStatus.inspecting,
                    {
                        "status": "fallback",
                        "mode": "deterministic_local_visual",
                        "provider_error_type": error_type,
                    },
                    tool="openai",
                ),
            )
        normal_rounds = int(budget["max_rounds"])
        recovery_rounds = path.recovery_rounds(budget)
        recovery_pages_per_subquestion = int(
            budget.get("completion_recovery_pages_per_subquestion", 2)
        )
        queries = build_queries(
            question,
            goal,
            subquestions=plan.subquestions,
            max_rounds=normal_rounds + recovery_rounds,
            max_queries=(int(budget["max_queries"]) + len(plan.subquestions) * recovery_rounds),
            analysis_requirements=DEPTH_TARGETS[budget_mode].analysis_requirements,
            research_context=research_context,
        )
        last_query_round_by_subquestion: dict[str, int] = {}
        for query_round, _, query_subquestion_id, _ in queries:
            last_query_round_by_subquestion[query_subquestion_id] = query_round
        require_article_analysis = (
            path.uses_precedent_sources
            and public_page_parser is not None
            and isinstance(provider, PublicPageAnalysisProvider)
        )
        require_research_synthesis = (
            path.uses_precedent_sources
            and public_page_parser is not None
            and isinstance(provider, ResearchSynthesisProvider)
        )
        initial_coverage = calculate_coverage(
            db,
            run_id,
            require_article_analysis=require_article_analysis,
        )
        retrying_without_coverage = (
            run_attempt > 0 and initial_coverage["covered_subquestions"] == 0
        )
        completed_query_keys = (
            set() if retrying_without_coverage else completed_query_keys_for_resume(db, run_id)
        )
        completion_continuation = (
            path.uses_precedent_sources
            and run_attempt > 0
            and not completion_satisfied(initial_coverage)
        )

        with db.session_factory() as session:
            prior_source_pages = list(
                session.scalars(select(SourcePage).where(SourcePage.run_id == run_id))
            )
            prior_source_urls = {
                page.url for page in prior_source_pages if page.access_status != "pending"
            }
            prior_source_titles = [
                page.title
                for page in prior_source_pages
                if page.access_status != "pending" and page.title
            ]
            prior_project_names = list(
                session.scalars(
                    select(AssetCandidate.project_name).where(AssetCandidate.run_id == run_id)
                )
            )
            prior_queries = list(
                session.scalars(
                    select(QueryAttempt)
                    .where(QueryAttempt.run_id == run_id)
                    .order_by(QueryAttempt.created_at, QueryAttempt.id)
                )
            )
        public_queries_by_subquestion: dict[str, list[str]] = {}
        public_queries_seen: set[str] = set()
        public_search_feedback_by_subquestion: dict[str, list[str]] = {}
        public_search_low_yield_domains_by_subquestion: dict[str, set[str]] = {}
        for prior_query in prior_queries:
            if prior_query.subquestion_id:
                query_parts = [
                    part.strip() for part in prior_query.query.split(" || ") if part.strip()
                ]
                public_queries_by_subquestion.setdefault(prior_query.subquestion_id, []).extend(
                    query_parts
                )
                public_queries_seen.update(query_parts)
        excluded_public_urls = set() if retrying_without_coverage else set(prior_source_urls)
        excluded_project_keys = (
            set()
            if retrying_without_coverage
            else {
                identity
                for identity in (_project_identity_key(name) for name in prior_project_names)
                if identity
            }
        )
        excluded_search_project_names = (
            set()
            if retrying_without_coverage
            else {
                name
                for name in (*prior_source_titles, *prior_project_names)
                if name and name.strip()
            }
        )
        round_added_usable_assets = 0
        resumed_rounds = {round_number for round_number, _ in completed_query_keys}
        inspected_urls = set() if retrying_without_coverage else set(prior_source_urls)
        parsed_pages: dict[str, ParsedPublicPage | None] = {}
        project_text_supplement_attempted: set[str] = set()
        project_text_supplement_pages: dict[str, list[tuple[ProviderSource, ParsedPublicPage]]] = {}
        analyzed_public_page_branches: set[tuple[str, str]] = set()
        reused_article_ready_branches: set[str] = set()
        remote_public_pages_by_subquestion: dict[str, list[RemotePublicPageBatchItem]] = {}
        public_page_attempts = 0
        public_recovery_page_attempts: dict[str, int] = {}
        browser_page_attempts = browser_pages_attempted
        browser_recovery_page_attempts: dict[str, int] = {}
        visual_call_limit, visual_byte_limit = (
            VISUAL_REFERENCE_INSPECTION_LIMIT
            if path.uses_visual_platform
            else VISUAL_INSPECTION_LIMITS[budget_mode]
        )
        inspection_budget = InspectionBudget(
            max_calls=visual_call_limit,
            max_bytes=visual_byte_limit,
            used_calls=visual_calls_used,
            used_bytes=visual_bytes_used,
            byte_limit_reached=visual_byte_limit_reached,
            on_change=lambda current: persist_inspection_budget(db, run_id, current),
        )
        provider_call_reserve = (
            provider.worst_case_call_seconds
            if isinstance(provider, CallBudgetAwareResearchProvider)
            else 0.0
        )
        synthesis_call_reserve = provider_call_reserve
        if require_research_synthesis:
            synthesis_worst_case_seconds = getattr(
                provider,
                "synthesis_worst_case_seconds",
                None,
            )
            if callable(synthesis_worst_case_seconds):
                synthesis_call_reserve = max(
                    provider_call_reserve,
                    float(synthesis_worst_case_seconds(budget_mode)),
                )
        research_deadline = (
            deadline - synthesis_call_reserve if require_research_synthesis else deadline
        )
        public_search_provider = (
            public_page_parser if isinstance(public_page_parser, PublicSearchProvider) else None
        )
        search_query_planner = (
            provider
            if path.uses_precedent_sources and isinstance(provider, SearchQueryPlanningProvider)
            else None
        )
        candidate_reranker = (
            provider
            if path.uses_precedent_sources and isinstance(provider, CandidateRerankingProvider)
            else None
        )
        public_search_reserve = (
            _public_search_worst_case_seconds(public_search_provider)
            if public_search_provider is not None
            else 0.0
        )
        xiaohongshu_searchers: list[XiaohongshuSearch] = []
        xiaohongshu_browser_search: XiaohongshuBrowserSearch | None = (
            xiaohongshu_search if isinstance(xiaohongshu_search, XiaohongshuBrowserSearch) else None
        )
        if ResearchSource.xiaohongshu in research_sources:
            if xiaohongshu_search is not None:
                xiaohongshu_searchers.append(xiaohongshu_search)
            if browser_client is not None and bool(getattr(browser_client, "connected", True)):
                xiaohongshu_browser_search = XiaohongshuBrowserSearch(browser_client)
                xiaohongshu_searchers.append(xiaohongshu_browser_search)
        xiaohongshu_note_attempts: dict[str, int] = {}
        xiaohongshu_usable_notes: dict[str, int] = {}
        stop_reason = "budget_exhausted"
        model_search_timed_out = False
        model_timeout_recovery_attempted = False
        xiaohongshu_required = path.uses_visual_platform
        xiaohongshu_only_visual = xiaohongshu_required and research_sources == {
            ResearchSource.xiaohongshu
        }
        xiaohongshu_unavailable = (
            ResearchSource.xiaohongshu in research_sources and not xiaohongshu_searchers
        )
        browser_inspection_failed = xiaohongshu_required and xiaohongshu_unavailable
        public_page_inspection_failed = False
        public_page_inspection_succeeded = False
        if xiaohongshu_unavailable:
            checkpoint(
                db,
                run_id,
                RunStatus.searching,
                {"status": "skipped", "error_type": "BrowserUnavailableError"},
                tool="xiaohongshu_search",
            )
        query_offset = 0
        while query_offset < len(queries):
            current_coverage = calculate_coverage(
                db,
                run_id,
                require_article_analysis=require_article_analysis,
            )
            round_number = queries[query_offset][0]
            round_start = query_offset == 0 or queries[query_offset - 1][0] != round_number
            if (
                round_start
                and path.uses_precedent_sources
                and completion_satisfied(current_coverage)
            ):
                round_end = query_offset
                while round_end < len(queries) and queries[round_end][0] == round_number:
                    round_end += 1
                round_queries = queries[query_offset:round_end]
                projects_per_subquestion = current_coverage.get("projects_per_subquestion")
                round_subquestion_ids = {item[2] for item in round_queries}
                if (
                    projects_per_subquestion is not None
                    and round_subquestion_ids <= projects_per_subquestion.keys()
                ):
                    queries[query_offset:round_end] = sorted(
                        round_queries,
                        key=lambda item: projects_per_subquestion[item[2]],
                    )
            round_number, language, subquestion_id, query = queries[query_offset]
            query_offset += 1
            query_index = query_offset
            coverage_incomplete = (
                current_coverage["covered_subquestions"] < current_coverage["subquestion_count"]
            )
            if path.should_skip_subquestion(
                covered=subquestion_id in current_coverage["covered_subquestion_ids"],
                coverage_incomplete=coverage_incomplete,
                completion_continuation=completion_continuation,
            ):
                continue
            query_key = (round_number, subquestion_id)
            if query_key in completed_query_keys:
                continue
            raise_if_cancelled(db, run_id)
            page_analysis_attempts_before_query = sum(
                attempted_subquestion_id == subquestion_id
                for _, attempted_subquestion_id in analyzed_public_page_branches
            )
            page_analysis_attempt_limit = (
                (
                    UNCOVERED_BRANCH_PAGE_ANALYSIS_LIMIT
                    if round_number == 1
                    else UNCOVERED_BRANCH_FOLLOWUP_PAGE_ANALYSIS_LIMIT
                )
                if require_article_analysis and coverage_incomplete
                else None
            )
            remaining_seconds = research_deadline - clock()
            public_search_budget_available = (
                public_search_provider is not None
                and _public_search_budget_available(
                    db,
                    run_id,
                    public_search_provider,
                )
            )
            can_search_publicly = (
                public_search_provider is not None
                and remaining_seconds >= public_search_reserve
                and public_search_budget_available
            )
            is_model_timeout_recovery = (
                model_search_timed_out
                and not model_timeout_recovery_attempted
                and round_number > normal_rounds
            )
            can_search_with_model = (
                public_search_provider is None
                and (not model_search_timed_out or is_model_timeout_recovery)
            ) and remaining_seconds >= provider_call_reserve
            visual_platform_available = bool(xiaohongshu_searchers) and page_budget_available(
                round_number=round_number,
                normal_rounds=normal_rounds,
                normal_attempts=browser_page_attempts,
                normal_limit=max_pages,
                subquestion_id=subquestion_id,
                recovery_attempts=browser_recovery_page_attempts,
                recovery_limit=recovery_pages_per_subquestion,
            )
            search_availability = path.search_availability(
                public_available=(
                    public_search_provider is not None
                    and remaining_seconds >= public_search_reserve
                    and public_search_budget_available
                ),
                provider_available=(
                    public_search_provider is None
                    and (not model_search_timed_out or is_model_timeout_recovery)
                    and remaining_seconds >= provider_call_reserve
                ),
                visual_platform_available=visual_platform_available,
            )
            can_search_publicly = search_availability.public
            can_search_with_model = search_availability.provider
            can_search_xiaohongshu = search_availability.visual_platform
            if remaining_seconds <= 0:
                stop_reason = "time_budget_exhausted"
                break
            if path.uses_visual_platform and inspection_budget.exhausted:
                stop_reason = "visual_budget_exhausted"
                break
            if not (can_search_publicly or can_search_with_model or can_search_xiaohongshu):
                stop_reason = path.unavailable_stop_reason(
                    public_search_configured=public_search_provider is not None,
                    public_time_available=remaining_seconds >= public_search_reserve,
                    public_budget_available=public_search_budget_available,
                )
                break
            xiaohongshu_query = (
                path.visual_platform_query(
                    subquestion_text[subquestion_id],
                    round_number,
                )
                if can_search_xiaohongshu
                else None
            )
            provider_query = path.provider_query(query)
            query_attempt_id = record_query(
                db,
                run_id,
                round_number=round_number,
                language=language,
                subquestion_id=subquestion_id,
                query=(
                    xiaohongshu_query
                    if xiaohongshu_only_visual and xiaohongshu_query is not None
                    else provider_query
                ),
                purpose=goal.value,
                provider_name=(
                    public_search_provider.name
                    if public_search_provider is not None
                    else provider.name
                ),
            )
            checkpoint(
                db,
                run_id,
                RunStatus.searching,
                {
                    "round": round_number,
                    "query_index": query_index,
                    "query_count": len(queries),
                    "subquestion_id": subquestion_id,
                },
            )
            public_sources: list[ProviderSource] = []
            public_search_failure_reason: str | None = None
            selected_public_sources: list[ProviderSource] = []
            named_project_names: list[str] = []
            trusted_public_recovery = False
            selected_xiaohongshu_source = False
            public_relevance_context = build_public_search_query(
                goal,
                "en",
                subquestion_text[subquestion_id],
                round_number,
                research_question=question,
                research_context=research_context,
            )
            if can_search_xiaohongshu:
                browser_page_attempts += 1
                if round_number > normal_rounds:
                    browser_recovery_page_attempts[subquestion_id] = (
                        browser_recovery_page_attempts.get(subquestion_id, 0) + 1
                    )
                persist_browser_page_attempts(db, run_id, browser_page_attempts)
                xiaohongshu_sources, search_failed = _try_xiaohongshu_search(
                    db,
                    run_id,
                    xiaohongshu_searchers,
                    xiaohongshu_query or subquestion_text[subquestion_id],
                    limit=(XIAOHONGSHU_VISUAL_SOURCE_POOL_LIMIT if xiaohongshu_only_visual else 4),
                )
                if xiaohongshu_only_visual:
                    pooled_source_count = len(xiaohongshu_sources)
                    xiaohongshu_sources = _rank_xiaohongshu_visual_sources(
                        xiaohongshu_sources,
                        subquestion_text[subquestion_id],
                        limit=XIAOHONGSHU_VISUAL_NOTE_LIMIT,
                    )
                    requested_label = requested_visual_drawing_type(
                        subquestion_text[subquestion_id]
                    )
                    checkpoint(
                        db,
                        run_id,
                        RunStatus.searching,
                        {
                            "source_pool_count": pooled_source_count,
                            "retained_source_count": len(xiaohongshu_sources),
                            "drawing_type_match_count": sum(
                                bool(requested_label and requested_label in source.title)
                                for source in xiaohongshu_sources
                            ),
                        },
                        tool="xiaohongshu_candidate_pool",
                    )
                if xiaohongshu_required:
                    browser_inspection_failed = browser_inspection_failed or search_failed
                public_sources.extend(xiaohongshu_sources)
                selected_xiaohongshu_source = bool(xiaohongshu_sources)
            if can_search_publicly and public_search_provider is not None:
                public_search_domains = select_public_search_domains(
                    goal,
                    allowed_domains,
                    round_number=round_number,
                    round_query_index=subquestion_domain_slots[subquestion_id],
                    low_yield_domains=public_search_low_yield_domains_by_subquestion.get(
                        subquestion_id,
                        set(),
                    ),
                )
                preferred_language = (
                    "zh"
                    if public_search_domains == ["archdaily.cn"]
                    else "en"
                    if public_search_domains
                    else language
                )
                fallback_public_query = build_public_search_query(
                    goal,
                    language,
                    subquestion_text[subquestion_id],
                    round_number,
                    research_question=question,
                    research_context=research_context,
                    trusted_domain=(
                        public_search_domains[0]
                        if path.uses_precedent_sources
                        and not allowed_domains
                        and len(public_search_domains) == 1
                        else None
                    ),
                )
                previous_public_queries = public_queries_by_subquestion.setdefault(
                    subquestion_id,
                    [],
                )
                stage_failure_reasons = public_search_feedback_by_subquestion.get(
                    subquestion_id,
                    [],
                )
                failure_reasons = [
                    *current_coverage.get("gaps", []),
                    *current_coverage.get("enrichment_gaps", []),
                    *stage_failure_reasons,
                ]
                query_limit = (
                    2
                    if path.uses_precedent_sources
                    and (
                        round_number == 1
                        or (
                            normal_rounds == 1
                            and round_number > normal_rounds
                            and any(
                                reason
                                in {
                                    "local_search_no_candidates",
                                    "no_new_local_candidates",
                                    "candidate_reranking_rejected_all",
                                    "public_page_analysis_incomplete",
                                }
                                for reason in stage_failure_reasons
                            )
                        )
                    )
                    else 1
                )
                query_limit = min(
                    query_limit,
                    _public_search_budget_remaining(
                        db,
                        run_id,
                        public_search_provider,
                    ),
                )
                query_planning_reserve = float(
                    getattr(
                        search_query_planner,
                        "worst_case_search_query_planning_seconds",
                        provider_call_reserve,
                    )
                )
                assistance_reserve = (
                    public_search_reserve * query_limit
                    + query_planning_reserve
                    + provider_call_reserve
                )
                planner_has_time = (
                    search_query_planner is not None
                    and research_deadline - clock() >= assistance_reserve
                )
                query_plan = _try_search_query_plan(
                    db,
                    run_id,
                    search_query_planner if planner_has_time else None,
                    question=question,
                    subquestion=subquestions_by_id[subquestion_id],
                    round_number=round_number,
                    preferred_language=preferred_language,
                    research_context=research_context,
                    previous_queries=[
                        *previous_public_queries,
                        *sorted(public_queries_seen),
                    ],
                    excluded_sources=sorted(excluded_public_urls),
                    excluded_projects=sorted(excluded_search_project_names),
                    failure_reasons=failure_reasons,
                    fallback_query=fallback_public_query,
                    query_limit=query_limit,
                    unavailable_error_type=(
                        "InsufficientTimeReserve"
                        if search_query_planner is not None and not planner_has_time
                        else "ProviderUnavailable"
                    ),
                )
                planned_public_queries = [item.query for item in query_plan.queries]
                structured_project_names = [
                    item.anchors.project_name
                    for item in query_plan.queries
                    if item.anchors is not None and item.anchors.project_name
                ]
                named_project_names = list(
                    dict.fromkeys(
                        [
                            *structured_project_names,
                            *(
                                name
                                for public_query in planned_public_queries
                                for name in explicit_project_names(public_query)
                            ),
                        ]
                    )
                )
                excluded_search_project_names.update(structured_project_names)
                previous_public_queries.extend(planned_public_queries)
                public_queries_seen.update(planned_public_queries)
                _update_query_attempt_text(
                    db,
                    query_attempt_id,
                    query_plan.queries,
                )
                local_public_sources: list[ProviderSource] = []
                for planned_query in query_plan.queries:
                    public_query = planned_query.query
                    structured_query_project_names = (
                        [planned_query.anchors.project_name]
                        if planned_query.anchors is not None and planned_query.anchors.project_name
                        else []
                    )
                    query_sources = _try_public_search(
                        db,
                        run_id,
                        public_search_provider,
                        public_query,
                        public_search_domains,
                        structured_query=planned_query,
                    )
                    if path.uses_precedent_sources:
                        query_sources = [
                            source
                            for source in query_sources
                            if not _is_sparse_visual_platform_url(source.url)
                        ]
                    local_public_sources = _merge_source_lists(
                        local_public_sources,
                        _filter_named_project_query_sources(
                            query_sources,
                            public_query,
                            project_names=structured_query_project_names,
                        ),
                    )
                candidates, candidate_sources = _prepare_local_search_candidates(
                    local_public_sources,
                    excluded_urls=excluded_public_urls,
                    excluded_project_keys=excluded_project_keys,
                )
                reranker_has_time = (
                    bool(candidates)
                    and candidate_reranker is not None
                    and research_deadline - clock() >= provider_call_reserve
                )
                selected_public_sources = _try_candidate_reranking(
                    db,
                    run_id,
                    candidate_reranker,
                    provider_call_enabled=reranker_has_time,
                    question=question,
                    subquestion=subquestions_by_id[subquestion_id],
                    planned_queries=query_plan.queries,
                    candidates=candidates,
                    candidate_sources=candidate_sources,
                    relevance_context=public_relevance_context,
                    unavailable_error_type=(
                        "InsufficientTimeReserve"
                        if candidate_reranker is not None and not reranker_has_time
                        else "ProviderUnavailable"
                    ),
                )
                if not local_public_sources:
                    public_search_failure_reason = "local_search_no_candidates"
                elif not candidates:
                    public_search_failure_reason = "no_new_local_candidates"
                elif not selected_public_sources:
                    public_search_failure_reason = "candidate_reranking_rejected_all"
                selected_public_urls = {source.url for source in selected_public_sources}
                rejected_public_sources: list[ProviderSource] = []
                for source in candidate_sources.values():
                    if source.url in selected_public_urls:
                        continue
                    rejected_public_sources.append(source)
                    excluded_public_urls.add(source.url)
                    if source.title:
                        excluded_search_project_names.add(source.title)
                    project_key = _project_identity_key(source.title)
                    if project_key:
                        excluded_project_keys.add(project_key)
                if rejected_public_sources:
                    _persist_sources(
                        db,
                        run_id,
                        ProviderSearchResult(sources=rejected_public_sources, assets=[]),
                        access_status="irrelevant",
                    )
                public_sources = _merge_source_lists(
                    public_sources,
                    selected_public_sources,
                )
                if public_sources:
                    _persist_sources(
                        db,
                        run_id,
                        ProviderSearchResult(sources=public_sources, assets=[]),
                        access_status="pending",
                    )
                trusted_public_recovery = (
                    path.uses_precedent_sources
                    and round_number > normal_rounds
                    and any(
                        source.publication_tier
                        in {PublicationTier.primary, PublicationTier.trusted_secondary}
                        and _source_relevance_score(source, public_relevance_context) > 0
                        for source in public_sources
                    )
                )
                if trusted_public_recovery:
                    can_search_with_model = False
            if not can_search_with_model:
                provider_result = ProviderSearchResult(sources=public_sources, assets=[])
                checkpoint(
                    db,
                    run_id,
                    RunStatus.searching,
                    {
                        "status": "skipped",
                        "reason": (
                            "selected_xiaohongshu_note"
                            if selected_xiaohongshu_source
                            else (
                                "local_browser_search"
                                if public_search_provider is not None
                                else (
                                    "trusted_public_sources"
                                    if trusted_public_recovery
                                    else (
                                        "previous_timeout"
                                        if model_search_timed_out
                                        else "insufficient_time_reserve"
                                    )
                                )
                            )
                        ),
                        "retained_source_count": len(public_sources),
                    },
                    tool=provider.name,
                )
            else:
                if is_model_timeout_recovery:
                    model_timeout_recovery_attempted = True
                try:
                    provider_result = provider.search(provider_query, goal, allowed_domains)
                except Exception as exc:
                    timed_out = is_timeout_error(exc)
                    if not public_sources and not timed_out:
                        raise
                    model_search_timed_out = model_search_timed_out or timed_out
                    provider_result = ProviderSearchResult(sources=public_sources, assets=[])
                    checkpoint(
                        db,
                        run_id,
                        RunStatus.searching,
                        {
                            "status": "degraded",
                            "error_type": type(exc).__name__,
                            "retained_source_count": len(public_sources),
                        },
                        tool=provider.name,
                    )
                else:
                    provider_result = _merge_public_sources(provider_result, public_sources)
            provider_result = path.constrain_provider_result(provider_result)
            raise_if_cancelled(db, run_id)
            _persist_sources(db, run_id, provider_result)
            added_usable_assets = _persist_assets(
                db,
                run_id,
                provider_result,
                subquestion_id=subquestion_id,
            )

            checkpoint(
                db,
                run_id,
                RunStatus.inspecting,
                {"page_count": len(provider_result.sources)},
            )
            browser_added = 0
            remote_public_pages = remote_public_pages_by_subquestion.setdefault(subquestion_id, [])
            if (
                require_article_analysis
                and not provider_result.sources
                and subquestion_id not in reused_article_ready_branches
                and isinstance(provider, PublicPageAnalysisProvider)
                and _public_page_branch_analysis_budget_available(
                    analyzed_public_page_branches,
                    subquestion_id=subquestion_id,
                    attempts_before_query=page_analysis_attempts_before_query,
                    attempt_limit=page_analysis_attempt_limit,
                )
                and research_deadline - clock() >= provider.worst_case_page_analysis_seconds
            ):
                reused, reused_added = _try_article_ready_page_branch_reuse(
                    db,
                    run_id,
                    provider,
                    parsed_pages,
                    question=subquestion_text[subquestion_id],
                    subquestion_id=subquestion_id,
                    analysis_requirements=DEPTH_TARGETS[budget_mode].analysis_requirements,
                    attempted_branches=analyzed_public_page_branches,
                    public_search_provider=public_search_provider,
                    public_page_parser=public_page_parser,
                    supplement_attempted=project_text_supplement_attempted,
                    supplement_pages=project_text_supplement_pages,
                    remaining_seconds=lambda: research_deadline - clock(),
                )
                if reused:
                    reused_article_ready_branches.add(subquestion_id)
                    browser_added += reused_added
            inspection_sources = sorted(
                provider_result.sources,
                key=lambda source: _inspection_source_sort_key(
                    source,
                    goal,
                    public_relevance_context,
                ),
                reverse=True,
            )
            for source in inspection_sources:
                if _is_xiaohongshu_url(source.url):
                    note_limit = XIAOHONGSHU_VISUAL_NOTE_LIMIT if path.uses_visual_platform else 1
                    note_target = XIAOHONGSHU_VISUAL_NOTE_TARGET if path.uses_visual_platform else 1
                    if (
                        xiaohongshu_usable_notes.get(subquestion_id, 0) >= note_target
                        or xiaohongshu_note_attempts.get(subquestion_id, 0) >= note_limit
                    ):
                        continue
                if (
                    _is_xiaohongshu_url(source.url)
                    and isinstance(xiaohongshu_search, XiaohongshuAssetDownloader)
                    and visual_classifier is not None
                    and candidate_root is not None
                    and not inspection_budget.exhausted
                ):
                    xiaohongshu_note_attempts[subquestion_id] = (
                        xiaohongshu_note_attempts.get(subquestion_id, 0) + 1
                    )
                    temporary_root = candidate_root / run_id / "temporary"
                    temporary_root.mkdir(parents=True, exist_ok=True)
                    try:
                        with TemporaryDirectory(prefix="xiaohongshu-", dir=temporary_root) as temp:
                            image_paths = xiaohongshu_search.download(
                                source.url,
                                Path(temp),
                                limit=REMOTE_VISUAL_BATCH_LIMIT,
                            )
                            inspected = inspect_local_images(
                                visual_classifier,
                                run_id=run_id,
                                source_url=source.url,
                                image_paths=image_paths,
                                question=subquestion_text[subquestion_id],
                                caption=source.title,
                                candidate_root=candidate_root,
                                budget=inspection_budget,
                            )
                            (
                                accepted_inspected,
                                type_mismatch_count,
                                quality_rejected_count,
                            ) = path.filter_inspected_visuals(
                                inspected,
                                question=subquestion_text[subquestion_id],
                                caption=source.title,
                            )
                            added = _persist_inspected_assets(
                                db,
                                run_id,
                                source,
                                accepted_inspected,
                                subquestion_id=subquestion_id,
                            )
                        inspected_urls.add(source.url)
                        browser_added += added
                        if added > 0:
                            xiaohongshu_usable_notes[subquestion_id] = (
                                xiaohongshu_usable_notes.get(subquestion_id, 0) + 1
                            )
                        checkpoint(
                            db,
                            run_id,
                            RunStatus.inspecting,
                            {
                                "source_url": _redacted_trace_url(source.url),
                                "status": "completed",
                                "downloaded_count": len(image_paths),
                                "candidate_count": len(inspected),
                                "accepted_type_count": len(accepted_inspected),
                                "type_mismatch_count": type_mismatch_count,
                                "quality_rejected_count": quality_rejected_count,
                                "added": added,
                                "note_attempt": xiaohongshu_note_attempts[subquestion_id],
                                "usable_note_count": xiaohongshu_usable_notes.get(
                                    subquestion_id, 0
                                ),
                                "visual_calls_used": inspection_budget.used_calls,
                                "preview_bytes_used": inspection_budget.used_bytes,
                            },
                            tool="xiaohongshu_assets",
                        )
                    except Exception as exc:
                        if xiaohongshu_required and (
                            browser_client is None
                            or not bool(getattr(browser_client, "connected", True))
                        ):
                            browser_inspection_failed = True
                        checkpoint(
                            db,
                            run_id,
                            RunStatus.inspecting,
                            {
                                "source_url": _redacted_trace_url(source.url),
                                "status": "failed",
                                "error_type": type(exc).__name__,
                                "note_attempt": xiaohongshu_note_attempts[subquestion_id],
                            },
                            tool="xiaohongshu_assets",
                        )
                parsed_page = parsed_pages.get(source.url)
                parsed_now = False
                branch_analysis_available = _public_page_branch_analysis_budget_available(
                    analyzed_public_page_branches,
                    subquestion_id=subquestion_id,
                    attempts_before_query=page_analysis_attempts_before_query,
                    attempt_limit=page_analysis_attempt_limit,
                )
                cache_for_completion_recovery = (
                    require_article_analysis
                    and recovery_rounds > 0
                    and round_number > normal_rounds
                )
                if (
                    public_page_parser is not None
                    and not _is_sparse_visual_platform_url(source.url)
                    and source.url not in parsed_pages
                    and (branch_analysis_available or cache_for_completion_recovery)
                    and research_deadline - clock()
                    >= float(getattr(public_page_parser, "worst_case_call_seconds", 0.0))
                    and page_budget_available(
                        round_number=round_number,
                        normal_rounds=normal_rounds,
                        normal_attempts=public_page_attempts,
                        normal_limit=max_pages,
                        subquestion_id=subquestion_id,
                        recovery_attempts=public_recovery_page_attempts,
                        recovery_limit=recovery_pages_per_subquestion,
                    )
                ):
                    public_page_attempts += 1
                    if round_number > normal_rounds:
                        public_recovery_page_attempts[subquestion_id] = (
                            public_recovery_page_attempts.get(subquestion_id, 0) + 1
                        )
                    parsed_page = _try_parse_public_page(
                        db,
                        run_id,
                        source,
                        public_page_parser,
                    )
                    if parsed_page is not None:
                        parsed_pages[source.url] = parsed_page
                    public_page_inspection_succeeded = (
                        public_page_inspection_succeeded or parsed_page is not None
                    )
                    parsed_now = True

                can_inspect = (
                    browser_client is not None
                    and visual_classifier is not None
                    and candidate_root is not None
                    and bool(getattr(browser_client, "connected", True))
                    and source.url not in inspected_urls
                    and page_budget_available(
                        round_number=round_number,
                        normal_rounds=normal_rounds,
                        normal_attempts=browser_page_attempts,
                        normal_limit=max_pages,
                        subquestion_id=subquestion_id,
                        recovery_attempts=browser_recovery_page_attempts,
                        recovery_limit=recovery_pages_per_subquestion,
                    )
                    and not inspection_budget.exhausted
                )
                if can_inspect:
                    assert browser_client is not None
                    assert visual_classifier is not None
                    assert candidate_root is not None
                    xiaohongshu_browser_source = _is_xiaohongshu_url(source.url) and not isinstance(
                        xiaohongshu_search, XiaohongshuAssetDownloader
                    )
                    if xiaohongshu_browser_source:
                        xiaohongshu_note_attempts[subquestion_id] = (
                            xiaohongshu_note_attempts.get(subquestion_id, 0) + 1
                        )
                    inspected_urls.add(source.url)
                    browser_page_attempts += 1
                    if round_number > normal_rounds:
                        browser_recovery_page_attempts[subquestion_id] = (
                            browser_recovery_page_attempts.get(subquestion_id, 0) + 1
                        )
                    persist_browser_page_attempts(db, run_id, browser_page_attempts)
                    try:
                        note_opener = (
                            xiaohongshu_browser_search.open_note
                            if xiaohongshu_browser_search is not None
                            and xiaohongshu_browser_search.can_open_note(source.url)
                            else None
                        )
                        inspected = inspect_source_page(
                            browser_client,
                            visual_classifier,
                            run_id=run_id,
                            source_url=source.url,
                            question=subquestion_text[subquestion_id],
                            candidate_root=candidate_root,
                            budget=inspection_budget,
                            public_page_text=_public_page_context(parsed_page),
                            open_page=note_opener,
                        )
                        accepted_inspected, _, quality_rejected_count = (
                            path.filter_inspected_visuals(
                                inspected,
                                question=subquestion_text[subquestion_id],
                                caption=source.title,
                            )
                        )
                        added = _persist_inspected_assets(
                            db,
                            run_id,
                            source,
                            accepted_inspected,
                            subquestion_id=subquestion_id,
                        )
                        browser_added += added
                        if xiaohongshu_browser_source and added > 0:
                            xiaohongshu_usable_notes[subquestion_id] = (
                                xiaohongshu_usable_notes.get(subquestion_id, 0) + 1
                            )
                        checkpoint(
                            db,
                            run_id,
                            RunStatus.inspecting,
                            {
                                "source_url": _redacted_trace_url(source.url),
                                "status": "completed",
                                "candidate_count": len(inspected),
                                "added": added,
                                "quality_rejected_count": quality_rejected_count,
                                "note_attempt": (
                                    xiaohongshu_note_attempts[subquestion_id]
                                    if xiaohongshu_browser_source
                                    else None
                                ),
                                "usable_note_count": (
                                    xiaohongshu_usable_notes.get(subquestion_id, 0)
                                    if xiaohongshu_browser_source
                                    else None
                                ),
                                "visual_calls_used": inspection_budget.used_calls,
                                "preview_bytes_used": inspection_budget.used_bytes,
                            },
                            tool="browser",
                        )
                    except Exception as exc:
                        if parsed_page is None:
                            if xiaohongshu_required and _is_sparse_visual_platform_url(source.url):
                                browser_inspection_failed = True
                            else:
                                public_page_inspection_failed = True
                        browser_summary: dict[str, object] = {
                            "source_url": _redacted_trace_url(source.url),
                            "status": "skipped",
                            "error_type": type(exc).__name__,
                        }
                        if isinstance(exc, ValidationError):
                            validation_errors = exc.errors(
                                include_input=False,
                                include_url=False,
                            )
                            if validation_errors:
                                first_error = validation_errors[0]
                                browser_summary.update(
                                    {
                                        "validation_model": exc.title,
                                        "validation_path": ".".join(
                                            str(part) for part in first_error["loc"]
                                        ),
                                        "validation_error": first_error["type"],
                                    }
                                )
                        checkpoint(
                            db,
                            run_id,
                            RunStatus.inspecting,
                            browser_summary,
                            tool="browser",
                        )

                if parsed_now and parsed_page is not None and public_page_parser is not None:
                    concrete_project_page = is_concrete_project_page(
                        parsed_page,
                        source_title=source.title,
                    )
                    project_links = (
                        []
                        if concrete_project_page
                        else _filter_named_project_page_links(
                            select_project_page_links(parsed_page),
                            named_project_names,
                        )
                    )
                    parser_added = _persist_public_page_leads(
                        db,
                        run_id,
                        source,
                        parsed_page,
                        subquestion_id=subquestion_id,
                    )
                    direct_trusted_project = (
                        not project_links
                        and _inferred_publication_tier(source.url)
                        is PublicationTier.trusted_secondary
                        and concrete_project_page
                    )
                    exact_project_evidence = (
                        not project_links
                        and source.publication_tier
                        in {PublicationTier.primary, PublicationTier.trusted_secondary}
                        and concrete_project_page
                    )
                    if direct_trusted_project:
                        parser_added += _persist_expanded_project_page(
                            db,
                            run_id,
                            source,
                            parsed_page,
                            subquestion_id=subquestion_id,
                        )
                    if (
                        isinstance(visual_classifier, RemoteVisualClassifier)
                        and not project_links
                        and (goal is not ResearchGoal.precedent_research or exact_project_evidence)
                    ):
                        remote_public_pages.append(
                            RemotePublicPageBatchItem(
                                source=source,
                                page=parsed_page,
                                exact_project_evidence=exact_project_evidence,
                                article_analysis_eligible=direct_trusted_project,
                            )
                        )
                    if (
                        direct_trusted_project
                        and isinstance(provider, PublicPageAnalysisProvider)
                        and _public_page_branch_analysis_budget_available(
                            analyzed_public_page_branches,
                            subquestion_id=subquestion_id,
                            attempts_before_query=page_analysis_attempts_before_query,
                            attempt_limit=page_analysis_attempt_limit,
                        )
                        and research_deadline - clock() >= provider.worst_case_page_analysis_seconds
                    ):
                        parser_added += _try_public_page_branch_analysis(
                            db,
                            run_id,
                            provider,
                            source,
                            parsed_page,
                            question=subquestion_text[subquestion_id],
                            subquestion_id=subquestion_id,
                            analysis_requirements=DEPTH_TARGETS[budget_mode].analysis_requirements,
                            attempted_branches=analyzed_public_page_branches,
                            public_search_provider=public_search_provider,
                            public_page_parser=public_page_parser,
                            parsed_pages=parsed_pages,
                            supplement_attempted=project_text_supplement_attempted,
                            supplement_pages=project_text_supplement_pages,
                            remaining_seconds=lambda: research_deadline - clock(),
                        )
                    browser_added += parser_added
                    checkpoint(
                        db,
                        run_id,
                        RunStatus.inspecting,
                        {
                            "source_url": _redacted_trace_url(source.url),
                            "status": "completed",
                            "markdown_chars": len(parsed_page.markdown),
                            "image_leads": len(parsed_page.images),
                            "link_leads": len(parsed_page.links),
                            "enriched": parser_added,
                        },
                        tool=public_page_parser.name,
                    )
                    for project_url in project_links:
                        parser_reserve = float(
                            getattr(public_page_parser, "worst_case_call_seconds", 0.0)
                        )
                        if (
                            project_url in parsed_pages
                            or not page_budget_available(
                                round_number=round_number,
                                normal_rounds=normal_rounds,
                                normal_attempts=public_page_attempts,
                                normal_limit=max_pages,
                                subquestion_id=subquestion_id,
                                recovery_attempts=public_recovery_page_attempts,
                                recovery_limit=recovery_pages_per_subquestion,
                            )
                            or not _public_page_branch_analysis_budget_available(
                                analyzed_public_page_branches,
                                subquestion_id=subquestion_id,
                                attempts_before_query=page_analysis_attempts_before_query,
                                attempt_limit=page_analysis_attempt_limit,
                            )
                            or research_deadline - clock() < parser_reserve
                        ):
                            continue
                        public_page_attempts += 1
                        if round_number > normal_rounds:
                            public_recovery_page_attempts[subquestion_id] = (
                                public_recovery_page_attempts.get(subquestion_id, 0) + 1
                            )
                        project_source = ProviderSource(
                            url=project_url,
                            publisher=urlparse(project_url).hostname or "",
                            publication_tier=source.publication_tier,
                        )
                        project_page = _try_parse_public_page(
                            db,
                            run_id,
                            project_source,
                            public_page_parser,
                        )
                        parsed_pages[project_url] = project_page
                        public_page_inspection_succeeded = (
                            public_page_inspection_succeeded or project_page is not None
                        )
                        if project_page is None:
                            continue
                        project_source = project_source.model_copy(
                            update={"title": project_page.title}
                        )
                        _persist_sources(
                            db,
                            run_id,
                            ProviderSearchResult(sources=[project_source], assets=[]),
                        )
                        promoted = _persist_expanded_project_page(
                            db,
                            run_id,
                            project_source,
                            project_page,
                            subquestion_id=subquestion_id,
                        )
                        exact_project_evidence = project_source.publication_tier in {
                            PublicationTier.primary,
                            PublicationTier.trusted_secondary,
                        } and is_concrete_project_page(
                            project_page,
                            source_title=project_source.title,
                        )
                        if isinstance(visual_classifier, RemoteVisualClassifier) and (
                            goal is not ResearchGoal.precedent_research or exact_project_evidence
                        ):
                            remote_public_pages.append(
                                RemotePublicPageBatchItem(
                                    source=project_source,
                                    page=project_page,
                                    exact_project_evidence=exact_project_evidence,
                                    article_analysis_eligible=(
                                        project_source.publication_tier
                                        in {
                                            PublicationTier.primary,
                                            PublicationTier.trusted_secondary,
                                        }
                                    ),
                                )
                            )
                        if (
                            isinstance(provider, PublicPageAnalysisProvider)
                            and project_source.publication_tier
                            in {PublicationTier.primary, PublicationTier.trusted_secondary}
                            and _public_page_branch_analysis_budget_available(
                                analyzed_public_page_branches,
                                subquestion_id=subquestion_id,
                                attempts_before_query=page_analysis_attempts_before_query,
                                attempt_limit=page_analysis_attempt_limit,
                            )
                            and research_deadline - clock()
                            >= provider.worst_case_page_analysis_seconds
                        ):
                            promoted += _try_public_page_branch_analysis(
                                db,
                                run_id,
                                provider,
                                project_source,
                                project_page,
                                question=subquestion_text[subquestion_id],
                                subquestion_id=subquestion_id,
                                analysis_requirements=DEPTH_TARGETS[
                                    budget_mode
                                ].analysis_requirements,
                                attempted_branches=analyzed_public_page_branches,
                                public_search_provider=public_search_provider,
                                public_page_parser=public_page_parser,
                                parsed_pages=parsed_pages,
                                supplement_attempted=project_text_supplement_attempted,
                                supplement_pages=project_text_supplement_pages,
                                remaining_seconds=lambda: research_deadline - clock(),
                            )
                        browser_added += promoted
                        checkpoint(
                            db,
                            run_id,
                            RunStatus.inspecting,
                            {
                                "source_url": project_url,
                                "status": "completed",
                                "promoted": promoted,
                            },
                            tool=f"{public_page_parser.name}_expand",
                        )
                elif parsed_page is not None and public_page_parser is not None:
                    concrete_project_page = is_concrete_project_page(
                        parsed_page,
                        source_title=source.title,
                    )
                    project_links = (
                        []
                        if concrete_project_page
                        else _filter_named_project_page_links(
                            select_project_page_links(parsed_page),
                            named_project_names,
                        )
                    )
                    reassociated = 0
                    direct_trusted_project = (
                        not project_links
                        and _inferred_publication_tier(source.url)
                        is PublicationTier.trusted_secondary
                        and concrete_project_page
                    )
                    if (
                        direct_trusted_project
                        and isinstance(provider, PublicPageAnalysisProvider)
                        and _public_page_branch_analysis_budget_available(
                            analyzed_public_page_branches,
                            subquestion_id=subquestion_id,
                            attempts_before_query=page_analysis_attempts_before_query,
                            attempt_limit=page_analysis_attempt_limit,
                        )
                        and research_deadline - clock() >= provider.worst_case_page_analysis_seconds
                    ):
                        reassociated += _try_public_page_branch_analysis(
                            db,
                            run_id,
                            provider,
                            source,
                            parsed_page,
                            question=subquestion_text[subquestion_id],
                            subquestion_id=subquestion_id,
                            analysis_requirements=DEPTH_TARGETS[budget_mode].analysis_requirements,
                            attempted_branches=analyzed_public_page_branches,
                            public_search_provider=public_search_provider,
                            public_page_parser=public_page_parser,
                            parsed_pages=parsed_pages,
                            supplement_attempted=project_text_supplement_attempted,
                            supplement_pages=project_text_supplement_pages,
                            remaining_seconds=lambda: research_deadline - clock(),
                        )
                    for project_url in project_links:
                        project_page = parsed_pages.get(project_url)
                        if project_page is None:
                            continue
                        project_source = ProviderSource(
                            url=project_url,
                            title=project_page.title,
                            publisher=urlparse(project_url).hostname or "",
                            publication_tier=source.publication_tier,
                        )
                        reassociated += _persist_expanded_project_page(
                            db,
                            run_id,
                            project_source,
                            project_page,
                            subquestion_id=subquestion_id,
                        )
                    browser_added += reassociated
                    if reassociated:
                        checkpoint(
                            db,
                            run_id,
                            RunStatus.inspecting,
                            {
                                "source_url": _redacted_trace_url(source.url),
                                "status": "reused",
                                "reassociated": reassociated,
                            },
                            tool=f"{public_page_parser.name}_expand",
                        )
            defer_remote_batch = (
                path.uses_precedent_sources and require_article_analysis and recovery_rounds > 0
            )
            remote_batch_due = (
                not defer_remote_batch
                or round_number == last_query_round_by_subquestion[subquestion_id]
            )
            text_coverage_complete = True
            if path.uses_precedent_sources and require_article_analysis:
                text_coverage = calculate_coverage(
                    db,
                    run_id,
                    require_article_analysis=True,
                )
                text_coverage_complete = (
                    text_coverage["covered_subquestions"] == text_coverage["subquestion_count"]
                )
            if (
                remote_public_pages
                and remote_batch_due
                and text_coverage_complete
                and isinstance(visual_classifier, RemoteVisualClassifier)
            ):
                browser_added += _classify_remote_public_images(
                    db,
                    run_id,
                    remote_public_pages,
                    visual_classifier,
                    question=subquestion_text[subquestion_id],
                    subquestion_id=subquestion_id,
                    remaining_seconds=research_deadline - clock(),
                )
                if isinstance(provider, PublicPageAnalysisProvider):
                    for item in remote_public_pages:
                        if (
                            not item["article_analysis_eligible"]
                            or not _public_page_branch_analysis_budget_available(
                                analyzed_public_page_branches,
                                subquestion_id=subquestion_id,
                                attempts_before_query=page_analysis_attempts_before_query,
                                attempt_limit=page_analysis_attempt_limit,
                            )
                            or research_deadline - clock()
                            < provider.worst_case_page_analysis_seconds
                        ):
                            continue
                        browser_added += _try_public_page_branch_analysis(
                            db,
                            run_id,
                            provider,
                            item["source"],
                            item["page"],
                            question=subquestion_text[subquestion_id],
                            subquestion_id=subquestion_id,
                            analysis_requirements=DEPTH_TARGETS[budget_mode].analysis_requirements,
                            attempted_branches=analyzed_public_page_branches,
                            public_search_provider=public_search_provider,
                            public_page_parser=public_page_parser,
                            parsed_pages=parsed_pages,
                            supplement_attempted=project_text_supplement_attempted,
                            supplement_pages=project_text_supplement_pages,
                            remaining_seconds=lambda: research_deadline - clock(),
                        )
                remote_public_pages.clear()
            if (
                require_article_analysis
                and provider_result.sources
                and subquestion_id not in reused_article_ready_branches
                and isinstance(provider, PublicPageAnalysisProvider)
                and _public_page_branch_analysis_budget_available(
                    analyzed_public_page_branches,
                    subquestion_id=subquestion_id,
                    attempts_before_query=page_analysis_attempts_before_query,
                    attempt_limit=page_analysis_attempt_limit,
                )
                and research_deadline - clock() >= provider.worst_case_page_analysis_seconds
            ):
                reused, reused_added = _try_article_ready_page_branch_reuse(
                    db,
                    run_id,
                    provider,
                    parsed_pages,
                    question=subquestion_text[subquestion_id],
                    subquestion_id=subquestion_id,
                    analysis_requirements=DEPTH_TARGETS[budget_mode].analysis_requirements,
                    attempted_branches=analyzed_public_page_branches,
                    public_search_provider=public_search_provider,
                    public_page_parser=public_page_parser,
                    supplement_attempted=project_text_supplement_attempted,
                    supplement_pages=project_text_supplement_pages,
                    remaining_seconds=lambda: research_deadline - clock(),
                )
                if reused:
                    reused_article_ready_branches.add(subquestion_id)
                    browser_added += reused_added
            visited_public_sources: list[ProviderSource] = []
            for source in selected_public_sources:
                if parsed_pages.get(source.url) is None and source.url not in inspected_urls:
                    continue
                visited_public_sources.append(source)
                excluded_public_urls.add(source.url)
                if source.title:
                    excluded_search_project_names.add(source.title)
                project_key = _project_identity_key(source.title)
                if project_key:
                    excluded_project_keys.add(project_key)
            if visited_public_sources:
                _persist_sources(
                    db,
                    run_id,
                    ProviderSearchResult(sources=visited_public_sources, assets=[]),
                    access_status="available",
                )
            checkpoint(
                db,
                run_id,
                RunStatus.analyzing,
                {"candidate_count": len(provider_result.assets) + browser_added},
            )
            mark_query_completed(db, query_attempt_id)
            added_usable_assets += browser_added
            if can_search_publicly and public_search_provider is not None:
                feedback = public_search_feedback_by_subquestion.setdefault(
                    subquestion_id,
                    [],
                )
                if added_usable_assets > 0:
                    feedback.clear()
                    low_yield = public_search_low_yield_domains_by_subquestion.get(subquestion_id)
                    if low_yield is not None:
                        low_yield.difference_update(public_search_domains)
                else:
                    reason = public_search_failure_reason
                    if reason is None and selected_public_sources:
                        reason = "public_page_analysis_incomplete"
                    if reason is not None and reason not in feedback:
                        feedback.append(reason)
                        del feedback[:-3]
                    if reason is not None:
                        public_search_low_yield_domains_by_subquestion.setdefault(
                            subquestion_id,
                            set(),
                        ).update(public_search_domains)
            round_added_usable_assets += added_usable_assets

            checkpoint(db, run_id, RunStatus.verifying, {"method": "source_binding"})
            coverage = calculate_coverage(
                db,
                run_id,
                require_article_analysis=require_article_analysis,
            )
            checkpoint(db, run_id, RunStatus.gap_check, dict(coverage))
            visual_note_target_satisfied = not xiaohongshu_only_visual or all(
                xiaohongshu_usable_notes.get(item.id, 0) >= XIAOHONGSHU_VISUAL_NOTE_TARGET
                for item in plan.subquestions
            )
            visual_completion_allowed = visual_note_target_satisfied
            if enrichment_satisfied(coverage) and visual_completion_allowed:
                stop_reason = "coverage_satisfied"
                break
            round_finished = (
                query_offset == len(queries) or queries[query_offset][0] != round_number
            )
            if (
                round_finished
                and round_number >= normal_rounds + recovery_rounds
                and round_added_usable_assets == 0
                and round_number not in resumed_rounds
            ):
                stop_reason = "no_new_assets"
                break
            if round_finished:
                round_added_usable_assets = 0

        coverage = calculate_coverage(
            db,
            run_id,
            require_article_analysis=require_article_analysis,
        )
        if (
            require_article_analysis
            and recovery_rounds > 0
            and isinstance(provider, PublicPageAnalysisProvider)
            and coverage["covered_subquestions"] < coverage["subquestion_count"]
        ):
            covered_subquestion_ids = set(coverage["covered_subquestion_ids"])
            for subquestion in plan.subquestions:
                if subquestion.id in covered_subquestion_ids:
                    continue
                if research_deadline - clock() < provider.worst_case_page_analysis_seconds:
                    break
                reused, _ = _try_article_ready_page_branch_reuse(
                    db,
                    run_id,
                    provider,
                    parsed_pages,
                    question=subquestion_text[subquestion.id],
                    subquestion_id=subquestion.id,
                    analysis_requirements=DEPTH_TARGETS[budget_mode].analysis_requirements,
                    attempted_branches=analyzed_public_page_branches,
                    public_search_provider=public_search_provider,
                    public_page_parser=public_page_parser,
                    supplement_attempted=project_text_supplement_attempted,
                    supplement_pages=project_text_supplement_pages,
                    remaining_seconds=lambda: research_deadline - clock(),
                    include_unanalyzed_pages=True,
                )
                if not reused:
                    continue
                coverage = calculate_coverage(
                    db,
                    run_id,
                    require_article_analysis=require_article_analysis,
                )
                covered_subquestion_ids = set(coverage["covered_subquestion_ids"])
        if (
            require_article_analysis
            and recovery_rounds > 0
            and isinstance(provider, PublicPageAnalysisProvider)
            and not coverage["gaps"]
            and set(coverage["enrichment_gaps"]) == {"insufficient_multi_asset_projects"}
            and research_deadline - clock() >= provider.worst_case_page_analysis_seconds
        ):
            _try_cached_multi_drawing_page_enrichment(
                db,
                run_id,
                provider,
                parsed_pages,
                subquestions=plan.subquestions,
                analysis_requirements=DEPTH_TARGETS[budget_mode].analysis_requirements,
                attempted_branches=analyzed_public_page_branches,
            )
            coverage = calculate_coverage(
                db,
                run_id,
                require_article_analysis=require_article_analysis,
            )
        raise_if_cancelled(db, run_id)
        coverage = calculate_coverage(
            db,
            run_id,
            require_article_analysis=require_article_analysis,
        )
        if (
            path.uses_visual_platform
            and inspection_budget.exhausted
            and not completion_satisfied(coverage)
        ):
            stop_reason = "visual_budget_exhausted"
        if require_research_synthesis:
            assert isinstance(provider, ResearchSynthesisProvider)
            synthesis = None
            if deadline - clock() >= synthesis_call_reserve:
                synthesis = _try_research_synthesis(
                    db,
                    run_id,
                    provider,
                    question=question,
                    budget_mode=budget_mode,
                )
            if synthesis is None:
                coverage["gaps"].append("research_synthesis_incomplete")
                stop_reason = "research_synthesis_incomplete"
            else:
                coverage["synthesis"] = synthesis
        run_browser_inspection_failed = browser_inspection_failed or (
            public_page_inspection_failed and not public_page_inspection_succeeded
        )
        if (
            run_browser_inspection_failed
            and "browser_inspection_incomplete" not in coverage["gaps"]
        ):
            coverage["gaps"].append("browser_inspection_incomplete")
            stop_reason = "browser_inspection_incomplete"
        checkpoint(db, run_id, RunStatus.composing, {"coverage": coverage})
        with db.session_factory() as session:
            run = get_run(session, run_id)
            preserved_asset_count = session.scalar(
                select(func.count())
                .select_from(AssetCandidate)
                .where(AssetCandidate.run_id == run_id)
            )
            run.coverage_report = dict(coverage)
            terminal_status, terminal_stop_reason = path.terminal_outcome(
                complete=completion_satisfied(coverage),
                covered_subquestions=int(coverage["covered_subquestions"]),
                browser_inspection_incomplete=("browser_inspection_incomplete" in coverage["gaps"]),
                usable_assets=int(coverage["usable_assets"]),
                preserved_assets=int(preserved_asset_count or 0),
                stop_reason=stop_reason,
            )
            run.status = terminal_status.value
            run.stop_reason = terminal_stop_reason
            run.finished_at = datetime.now(UTC)
            session.commit()
            terminal_state = run.status
    except ResearchCancelled:
        terminal_state = RunStatus.cancelled.value
    except Exception as exc:
        terminal_state = _preserve_failure(db, run_id, exc)
    if terminal_state is not None and on_terminal is not None:
        on_terminal(terminal_state)


def _try_parse_public_page(
    db: Database,
    run_id: str,
    source: ProviderSource,
    parser: PublicPageParser,
) -> ParsedPublicPage | None:
    try:
        return parser.parse(source.url)
    except Exception as exc:
        checkpoint(
            db,
            run_id,
            RunStatus.inspecting,
            {
                "source_url": _redacted_trace_url(source.url),
                "status": "skipped",
                "error_type": type(exc).__name__,
            },
            tool=parser.name,
        )
        return None


def _public_search_worst_case_seconds(provider: PublicSearchProvider) -> float:
    return float(
        getattr(
            provider,
            "worst_case_search_seconds",
            getattr(provider, "worst_case_call_seconds", 0.0),
        )
    )


def _public_search_budget_available(
    db: Database,
    run_id: str,
    provider: PublicSearchProvider,
) -> bool:
    return _public_search_budget_remaining(db, run_id, provider) > 0


def _public_search_budget_remaining(
    db: Database,
    run_id: str,
    provider: PublicSearchProvider,
) -> int:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        budget = run.budget or {}
        default_recovery_rounds = 1 if run.goal == ResearchGoal.precedent_research.value else 0
        recovery_rounds = int(budget.get("completion_recovery_rounds", default_recovery_rounds))
        query_limit = (
            int(budget.get("max_queries", 0)) + len(run.subquestions or []) * recovery_rounds
        )
        used_calls = session.scalar(
            select(func.count())
            .select_from(TraceEvent)
            .where(
                TraceEvent.run_id == run_id,
                TraceEvent.retry_count == run.attempt,
                TraceEvent.tool == f"{provider.name}_search",
            )
        )
    return max(0, query_limit - int(used_calls or 0))


def _try_public_search(
    db: Database,
    run_id: str,
    provider: PublicSearchProvider,
    query: str,
    allowed_domains: list[str],
    *,
    limit: int = 4,
    purpose: str | None = None,
    structured_query: SearchQuery | None = None,
) -> list[ProviderSource]:
    tool_name = f"{provider.name}_search"
    if not _public_search_budget_available(db, run_id, provider):
        return []
    try:
        structured_search = getattr(provider, "search_structured", None)
        anchors = structured_query.anchors if structured_query is not None else None
        if anchors is not None and callable(structured_search):
            leads = structured_search(
                query,
                building_type=anchors.building_type,
                project_condition=anchors.project_condition,
                spatial_focus=anchors.spatial_focus,
                evidence_type=anchors.evidence_type,
                project_name=anchors.project_name,
                search_scope=(
                    "space_first"
                    if structured_query is not None and structured_query.strategy == "space_first"
                    else "project_context"
                ),
                limit=limit,
                include_domains=allowed_domains,
            )
        else:
            leads = provider.search(
                query,
                limit=limit,
                include_domains=allowed_domains,
            )
        sources: list[ProviderSource] = []
        for lead in leads[:limit]:
            source = ProviderSource(
                url=lead.url,
                title=lead.title,
                publisher=urlparse(lead.url).hostname or "",
                publication_tier=_inferred_publication_tier(lead.url),
            )
            source._search_description = lead.description
            sources.append(source)
        summary: dict[str, object] = {
            "status": "completed",
            "result_count": len(sources),
            "structured_query": anchors is not None and callable(structured_search),
            "domains": list(allowed_domains),
        }
        if purpose is not None:
            summary["purpose"] = purpose
        if anchors is not None:
            summary["search_scope"] = (
                "space_first"
                if structured_query is not None and structured_query.strategy == "space_first"
                else "project_context"
            )
        checkpoint(
            db,
            run_id,
            RunStatus.searching,
            summary,
            tool=tool_name,
        )
        return sources
    except Exception as exc:
        checkpoint(
            db,
            run_id,
            RunStatus.searching,
            {"status": "skipped", "error_type": type(exc).__name__},
            tool=tool_name,
        )
        return []


def _try_search_query_plan(
    db: Database,
    run_id: str,
    provider: SearchQueryPlanningProvider | None,
    *,
    question: str,
    subquestion: ResearchSubquestion,
    round_number: int,
    preferred_language: str,
    research_context: str,
    previous_queries: Sequence[str],
    excluded_sources: Sequence[str],
    excluded_projects: Sequence[str],
    failure_reasons: Sequence[str],
    fallback_query: str,
    query_limit: int,
    unavailable_error_type: str,
) -> SearchQueryPlan:
    error_type = unavailable_error_type
    if provider is not None:
        try:
            plan = provider.plan_search_queries(
                question=question,
                subquestion=subquestion,
                round_number=round_number,
                preferred_language=preferred_language,
                research_context=research_context,
                previous_queries=previous_queries,
                excluded_sources=excluded_sources,
                excluded_projects=excluded_projects,
                failure_reasons=failure_reasons,
                query_limit=query_limit,
            )
        except Exception as exc:
            error_type = type(exc).__name__
        else:
            checkpoint(
                db,
                run_id,
                RunStatus.searching,
                {
                    "status": "completed",
                    "provider": str(getattr(provider, "name", "provider")),
                    "subquestion_id": subquestion.id,
                    "round": round_number,
                    "query_count": len(plan.queries),
                    "strategies": [item.strategy for item in plan.queries],
                },
                tool="search_query_planning",
            )
            return plan
    normalized_previous = {" ".join(item.casefold().split()) for item in previous_queries}
    deterministic_query = " ".join(fallback_query.split())
    if deterministic_query.casefold() in normalized_previous:
        deterministic_query = (
            f"{fallback_query[:430].rstrip()} alternative evidence round {round_number}"
        )[:500]
    fallback_language: Literal["en", "zh"] = (
        "zh" if preferred_language == "zh" or not deterministic_query.isascii() else "en"
    )
    fallback_strategy = architecture_retrieval_strategy(architecture_retrieval_lane(round_number))
    fallback = SearchQueryPlan(
        queries=[
            SearchQuery(
                query=deterministic_query,
                language=fallback_language,
                strategy=fallback_strategy,
            )
        ]
    )
    checkpoint(
        db,
        run_id,
        RunStatus.searching,
        {
            "status": "fallback",
            "mode": "deterministic_template",
            "error_type": error_type,
            "subquestion_id": subquestion.id,
            "round": round_number,
            "query_count": len(fallback.queries),
            "strategies": [item.strategy for item in fallback.queries],
        },
        tool="search_query_planning",
    )
    return fallback


def _update_query_attempt_text(
    db: Database,
    query_attempt_id: str,
    queries: Sequence[SearchQuery],
) -> None:
    with db.session_factory() as session:
        attempt = session.get(QueryAttempt, query_attempt_id)
        if attempt is None:
            return
        attempt.query = " || ".join(item.query for item in queries)[:8_000]
        languages = {item.language for item in queries}
        attempt.language = next(iter(languages)) if len(languages) == 1 else "mixed"
        session.commit()


def _prepare_local_search_candidates(
    sources: Sequence[ProviderSource],
    *,
    excluded_urls: set[str],
    excluded_project_keys: set[str],
) -> tuple[list[LocalSearchCandidate], dict[str, ProviderSource]]:
    candidates: list[LocalSearchCandidate] = []
    candidate_sources: dict[str, ProviderSource] = {}
    seen_urls: set[str] = set()
    seen_project_keys: set[str] = set()
    for source in sources:
        project_key = _project_identity_key(source.title)
        if (
            source.url in excluded_urls
            or source.url in seen_urls
            or (project_key and project_key in excluded_project_keys)
            or (project_key and project_key in seen_project_keys)
        ):
            excluded_urls.add(source.url)
            continue
        candidate_id = f"candidate-{hashlib.sha256(source.url.encode()).hexdigest()[:16]}"
        candidate = LocalSearchCandidate(
            candidate_id=candidate_id,
            url=source.url,
            title=source.title,
            description=source._search_description,
            publication_tier=source.publication_tier,
        )
        candidates.append(candidate)
        candidate_sources[candidate_id] = source
        seen_urls.add(source.url)
        if project_key:
            seen_project_keys.add(project_key)
        if len(candidates) == 8:
            break
    return candidates, candidate_sources


def _filter_named_project_query_sources(
    sources: Sequence[ProviderSource],
    query: str,
    *,
    project_names: Sequence[str] = (),
) -> list[ProviderSource]:
    focused_project_names = list(project_names) or explicit_project_names(query)
    if not focused_project_names:
        return list(sources)
    return [
        source
        for source in sources
        if any(_source_matches_project_name(source, name) for name in focused_project_names)
    ]


def _source_matches_project_name(source: ProviderSource, project_name: str) -> bool:
    project_key = _project_identity_key(project_name)
    if not project_key:
        return False
    source_keys = (
        _project_identity_key(source.title),
        _project_identity_key(unquote(urlparse(source.url).path).replace("-", " ")),
    )
    return any(project_key in source_key for source_key in source_keys)


def _filter_named_project_page_links(
    links: Sequence[str],
    project_names: Sequence[str],
) -> list[str]:
    if not project_names:
        return list(links)
    project_keys = [
        project_key
        for project_key in (_project_identity_key(name) for name in project_names)
        if project_key
    ]
    return [
        link
        for link in links
        if any(
            project_key in _project_identity_key(unquote(urlparse(link).path).replace("-", " "))
            for project_key in project_keys
        )
    ]


def _try_candidate_reranking(
    db: Database,
    run_id: str,
    provider: CandidateRerankingProvider | None,
    *,
    provider_call_enabled: bool,
    question: str,
    subquestion: ResearchSubquestion,
    planned_queries: Sequence[SearchQuery],
    candidates: Sequence[LocalSearchCandidate],
    candidate_sources: dict[str, ProviderSource],
    relevance_context: str,
    unavailable_error_type: str,
) -> list[ProviderSource]:
    if not candidates:
        checkpoint(
            db,
            run_id,
            RunStatus.searching,
            {
                "status": "completed",
                "provider": "not_called",
                "subquestion_id": subquestion.id,
                "candidate_count": 0,
                "retained_count": 0,
            },
            tool="candidate_reranking",
        )
        return []
    error_type = unavailable_error_type
    if provider is not None and provider_call_enabled:
        try:
            reranking = provider.rerank_search_candidates(
                question=question,
                subquestion=subquestion,
                search_queries=[item.query for item in planned_queries],
                candidates=candidates,
            )
        except Exception as exc:
            error_type = type(exc).__name__
        else:
            eligible_assessments = [
                item
                for item in reranking.assessments
                if item.retain and item.relevance >= 2 and item.source_trust >= 2
            ]
            spatial_assessments = sorted(
                (item for item in eligible_assessments if item.spatial_relevance >= 2),
                key=lambda item: (
                    item.spatial_relevance,
                    item.relevance,
                    item.drawing_availability,
                    item.source_trust,
                    item.typology_match,
                ),
                reverse=True,
            )
            type_context_assessments = sorted(
                (
                    item
                    for item in eligible_assessments
                    if item.spatial_relevance < 2
                    and item.typology_match >= 3
                    and item.source_trust >= 3
                ),
                key=lambda item: (
                    item.spatial_relevance,
                    item.relevance,
                    item.drawing_availability,
                    item.source_trust,
                    item.typology_match,
                ),
                reverse=True,
            )
            mechanism_context_assessments = sorted(
                (
                    item
                    for item in eligible_assessments
                    if item.architectural_scale
                    and item.spatial_relevance == 1
                    and item.source_trust >= 3
                ),
                key=lambda item: (
                    item.relevance,
                    item.drawing_availability,
                    item.source_trust,
                    item.typology_match,
                ),
                reverse=True,
            )
            retained_assessments = spatial_assessments[:4]
            if len(retained_assessments) < 4 and type_context_assessments:
                retained_assessments.append(type_context_assessments[0])
            retained_candidate_ids = {item.candidate_id for item in retained_assessments}
            if len(retained_assessments) < 4:
                mechanism_probe = next(
                    (
                        item
                        for item in mechanism_context_assessments
                        if item.candidate_id not in retained_candidate_ids
                    ),
                    None,
                )
                if mechanism_probe is not None:
                    retained_assessments.append(mechanism_probe)
            type_context_candidate_ids = {item.candidate_id for item in type_context_assessments}
            mechanism_context_candidate_ids = {
                item.candidate_id for item in mechanism_context_assessments
            }
            selected = [
                candidate_sources[item.candidate_id]
                for item in retained_assessments
                if item.candidate_id in candidate_sources
            ]
            checkpoint(
                db,
                run_id,
                RunStatus.searching,
                {
                    "status": "completed",
                    "provider": str(getattr(provider, "name", "provider")),
                    "subquestion_id": subquestion.id,
                    "candidate_count": len(candidates),
                    "retained_count": len(selected),
                    "direct_retained_count": len(
                        [item for item in retained_assessments if item.typology_match >= 2]
                    ),
                    "analogical_retained_count": len(
                        [item for item in retained_assessments if item.typology_match < 2]
                    ),
                    "spatial_retained_count": len(
                        [item for item in retained_assessments if item.typology_match < 2]
                    ),
                    "type_context_probe_count": len(
                        [
                            item
                            for item in retained_assessments
                            if item.candidate_id in type_context_candidate_ids
                        ]
                    ),
                    "mechanism_context_probe_count": len(
                        [
                            item
                            for item in retained_assessments
                            if item.candidate_id in mechanism_context_candidate_ids
                            and item.candidate_id not in type_context_candidate_ids
                        ]
                    ),
                },
                tool="candidate_reranking",
            )
            return selected
    space_first_planned = any(
        item.strategy == "space_first" and item.anchors is not None for item in planned_queries
    )
    fallback_relevance_context = _candidate_fallback_relevance_context(
        planned_queries,
        relevance_context,
    )
    structured_building_types = list(
        dict.fromkeys(
            item.anchors.building_type for item in planned_queries if item.anchors is not None
        )
    )
    candidate_descriptions = {item.url: item.description for item in candidates}

    def fallback_source_relevance_score(source: ProviderSource) -> int:
        return public_search_relevance_score(
            fallback_relevance_context,
            title=source.title,
            description=candidate_descriptions.get(source.url, source._search_description),
            url=source.url,
        )

    def fallback_source_eligible(source: ProviderSource) -> bool:
        if provider is None:
            return True
        if fallback_source_relevance_score(source) <= 0:
            return False
        if space_first_planned:
            return True
        if structured_building_types:
            lead = PublicSearchLead(
                url=source.url,
                title=source.title,
                description=source._search_description,
            )
            return any(
                search_lead_matches_building_type(building_type, lead)
                for building_type in structured_building_types
            )
        return _source_matches_research_typology(source, relevance_context)

    fallback_sources = sorted(
        (source for source in candidate_sources.values() if fallback_source_eligible(source)),
        key=lambda source: (
            fallback_source_relevance_score(source),
            _inspection_source_sort_key(
                source,
                ResearchGoal.precedent_research,
                fallback_relevance_context,
            ),
        ),
        reverse=True,
    )[:4]
    checkpoint(
        db,
        run_id,
        RunStatus.searching,
        {
            "status": "fallback",
            "mode": "deterministic_candidate_ranking",
            "error_type": error_type,
            "subquestion_id": subquestion.id,
            "candidate_count": len(candidates),
            "retained_count": len(fallback_sources),
        },
        tool="candidate_reranking",
    )
    return fallback_sources


def _candidate_fallback_relevance_context(
    planned_queries: Sequence[SearchQuery],
    fallback_context: str,
) -> str:
    space_first_focuses = [
        " ".join((item.anchors.spatial_focus, item.anchors.evidence_type))
        for item in planned_queries
        if item.strategy == "space_first" and item.anchors is not None
    ]
    if space_first_focuses:
        return " ".join(space_first_focuses)
    planned_text = " ".join(item.query for item in planned_queries)
    return planned_text or fallback_context


def _inferred_publication_tier(url: str) -> PublicationTier:
    hostname = (urlparse(url).hostname or "").casefold().rstrip(".")
    if hostname.startswith("www."):
        hostname = hostname[4:]
    if any(
        hostname == domain or hostname.endswith(f".{domain}")
        for domain in TRUSTED_ARCHITECTURE_PUBLICATION_DOMAINS
    ):
        return PublicationTier.trusted_secondary
    return PublicationTier.unknown


def _try_xiaohongshu_search(
    db: Database,
    run_id: str,
    searches: list[XiaohongshuSearch],
    query: str,
    *,
    limit: int = 4,
) -> tuple[list[ProviderSource], bool]:
    failed_backends = 0
    while searches:
        search = searches[0]
        try:
            sources = search.search(query, limit=limit)
            if not sources and len(searches) > 1:
                searches.pop(0)
                failed_backends += 1
                checkpoint(
                    db,
                    run_id,
                    RunStatus.searching,
                    {
                        "status": "retrying",
                        "backend": search.name,
                        "reason": "empty_result",
                    },
                    tool="xiaohongshu_search",
                )
                continue
            checkpoint(
                db,
                run_id,
                RunStatus.searching,
                {
                    "status": "completed",
                    "backend": search.name,
                    "result_count": len(sources),
                    "fallback": failed_backends > 0,
                },
                tool="xiaohongshu_search",
            )
            return sources, False
        except Exception as exc:
            searches.pop(0)
            failed_backends += 1
            checkpoint(
                db,
                run_id,
                RunStatus.searching,
                {
                    "status": "retrying" if searches else "skipped",
                    "backend": search.name,
                    "error_type": type(exc).__name__,
                },
                tool="xiaohongshu_search",
            )
    return [], True


def _rank_xiaohongshu_visual_sources(
    sources: Sequence[ProviderSource],
    direction: str,
    *,
    limit: int,
) -> list[ProviderSource]:
    requested_label = requested_visual_drawing_type(direction) or ""
    drawing_root = requested_label.removesuffix("图")
    style = direction.replace(f"建筑{requested_label}", " ").replace(requested_label, " ")
    style_characters = "".join(re.findall(r"[\u4e00-\u9fff]", style))
    style_bigrams = {
        style_characters[index : index + 2] for index in range(max(0, len(style_characters) - 1))
    }

    deduplicated: list[ProviderSource] = []
    seen_urls: set[str] = set()
    for source in sources:
        source_key = urlparse(source.url).path.rstrip("/") or source.url
        if source_key in seen_urls:
            continue
        seen_urls.add(source_key)
        deduplicated.append(source)

    def source_score(
        indexed_source: tuple[int, ProviderSource],
    ) -> tuple[int, int, int, int, int]:
        index, source = indexed_source
        title_characters = "".join(re.findall(r"[\u4e00-\u9fff]", source.title))
        title_bigrams = {
            title_characters[position : position + 2]
            for position in range(max(0, len(title_characters) - 1))
        }
        architecture_context = int(
            any(term in source.title for term in XIAOHONGSHU_ARCHITECTURE_DRAWING_TITLE_TERMS)
        )
        non_architecture_context = int(
            any(term in source.title for term in XIAOHONGSHU_NON_ARCHITECTURE_VISUAL_TITLE_TERMS)
        )
        drawing_type_match = int(bool(requested_label and requested_label in source.title))
        drawing_root_match = int(bool(drawing_root and drawing_root in source.title))
        style_overlap = len(style_bigrams & title_bigrams)
        relevance_score = (
            drawing_type_match * 4
            + drawing_root_match * 2
            + architecture_context * 2
            - non_architecture_context * (1 - architecture_context) * 5
            + min(style_overlap, 3)
        )
        return (
            relevance_score,
            drawing_type_match,
            drawing_root_match,
            style_overlap,
            -index,
        )

    ranked = sorted(enumerate(deduplicated), key=source_score, reverse=True)
    return [source for _, source in ranked[: max(0, limit)]]


def _merge_source_lists(
    first: list[ProviderSource],
    second: list[ProviderSource],
) -> list[ProviderSource]:
    merged: list[ProviderSource] = []
    seen: set[str] = set()
    for source in [*first, *second]:
        if source.url in seen:
            continue
        seen.add(source.url)
        merged.append(source)
    return merged


def _merge_public_sources(
    result: ProviderSearchResult,
    public_sources: list[ProviderSource],
) -> ProviderSearchResult:
    return ProviderSearchResult(
        sources=_merge_source_lists(result.sources, public_sources),
        assets=result.assets,
    )


def _persist_public_page_leads(
    db: Database,
    run_id: str,
    source: ProviderSource,
    page: ParsedPublicPage,
    *,
    subquestion_id: str | None,
) -> int:
    images_by_type: dict[str, list[str]] = {}
    for image in page.images:
        asset_type = infer_architecture_asset_type(image)
        if asset_type is not None:
            images_by_type.setdefault(asset_type.value, []).append(image.url)

    with db.session_factory() as session:
        candidates = list(
            session.scalars(
                select(AssetCandidate).where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.source_url == source.url,
                    AssetCandidate.image_url.is_(None),
                    AssetCandidate.storage_path.is_(None),
                )
            )
        )
        candidates_by_type: dict[str, list[AssetCandidate]] = {}
        for candidate in candidates:
            candidates_by_type.setdefault(candidate.asset_type, []).append(candidate)

        enriched = 0
        consumed_urls: set[str] = set()
        for type_name, image_urls in images_by_type.items():
            matching_candidates = candidates_by_type.get(type_name, [])
            unique_urls = list(dict.fromkeys(image_urls))
            if len(matching_candidates) != 1 or len(unique_urls) != 1:
                continue
            existing = session.scalar(
                select(AssetCandidate.id).where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.source_url == source.url,
                    AssetCandidate.image_url == unique_urls[0],
                )
            )
            if existing is not None:
                continue
            matching_candidates[0].image_url = unique_urls[0]
            consumed_urls.add(unique_urls[0])
            enriched += 1

        existing_image_urls = {
            value
            for value in session.scalars(
                select(AssetCandidate.image_url).where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.source_url == source.url,
                )
            )
            if value is not None
        }
        source_page_id = session.scalar(
            select(SourcePage.id).where(
                SourcePage.run_id == run_id,
                SourcePage.url == source.url,
            )
        )
        expires_at = datetime.now(UTC) + timedelta(days=7)
        project_name = page.title.strip() or source.title.strip() or "待核验项目"
        for type_name, image_urls in images_by_type.items():
            for image_url in dict.fromkeys(image_urls):
                if image_url in consumed_urls or image_url in existing_image_urls:
                    continue
                session.add(
                    AssetCandidate(
                        run_id=run_id,
                        source_page_id=source_page_id,
                        project_name=project_name,
                        asset_type=type_name,
                        source_url=source.url,
                        image_url=image_url,
                        storage_path=None,
                        perceptual_hash=None,
                        publication_tier=PublicationTier.unknown.value,
                        project_identity=AssociationStatus.unknown.value,
                        asset_association=AssociationStatus.unknown.value,
                        primary_source=PrimarySourceStatus.unknown.value,
                        rights_status=RightsStatus.unknown.value,
                        result_tier=ResultTier.visual_lead.value,
                        relevance=1,
                        subquestion_ids=[subquestion_id] if subquestion_id is not None else [],
                        project_context="",
                        design_mechanism="",
                        transfer_strategy=[],
                        subquestion_analysis={},
                        facts=[],
                        observations=[],
                        inferences=[],
                        limitations=[
                            "该图片来自公共网页结构化解析，尚未完成本地视觉分类和图片—项目归属核验。"
                        ],
                        rank_index=0,
                        expires_at=expires_at,
                    )
                )
                existing_image_urls.add(image_url)
                enriched += 1
        if enriched:
            session.flush()
            _rerank_assets(session, run_id)
        session.commit()
        return enriched


def _classify_remote_public_images(
    db: Database,
    run_id: str,
    pages: Sequence[RemotePublicPageBatchItem],
    classifier: RemoteVisualClassifier,
    *,
    question: str,
    subquestion_id: str | None,
    remaining_seconds: float,
) -> int:
    selected = _remote_public_image_batch(pages, question)
    if not selected or remaining_seconds < classifier.worst_case_remote_batch_seconds:
        return 0

    candidates = [
        RemoteVisualCandidate(
            candidate_id=f"image_{index}",
            image_url=image.url,
            caption=" — ".join(
                part for part in (item["page"].title.strip(), image.alt.strip()) if part
            ),
        )
        for index, (item, image) in enumerate(selected, start=1)
    ]
    batch_fingerprint = hashlib.sha256(
        "\n".join(candidate.image_url for candidate in candidates).encode("utf-8")
    ).hexdigest()
    if _remote_visual_batch_started(db, run_id, batch_fingerprint, subquestion_id):
        return 0
    checkpoint(
        db,
        run_id,
        RunStatus.inspecting,
        {
            "status": "started",
            "batch_fingerprint": batch_fingerprint,
            "subquestion_id": subquestion_id,
            "candidate_count": len(candidates),
            "page_count": len({item["source"].url for item, _ in selected}),
        },
        tool="remote_visual_batch",
    )
    selected_pages = list(dict.fromkeys(item["source"].url for item, _ in selected))
    context_limit = max(1_000, PUBLIC_PAGE_ANALYSIS_TEXT_LIMIT // len(selected_pages))
    page_contexts: list[str] = []
    for source_url in selected_pages:
        item = next(item for item, _ in selected if item["source"].url == source_url)
        page_contexts.append(_public_page_context(item["page"])[:context_limit])
    try:
        result = classifier.classify_remote_batch(
            candidates,
            question=question,
            project_text="\n\n".join(page_contexts)[:PUBLIC_PAGE_ANALYSIS_TEXT_LIMIT],
        )
    except Exception as exc:
        checkpoint(
            db,
            run_id,
            RunStatus.inspecting,
            {
                "status": "failed",
                "batch_fingerprint": batch_fingerprint,
                "subquestion_id": subquestion_id,
                "error_type": type(exc).__name__,
            },
            tool="remote_visual_batch",
        )
        return 0

    added = 0
    for source_url in selected_pages:
        item = next(item for item, _ in selected if item["source"].url == source_url)
        page_candidates = [
            candidate
            for candidate, (candidate_item, _) in zip(candidates, selected, strict=True)
            if candidate_item["source"].url == source_url
        ]
        candidate_ids = {candidate.candidate_id for candidate in page_candidates}
        added += _persist_remote_visual_leads(
            db,
            run_id,
            item["source"],
            item["page"],
            page_candidates,
            [
                classification
                for classification in result.classifications
                if classification.candidate_id in candidate_ids
            ],
            subquestion_id=subquestion_id,
            exact_project_evidence=item["exact_project_evidence"],
        )
    checkpoint(
        db,
        run_id,
        RunStatus.inspecting,
        {
            "status": "completed",
            "batch_fingerprint": batch_fingerprint,
            "subquestion_id": subquestion_id,
            "classified_count": len(result.classifications),
            "added": added,
        },
        tool="remote_visual_batch",
    )
    return added


def _remote_public_image_batch(
    pages: Sequence[RemotePublicPageBatchItem],
    question: str,
) -> list[tuple[RemotePublicPageBatchItem, ParsedPageImage]]:
    unique_pages = list({item["source"].url: item for item in pages}.values())
    ranked_pages = sorted(
        unique_pages,
        key=lambda item: _remote_public_page_sort_key(item, question),
        reverse=True,
    )
    page_images = [
        (
            item,
            sorted(
                _remote_visual_candidate_images(item["page"]),
                key=lambda image: project_image_identity_score(
                    item["page"].title,
                    image.url,
                    image.alt,
                ),
                reverse=True,
            ),
        )
        for item in ranked_pages
    ]
    if len(page_images) == 1:
        item, images = page_images[0]
        return [(item, image) for image in images]

    selected: list[tuple[RemotePublicPageBatchItem, ParsedPageImage]] = []
    selected_urls: set[str] = set()
    max_page_images = max((len(images) for _, images in page_images), default=0)
    for image_index in range(max_page_images):
        for item, images in page_images:
            if image_index >= len(images):
                continue
            image = images[image_index]
            if image.url in selected_urls:
                continue
            selected.append((item, image))
            selected_urls.add(image.url)
            if len(selected) == REMOTE_VISUAL_BATCH_LIMIT:
                return selected
    return selected


def _remote_public_page_sort_key(
    item: RemotePublicPageBatchItem,
    question: str,
) -> tuple[int, int, int, int, int]:
    source = item["source"]
    page = item["page"]
    page_text = " ".join((page.title, page.description, _public_page_analysis_text(page)))
    return (
        int(item["exact_project_evidence"]),
        public_search_relevance_score(
            question,
            title=page.title,
            description=page.description,
            url=source.url,
        ),
        len(_relevance_tokens(page_text) & _relevance_tokens(question)),
        sum(infer_architecture_asset_type(image) is not None for image in page.images),
        PUBLICATION_TIER_STRENGTH[source.publication_tier.value],
    )


def _remote_visual_candidate_images(page: ParsedPublicPage) -> list[ParsedPageImage]:
    type_priority: dict[ArchitectureAssetType | None, int] = {
        ArchitectureAssetType.circulation: 0,
        ArchitectureAssetType.plan: 1,
        ArchitectureAssetType.section: 2,
        ArchitectureAssetType.axonometric: 3,
        ArchitectureAssetType.analysis_diagram: 4,
        ArchitectureAssetType.site_plan: 5,
        ArchitectureAssetType.elevation: 6,
        ArchitectureAssetType.render: 7,
        ArchitectureAssetType.photograph: 8,
        None: 9,
    }
    indexed_images = list(enumerate(page.images))
    typed = sorted(
        (
            (index, image)
            for index, image in indexed_images
            if infer_architecture_asset_type(image) is not None
        ),
        key=lambda item: (
            type_priority[infer_architecture_asset_type(item[1])],
            item[0],
        ),
    )
    selected = [image for _, image in typed[:REMOTE_VISUAL_BATCH_LIMIT]]
    remaining = REMOTE_VISUAL_BATCH_LIMIT - len(selected)
    untyped = [image for _, image in indexed_images if infer_architecture_asset_type(image) is None]
    sample_count = min(remaining, len(untyped))
    if sample_count == 1:
        selected.append(untyped[0])
    elif sample_count > 1:
        last_index = len(untyped) - 1
        selected.extend(
            untyped[round(position * last_index / (sample_count - 1))]
            for position in range(sample_count)
        )
    return selected


def _remote_visual_batch_started(
    db: Database,
    run_id: str,
    batch_fingerprint: str,
    subquestion_id: str | None,
) -> bool:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        events = list(
            session.scalars(
                select(TraceEvent)
                .where(
                    TraceEvent.run_id == run_id,
                    TraceEvent.tool == "remote_visual_batch",
                )
                .order_by(TraceEvent.sequence)
            )
        )
        if any(
            event.retry_count == run.attempt
            and event.summary.get("status") == "started"
            and event.summary.get("subquestion_id") == subquestion_id
            for event in events
        ):
            return True
        matching = [
            event for event in events if event.summary.get("batch_fingerprint") == batch_fingerprint
        ]
        if not matching:
            return False
        latest = matching[-1]
        status = latest.summary.get("status")
        if status in {"started", "completed"}:
            return True
        return status == "failed" and latest.retry_count == run.attempt


def _persist_remote_visual_leads(
    db: Database,
    run_id: str,
    source: ProviderSource,
    page: ParsedPublicPage,
    candidates: list[RemoteVisualCandidate],
    classifications: list[RemoteVisualClassification],
    *,
    subquestion_id: str | None,
    exact_project_evidence: bool,
) -> int:
    candidate_by_id = {candidate.candidate_id: candidate for candidate in candidates}
    accepted = [
        classification
        for classification in classifications
        if classification.asset_type is not None
        and classification.relevance >= REMOTE_VISUAL_MIN_RELEVANCE
        and classification.observations
    ]
    if not accepted:
        return 0

    with db.session_factory() as session:
        existing_by_url = {
            candidate.image_url: candidate
            for candidate in session.scalars(
                select(AssetCandidate).where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.image_url.is_not(None),
                )
            )
            if candidate.image_url is not None
        }
        source_page_id = session.scalar(
            select(SourcePage.id).where(
                SourcePage.run_id == run_id,
                SourcePage.url == source.url,
            )
        )
        expires_at = datetime.now(UTC) + timedelta(days=7)
        project_name = page.title.strip() or source.title.strip() or "待核验项目"
        visual_limitation = "该类型与观察来自低细节远程视觉分类；图片—项目归属和来源仍待核验。"
        project_limitation = (
            "图纸类型与可见观察来自远程视觉分类；项目页仅支持图片归属，首发来源与使用权仍待核验。"
        )
        added = 0
        for classification in accepted:
            candidate = candidate_by_id.get(classification.candidate_id)
            asset_type = classification.asset_type
            if candidate is None or asset_type is None:
                continue
            record = existing_by_url.get(candidate.image_url)
            changed = record is None
            limitation = project_limitation if exact_project_evidence else visual_limitation
            statement = f"{project_name} 项目页直接列出了这张{_asset_type_label(asset_type)}图。"
            if record is None:
                record = AssetCandidate(
                    run_id=run_id,
                    source_page_id=source_page_id,
                    project_name=project_name,
                    asset_type=asset_type.value,
                    source_url=source.url,
                    image_url=candidate.image_url,
                    storage_path=None,
                    perceptual_hash=None,
                    publication_tier=(
                        source.publication_tier.value
                        if exact_project_evidence
                        else PublicationTier.unknown.value
                    ),
                    project_identity=(
                        AssociationStatus.probable.value
                        if exact_project_evidence
                        else AssociationStatus.unknown.value
                    ),
                    asset_association=(
                        AssociationStatus.confirmed.value
                        if exact_project_evidence
                        else AssociationStatus.unknown.value
                    ),
                    primary_source=PrimarySourceStatus.unknown.value,
                    rights_status=RightsStatus.unknown.value,
                    result_tier=(
                        ResultTier.partial.value
                        if exact_project_evidence
                        else ResultTier.visual_lead.value
                    ),
                    relevance=classification.relevance,
                    subquestion_ids=[subquestion_id] if subquestion_id is not None else [],
                    project_context="",
                    design_mechanism="",
                    transfer_strategy=[],
                    subquestion_analysis=(
                        {
                            subquestion_id: {
                                "project_context": "",
                                "design_mechanism": "",
                                "transfer_strategy": [],
                                "observations": classification.observations,
                                "limitations": [limitation],
                            }
                        }
                        if subquestion_id is not None
                        else {}
                    ),
                    facts=[statement] if exact_project_evidence else [],
                    observations=classification.observations,
                    inferences=[],
                    limitations=[limitation],
                    rank_index=0,
                    expires_at=expires_at,
                )
                session.add(record)
                existing_by_url[candidate.image_url] = record
            else:
                observations = list(
                    dict.fromkeys([*record.observations, *classification.observations])
                )
                changed = changed or observations != record.observations
                record.observations = observations
                relevance = max(record.relevance, classification.relevance)
                changed = changed or relevance != record.relevance
                record.relevance = relevance
                if record.result_tier == ResultTier.visual_lead.value:
                    changed = changed or record.asset_type != asset_type.value
                    record.asset_type = asset_type.value
                associations = list(record.subquestion_ids or [])
                if subquestion_id is not None and subquestion_id not in associations:
                    record.subquestion_ids = [*associations, subquestion_id]
                    changed = True

            if subquestion_id is not None:
                analyses = dict(record.subquestion_analysis or {})
                branch = dict(analyses.get(subquestion_id, {}))
                branch_observations = branch.get("observations")
                branch["project_context"] = (
                    branch.get("project_context")
                    if isinstance(branch.get("project_context"), str)
                    else ""
                )
                branch["design_mechanism"] = (
                    branch.get("design_mechanism")
                    if isinstance(branch.get("design_mechanism"), str)
                    else ""
                )
                branch["transfer_strategy"] = (
                    branch.get("transfer_strategy")
                    if isinstance(branch.get("transfer_strategy"), list)
                    else []
                )
                branch["observations"] = list(
                    dict.fromkeys(
                        [
                            *(branch_observations if isinstance(branch_observations, list) else []),
                            *classification.observations,
                        ]
                    )
                )
                branch["limitations"] = [limitation]
                analyses[subquestion_id] = branch
                record.subquestion_analysis = analyses

            if exact_project_evidence:
                previous = (
                    record.source_page_id,
                    record.project_name,
                    record.source_url,
                    record.publication_tier,
                    record.project_identity,
                    record.asset_association,
                    record.result_tier,
                    tuple(record.facts),
                    tuple(record.limitations),
                )
                record.source_page_id = source_page_id
                record.project_name = project_name
                record.source_url = source.url
                if PUBLICATION_TIER_STRENGTH[source.publication_tier.value] > (
                    PUBLICATION_TIER_STRENGTH.get(record.publication_tier, 0)
                ):
                    record.publication_tier = source.publication_tier.value
                if record.project_identity == AssociationStatus.unknown.value:
                    record.project_identity = AssociationStatus.probable.value
                if record.asset_association != AssociationStatus.conflict.value:
                    record.asset_association = AssociationStatus.confirmed.value
                if record.result_tier == ResultTier.visual_lead.value:
                    record.result_tier = ResultTier.partial.value
                record.facts = list(dict.fromkeys([*record.facts, statement]))
                record.limitations = [project_limitation]
                current = (
                    record.source_page_id,
                    record.project_name,
                    record.source_url,
                    record.publication_tier,
                    record.project_identity,
                    record.asset_association,
                    record.result_tier,
                    tuple(record.facts),
                    tuple(record.limitations),
                )
                changed = changed or current != previous
                session.flush()
                claim_exists = session.scalar(
                    select(EvidenceClaim.id).where(
                        EvidenceClaim.asset_candidate_id == record.id,
                        EvidenceClaim.claim_type == "fact",
                        EvidenceClaim.statement == statement,
                        EvidenceClaim.source_url == source.url,
                    )
                )
                if claim_exists is None:
                    session.add(
                        EvidenceClaim(
                            asset_candidate_id=record.id,
                            claim_type="fact",
                            statement=statement,
                            source_url=source.url,
                            text_excerpt=candidate.caption or page.title or None,
                            expires_at=datetime.now(UTC) + timedelta(days=30),
                        )
                    )
                    changed = True
            added += int(changed)
        if added:
            session.flush()
            _rerank_assets(session, run_id)
        session.commit()
        return added


def _public_page_drawings(
    db: Database,
    run_id: str,
    source_url: str,
    page: ParsedPublicPage,
) -> list[PublicPageDrawing]:
    candidate_images = _remote_visual_candidate_images(page)
    image_urls = [image.url for image in candidate_images]
    if not image_urls:
        return []
    with db.session_factory() as session:
        stored_types = {
            candidate.image_url: ArchitectureAssetType(candidate.asset_type)
            for candidate in session.scalars(
                select(AssetCandidate).where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.source_url == source_url,
                    AssetCandidate.image_url.in_(image_urls),
                )
            )
            if candidate.image_url is not None
        }
    drawings: list[PublicPageDrawing] = []
    for image in candidate_images:
        asset_type = (
            stored_types.get(image.url)
            or infer_architecture_asset_type(image)
            or ArchitectureAssetType.photograph
        )
        drawings.append(
            PublicPageDrawing(
                drawing_id=f"drawing_{len(drawings) + 1}",
                asset_type=asset_type,
                image_url=image.url,
                caption=image.alt,
            )
        )
    return drawings


def _public_page_branch_analysis_budget_available(
    attempted_branches: set[tuple[str, str]],
    *,
    subquestion_id: str,
    attempts_before_query: int,
    attempt_limit: int | None,
) -> bool:
    if attempt_limit is None:
        return True
    current_attempts = sum(
        attempted_subquestion_id == subquestion_id
        for _, attempted_subquestion_id in attempted_branches
    )
    return current_attempts - attempts_before_query < attempt_limit


class _PublicPageAnalysisOutcome(NamedTuple):
    added: int
    direct_match: bool | None
    evidence_chain_status: str


def _try_public_page_branch_analysis(
    db: Database,
    run_id: str,
    provider: PublicPageAnalysisProvider,
    source: ProviderSource,
    page: ParsedPublicPage,
    *,
    question: str,
    subquestion_id: str,
    analysis_requirements: Sequence[str],
    attempted_branches: set[tuple[str, str]],
    public_search_provider: PublicSearchProvider | None = None,
    public_page_parser: PublicPageParser | None = None,
    parsed_pages: dict[str, ParsedPublicPage | None] | None = None,
    supplement_attempted: set[str] | None = None,
    supplement_pages: dict[str, list[tuple[ProviderSource, ParsedPublicPage]]] | None = None,
    remaining_seconds: Callable[[], float] | None = None,
) -> int:
    analysis_key = (source.url, subquestion_id)
    if analysis_key in attempted_branches:
        return 0
    drawings = _public_page_drawings(db, run_id, source.url, page)
    attempted_branches.add(analysis_key)
    outcome = _try_public_page_analysis(
        db,
        run_id,
        provider,
        source,
        page,
        drawings,
        question=question,
        subquestion_id=subquestion_id,
        analysis_requirements=analysis_requirements,
    )
    added = outcome.added
    if (
        outcome.direct_match is not True
        or outcome.evidence_chain_status == "complete"
        or public_search_provider is None
        or public_page_parser is None
        or parsed_pages is None
        or supplement_attempted is None
        or supplement_pages is None
        or remaining_seconds is None
    ):
        return added
    return added + _try_project_text_supplement(
        db,
        run_id,
        provider,
        source,
        page,
        question=question,
        subquestion_id=subquestion_id,
        analysis_requirements=analysis_requirements,
        public_search_provider=public_search_provider,
        public_page_parser=public_page_parser,
        parsed_pages=parsed_pages,
        supplement_attempted=supplement_attempted,
        supplement_pages=supplement_pages,
        remaining_seconds=remaining_seconds,
    )


def _try_project_text_supplement(
    db: Database,
    run_id: str,
    provider: PublicPageAnalysisProvider,
    source: ProviderSource,
    page: ParsedPublicPage,
    *,
    question: str,
    subquestion_id: str,
    analysis_requirements: Sequence[str],
    public_search_provider: PublicSearchProvider,
    public_page_parser: PublicPageParser,
    parsed_pages: dict[str, ParsedPublicPage | None],
    supplement_attempted: set[str],
    supplement_pages: dict[str, list[tuple[ProviderSource, ParsedPublicPage]]],
    remaining_seconds: Callable[[], float],
) -> int:
    project_identity = _project_identity_key(source.title or page.title)
    if not project_identity:
        return 0
    if source.publication_tier not in {
        PublicationTier.primary,
        PublicationTier.trusted_secondary,
    } or not is_concrete_project_page(page, source_title=source.title):
        return 0
    project_identities = {
        identity
        for identity in (
            _project_identity_key(source.title),
            _project_identity_key(page.title),
        )
        if identity
    }
    with db.session_factory() as session:
        candidates = list(
            session.scalars(
                select(AssetCandidate)
                .where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.result_tier.in_(
                        [ResultTier.verified.value, ResultTier.partial.value]
                    ),
                )
                .order_by(AssetCandidate.rank_index, AssetCandidate.created_at)
            )
        )
        project_candidates = [
            item
            for item in candidates
            if _project_identity_key(item.project_name) in project_identities
        ]
        project_context = ""
        design_mechanism = ""
        has_transfer_strategy = False
        has_project_mechanism = False
        for candidate in project_candidates:
            analyses = candidate.subquestion_analysis or {}
            has_project_mechanism = has_project_mechanism or bool(
                candidate.design_mechanism.strip()
            )
            for candidate_branch in analyses.values():
                if not isinstance(candidate_branch, dict):
                    continue
                mechanism = candidate_branch.get("design_mechanism")
                has_project_mechanism = has_project_mechanism or bool(
                    isinstance(mechanism, str) and mechanism.strip()
                )
            branch = analyses.get(subquestion_id, {})
            if not isinstance(branch, dict):
                continue
            context = branch.get("project_context")
            mechanism = branch.get("design_mechanism")
            transfer = branch.get("transfer_strategy")
            if not project_context and isinstance(context, str):
                project_context = context.strip()
            if not design_mechanism and isinstance(mechanism, str):
                design_mechanism = mechanism.strip()
            has_transfer_strategy = has_transfer_strategy or bool(
                isinstance(transfer, list) and transfer
            )
        if project_context and design_mechanism and has_transfer_strategy:
            return 0

    supporting_pages = next(
        (
            supplement_pages[identity]
            for identity in project_identities
            if identity in supplement_pages
        ),
        None,
    )
    if supporting_pages is None:
        if project_identities & supplement_attempted:
            return 0
        search_domains = _project_text_supplement_domains(source.url)
        search_reserve = _public_search_worst_case_seconds(public_search_provider) * len(
            search_domains
        )
        parser_reserve = float(getattr(public_page_parser, "worst_case_call_seconds", 0.0))
        required_seconds = (
            search_reserve
            + parser_reserve * PROJECT_TEXT_SUPPLEMENT_PAGE_LIMIT
            + provider.worst_case_page_analysis_seconds
        )
        if remaining_seconds() < required_seconds:
            return 0
        supplement_attempted.update(project_identities)
        project_name = _project_display_name(source.title or page.title)
        supplement_query = _project_text_supplement_query(project_name, question)
        supplement_sources: list[ProviderSource] = []
        primary_titles = [source.title, page.title]
        for domain in search_domains:
            remaining_limit = PROJECT_TEXT_SUPPLEMENT_PAGE_LIMIT - len(supplement_sources)
            if remaining_limit <= 0:
                break
            domain_sources = _try_public_search(
                db,
                run_id,
                public_search_provider,
                supplement_query,
                [domain],
                limit=remaining_limit,
                purpose="project_text_supplement",
            )
            matching_sources = [
                candidate
                for candidate in domain_sources
                if not _project_identity_key(candidate.title)
                or any(
                    _same_project_identity(candidate.title, primary_title)
                    for primary_title in primary_titles
                )
            ]
            supplement_sources = _merge_source_lists(
                supplement_sources,
                matching_sources,
            )[:PROJECT_TEXT_SUPPLEMENT_PAGE_LIMIT]
        _persist_sources(
            db,
            run_id,
            ProviderSearchResult(sources=supplement_sources, assets=[]),
        )
        supporting_pages = []
        for supplement_source in supplement_sources:
            if supplement_source.url == source.url:
                continue
            if _project_identity_key(supplement_source.title) and not any(
                _same_project_identity(supplement_source.title, primary_title)
                for primary_title in primary_titles
            ):
                continue
            if supplement_source.url in parsed_pages:
                supplement_page = parsed_pages[supplement_source.url]
            else:
                try:
                    supplement_page = public_page_parser.parse(supplement_source.url)
                except Exception as exc:
                    parsed_pages[supplement_source.url] = None
                    checkpoint(
                        db,
                        run_id,
                        RunStatus.inspecting,
                        {
                            "source_url": _redacted_trace_url(supplement_source.url),
                            "status": "failed",
                            "error_type": type(exc).__name__,
                            "purpose": "project_text_supplement",
                        },
                        tool=public_page_parser.name,
                    )
                    continue
                parsed_pages[supplement_source.url] = supplement_page
            if supplement_page is None:
                continue
            if not any(
                _same_project_identity(supplement_page.title, primary_title)
                for primary_title in primary_titles
            ):
                continue
            if supplement_source.publication_tier not in {
                PublicationTier.primary,
                PublicationTier.trusted_secondary,
            } or not is_concrete_project_page(
                supplement_page,
                source_title=supplement_source.title,
            ):
                continue
            supporting_pages.append((supplement_source, supplement_page))
            checkpoint(
                db,
                run_id,
                RunStatus.inspecting,
                {
                    "source_url": _redacted_trace_url(supplement_source.url),
                    "status": "completed",
                    "markdown_chars": len(supplement_page.markdown),
                    "purpose": "project_text_supplement",
                },
                tool=public_page_parser.name,
            )
        for identity in project_identities:
            supplement_pages[identity] = supporting_pages

    if not supporting_pages or remaining_seconds() < provider.worst_case_page_analysis_seconds:
        return 0
    evidence_pages = [(source, page), *supporting_pages]
    bundled_page = ParsedPublicPage(
        source_url=source.url,
        title=page.title,
        markdown=_project_evidence_bundle_text(evidence_pages),
        images=[],
    )
    return _try_public_page_analysis(
        db,
        run_id,
        provider,
        source,
        bundled_page,
        [],
        question=question,
        subquestion_id=subquestion_id,
        analysis_requirements=analysis_requirements,
        evidence_pages=evidence_pages,
    ).added


def _project_text_supplement_domains(source_url: str) -> list[str]:
    source_host = (urlparse(source_url).hostname or "").casefold().removeprefix("www.")
    preferred = ("archdaily.com", "designboom.com", "dezeen.com")
    return [
        domain
        for domain in preferred
        if source_host != domain and not source_host.endswith(f".{domain}")
    ][:2]


def _project_text_supplement_query(project_name: str, question: str) -> str:
    safe_project_name = project_name.replace('"', "").strip()[:200]
    normalized_question = question.casefold()
    if any(
        term in normalized_question
        for term in (
            "公共界面",
            "共享大厅",
            "室内外连续",
            "public interface",
            "shared lobby",
            "indoor-outdoor",
        )
    ):
        focus = "public interface shared lobby"
    else:
        focus = {
            "interface": "structure detail",
            "program": "program insertion",
            "flow": "public service circulation",
            "daylight": "daylight skylight",
            "section": "section mezzanine",
        }.get(infer_research_issue_intent(question), "design mechanism")
    return f'"{safe_project_name}" {focus}'[:500]


def _project_evidence_bundle_text(
    evidence_pages: Sequence[tuple[ProviderSource, ParsedPublicPage]],
) -> str:
    page_limit = max(1_000, PUBLIC_PAGE_ANALYSIS_TEXT_LIMIT // len(evidence_pages) - 300)
    chunks = []
    for index, (source, page) in enumerate(evidence_pages, start=1):
        chunks.append(
            "\n".join(
                (
                    f"[SOURCE {index}]",
                    f"URL: {source.url}",
                    f"TITLE: {page.title}",
                    _public_page_analysis_text(page)[:page_limit],
                )
            )
        )
    return "\n\n".join(chunks)[:PUBLIC_PAGE_ANALYSIS_TEXT_LIMIT]


def _try_article_ready_page_branch_reuse(
    db: Database,
    run_id: str,
    provider: PublicPageAnalysisProvider,
    parsed_pages: dict[str, ParsedPublicPage | None],
    *,
    question: str,
    subquestion_id: str,
    analysis_requirements: Sequence[str],
    attempted_branches: set[tuple[str, str]],
    public_search_provider: PublicSearchProvider | None,
    public_page_parser: PublicPageParser | None,
    supplement_attempted: set[str],
    supplement_pages: dict[str, list[tuple[ProviderSource, ParsedPublicPage]]],
    remaining_seconds: Callable[[], float],
    include_unanalyzed_pages: bool = False,
) -> tuple[bool, int]:
    seen_sources: set[str] = set()
    preferred_types = _preferred_public_page_drawing_types(question)
    options: list[tuple[tuple[int, int, int], ProviderSource, ParsedPublicPage]] = []
    cases = _research_synthesis_cases(db, run_id)
    for case_index, case in enumerate(cases):
        if case.source_url in seen_sources:
            continue
        seen_sources.add(case.source_url)
        page = parsed_pages.get(case.source_url)
        if page is None or (case.source_url, subquestion_id) in attempted_branches:
            continue
        source = ProviderSource(
            url=case.source_url,
            title=case.project_name,
            publisher=urlparse(case.source_url).hostname or "",
            publication_tier=_inferred_publication_tier(case.source_url),
        )
        drawings = _public_page_drawings(db, run_id, case.source_url, page)
        options.append(
            (
                (
                    sum(drawing.asset_type in preferred_types for drawing in drawings),
                    len(drawings),
                    -case_index,
                ),
                source,
                page,
            )
        )
    if include_unanalyzed_pages:
        for page_index, (source_url, page) in enumerate(parsed_pages.items(), start=len(cases)):
            if (
                source_url in seen_sources
                or page is None
                or (source_url, subquestion_id) in attempted_branches
            ):
                continue
            publication_tier = _inferred_publication_tier(source_url)
            if publication_tier not in {
                PublicationTier.primary,
                PublicationTier.trusted_secondary,
            } or not is_concrete_project_page(page, source_title=page.title):
                continue
            source = ProviderSource(
                url=source_url,
                title=page.title,
                publisher=urlparse(source_url).hostname or "",
                publication_tier=publication_tier,
            )
            drawings = _public_page_drawings(db, run_id, source_url, page)
            options.append(
                (
                    (
                        sum(drawing.asset_type in preferred_types for drawing in drawings),
                        len(drawings),
                        -page_index,
                    ),
                    source,
                    page,
                )
            )
    if not options:
        return False, 0
    _, source, page = max(options, key=lambda item: item[0])
    added = _try_public_page_branch_analysis(
        db,
        run_id,
        provider,
        source,
        page,
        question=question,
        subquestion_id=subquestion_id,
        analysis_requirements=analysis_requirements,
        attempted_branches=attempted_branches,
        public_search_provider=public_search_provider,
        public_page_parser=public_page_parser,
        parsed_pages=parsed_pages,
        supplement_attempted=supplement_attempted,
        supplement_pages=supplement_pages,
        remaining_seconds=remaining_seconds,
    )
    return True, added


def _try_cached_multi_drawing_page_enrichment(
    db: Database,
    run_id: str,
    provider: PublicPageAnalysisProvider,
    parsed_pages: dict[str, ParsedPublicPage | None],
    *,
    subquestions: Sequence[ResearchSubquestion],
    analysis_requirements: Sequence[str],
    attempted_branches: set[tuple[str, str]],
) -> bool:
    options: list[
        tuple[
            tuple[int, int, int, int, int],
            ProviderSource,
            ParsedPublicPage,
            ResearchSubquestion,
        ]
    ] = []
    for page_index, (source_url, page) in enumerate(parsed_pages.items()):
        if page is None:
            continue
        publication_tier = _inferred_publication_tier(source_url)
        if publication_tier not in {
            PublicationTier.primary,
            PublicationTier.trusted_secondary,
        } or not is_concrete_project_page(page, source_title=page.title):
            continue
        drawings = _public_page_drawings(db, run_id, source_url, page)
        distinct_types = {drawing.asset_type for drawing in drawings}
        if len(distinct_types) < 2:
            continue
        page_intent = infer_research_issue_intent(f"{page.title}\n{page.markdown}")
        source = ProviderSource(
            url=source_url,
            title=page.title,
            publisher=urlparse(source_url).hostname or "",
            publication_tier=publication_tier,
        )
        for subquestion_index, subquestion in enumerate(subquestions):
            if (source_url, subquestion.id) in attempted_branches:
                continue
            subquestion_intent = infer_research_issue_intent(subquestion.question)
            if (
                page_intent != "other"
                and subquestion_intent != "other"
                and page_intent != subquestion_intent
            ):
                continue
            preferred_types = _preferred_public_page_drawing_types(subquestion.question)
            options.append(
                (
                    (
                        int(page_intent == subquestion_intent != "other"),
                        len(distinct_types & preferred_types),
                        len(distinct_types),
                        -page_index,
                        -subquestion_index,
                    ),
                    source,
                    page,
                    subquestion,
                )
            )
    if not options:
        return False
    _, source, page, subquestion = max(options, key=lambda item: item[0])
    _try_public_page_branch_analysis(
        db,
        run_id,
        provider,
        source,
        page,
        question=subquestion.question,
        subquestion_id=subquestion.id,
        analysis_requirements=analysis_requirements,
        attempted_branches=attempted_branches,
    )
    return True


def _preferred_public_page_drawing_types(
    question: str,
) -> set[ArchitectureAssetType]:
    return {
        "interface": {
            ArchitectureAssetType.section,
            ArchitectureAssetType.axonometric,
            ArchitectureAssetType.elevation,
        },
        "flow": {
            ArchitectureAssetType.circulation,
            ArchitectureAssetType.plan,
            ArchitectureAssetType.site_plan,
            ArchitectureAssetType.section,
        },
        "daylight": {
            ArchitectureAssetType.section,
            ArchitectureAssetType.plan,
            ArchitectureAssetType.axonometric,
        },
        "program": {
            ArchitectureAssetType.plan,
            ArchitectureAssetType.section,
            ArchitectureAssetType.axonometric,
        },
        "section": {
            ArchitectureAssetType.section,
            ArchitectureAssetType.axonometric,
        },
    }.get(infer_research_issue_intent(question), set())


def _project_display_name(value: str) -> str:
    normalized = " ".join(value.split()).strip()
    if not normalized:
        return "项目正文案例"
    return re.split(r"\s+(?:/|\||—|–)\s+", normalized, maxsplit=1)[0].strip()


def _project_identity_key(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9\u4e00-\u9fff]+", _project_display_name(value).casefold()))


def _same_project_identity(left: str, right: str) -> bool:
    left_key = _project_identity_key(left)
    right_key = _project_identity_key(right)
    if not left_key or not right_key:
        return False
    if left_key == right_key:
        return True
    left_tokens = set(left_key.split())
    right_tokens = set(right_key.split())
    if min(len(left_tokens), len(right_tokens)) >= 2 and (
        left_key in right_key or right_key in left_key
    ):
        return True
    if min(len(left_tokens), len(right_tokens)) < 5:
        return False
    shared = left_tokens & right_tokens
    return len(shared) >= 3 and len(shared) / min(len(left_tokens), len(right_tokens)) >= 0.6


def _supported_project_facts(
    evidence_pages: Sequence[tuple[ProviderSource, ParsedPublicPage]],
    facts: Sequence[PublicPageSupportedFact],
) -> list[tuple[PublicPageSupportedFact, str]]:
    normalized_pages = [
        (source.url, " ".join(_public_page_analysis_text(page).split()))
        for source, page in evidence_pages
    ]
    supported: list[tuple[PublicPageSupportedFact, str]] = []
    seen: set[tuple[str, str]] = set()
    for fact in facts:
        excerpt = " ".join(fact.text_excerpt.split())
        source_url = next(
            (url for url, normalized_text in normalized_pages if excerpt in normalized_text),
            None,
        )
        key = (fact.statement, source_url or "")
        if source_url is None or key in seen:
            continue
        seen.add(key)
        supported.append((fact, source_url))
    return supported


def _public_page_evidence_chain_status(
    evidence_pages: Sequence[tuple[ProviderSource, ParsedPublicPage]],
    analysis: PublicPageAnalysis,
) -> tuple[str, int]:
    if not analysis.direct_match:
        return "not_direct_match", 0
    supported_facts = _supported_project_facts(evidence_pages, analysis.facts)
    supported_statements = {fact.statement for fact, _ in supported_facts}
    has_context = analysis.project_context in supported_statements
    has_mechanism = analysis.design_mechanism in supported_statements
    if has_context and has_mechanism and analysis.transfer_strategy:
        return "complete", len(supported_facts)
    if supported_facts:
        return "partial", len(supported_facts)
    return "no_verbatim_facts", 0


def _try_public_page_analysis(
    db: Database,
    run_id: str,
    provider: PublicPageAnalysisProvider,
    source: ProviderSource,
    page: ParsedPublicPage,
    drawings: list[PublicPageDrawing],
    *,
    question: str,
    subquestion_id: str,
    analysis_requirements: Sequence[str],
    evidence_pages: Sequence[tuple[ProviderSource, ParsedPublicPage]] | None = None,
) -> _PublicPageAnalysisOutcome:
    fallback_error_type: str | None = None
    analysis: PublicPageAnalysis | None = None
    try:
        analysis = provider.analyze_public_page(
            question=_public_page_analysis_question(question),
            source_url=source.url,
            title=page.title,
            page_text=_public_page_analysis_text(page),
            drawings=drawings,
            analysis_requirements=analysis_requirements,
        )
    except Exception as exc:
        if is_recoverable_public_page_analysis_error(exc):
            analysis = deterministic_public_page_analysis(
                question=question,
                title=page.title,
                page_text=_public_page_analysis_text(page),
                drawings=drawings,
            )
            if analysis is not None:
                fallback_error_type = type(exc).__name__
        if analysis is None:
            checkpoint(
                db,
                run_id,
                RunStatus.analyzing,
                {
                    "source_url": _redacted_trace_url(source.url),
                    "subquestion_id": subquestion_id,
                    "status": "failed",
                    "error_type": type(exc).__name__,
                },
                tool="public_page_analysis",
            )
            return _PublicPageAnalysisOutcome(0, None, "analysis_failed")
    assert analysis is not None
    project_pages = list(evidence_pages or [(source, page)])
    evidence_chain_status, supported_fact_count = _public_page_evidence_chain_status(
        project_pages,
        analysis,
    )
    added = _persist_public_page_analysis(
        db,
        run_id,
        source,
        page,
        drawings,
        analysis,
        question=question,
        subquestion_id=subquestion_id,
        evidence_pages=evidence_pages,
    )
    summary: dict[str, object] = {
        "source_url": _redacted_trace_url(source.url),
        "subquestion_id": subquestion_id,
        "status": "completed",
        "relevance": analysis.relevance,
        "drawing_count": len(analysis.drawing_ids),
        "enriched": added,
        "source_count": len(project_pages),
        "direct_match": analysis.direct_match,
        "supported_fact_count": supported_fact_count,
        "evidence_chain_status": evidence_chain_status,
    }
    if fallback_error_type is not None:
        summary.update(
            {
                "generation_mode": "deterministic_fallback",
                "provider_error_type": fallback_error_type,
            }
        )
    checkpoint(db, run_id, RunStatus.analyzing, summary, tool="public_page_analysis")
    return _PublicPageAnalysisOutcome(
        added,
        analysis.direct_match,
        evidence_chain_status,
    )


def _persist_public_page_analysis(
    db: Database,
    run_id: str,
    source: ProviderSource,
    page: ParsedPublicPage,
    drawings: list[PublicPageDrawing],
    analysis: PublicPageAnalysis,
    *,
    question: str,
    subquestion_id: str,
    evidence_pages: Sequence[tuple[ProviderSource, ParsedPublicPage]] | None = None,
) -> int:
    if not analysis.direct_match:
        return 0
    drawing_by_id = {drawing.drawing_id: drawing for drawing in drawings}
    selected_urls = {
        drawing_by_id[drawing_id].image_url
        for drawing_id in analysis.drawing_ids
        if drawing_id in drawing_by_id
    }
    project_pages = list(evidence_pages or [(source, page)])
    supported_facts = _supported_project_facts(project_pages, analysis.facts)
    supported_statements = list(dict.fromkeys(fact.statement for fact, _ in supported_facts))
    supported_statement_set = set(supported_statements)
    supported_context = (
        analysis.project_context if analysis.project_context in supported_statement_set else ""
    )
    supported_mechanism = (
        analysis.design_mechanism if analysis.design_mechanism in supported_statement_set else ""
    )
    supported_transfer = analysis.transfer_strategy if supported_mechanism else []
    has_supported_analysis = bool(supported_context or supported_mechanism)
    effective_relevance = (
        max(analysis.relevance, 2) if has_supported_analysis else analysis.relevance
    )
    if effective_relevance < 2:
        return 0
    if not selected_urls and supported_context and supported_mechanism and supported_transfer:
        preferred_types = _preferred_public_page_drawing_types(question)
        audit_drawing = next(
            (drawing for drawing in drawings if drawing.asset_type in preferred_types),
            drawings[0] if drawings else None,
        )
        if audit_drawing is not None:
            selected_urls = {audit_drawing.image_url}
    if not selected_urls and not has_supported_analysis:
        return 0
    with db.session_factory() as session:
        source_candidates = list(
            session.scalars(
                select(AssetCandidate)
                .where(
                    AssetCandidate.run_id == run_id,
                    AssetCandidate.source_url == source.url,
                )
                .order_by(AssetCandidate.rank_index, AssetCandidate.created_at)
            )
        )
        verified_project_name = next(
            (
                candidate.project_name.strip()
                for candidate in source_candidates
                if candidate.project_name.strip() and candidate.project_name.strip() != "待核验项目"
            ),
            _project_display_name(
                page.title.strip() or source.title.strip() or analysis.project_name_zh.strip()
            ),
        )
        candidates = [
            candidate for candidate in source_candidates if candidate.image_url in selected_urls
        ]
        if has_supported_analysis and selected_urls:
            existing_urls = {candidate.image_url for candidate in source_candidates}
            missing_drawings = [
                drawing
                for drawing in drawings
                if drawing.image_url in selected_urls and drawing.image_url not in existing_urls
            ]
            if missing_drawings:
                source_page_id = session.scalar(
                    select(SourcePage.id).where(
                        SourcePage.run_id == run_id,
                        SourcePage.url == source.url,
                    )
                )
                missing_candidates = [
                    AssetCandidate(
                        run_id=run_id,
                        source_page_id=source_page_id,
                        project_name=verified_project_name,
                        asset_type=drawing.asset_type.value,
                        source_url=source.url,
                        image_url=drawing.image_url,
                        storage_path=None,
                        perceptual_hash=None,
                        publication_tier=source.publication_tier.value,
                        project_identity=AssociationStatus.confirmed.value,
                        asset_association=AssociationStatus.unknown.value,
                        primary_source=PrimarySourceStatus.unknown.value,
                        rights_status=RightsStatus.unknown.value,
                        result_tier=ResultTier.partial.value,
                        relevance=effective_relevance,
                        subquestion_ids=[],
                        project_context="",
                        design_mechanism="",
                        transfer_strategy=[],
                        subquestion_analysis={},
                        facts=[],
                        observations=[],
                        inferences=[],
                        limitations=["该案例由项目正文支持；图片仅作为同源项目预览。"],
                        rank_index=len(source_candidates) + index,
                        expires_at=datetime.now(UTC) + timedelta(days=7),
                    )
                    for index, drawing in enumerate(missing_drawings)
                ]
                session.add_all(missing_candidates)
                session.flush()
                candidates.extend(missing_candidates)
        if not candidates and has_supported_analysis and source_candidates:
            candidates = [source_candidates[0]]
        if not candidates and has_supported_analysis:
            project_identity = _project_identity_key(page.title or source.title)
            project_candidates = list(
                session.scalars(
                    select(AssetCandidate)
                    .where(
                        AssetCandidate.run_id == run_id,
                        AssetCandidate.result_tier.in_(
                            [ResultTier.verified.value, ResultTier.partial.value]
                        ),
                        AssetCandidate.project_identity == AssociationStatus.confirmed.value,
                    )
                    .order_by(AssetCandidate.rank_index, AssetCandidate.created_at)
                )
            )
            candidates = [
                candidate
                for candidate in project_candidates
                if _project_identity_key(candidate.project_name) == project_identity
            ][:1]
        if not candidates and has_supported_analysis:
            source_page_id = session.scalar(
                select(SourcePage.id).where(
                    SourcePage.run_id == run_id,
                    SourcePage.url == source.url,
                )
            )
            preview_drawings: list[PublicPageDrawing | None] = [
                drawing for drawing in drawings if drawing.image_url in selected_urls
            ] or [None]
            text_cases = [
                AssetCandidate(
                    run_id=run_id,
                    source_page_id=source_page_id,
                    project_name=_project_display_name(
                        page.title.strip() or source.title.strip() or "项目正文案例"
                    ),
                    asset_type=(
                        preview_drawing.asset_type.value
                        if preview_drawing is not None
                        else ArchitectureAssetType.photograph.value
                    ),
                    source_url=source.url,
                    image_url=(preview_drawing.image_url if preview_drawing is not None else None),
                    storage_path=None,
                    perceptual_hash=None,
                    publication_tier=source.publication_tier.value,
                    project_identity=AssociationStatus.confirmed.value,
                    asset_association=AssociationStatus.unknown.value,
                    primary_source=PrimarySourceStatus.unknown.value,
                    rights_status=RightsStatus.unknown.value,
                    result_tier=ResultTier.partial.value,
                    relevance=effective_relevance,
                    subquestion_ids=[],
                    project_context="",
                    design_mechanism="",
                    transfer_strategy=[],
                    subquestion_analysis={},
                    facts=[],
                    observations=[],
                    inferences=[],
                    limitations=[
                        "该案例由项目正文支持；图片仅作为同源项目预览。"
                        if preview_drawing is not None
                        else "该案例由项目正文支持；当前未保存项目预览图。"
                    ],
                    rank_index=rank_index,
                    expires_at=datetime.now(UTC) + timedelta(days=7),
                )
                for rank_index, preview_drawing in enumerate(preview_drawings)
            ]
            session.add_all(text_cases)
            session.flush()
            candidates = text_cases
        changed = 0
        for candidate in candidates:
            before = (
                candidate.project_name,
                candidate.project_context,
                candidate.design_mechanism,
                tuple(candidate.transfer_strategy or []),
                tuple(candidate.facts or []),
                tuple(candidate.inferences or []),
                tuple(candidate.limitations or []),
                tuple(candidate.subquestion_ids or []),
                dict((candidate.subquestion_analysis or {}).get(subquestion_id, {})),
            )
            if candidate.project_name.strip() == "待核验项目":
                candidate.project_name = verified_project_name
            if supported_context and not candidate.project_context:
                candidate.project_context = supported_context
            if supported_mechanism and not candidate.design_mechanism:
                candidate.design_mechanism = supported_mechanism
            candidate.relevance = max(candidate.relevance, effective_relevance)
            candidate.transfer_strategy = list(
                dict.fromkeys([*(candidate.transfer_strategy or []), *supported_transfer])
            )
            candidate.facts = list(dict.fromkeys([*(candidate.facts or []), *supported_statements]))
            candidate.inferences = list(
                dict.fromkeys(
                    [
                        *(candidate.inferences or []),
                        *([supported_mechanism] if supported_mechanism else []),
                    ]
                )
            )
            candidate.limitations = list(
                dict.fromkeys([*(candidate.limitations or []), *analysis.limitations])
            )
            branch_analyses = dict(candidate.subquestion_analysis or {})
            branch = dict(branch_analyses.get(subquestion_id, {}))
            branch["project_context"] = supported_context or (
                branch.get("project_context")
                if isinstance(branch.get("project_context"), str)
                else ""
            )
            branch["design_mechanism"] = supported_mechanism or (
                branch.get("design_mechanism")
                if isinstance(branch.get("design_mechanism"), str)
                else ""
            )
            incoming_project_name_zh = (getattr(analysis, "project_name_zh", "") or "").strip()
            branch["project_name_zh"] = incoming_project_name_zh or (
                branch.get("project_name_zh")
                if isinstance(branch.get("project_name_zh"), str)
                else ""
            )
            for field, incoming in (
                ("transfer_strategy", supported_transfer),
                ("limitations", analysis.limitations),
            ):
                existing = branch.get(field)
                branch[field] = list(
                    dict.fromkeys([*(existing if isinstance(existing, list) else []), *incoming])
                )
            observations = branch.get("observations")
            branch["observations"] = observations if isinstance(observations, list) else []
            branch_analyses[subquestion_id] = branch
            candidate.subquestion_analysis = branch_analyses
            branch_complete = bool(
                branch["project_context"]
                and branch["design_mechanism"]
                and branch["transfer_strategy"]
            )
            if branch_complete and subquestion_id not in (candidate.subquestion_ids or []):
                candidate.subquestion_ids = [
                    *(candidate.subquestion_ids or []),
                    subquestion_id,
                ]

            for fact, fact_source_url in supported_facts:
                existing_claim = session.scalar(
                    select(EvidenceClaim.id).where(
                        EvidenceClaim.asset_candidate_id == candidate.id,
                        EvidenceClaim.claim_type == "fact",
                        EvidenceClaim.statement == fact.statement,
                        EvidenceClaim.source_url == fact_source_url,
                    )
                )
                if existing_claim is None:
                    session.add(
                        EvidenceClaim(
                            asset_candidate_id=candidate.id,
                            claim_type="fact",
                            statement=fact.statement,
                            source_url=fact_source_url,
                            text_excerpt=fact.text_excerpt,
                            expires_at=datetime.now(UTC) + timedelta(days=30),
                        )
                    )
            after = (
                candidate.project_name,
                candidate.project_context,
                candidate.design_mechanism,
                tuple(candidate.transfer_strategy or []),
                tuple(candidate.facts or []),
                tuple(candidate.inferences or []),
                tuple(candidate.limitations or []),
                tuple(candidate.subquestion_ids or []),
                dict((candidate.subquestion_analysis or {}).get(subquestion_id, {})),
            )
            changed += int(after != before)
        if changed:
            _rerank_assets(session, run_id)
        session.commit()
        return changed


def _public_page_analysis_text(page: ParsedPublicPage) -> str:
    return "\n".join(
        value
        for value in (page.title.strip(), page.description.strip(), page.markdown.strip())
        if value
    )[:PUBLIC_PAGE_ANALYSIS_TEXT_LIMIT]


def _public_page_analysis_question(question: str) -> str:
    return question.strip()


def _public_page_context(page: ParsedPublicPage | None) -> str:
    if page is None:
        return ""
    return " ".join(
        value
        for value in (
            page.title.strip(),
            page.description.strip(),
            page.markdown.strip(),
        )
        if value
    )[:1_200]


def _persist_expanded_project_page(
    db: Database,
    run_id: str,
    source: ProviderSource,
    page: ParsedPublicPage,
    *,
    subquestion_id: str | None,
) -> int:
    project_name = page.title.strip()
    typed_images = [(image, infer_architecture_asset_type(image)) for image in page.images]
    typed_images = [(image, asset_type) for image, asset_type in typed_images if asset_type]
    if not project_name or not typed_images:
        return 0

    with db.session_factory() as session:
        source_page_id = session.scalar(
            select(SourcePage.id).where(
                SourcePage.run_id == run_id,
                SourcePage.url == source.url,
            )
        )
        existing_assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        existing_by_image: dict[str, AssetCandidate] = {}
        for existing_candidate in existing_assets:
            if existing_candidate.image_url is None:
                continue
            current = existing_by_image.get(existing_candidate.image_url)
            current_priority = (
                (
                    current.source_url == source.url,
                    current.result_tier == ResultTier.visual_lead.value,
                )
                if current is not None
                else (False, False)
            )
            candidate_priority = (
                existing_candidate.source_url == source.url,
                existing_candidate.result_tier == ResultTier.visual_lead.value,
            )
            if current is None or candidate_priority > current_priority:
                existing_by_image[existing_candidate.image_url] = existing_candidate

        expires_at = datetime.now(UTC) + timedelta(days=7)
        promoted = 0
        for image, asset_type in typed_images:
            assert asset_type is not None
            verbatim_alt = image.alt.strip()
            has_verbatim_evidence = bool(verbatim_alt)
            statement = (
                f"{project_name} 项目页直接列出了这张{_asset_type_label(asset_type)}图。"
                if has_verbatim_evidence
                else (
                    f"{project_name} 项目页中观察到一张{_asset_type_label(asset_type)}图；"
                    "类型来自图像 URL 线索。"
                )
            )
            limitations = ["项目页支持图片归属，但首发来源与使用权仍待核验。"]
            if not has_verbatim_evidence:
                limitations.append("图纸类型仅由图像 URL 线索判定，未获得逐字替代文本。")
            candidate = existing_by_image.get(image.url)
            changed = candidate is None
            if candidate is None:
                candidate = AssetCandidate(
                    run_id=run_id,
                    source_page_id=source_page_id,
                    project_name=project_name,
                    asset_type=asset_type.value,
                    source_url=source.url,
                    image_url=image.url,
                    storage_path=None,
                    perceptual_hash=None,
                    publication_tier=source.publication_tier.value,
                    project_identity=AssociationStatus.probable.value,
                    asset_association=AssociationStatus.confirmed.value,
                    primary_source=PrimarySourceStatus.unknown.value,
                    rights_status=RightsStatus.unknown.value,
                    result_tier=ResultTier.partial.value,
                    relevance=2,
                    subquestion_ids=([subquestion_id] if subquestion_id is not None else []),
                    project_context="",
                    design_mechanism="",
                    transfer_strategy=[],
                    subquestion_analysis={},
                    facts=([statement] if has_verbatim_evidence else []),
                    observations=([] if has_verbatim_evidence else [statement]),
                    inferences=[],
                    limitations=limitations,
                    rank_index=0,
                    expires_at=expires_at,
                )
                session.add(candidate)
                session.flush()
                existing_by_image[image.url] = candidate
            else:
                changed = changed or candidate.result_tier == ResultTier.visual_lead.value
                candidate.source_page_id = source_page_id
                candidate.project_name = project_name
                candidate.asset_type = asset_type.value
                candidate.source_url = source.url
                candidate.publication_tier = source.publication_tier.value
                candidate.project_identity = AssociationStatus.probable.value
                candidate.asset_association = AssociationStatus.confirmed.value
                candidate.primary_source = PrimarySourceStatus.unknown.value
                candidate.result_tier = ResultTier.partial.value
                candidate.relevance = max(candidate.relevance, 2)
                if has_verbatim_evidence:
                    candidate.facts = list(dict.fromkeys([*candidate.facts, statement]))
                else:
                    candidate.observations = list(
                        dict.fromkeys([*candidate.observations, statement])
                    )
                candidate.limitations = limitations
                associations = list(candidate.subquestion_ids or [])
                if subquestion_id is not None and subquestion_id not in associations:
                    candidate.subquestion_ids = [*associations, subquestion_id]
                    changed = True

            claim_type = "fact" if has_verbatim_evidence else "observation"
            claim_source_url = source.url if has_verbatim_evidence else image.url
            existing_claim = session.scalar(
                select(EvidenceClaim.id).where(
                    EvidenceClaim.asset_candidate_id == candidate.id,
                    EvidenceClaim.claim_type == claim_type,
                    EvidenceClaim.statement == statement,
                    EvidenceClaim.source_url == claim_source_url,
                )
            )
            if existing_claim is None:
                session.add(
                    EvidenceClaim(
                        asset_candidate_id=candidate.id,
                        claim_type=claim_type,
                        statement=statement,
                        source_url=claim_source_url,
                        text_excerpt=verbatim_alt or None,
                        image_region=(
                            None
                            if has_verbatim_evidence
                            else {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0}
                        ),
                        expires_at=datetime.now(UTC) + timedelta(days=30),
                    )
                )
                changed = True
            promoted += int(changed)
        if promoted:
            _rerank_assets(session, run_id)
        session.commit()
        return promoted


def _asset_type_label(asset_type: ArchitectureAssetType) -> str:
    return {
        ArchitectureAssetType.plan: "平面",
        ArchitectureAssetType.section: "剖面",
        ArchitectureAssetType.elevation: "立面",
        ArchitectureAssetType.site_plan: "总平面",
        ArchitectureAssetType.axonometric: "轴测",
        ArchitectureAssetType.circulation: "流线",
        ArchitectureAssetType.analysis_diagram: "分析",
        ArchitectureAssetType.render: "效果",
        ArchitectureAssetType.photograph: "建筑照片",
    }[asset_type]


def _constrain_sparse_visual_platform_result(
    result: ProviderSearchResult,
) -> ProviderSearchResult:
    sources = [
        (
            source.model_copy(update={"publication_tier": PublicationTier.aggregator})
            if _is_sparse_visual_platform_url(source.url)
            else source
        )
        for source in result.sources
        if not _is_removed_visual_source_url(source.url)
    ]
    assets: list[ProviderAsset] = []
    for item in result.assets:
        if _is_removed_visual_source_url(item.source_url):
            continue
        if not _is_sparse_visual_platform_url(item.source_url):
            assets.append(item)
            continue
        assets.append(
            item.model_copy(
                update={
                    "publication_tier": PublicationTier.aggregator,
                    "project_identity": AssociationStatus.unknown,
                    "asset_association": AssociationStatus.unknown,
                    "primary_source": PrimarySourceStatus.unknown,
                    "rights_status": RightsStatus.unknown,
                    "result_tier": ResultTier.visual_lead,
                    "project_context": "",
                    "design_mechanism": "",
                    "transfer_strategy": [],
                    "facts": [],
                    "limitations": list(
                        dict.fromkeys(
                            [
                                *item.limitations,
                                "视觉平台帖子只支持可见图像观察，不能单独确认完整项目事实、图纸归属或使用权。",
                            ]
                        )
                    ),
                }
            )
        )
    return ProviderSearchResult(sources=sources, assets=assets)


def _is_sparse_visual_platform_url(value: str) -> bool:
    return _is_xiaohongshu_url(value)


def _is_xiaohongshu_url(value: str) -> bool:
    hostname = (urlparse(value).hostname or "").rstrip(".").lower()
    return hostname == "xiaohongshu.com" or hostname.endswith(".xiaohongshu.com")


def _is_removed_visual_source_url(value: str) -> bool:
    hostname = (urlparse(value).hostname or "").rstrip(".").lower()
    return (
        hostname == "pinterest.com"
        or hostname.endswith(".pinterest.com")
        or hostname == "pin.it"
        or hostname.endswith(".pin.it")
    )


def _redacted_trace_url(value: str) -> str:
    parsed = urlparse(value)
    if not _is_xiaohongshu_url(value):
        return value
    return parsed._replace(params="", query="", fragment="").geturl()


def _inspection_source_sort_key(
    source: ProviderSource,
    goal: ResearchGoal,
    relevance_context: str = "",
) -> tuple[int, int, int, int, int]:
    path = policy_for_goal(goal)
    is_visual_platform = _is_sparse_visual_platform_url(source.url)
    discovery_priority = (
        _architecture_discovery_priority(source) if path.uses_precedent_sources else 0
    )
    purpose_priority = (
        int(is_visual_platform) if path.uses_visual_platform else int(not is_visual_platform)
    )
    return (
        purpose_priority,
        int(discovery_priority > 0),
        _source_relevance_score(source, relevance_context),
        PUBLICATION_TIER_STRENGTH[source.publication_tier.value],
        discovery_priority,
    )


def _source_relevance_score(source: ProviderSource, context: str) -> int:
    if not context:
        return 0
    return public_search_relevance_score(
        context,
        title=source.title,
        description=source._search_description,
        url=source.url,
    )


def _source_matches_research_typology(source: ProviderSource, context: str) -> bool:
    query_text = context.casefold()
    identity_text = " ".join(
        (
            source.title,
            unquote(urlparse(source.url).path).replace("-", " "),
        )
    ).casefold()
    if any(term in query_text for term in ("图书馆", "library")):
        return any(term in identity_text for term in ("图书馆", "library"))
    if any(term in query_text for term in ("工业", "厂房", "industrial", "factory")):
        return any(
            term in identity_text
            for term in (
                "工业",
                "厂房",
                "仓库",
                "industrial",
                "factory",
                "mill",
                "plant",
                "warehouse",
            )
        )
    if any(term in query_text for term in ("文化中心", "cultural center")):
        return any(term in identity_text for term in ("文化中心", "cultural center"))
    if any(term in query_text for term in ("社区中心", "community center")):
        return any(term in identity_text for term in ("社区中心", "community center"))
    return True


def _relevance_tokens(value: str) -> set[str]:
    stop_words = {
        "architecture",
        "building",
        "drawing",
        "drawings",
        "floor",
        "house",
        "page",
        "plan",
        "project",
        "section",
        "site",
        "with",
    }
    normalized = value.casefold()
    latin_tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", normalized)
        if len(token) >= 3 and token not in stop_words
    }
    cjk_tokens: set[str] = set()
    for sequence in re.findall(r"[\u4e00-\u9fff]+", normalized):
        if len(sequence) == 1:
            continue
        cjk_tokens.add(sequence)
        cjk_tokens.update(sequence[index : index + 2] for index in range(len(sequence) - 1))
    return latin_tokens | cjk_tokens


def _architecture_discovery_priority(source: ProviderSource) -> int:
    if " / " in source.title:
        return 2
    segments = {segment.casefold() for segment in urlparse(source.url).path.split("/") if segment}
    if segments & {"category", "projects", "search", "tag"}:
        return 1
    return 0


def _persist_sources(
    db: Database,
    run_id: str,
    result: ProviderSearchResult,
    *,
    access_status: str | None = None,
) -> None:
    result = _constrain_sparse_visual_platform_result(result)
    expires_at = datetime.now(UTC) + timedelta(days=30)
    with db.session_factory() as session:
        existing = {
            page.url: page
            for page in session.scalars(select(SourcePage).where(SourcePage.run_id == run_id))
        }
        for source in result.sources:
            existing_page = existing.get(source.url)
            if existing_page is not None:
                if access_status is not None and (
                    access_status == "available" or existing_page.access_status == "pending"
                ):
                    existing_page.access_status = access_status
                if _is_sparse_visual_platform_url(source.url):
                    existing_page.publication_tier = PublicationTier.aggregator.value
                    existing_page.publisher = source.publisher
                    existing_page.title = source.title
                    continue
                if PUBLICATION_TIER_STRENGTH[source.publication_tier.value] > (
                    PUBLICATION_TIER_STRENGTH.get(existing_page.publication_tier, 0)
                ):
                    existing_page.publication_tier = source.publication_tier.value
                    existing_page.publisher = source.publisher
                    existing_page.title = source.title
                continue
            page = SourcePage(
                run_id=run_id,
                url=source.url,
                publisher=source.publisher,
                title=source.title,
                publication_tier=source.publication_tier.value,
                access_status=access_status or "available",
                content_hash=hashlib.sha256(source.url.encode()).hexdigest(),
                expires_at=expires_at,
            )
            session.add(page)
            existing[source.url] = page
        session.commit()


def _persist_assets(
    db: Database,
    run_id: str,
    result: ProviderSearchResult,
    *,
    subquestion_id: str | None = None,
) -> int:
    result = _constrain_sparse_visual_platform_result(result)
    expires_at = datetime.now(UTC) + timedelta(days=7)
    with db.session_factory() as session:
        pages = {
            page.url: page.id
            for page in session.scalars(select(SourcePage).where(SourcePage.run_id == run_id))
        }
        existing_assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        existing = {
            (candidate.source_url, candidate.image_url): candidate for candidate in existing_assets
        }
        assets_by_image_url: dict[str, list[AssetCandidate]] = {}
        for candidate in existing_assets:
            if candidate.image_url is not None:
                assets_by_image_url.setdefault(candidate.image_url, []).append(candidate)
        added_usable = 0
        for item in result.assets:
            identity = (item.source_url, item.image_url)
            existing_candidate = existing.get(identity)
            if existing_candidate is None and item.image_url is not None:
                same_image_url = assets_by_image_url.get(item.image_url, [])
                if len(same_image_url) == 1:
                    existing_candidate = same_image_url[0]
            if existing_candidate is not None:
                if PUBLICATION_TIER_STRENGTH[item.publication_tier.value] > (
                    PUBLICATION_TIER_STRENGTH.get(existing_candidate.publication_tier, 0)
                ):
                    existing_candidate.publication_tier = item.publication_tier.value
                    existing_candidate.source_page_id = pages.get(item.source_url)
                    existing_candidate.source_url = item.source_url
                associations = list(existing_candidate.subquestion_ids or [])
                if subquestion_id is not None and subquestion_id not in associations:
                    existing_candidate.subquestion_ids = [*associations, subquestion_id]
                    if existing_candidate.relevance >= 2:
                        added_usable += 1
                if subquestion_id is not None:
                    analysis = dict(existing_candidate.subquestion_analysis or {})
                    current_analysis = dict(analysis.get(subquestion_id, {}))
                    current_context = current_analysis.get("project_context")
                    if not isinstance(current_context, str) or not current_context.strip():
                        current_analysis["project_context"] = _supported_project_context(item)
                    current_mechanism = current_analysis.get("design_mechanism")
                    if not isinstance(current_mechanism, str) or not current_mechanism.strip():
                        current_analysis["design_mechanism"] = item.design_mechanism
                    for field, incoming_values in (
                        ("transfer_strategy", item.transfer_strategy),
                        ("observations", item.observations),
                        ("limitations", item.limitations),
                    ):
                        existing_values = current_analysis.get(field)
                        current_analysis[field] = list(
                            dict.fromkeys(
                                [
                                    *(existing_values if isinstance(existing_values, list) else []),
                                    *incoming_values,
                                ]
                            )
                        )
                    analysis[subquestion_id] = current_analysis
                    existing_candidate.subquestion_analysis = analysis
                supported_context = _supported_project_context(item)
                if not existing_candidate.project_context and supported_context:
                    existing_candidate.project_context = supported_context
                if not existing_candidate.design_mechanism and item.design_mechanism:
                    existing_candidate.design_mechanism = item.design_mechanism
                if item.transfer_strategy:
                    existing_candidate.transfer_strategy = list(
                        dict.fromkeys(
                            [
                                *(existing_candidate.transfer_strategy or []),
                                *item.transfer_strategy,
                            ]
                        )
                    )
                existing_candidate.facts = list(
                    dict.fromkeys([*existing_candidate.facts, *item.facts])
                )
                existing_candidate.observations = list(
                    dict.fromkeys([*existing_candidate.observations, *item.observations])
                )
                existing_candidate.inferences = list(
                    dict.fromkeys([*existing_candidate.inferences, *item.inferences])
                )
                existing_candidate.limitations = list(
                    dict.fromkeys([*existing_candidate.limitations, *item.limitations])
                )
                _persist_provider_evidence_claims(session, existing_candidate, item)
                continue
            candidate = AssetCandidate(
                run_id=run_id,
                source_page_id=pages.get(item.source_url),
                project_name=item.project_name,
                asset_type=item.asset_type.value,
                source_url=item.source_url,
                image_url=item.image_url,
                perceptual_hash=None,
                publication_tier=item.publication_tier.value,
                project_identity=item.project_identity.value,
                asset_association=item.asset_association.value,
                primary_source=item.primary_source.value,
                rights_status=item.rights_status.value,
                result_tier=item.result_tier.value,
                relevance=item.relevance,
                subquestion_ids=[subquestion_id] if subquestion_id is not None else [],
                project_context=_supported_project_context(item),
                design_mechanism=item.design_mechanism,
                transfer_strategy=item.transfer_strategy,
                subquestion_analysis=(
                    {subquestion_id: _subquestion_analysis(item)}
                    if subquestion_id is not None
                    else {}
                ),
                facts=item.facts,
                observations=item.observations,
                inferences=item.inferences,
                limitations=item.limitations,
                rank_index=0,
                expires_at=expires_at,
            )
            session.add(candidate)
            session.flush()
            existing[identity] = candidate
            if item.image_url is not None:
                assets_by_image_url.setdefault(item.image_url, []).append(candidate)
            if item.relevance >= 2:
                added_usable += 1
            _persist_provider_evidence_claims(session, candidate, item)
        _rerank_assets(session, run_id)
        session.commit()
        return added_usable


def _persist_provider_evidence_claims(
    session: Session,
    candidate: AssetCandidate,
    item: ProviderAsset,
) -> None:
    excerpts = {evidence.statement: evidence.text_excerpt for evidence in item.evidence_excerpts}
    statements = list(dict.fromkeys([*item.facts, *excerpts]))
    existing_claims = {
        (claim.statement, claim.source_url): claim
        for claim in session.scalars(
            select(EvidenceClaim).where(
                EvidenceClaim.asset_candidate_id == candidate.id,
                EvidenceClaim.claim_type == "fact",
            )
        )
    }
    for statement in statements:
        key = (statement, item.source_url)
        existing_claim = existing_claims.get(key)
        text_excerpt = excerpts.get(statement)
        if existing_claim is not None:
            if text_excerpt and not existing_claim.text_excerpt:
                existing_claim.text_excerpt = text_excerpt
            continue
        claim = EvidenceClaim(
            asset_candidate_id=candidate.id,
            claim_type="fact",
            statement=statement,
            source_url=item.source_url,
            text_excerpt=text_excerpt,
            expires_at=datetime.now(UTC) + timedelta(days=30),
        )
        session.add(claim)
        existing_claims[key] = claim


def _persist_inspected_assets(
    db: Database,
    run_id: str,
    source: ProviderSource,
    inspected: list[InspectedVisual],
    *,
    subquestion_id: str | None = None,
) -> int:
    expires_at = datetime.now(UTC) + timedelta(days=7)
    is_visual_platform = _is_sparse_visual_platform_url(source.url)
    visual_platform_limitation = (
        "视觉平台帖子只支持可见图像观察，不能单独确认完整项目事实、图纸归属或使用权。"
    )
    with db.session_factory() as session:
        page_id = session.scalar(
            select(SourcePage.id).where(
                SourcePage.run_id == run_id,
                SourcePage.url == source.url,
            )
        )
        existing_assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        existing_image_urls: dict[tuple[str, str | None], AssetCandidate] = {
            (candidate.source_url, candidate.image_url): candidate
            for candidate in existing_assets
            if candidate.image_url is not None
        }
        assets_by_image_url: dict[str, list[AssetCandidate]] = {}
        for candidate in existing_assets:
            if candidate.image_url is not None:
                assets_by_image_url.setdefault(candidate.image_url, []).append(candidate)
        existing_hashes = {
            candidate.perceptual_hash: candidate
            for candidate in existing_assets
            if candidate.perceptual_hash is not None
        }
        unresolved_by_source_and_type: dict[tuple[str, str], list[AssetCandidate]] = {}
        for candidate in existing_assets:
            if (
                candidate.image_url is None
                and candidate.storage_path is None
                and candidate.perceptual_hash is None
            ):
                unresolved_by_source_and_type.setdefault(
                    (candidate.source_url, candidate.asset_type), []
                ).append(candidate)
        added_usable = 0
        for item in inspected:
            image_identity = (item.source_url, item.image_url)
            duplicate = existing_hashes.get(item.perceptual_hash)
            if duplicate is None and item.image_url is not None:
                duplicate = existing_image_urls.get(image_identity)
            if duplicate is None and item.image_url is not None:
                same_image_url = assets_by_image_url.get(item.image_url, [])
                if len(same_image_url) == 1:
                    duplicate = same_image_url[0]
            unresolved_key = (item.source_url, item.asset_type.value)
            if duplicate is None:
                unresolved = unresolved_by_source_and_type.get(unresolved_key, [])
                if len(unresolved) == 1:
                    duplicate = unresolved[0]
                    unresolved_by_source_and_type.pop(unresolved_key, None)
            if duplicate is not None:
                if duplicate.perceptual_hash is None:
                    duplicate.perceptual_hash = item.perceptual_hash
                existing_hashes[item.perceptual_hash] = duplicate
                if duplicate.image_url is None and item.image_url is not None:
                    duplicate.image_url = item.image_url
                    existing_image_urls[image_identity] = duplicate
                if item.storage_path is not None:
                    if duplicate.storage_path is None:
                        duplicate.storage_path = str(item.storage_path)
                    elif Path(duplicate.storage_path) != item.storage_path:
                        try:
                            item.storage_path.unlink(missing_ok=True)
                        except OSError:
                            pass
                if duplicate.source_url != item.source_url:
                    existing_claim_urls = set(
                        session.scalars(
                            select(EvidenceClaim.source_url).where(
                                EvidenceClaim.asset_candidate_id == duplicate.id,
                                EvidenceClaim.claim_type == "observation",
                            )
                        )
                    )
                    for observed_source_url in (duplicate.source_url, item.source_url):
                        if observed_source_url in existing_claim_urls:
                            continue
                        session.add(
                            EvidenceClaim(
                                asset_candidate_id=duplicate.id,
                                claim_type="observation",
                                statement=(
                                    "The same visual content was observed on this additional "
                                    "source page."
                                ),
                                source_url=observed_source_url,
                                expires_at=datetime.now(UTC) + timedelta(days=30),
                            )
                        )
                        existing_claim_urls.add(observed_source_url)
                    if PUBLICATION_TIER_STRENGTH[source.publication_tier.value] > (
                        PUBLICATION_TIER_STRENGTH.get(duplicate.publication_tier, 0)
                    ):
                        duplicate.source_page_id = page_id
                        duplicate.source_url = item.source_url
                        duplicate.image_url = item.image_url
                        duplicate.publication_tier = source.publication_tier.value
                elif PUBLICATION_TIER_STRENGTH[source.publication_tier.value] > (
                    PUBLICATION_TIER_STRENGTH.get(duplicate.publication_tier, 0)
                ):
                    duplicate.source_page_id = page_id
                    duplicate.publication_tier = source.publication_tier.value
                duplicate.observations = list(
                    dict.fromkeys([*duplicate.observations, *item.observations])
                )
                associations = list(duplicate.subquestion_ids or [])
                if subquestion_id is not None and subquestion_id not in associations:
                    duplicate.subquestion_ids = [*associations, subquestion_id]
                    if duplicate.relevance >= 2:
                        added_usable += 1
                if subquestion_id is not None:
                    analysis = dict(duplicate.subquestion_analysis or {})
                    existing_analysis = dict(analysis.get(subquestion_id, {}))
                    existing_observations = existing_analysis.get("observations")
                    existing_limitations = existing_analysis.get("limitations")
                    existing_transfer = existing_analysis.get("transfer_strategy")
                    analysis[subquestion_id] = {
                        "project_context": (
                            existing_analysis.get("project_context")
                            if isinstance(existing_analysis.get("project_context"), str)
                            else ""
                        ),
                        "design_mechanism": (
                            existing_analysis.get("design_mechanism")
                            if isinstance(existing_analysis.get("design_mechanism"), str)
                            else ""
                        ),
                        "transfer_strategy": (
                            existing_transfer if isinstance(existing_transfer, list) else []
                        ),
                        "observations": list(
                            dict.fromkeys(
                                [
                                    *(
                                        existing_observations
                                        if isinstance(existing_observations, list)
                                        else []
                                    ),
                                    *item.observations,
                                ]
                            )
                        ),
                        "limitations": (
                            existing_limitations if isinstance(existing_limitations, list) else []
                        ),
                    }
                    duplicate.subquestion_analysis = analysis
                continue
            if item.storage_path is None:
                continue
            candidate = AssetCandidate(
                run_id=run_id,
                source_page_id=page_id,
                project_name=(
                    source.title.strip() or "视觉平台参考" if is_visual_platform else "待核验项目"
                ),
                asset_type=item.asset_type.value,
                source_url=item.source_url,
                image_url=item.image_url,
                storage_path=str(item.storage_path),
                perceptual_hash=item.perceptual_hash,
                publication_tier=source.publication_tier.value,
                project_identity=AssociationStatus.unknown.value,
                asset_association=AssociationStatus.unknown.value,
                primary_source=PrimarySourceStatus.unknown.value,
                rights_status=RightsStatus.unknown.value,
                result_tier=ResultTier.visual_lead.value,
                relevance=item.relevance,
                subquestion_ids=[subquestion_id] if subquestion_id is not None else [],
                project_context="",
                design_mechanism="",
                transfer_strategy=[],
                subquestion_analysis=(
                    {
                        subquestion_id: {
                            "project_context": "",
                            "design_mechanism": "",
                            "transfer_strategy": [],
                            "observations": item.observations,
                            "limitations": (
                                [visual_platform_limitation] if is_visual_platform else []
                            ),
                        }
                    }
                    if subquestion_id is not None
                    else {}
                ),
                facts=[],
                observations=item.observations,
                inferences=[],
                limitations=([visual_platform_limitation] if is_visual_platform else []),
                rank_index=0,
                expires_at=expires_at,
            )
            session.add(candidate)
            if item.image_url is not None:
                existing_image_urls[image_identity] = candidate
            existing_hashes[item.perceptual_hash] = candidate
            if item.relevance >= 2:
                added_usable += 1
        _rerank_assets(session, run_id)
        session.commit()
        return added_usable


def _subquestion_analysis(item: ProviderAsset) -> dict[str, object]:
    return {
        "project_context": _supported_project_context(item),
        "design_mechanism": item.design_mechanism,
        "transfer_strategy": item.transfer_strategy,
        "observations": item.observations,
        "limitations": item.limitations,
    }


def _supported_project_context(item: ProviderAsset) -> str:
    context = item.project_context.strip()
    supported_facts = {fact.strip() for fact in item.facts}
    return context if context and context in supported_facts else ""


def _try_research_synthesis(
    db: Database,
    run_id: str,
    provider: ResearchSynthesisProvider,
    *,
    question: str,
    budget_mode: BudgetMode,
) -> dict[str, object] | None:
    cases = _research_synthesis_cases(db, run_id)
    if not cases:
        return None
    with db.session_factory() as session:
        run = get_run(session, run_id)
        subquestions = [ResearchSubquestion.model_validate(item) for item in run.subquestions or []]
    try:
        synthesis = provider.synthesize_research(
            question=question,
            budget_mode=budget_mode,
            subquestions=subquestions,
            cases=cases,
        )
    except Exception as exc:
        fallback = (
            deterministic_research_synthesis(budget_mode, subquestions, cases)
            if is_recoverable_research_synthesis_error(exc)
            else None
        )
        if fallback is not None:
            checkpoint(
                db,
                run_id,
                RunStatus.composing,
                {
                    "status": "completed",
                    "generation_mode": "deterministic_fallback",
                    "provider_error_type": type(exc).__name__,
                    "case_count": len(cases),
                    "comparison_count": len(fallback.comparisons),
                    "conflict_count": len(fallback.conflicts),
                },
                tool="research_synthesis",
            )
            result = fallback.model_dump(mode="json")
            result["generation_mode"] = "deterministic_fallback"
            return result
        checkpoint(
            db,
            run_id,
            RunStatus.composing,
            {"status": "failed", "error_type": type(exc).__name__},
            tool="research_synthesis",
        )
        return None
    checkpoint(
        db,
        run_id,
        RunStatus.composing,
        {
            "status": "completed",
            "case_count": len(cases),
            "comparison_count": len(synthesis.comparisons),
            "conflict_count": len(synthesis.conflicts),
        },
        tool="research_synthesis",
    )
    return synthesis.model_dump(mode="json")


def _research_synthesis_cases(db: Database, run_id: str) -> list[ResearchSynthesisCase]:
    with db.session_factory() as session:
        assets = list(
            session.scalars(
                select(AssetCandidate)
                .where(AssetCandidate.run_id == run_id)
                .order_by(AssetCandidate.rank_index)
            )
        )
        evidence_rows = session.execute(
            select(
                EvidenceClaim.asset_candidate_id,
                EvidenceClaim.source_url,
                EvidenceClaim.statement,
                EvidenceClaim.text_excerpt,
            )
            .join(
                AssetCandidate,
                EvidenceClaim.asset_candidate_id == AssetCandidate.id,
            )
            .where(AssetCandidate.run_id == run_id)
        ).all()
    analysis_statements_by_asset: dict[str, set[str]] = {}
    for asset in assets:
        statements = {asset.project_context.strip(), asset.design_mechanism.strip()}
        for branch in (asset.subquestion_analysis or {}).values():
            if not isinstance(branch, dict):
                continue
            for field in ("project_context", "design_mechanism"):
                value = branch.get(field)
                if isinstance(value, str) and value.strip():
                    statements.add(value.strip())
        analysis_statements_by_asset[asset.id] = statements
    evidence_by_asset: dict[str, list[str]] = {}
    evidence_by_statement: dict[tuple[str, str], list[str]] = {}
    evidence_asset_ids: set[str] = set()
    for asset_id, _source_url, statement, text_excerpt in evidence_rows:
        if (
            text_excerpt is None
            or not text_excerpt.strip()
            or statement.strip() not in analysis_statements_by_asset.get(asset_id, set())
        ):
            continue
        evidence_asset_ids.add(asset_id)
        rendered = f"{statement}｜原文：{text_excerpt.strip()}"
        evidence_by_asset.setdefault(asset_id, []).append(rendered)
        evidence_by_statement.setdefault((asset_id, statement.strip()), []).append(rendered)
    cases: list[ResearchSynthesisCase] = []
    seen_case_identities: set[tuple[object, ...]] = set()
    for asset in assets:
        if (
            asset.relevance < 2
            or asset.result_tier not in {ResultTier.verified.value, ResultTier.partial.value}
            or not asset.project_context.strip()
            or not asset.design_mechanism.strip()
            or not asset.transfer_strategy
            or asset.id not in evidence_asset_ids
        ):
            continue
        branch_analysis = research_synthesis_branch_analysis(
            asset,
            evidence_by_statement,
        )
        case = ResearchSynthesisCase(
            asset_id=asset.id,
            project_name=asset.project_name,
            asset_type=ArchitectureAssetType(asset.asset_type),
            source_url=asset.source_url,
            subquestion_ids=(
                list(branch_analysis) if branch_analysis else list(asset.subquestion_ids or [])
            ),
            project_context=asset.project_context,
            design_mechanism=asset.design_mechanism,
            transfer_strategy=list(asset.transfer_strategy or []),
            limitations=list(asset.limitations or []),
            evidence=evidence_by_asset.get(asset.id, [])[:6],
            subquestion_analysis=branch_analysis,
        )
        identity = research_synthesis_case_identity(case)
        if identity in seen_case_identities:
            continue
        seen_case_identities.add(identity)
        cases.append(case)
    return cases


def _rerank_assets(session: Session, run_id: str) -> None:
    assets = list(session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id)))
    ordered: list[AssetCandidate] = []
    for tier in (ResultTier.verified, ResultTier.partial, ResultTier.visual_lead):
        tier_assets = [asset for asset in assets if asset.result_tier == tier.value]
        for relevance in range(4, -1, -1):
            groups: dict[str, list[AssetCandidate]] = {}
            matching = sorted(
                (asset for asset in tier_assets if asset.relevance == relevance),
                key=lambda item: (item.project_name, item.asset_type, item.source_url),
            )
            for asset in matching:
                groups.setdefault(asset.project_name, []).append(asset)
            while any(groups.values()):
                for project_assets in groups.values():
                    if project_assets:
                        ordered.append(project_assets.pop(0))
    for rank, asset in enumerate(ordered):
        asset.rank_index = rank


def _preserve_failure(db: Database, run_id: str, exc: Exception) -> str:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        asset_count = session.scalar(
            select(func.count()).select_from(AssetCandidate).where(AssetCandidate.run_id == run_id)
        )
        if run.status != RunStatus.cancelled.value:
            if policy_for_goal(ResearchGoal(run.goal)).uses_precedent_sources and asset_count:
                run.status = RunStatus.blocked.value
            else:
                run.status = RunStatus.partial.value if asset_count else RunStatus.failed.value
            run.stop_reason = f"provider_error:{type(exc).__name__}"
            run.finished_at = datetime.now(UTC)
            session.commit()
        return run.status
