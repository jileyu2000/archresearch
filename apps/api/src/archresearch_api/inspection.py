from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any, Literal, Protocol

from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field

from .visual import ArchitectureAssetType, VisualClassifier

MAX_MEDIA_PER_PAGE = 3
MAX_CROP_BYTES = 20 * 1024 * 1024
MAX_CROP_DIMENSION = 8_192


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
    storage_path: Path
    perceptual_hash: str
    asset_type: ArchitectureAssetType
    relevance: int
    observations: list[str]


def inspect_source_page(
    browser: BrowserCommandClient,
    classifier: VisualClassifier,
    *,
    run_id: str,
    source_url: str,
    question: str,
    candidate_root: Path,
) -> list[InspectedVisual]:
    tab_id: int | None = None
    try:
        opened = OpenPageResult.model_validate(
            browser.send_command_sync("open_url", {"url": source_url})
        )
        tab_id = opened.tab_id
        browser.send_command_sync("wait", {"milliseconds": 500})
        metadata = PageMetadata.model_validate(
            browser.send_command_sync("page_metadata", {"tab_id": tab_id})
        )
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
            media=enumeration.media[:MAX_MEDIA_PER_PAGE],
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
    media: list[PageMedia],
) -> list[InspectedVisual]:
    results: list[InspectedVisual] = []
    project_text = _bounded_text(
        " ".join(
            item
            for item in (metadata.title, metadata.publisher or "", metadata.description or "")
            if item
        ),
        1_200,
    )
    for item in media:
        try:
            captured = CaptureResult.model_validate(
                browser.send_command_sync(
                    "capture_region",
                    {"tab_id": tab_id, "region": item.region.model_dump(mode="json")},
                )
            )
            image_bytes = _decode_crop(captured.image_data_url)
            perceptual_hash = difference_hash(image_bytes)
            classification = classifier.classify(
                captured.image_data_url,
                question=_bounded_text(question, 1_000),
                caption=_bounded_text(f"{item.alt} {item.adjacent_text}", 500),
                project_text=project_text,
            )
            content_digest = hashlib.sha256(image_bytes).hexdigest()
            storage_path = candidate_root / run_id / "candidates" / f"{content_digest}.png"
            storage_path.parent.mkdir(parents=True, exist_ok=True)
            storage_path.write_bytes(image_bytes)
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
