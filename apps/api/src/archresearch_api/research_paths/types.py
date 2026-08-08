from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from ..inspection import InspectedVisual
from ..providers import ProviderSearchResult
from ..schemas import ResearchSource, RunStatus


@dataclass(frozen=True)
class SearchAvailability:
    public: bool
    provider: bool
    visual_platform: bool


@dataclass(frozen=True)
class ResearchPathPolicy:
    normalize_research_sources: Callable[[set[ResearchSource]], set[ResearchSource]]
    recovery_rounds: Callable[[dict[str, int]], int]
    should_skip_subquestion: Callable[..., bool]
    search_availability: Callable[..., SearchAvailability]
    unavailable_stop_reason: Callable[..., str]
    terminal_outcome: Callable[..., tuple[RunStatus, str]]
    visual_platform_query: Callable[[str, int], str | None]
    provider_query: Callable[[str], str]
    constrain_provider_result: Callable[[ProviderSearchResult], ProviderSearchResult]
    filter_inspected_visuals: Callable[..., tuple[list[InspectedVisual], int, int]]
    uses_precedent_sources: bool
    uses_visual_platform: bool
