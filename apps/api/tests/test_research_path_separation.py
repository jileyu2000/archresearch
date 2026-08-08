import inspect
from pathlib import Path

from PIL import Image, ImageDraw

from archresearch_api import workflow
from archresearch_api.inspection import InspectedVisual
from archresearch_api.research_paths import drawing, drawing_runner, precedent, precedent_runner
from archresearch_api.schemas import ResearchSource, RunStatus
from archresearch_api.visual import ArchitectureAssetType


def test_precedent_and_drawing_paths_are_physical_modules() -> None:
    assert Path(precedent.__file__).name == "precedent.py"
    assert Path(drawing.__file__).name == "drawing.py"
    precedent_source = Path(precedent.__file__).read_text(encoding="utf-8")
    drawing_source = Path(drawing.__file__).read_text(encoding="utf-8")
    assert "from ..xiaohongshu" not in precedent_source
    assert "ResearchProvider" not in drawing_source


def test_search_and_inspection_execution_is_split_into_goal_specific_runners() -> None:
    source_root = Path(__file__).parents[1] / "src" / "archresearch_api" / "research_paths"
    precedent_runner_path = source_root / "precedent_runner.py"
    drawing_runner_path = source_root / "drawing_runner.py"
    assert precedent_runner_path.is_file()
    assert drawing_runner_path.is_file()

    precedent_source = precedent_runner_path.read_text(encoding="utf-8")
    drawing_source = drawing_runner_path.read_text(encoding="utf-8")
    execute_source = inspect.getsource(workflow.execute_research_run)

    assert "from ..xiaohongshu" not in precedent_source.casefold()
    assert "xiaohongshu" not in precedent_source.casefold().replace("xiaohongshu_search=none", "")
    assert "publicsearchprovider" not in drawing_source.casefold()
    assert "searchqueryplanningprovider" not in drawing_source.casefold()
    assert "candidatererankingprovider" not in drawing_source.casefold()
    assert "xiaohongshu_search" not in str(
        inspect.signature(precedent_runner.execute_precedent_run)
    )
    assert "public_page_parser" not in str(inspect.signature(drawing_runner.execute_drawing_run))
    assert "execute_precedent_run" in execute_source
    assert "execute_drawing_run" in execute_source
    assert "path.uses_precedent_sources" not in execute_source
    assert "path.uses_visual_platform" not in execute_source


def test_precedent_path_never_enables_visual_platform_search() -> None:
    assert precedent.normalize_research_sources({ResearchSource.xiaohongshu}) == set()
    availability = precedent.search_availability(
        public_available=True,
        provider_available=True,
        visual_platform_available=True,
    )
    assert availability.public is True
    assert availability.provider is True
    assert availability.visual_platform is False


def test_drawing_path_never_enables_public_or_provider_search() -> None:
    assert drawing.normalize_research_sources({ResearchSource.xiaohongshu}) == {
        ResearchSource.xiaohongshu
    }
    availability = drawing.search_availability(
        public_available=True,
        provider_available=True,
        visual_platform_available=True,
    )
    assert availability.public is False
    assert availability.provider is False
    assert availability.visual_platform is True
    assert drawing.unavailable_stop_reason() == "query_budget_exhausted"


def test_paths_own_different_terminal_rules() -> None:
    precedent_outcome = precedent.terminal_outcome(
        complete=False,
        covered_subquestions=1,
        browser_inspection_incomplete=False,
        usable_assets=0,
        preserved_assets=0,
        stop_reason="time_budget_exhausted",
    )
    drawing_outcome = drawing.terminal_outcome(
        complete=False,
        covered_subquestions=1,
        browser_inspection_incomplete=False,
        usable_assets=1,
        preserved_assets=1,
        stop_reason="query_budget_exhausted",
    )
    assert precedent_outcome == (RunStatus.partial, "time_budget_exhausted")
    assert drawing_outcome == (RunStatus.partial, "query_budget_exhausted")


def test_drawing_path_rejects_photo_dominant_cover_and_promotional_caption(
    tmp_path: Path,
) -> None:
    clean_path = tmp_path / "clean.png"
    clean = Image.new("RGB", (160, 160), "white")
    clean_draw = ImageDraw.Draw(clean)
    clean_draw.rectangle((25, 35, 135, 125), outline="black", width=3)
    clean_draw.line((25, 80, 135, 80), fill="black", width=2)
    clean.save(clean_path)

    photo_path = tmp_path / "photo.png"
    photo = Image.new("RGB", (160, 160), (10, 20, 30))
    photo_draw = ImageDraw.Draw(photo)
    for x in range(0, 160, 16):
        photo_draw.rectangle((x, 0, x + 8, 160), fill=(235, 120, 20))
    photo.save(photo_path)

    def visual(path: Path) -> InspectedVisual:
        return InspectedVisual(
            source_url="https://www.xiaohongshu.com/explore/note",
            image_url=None,
            storage_path=path,
            perceptual_hash=path.stem,
            asset_type=ArchitectureAssetType.section,
            relevance=4,
            observations=["可见剖面线稿"],
        )

    accepted, type_mismatches, quality_rejected = drawing.filter_inspected_visuals(
        [visual(clean_path), visual(photo_path)],
        question="精细线稿剖面图",
        caption="剖面表达参考",
    )
    assert [item.storage_path for item in accepted] == [clean_path]
    assert type_mismatches == 0
    assert quality_rejected == 1

    promo_path = tmp_path / "promo.png"
    promo = Image.new("RGB", (160, 160), "white")
    promo_draw = ImageDraw.Draw(promo)
    promo_draw.rectangle((50, 20, 110, 45), outline="black", width=1)
    promo_draw.rectangle((40, 115, 120, 140), outline="black", width=1)
    promo.save(promo_path)
    accepted, type_mismatches, quality_rejected = drawing.filter_inspected_visuals(
        [visual(promo_path)],
        question="精细线稿剖面图",
        caption="左滑！教你5步做出丰富的线稿风剖面图",
    )
    assert accepted == []
    assert type_mismatches == 0
    assert quality_rejected == 1


def test_drawing_path_rejects_incomplete_border_crop(tmp_path: Path) -> None:
    path = tmp_path / "cropped.png"
    image = Image.new("RGB", (160, 160), "white")
    image_draw = ImageDraw.Draw(image)
    image_draw.rectangle((115, 0, 159, 159), fill=(190, 190, 190))
    image_draw.rectangle((0, 145, 159, 159), fill=(160, 160, 160))
    image.save(path)
    visual = InspectedVisual(
        source_url="https://www.xiaohongshu.com/explore/note",
        image_url=None,
        storage_path=path,
        perceptual_hash="cropped",
        asset_type=ArchitectureAssetType.section,
        relevance=4,
        observations=["可见剖面线稿"],
    )

    accepted, type_mismatches, quality_rejected = drawing.filter_inspected_visuals(
        [visual],
        question="精细线稿剖面图",
        caption="制图分享｜细节满满且素雅的线稿风剖面",
    )
    assert accepted == []
    assert type_mismatches == 0
    assert quality_rejected == 1
