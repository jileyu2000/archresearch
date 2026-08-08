from __future__ import annotations

from urllib.parse import urlparse

from ..inspection import InspectedVisual
from ..providers import ProviderSearchResult
from ..schemas import ResearchSource, RunStatus
from .types import ResearchPathPolicy, SearchAvailability


def normalize_research_sources(
    research_sources: set[ResearchSource],
) -> set[ResearchSource]:
    del research_sources
    return set()


def recovery_rounds(budget: dict[str, int]) -> int:
    return int(budget.get("completion_recovery_rounds", 1))


def should_skip_subquestion(
    *,
    covered: bool,
    coverage_incomplete: bool,
    completion_continuation: bool,
) -> bool:
    return covered and (coverage_incomplete or completion_continuation)


def search_availability(
    *,
    public_available: bool,
    provider_available: bool,
    visual_platform_available: bool,
) -> SearchAvailability:
    del visual_platform_available
    return SearchAvailability(
        public=public_available,
        provider=provider_available,
        visual_platform=False,
    )


def unavailable_stop_reason(
    *,
    public_search_configured: bool = False,
    public_time_available: bool = False,
    public_budget_available: bool = True,
) -> str:
    if public_search_configured and public_time_available and not public_budget_available:
        return "query_budget_exhausted"
    return "time_budget_exhausted"


def terminal_outcome(
    *,
    complete: bool,
    covered_subquestions: int,
    browser_inspection_incomplete: bool,
    usable_assets: int,
    preserved_assets: int,
    stop_reason: str,
) -> tuple[RunStatus, str]:
    del usable_assets, preserved_assets
    if complete:
        return RunStatus.completed, "coverage_satisfied"
    if covered_subquestions > 0 and not browser_inspection_incomplete:
        return RunStatus.partial, stop_reason
    return RunStatus.blocked, stop_reason


def visual_platform_query(direction: str, round_number: int) -> None:
    del direction, round_number
    return None


def provider_query(query: str) -> str:
    preference = "优先项目官网、ArchDaily 等完整建筑项目页；视觉平台只能作为灵感线索。"
    return f"{query} 来源分工：{preference}"[:8_000]


def constrain_provider_result(result: ProviderSearchResult) -> ProviderSearchResult:
    def allowed(url: str) -> bool:
        hostname = (urlparse(url).hostname or "").rstrip(".").lower()
        return not (hostname == "xiaohongshu.com" or hostname.endswith(".xiaohongshu.com"))

    return ProviderSearchResult(
        sources=[source for source in result.sources if allowed(source.url)],
        assets=[asset for asset in result.assets if allowed(asset.source_url)],
    )


def filter_inspected_visuals(
    inspected: list[InspectedVisual],
    *,
    question: str,
    caption: str,
) -> tuple[list[InspectedVisual], int, int]:
    del question, caption
    return inspected, 0, 0


POLICY = ResearchPathPolicy(
    normalize_research_sources=normalize_research_sources,
    recovery_rounds=recovery_rounds,
    should_skip_subquestion=should_skip_subquestion,
    search_availability=search_availability,
    unavailable_stop_reason=unavailable_stop_reason,
    terminal_outcome=terminal_outcome,
    visual_platform_query=visual_platform_query,
    provider_query=provider_query,
    constrain_provider_result=constrain_provider_result,
    filter_inspected_visuals=filter_inspected_visuals,
    uses_precedent_sources=True,
    uses_visual_platform=False,
)
