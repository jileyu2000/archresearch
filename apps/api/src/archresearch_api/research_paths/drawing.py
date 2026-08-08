from __future__ import annotations

from pathlib import Path
from typing import cast

from PIL import Image

from ..inspection import InspectedVisual
from ..providers import (
    ProviderSearchResult,
    requested_visual_drawing_type,
    visual_reference_search_query,
)
from ..schemas import ResearchSource, RunStatus
from ..visual import ArchitectureAssetType
from .types import ResearchPathPolicy, SearchAvailability

_ROUND_FOCUS = ("", "作品集", "构图细节", "版式参考", "表达教程")
_ASSET_TYPE_BY_DRAWING_LABEL = {
    "总平面图": ArchitectureAssetType.site_plan,
    "平面图": ArchitectureAssetType.plan,
    "剖面图": ArchitectureAssetType.section,
    "爆炸图": ArchitectureAssetType.axonometric,
    "轴测图": ArchitectureAssetType.axonometric,
    "分析图": ArchitectureAssetType.analysis_diagram,
    "立面图": ArchitectureAssetType.elevation,
    "流线图": ArchitectureAssetType.circulation,
    "效果图": ArchitectureAssetType.render,
}
_PROMOTIONAL_CAPTION_TERMS = ("教程", "教你", "步骤", "技巧", "左滑", "看完就会")


def normalize_research_sources(
    research_sources: set[ResearchSource],
) -> set[ResearchSource]:
    return research_sources & {ResearchSource.xiaohongshu}


def recovery_rounds(budget: dict[str, int]) -> int:
    del budget
    return 0


def should_skip_subquestion(
    *,
    covered: bool,
    coverage_incomplete: bool,
    completion_continuation: bool,
) -> bool:
    del completion_continuation
    return covered and coverage_incomplete


def search_availability(
    *,
    public_available: bool,
    provider_available: bool,
    visual_platform_available: bool,
) -> SearchAvailability:
    del public_available, provider_available
    return SearchAvailability(
        public=False,
        provider=False,
        visual_platform=visual_platform_available,
    )


def unavailable_stop_reason(
    *,
    public_search_configured: bool = False,
    public_time_available: bool = False,
    public_budget_available: bool = True,
) -> str:
    del public_search_configured, public_time_available, public_budget_available
    return "query_budget_exhausted"


def terminal_outcome(
    *,
    complete: bool,
    covered_subquestions: int,
    browser_inspection_incomplete: bool,
    usable_assets: int,
    preserved_assets: int,
    stop_reason: str,
) -> tuple[RunStatus, str]:
    del covered_subquestions, browser_inspection_incomplete
    if complete:
        return RunStatus.completed, "coverage_satisfied"
    if usable_assets:
        return RunStatus.partial, stop_reason
    if preserved_assets:
        return RunStatus.partial, "unverified_visual_leads"
    if stop_reason == "visual_budget_exhausted":
        return RunStatus.blocked, stop_reason
    return RunStatus.blocked, "no_usable_assets"


def visual_platform_query(direction: str, round_number: int) -> str:
    query = visual_reference_search_query(direction)
    focus = _ROUND_FOCUS[min(max(round_number, 1) - 1, len(_ROUND_FOCUS) - 1)]
    return " ".join(part for part in (query, focus) if part)


def provider_query(query: str) -> str:
    preference = "优先图纸风格、建筑形体推演与分析图表达的可见特征。"
    return f"{query} 来源分工：{preference}"[:8_000]


def constrain_provider_result(result: ProviderSearchResult) -> ProviderSearchResult:
    return result


def filter_inspected_visuals(
    inspected: list[InspectedVisual],
    *,
    question: str,
    caption: str,
) -> tuple[list[InspectedVisual], int, int]:
    requested_label = requested_visual_drawing_type(question)
    requested_asset_type = _ASSET_TYPE_BY_DRAWING_LABEL.get(requested_label or "")
    if requested_asset_type is None:
        return inspected, 0, 0

    accepted: list[InspectedVisual] = []
    mismatch_count = 0
    quality_rejected_count = 0
    for item in inspected:
        if item.asset_type is requested_asset_type:
            if _has_drawing_quality_issue(item.storage_path, caption=caption):
                quality_rejected_count += 1
                if item.storage_path is not None:
                    item.storage_path.unlink(missing_ok=True)
                continue
            accepted.append(item)
            continue
        mismatch_count += 1
        if item.storage_path is not None:
            item.storage_path.unlink(missing_ok=True)
    return accepted, mismatch_count, quality_rejected_count


def _has_drawing_quality_issue(path: Path | None, *, caption: str) -> bool:
    if path is None or not path.is_file():
        return False
    try:
        image = Image.open(path).convert("RGB").resize((160, 160))
    except (OSError, ValueError):
        return True

    def pixel_at(x: int, y: int) -> tuple[int, int, int]:
        return cast(tuple[int, int, int], image.getpixel((x, y)))

    pixels = [pixel_at(x, y) for y in range(160) for x in range(160)]
    white_ratio = sum(min(pixel) > 235 and max(pixel) > 242 for pixel in pixels) / len(pixels)
    ink_ratio = sum(min(pixel) < 210 or max(pixel) - min(pixel) > 25 for pixel in pixels) / len(
        pixels
    )
    if (
        any(term in caption for term in _PROMOTIONAL_CAPTION_TERMS)
        and white_ratio > 0.65
        and ink_ratio < 0.12
    ):
        return True
    means = [sum(pixel[index] for pixel in pixels) / len(pixels) / 255 for index in range(3)]
    variance = (
        sum(
            sum(((pixel[index] / 255) - means[index]) ** 2 for pixel in pixels) / len(pixels)
            for index in range(3)
        )
        / 3
    )
    if white_ratio < 0.24 and variance**0.5 > 0.23:
        return True

    def ink(pixel: tuple[int, int, int]) -> bool:
        return min(pixel) < 210 or max(pixel) - min(pixel) > 25

    right_border = sum(ink(pixel_at(x, y)) for x in range(156, 160) for y in range(160))
    bottom_border = sum(ink(pixel_at(x, y)) for y in range(156, 160) for x in range(160))
    if white_ratio > 0.30 and right_border / 640 > 0.45 and bottom_border / 640 > 0.80:
        return True
    return False


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
    uses_precedent_sources=False,
    uses_visual_platform=True,
)
