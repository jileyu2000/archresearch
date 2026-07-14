from __future__ import annotations

import base64
import hashlib
from collections.abc import Callable
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any, Literal, Protocol

from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field

from .visual import ArchitectureAssetType, VisualClassification, VisualClassifier

MAX_MEDIA_PER_PAGE = 6
MAX_CROP_BYTES = 20 * 1024 * 1024
MAX_CROP_DIMENSION = 8_192
MAX_PREVIEW_BYTES = 2 * 1024 * 1024
MAX_PREVIEW_DIMENSION = 1_600


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class OpenPageResult(StrictModel):
    tab_id: int = Field(ge=1)
    url: str


class PageMetadata(StrictModel):
    url: str
    title: str = ""
    canonical_url: str | None = None
    language: str | None = None
    description: str | None = None
    publisher: str | None = None


class SemanticBlock(StrictModel):
    kind: Literal["heading", "paragraph", "caption"]
    text: str = Field(min_length=1, max_length=500)


class PageSnapshot(StrictModel):
    blocks: list[SemanticBlock] = Field(default_factory=list, max_length=40)
    truncated: bool = False


class MediaRegion(StrictModel):
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(gt=0, le=8_192)
    height: float = Field(gt=0, le=8_192)


class PageMedia(StrictModel):
    media_type: Literal["image", "canvas", "svg"]
    url: str | None
    alt: str = ""
    adjacent_text: str = ""
    intrinsic_width: int = Field(gt=0)
    intrinsic_height: int = Field(gt=0)
    region: MediaRegion


class MediaEnumeration(StrictModel):
    media: list[PageMedia]


class CaptureResult(StrictModel):
    image_data_url: str
    media_type: Literal["image/png"]


class BrowserCommandClient(Protocol):
    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any: ...


@dataclass(frozen=True)
class InspectedVisual:
    source_url: str
    image_url: str | None
    storage_path: Path | None
    perceptual_hash: str
    asset_type: ArchitectureAssetType
    relevance: int
    observations: list[str]


@dataclass
class InspectionBudget:
    max_calls: int = MAX_MEDIA_PER_PAGE
    max_bytes: int = MAX_PREVIEW_BYTES * MAX_MEDIA_PER_PAGE
    used_calls: int = 0
    used_bytes: int = 0
    byte_limit_reached: bool = False
    seen_perceptual_hashes: set[str] = field(default_factory=set)
    accepted_classifications: dict[tuple[str, str], VisualClassification] = field(
        default_factory=dict
    )
    accepted_source_urls: dict[tuple[str, str], set[str]] = field(default_factory=dict)
    on_change: Callable[[InspectionBudget], None] | None = field(
        default=None,
        repr=False,
        compare=False,
    )

    def __post_init__(self) -> None:
        if self.max_calls < 0 or self.max_bytes < 0:
            raise ValueError("Inspection budget limits cannot be negative")

    def reserve_capture(self) -> bool:
        if self.used_calls >= self.max_calls:
            return False
        self.used_calls += 1
        self._notify_change()
        return True

    def reserve_preview(self, preview_size: int) -> bool:
        if self.used_bytes + preview_size > self.max_bytes:
            if not self.byte_limit_reached:
                self.byte_limit_reached = True
                self._notify_change()
            return False
        self.used_bytes += preview_size
        self._notify_change()
        return True

    def _notify_change(self) -> None:
        if self.on_change is not None:
            self.on_change(self)

    @property
    def exhausted(self) -> bool:
        return self.used_calls >= self.max_calls or self.byte_limit_reached


def inspect_source_page(
    browser: BrowserCommandClient,
    classifier: VisualClassifier,
    *,
    run_id: str,
    source_url: str,
    question: str,
    candidate_root: Path,
    budget: InspectionBudget | None = None,
) -> list[InspectedVisual]:
    tab_id: int | None = None
    active_budget = budget if budget is not None else InspectionBudget()
    try:
        opened = OpenPageResult.model_validate(
            browser.send_command_sync("open_url", {"url": source_url})
        )
        tab_id = opened.tab_id
        browser.send_command_sync("wait", {"milliseconds": 500})
        metadata = PageMetadata.model_validate(
            browser.send_command_sync("page_metadata", {"tab_id": tab_id})
        )
        snapshot = _optional_page_snapshot(browser, tab_id)
        enumeration = MediaEnumeration.model_validate(
            browser.send_command_sync("enumerate_media", {"tab_id": tab_id})
        )
        return _capture_candidates(
            browser,
            classifier,
            run_id=run_id,
            tab_id=tab_id,
            source_url=source_url,
            question=question,
            candidate_root=candidate_root,
            metadata=metadata,
            snapshot=snapshot,
            media=enumeration.media[:MAX_MEDIA_PER_PAGE],
            budget=active_budget,
        )
    finally:
        if tab_id is not None:
            browser.send_command_sync("close_tab", {"tab_id": tab_id})


def _capture_candidates(
    browser: BrowserCommandClient,
    classifier: VisualClassifier,
    *,
    run_id: str,
    tab_id: int,
    source_url: str,
    question: str,
    candidate_root: Path,
    metadata: PageMetadata,
    snapshot: PageSnapshot,
    media: list[PageMedia],
    budget: InspectionBudget,
) -> list[InspectedVisual]:
    results: list[InspectedVisual] = []
    snapshot_text = " ".join(block.text for block in snapshot.blocks)
    project_text = _bounded_text(
        " ".join(
            item
            for item in (
                _bounded_text(metadata.title, 300),
                _bounded_text(metadata.publisher or "", 150),
                _bounded_text(snapshot_text, 600),
                _bounded_text(metadata.description or "", 300),
            )
            if item
        ),
        1_200,
    )
    bounded_question = _bounded_text(question, 1_000)
    for item in media:
        if not budget.reserve_capture():
            break
        try:
            captured = CaptureResult.model_validate(
                browser.send_command_sync(
                    "capture_region",
                    {"tab_id": tab_id, "region": item.region.model_dump(mode="json")},
                )
            )
            image_bytes = _decode_crop(captured.image_data_url)
            perceptual_hash = difference_hash(image_bytes)
            budget.seen_perceptual_hashes.add(perceptual_hash)
            classification_key = (perceptual_hash, bounded_question)
            accepted_classification = budget.accepted_classifications.get(classification_key)
            if accepted_classification is not None:
                accepted_sources = budget.accepted_source_urls.setdefault(classification_key, set())
                if source_url not in accepted_sources:
                    results.append(
                        InspectedVisual(
                            source_url=source_url,
                            image_url=item.url,
                            storage_path=None,
                            perceptual_hash=perceptual_hash,
                            asset_type=accepted_classification.asset_type,
                            relevance=accepted_classification.relevance,
                            observations=list(accepted_classification.observations),
                        )
                    )
                    accepted_sources.add(source_url)
                continue
            preview_data_url, preview_size = _classifier_preview(image_bytes)
            if not budget.reserve_preview(preview_size):
                break
            classification = classifier.classify(
                preview_data_url,
                question=bounded_question,
                caption=_bounded_text(f"{item.alt} {item.adjacent_text}", 500),
                project_text=project_text,
            )
            storage_path: Path | None = None
            if not any(
                accepted_hash == perceptual_hash
                for accepted_hash, _ in budget.accepted_classifications
            ):
                content_digest = hashlib.sha256(image_bytes).hexdigest()
                storage_path = candidate_root / run_id / "candidates" / f"{content_digest}.png"
                storage_path.parent.mkdir(parents=True, exist_ok=True)
                storage_path.write_bytes(image_bytes)
            budget.accepted_classifications[classification_key] = classification
            budget.accepted_source_urls[classification_key] = {source_url}
            results.append(
                InspectedVisual(
                    source_url=source_url,
                    image_url=item.url,
                    storage_path=storage_path,
                    perceptual_hash=perceptual_hash,
                    asset_type=classification.asset_type,
                    relevance=classification.relevance,
                    observations=classification.observations,
                )
            )
        except Exception:
            continue
    return results


def _optional_page_snapshot(
    browser: BrowserCommandClient,
    tab_id: int,
) -> PageSnapshot:
    try:
        return PageSnapshot.model_validate(
            browser.send_command_sync("page_snapshot", {"tab_id": tab_id})
        )
    except Exception:
        return PageSnapshot()


def difference_hash(image_bytes: bytes) -> str:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            if image.width > MAX_CROP_DIMENSION or image.height > MAX_CROP_DIMENSION:
                raise ValueError("Browser crop dimensions exceed the allowed size")
            image.load()
            grayscale = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
            pixels = grayscale.tobytes()
    except (Image.DecompressionBombError, OSError, UnidentifiedImageError) as exc:
        raise ValueError("Browser crop could not be decoded as an image") from exc

    value = 0
    for row in range(8):
        offset = row * 9
        for column in range(8):
            value = (value << 1) | int(pixels[offset + column] > pixels[offset + column + 1])
    return f"{value:016x}"


def _classifier_preview(image_bytes: bytes) -> tuple[str, int]:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.load()
            if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                rgba = image.convert("RGBA")
                preview = Image.new("RGB", rgba.size, "white")
                preview.paste(rgba, mask=rgba.getchannel("A"))
            else:
                preview = image.convert("RGB")
    except (Image.DecompressionBombError, OSError, UnidentifiedImageError) as exc:
        raise ValueError("Browser crop could not be prepared for classification") from exc

    for maximum_dimension in (MAX_PREVIEW_DIMENSION, 1_280, 1_024, 800, 640, 512):
        resized = preview.copy()
        resized.thumbnail((maximum_dimension, maximum_dimension), Image.Resampling.LANCZOS)
        for quality in (82, 68, 52):
            buffer = BytesIO()
            resized.save(buffer, format="JPEG", quality=quality, optimize=True)
            preview_bytes = buffer.getvalue()
            if len(preview_bytes) <= MAX_PREVIEW_BYTES:
                encoded = base64.b64encode(preview_bytes).decode("ascii")
                return f"data:image/jpeg;base64,{encoded}", len(preview_bytes)
    raise ValueError("Browser crop preview exceeds the allowed size")


def _decode_crop(data_url: str) -> bytes:
    prefix = "data:image/png;base64,"
    if not data_url.startswith(prefix):
        raise ValueError("Browser crop must be a PNG data URL")
    image_bytes = base64.b64decode(data_url[len(prefix) :], validate=True)
    if not image_bytes or len(image_bytes) > MAX_CROP_BYTES:
        raise ValueError("Browser crop is outside the allowed size")
    return image_bytes


def _bounded_text(value: str, maximum_length: int) -> str:
    return " ".join(value.split())[:maximum_length]
