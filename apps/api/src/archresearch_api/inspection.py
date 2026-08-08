from __future__ import annotations

import base64
import hashlib
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any, Literal, Protocol
from urllib.parse import urlparse

import httpx
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field

from .visual import (
    ArchitectureAssetType,
    RemoteVisualCandidate,
    RemoteVisualClassification,
    RemoteVisualClassifier,
    VisualClassification,
    VisualClassifier,
)

MAX_MEDIA_PER_PAGE = 6
MAX_CROP_BYTES = 20 * 1024 * 1024
MAX_CROP_DIMENSION = 8_192
MAX_PREVIEW_BYTES = 2 * 1024 * 1024
MAX_PREVIEW_DIMENSION = 1_600
MAX_SCROLL_PASSES = 2
SCROLL_DISTANCE = 1_200
SCROLL_WAIT_MILLISECONDS = 350
LOCAL_IMAGE_BATCH_LIMIT = 4
LOCAL_IMAGE_MIN_RELEVANCE = 2


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
    link_url: str | None = None
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


SourcePageOpener = Callable[[str], OpenPageResult]
ImageFetcher = Callable[[str], bytes]


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
    public_page_text: str = "",
    open_page: SourcePageOpener | None = None,
    image_fetcher: ImageFetcher | None = None,
) -> list[InspectedVisual]:
    tab_id: int | None = None
    active_budget = budget if budget is not None else InspectionBudget()
    try:
        opened = (
            open_page(source_url)
            if open_page is not None
            else OpenPageResult.model_validate(
                browser.send_command_sync("open_url", {"url": source_url})
            )
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
        seen_media: set[tuple[object, ...]] = set()
        results: list[InspectedVisual] = []
        for pass_number in range(MAX_SCROLL_PASSES + 1):
            results.extend(
                _capture_candidates(
                    browser,
                    classifier,
                    run_id=run_id,
                    tab_id=tab_id,
                    source_url=source_url,
                    question=question,
                    candidate_root=candidate_root,
                    metadata=metadata,
                    snapshot=snapshot,
                    public_page_text=public_page_text,
                    media=_unseen_media(enumeration.media, seen_media),
                    budget=active_budget,
                    image_fetcher=image_fetcher or _download_xiaohongshu_media,
                )
            )
            if (
                pass_number == MAX_SCROLL_PASSES
                or active_budget.exhausted
                or len(seen_media) >= MAX_MEDIA_PER_PAGE
            ):
                break
            try:
                browser.send_command_sync(
                    "scroll",
                    {"tab_id": tab_id, "direction": "down", "distance": SCROLL_DISTANCE},
                )
                browser.send_command_sync("wait", {"milliseconds": SCROLL_WAIT_MILLISECONDS})
                enumeration = MediaEnumeration.model_validate(
                    browser.send_command_sync("enumerate_media", {"tab_id": tab_id})
                )
            except Exception:
                break
        return results
    finally:
        if tab_id is not None:
            browser.send_command_sync("close_tab", {"tab_id": tab_id})


@dataclass(frozen=True)
class _PreparedLocalImage:
    candidate_id: str
    image_bytes: bytes
    perceptual_hash: str
    preview_data_url: str


def inspect_local_images(
    classifier: VisualClassifier,
    *,
    run_id: str,
    source_url: str,
    image_paths: Sequence[Path],
    question: str,
    caption: str,
    candidate_root: Path,
    budget: InspectionBudget,
) -> list[InspectedVisual]:
    bounded_question = _bounded_text(question, 1_000)
    bounded_caption = _bounded_text(caption, 500)
    selected_paths = _evenly_sampled_paths(list(image_paths), LOCAL_IMAGE_BATCH_LIMIT)
    prepared: list[_PreparedLocalImage] = []
    seen_hashes: set[str] = set()
    for path in selected_paths:
        if not budget.reserve_capture():
            break
        try:
            image_bytes = path.read_bytes()
            if not image_bytes or len(image_bytes) > MAX_CROP_BYTES:
                continue
            perceptual_hash = difference_hash(image_bytes)
            if perceptual_hash in seen_hashes:
                continue
            seen_hashes.add(perceptual_hash)
            budget.seen_perceptual_hashes.add(perceptual_hash)
            preview_data_url, preview_size = _classifier_preview(image_bytes)
            if not budget.reserve_preview(preview_size):
                break
            prepared.append(
                _PreparedLocalImage(
                    candidate_id=f"image_{len(prepared) + 1}",
                    image_bytes=image_bytes,
                    perceptual_hash=perceptual_hash,
                    preview_data_url=preview_data_url,
                )
            )
        except (OSError, ValueError):
            continue
    if not prepared:
        return []

    candidates = [
        RemoteVisualCandidate(
            candidate_id=item.candidate_id,
            image_url=item.preview_data_url,
            caption=bounded_caption,
        )
        for item in prepared
    ]
    if isinstance(classifier, RemoteVisualClassifier):
        classifications = classifier.classify_remote_batch(
            candidates,
            question=bounded_question,
            project_text=bounded_caption,
        ).classifications
    else:
        classifications = [
            _classify_local_candidate(
                classifier,
                candidate,
                question=bounded_question,
                project_text=bounded_caption,
            )
            for candidate in candidates
        ]

    prepared_by_id = {item.candidate_id: item for item in prepared}
    results: list[InspectedVisual] = []
    for classification in classifications:
        prepared_item = prepared_by_id.get(classification.candidate_id)
        if (
            prepared_item is None
            or classification.asset_type is None
            or classification.relevance < LOCAL_IMAGE_MIN_RELEVANCE
            or not classification.observations
        ):
            continue
        visual_classification = VisualClassification(
            asset_type=classification.asset_type,
            relevance=classification.relevance,
            observations=classification.observations,
        )
        classification_key = (prepared_item.perceptual_hash, bounded_question)
        budget.accepted_classifications[classification_key] = visual_classification
        budget.accepted_source_urls[classification_key] = {source_url}
        content_digest = hashlib.sha256(prepared_item.image_bytes).hexdigest()
        storage_path = candidate_root / run_id / "candidates" / f"{content_digest}.png"
        storage_path.parent.mkdir(parents=True, exist_ok=True)
        storage_path.write_bytes(_normalized_png(prepared_item.image_bytes))
        results.append(
            InspectedVisual(
                source_url=source_url,
                image_url=None,
                storage_path=storage_path,
                perceptual_hash=prepared_item.perceptual_hash,
                asset_type=classification.asset_type,
                relevance=classification.relevance,
                observations=classification.observations,
            )
        )
    return results


def _classify_local_candidate(
    classifier: VisualClassifier,
    candidate: RemoteVisualCandidate,
    *,
    question: str,
    project_text: str,
) -> RemoteVisualClassification:
    result = classifier.classify(
        candidate.image_url,
        question=question,
        caption=candidate.caption,
        project_text=project_text,
    )
    return RemoteVisualClassification(
        candidate_id=candidate.candidate_id,
        asset_type=result.asset_type,
        relevance=result.relevance,
        observations=result.observations[:4],
    )


def _evenly_sampled_paths(paths: list[Path], limit: int) -> list[Path]:
    if len(paths) <= limit:
        return paths
    last_index = len(paths) - 1
    return [paths[round(position * last_index / (limit - 1))] for position in range(limit)]


def _normalized_png(image_bytes: bytes) -> bytes:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.load()
            normalized = image.convert("RGB")
            buffer = BytesIO()
            normalized.save(buffer, format="PNG", optimize=True)
            return buffer.getvalue()
    except (Image.DecompressionBombError, OSError, UnidentifiedImageError) as exc:
        raise ValueError("Local image could not be normalized") from exc


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
    public_page_text: str,
    media: list[PageMedia],
    budget: InspectionBudget,
    image_fetcher: ImageFetcher,
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
                _bounded_text(public_page_text, 600),
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
            if _is_xiaohongshu_original_media(source_url, item):
                image_bytes = _normalized_png(image_fetcher(item.url or ""))
            else:
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


def _is_xiaohongshu_original_media(source_url: str, item: PageMedia) -> bool:
    if item.media_type != "image" or not item.url:
        return False
    source = urlparse(source_url)
    source_host = (source.hostname or "").rstrip(".").lower()
    if (
        source.scheme != "https"
        or not _is_xiaohongshu_host(source_host)
        or not re.fullmatch(
            r"/(?:explore|discovery/item|search_result)/[^/]+/?",
            source.path,
        )
    ):
        return False
    media = urlparse(item.url)
    media_host = (media.hostname or "").rstrip(".").lower()
    return (
        media.scheme == "https"
        and not media.username
        and not media.password
        and media.port in {None, 443}
        and (media_host == "xhscdn.com" or media_host.endswith(".xhscdn.com"))
    )


def _is_xiaohongshu_host(hostname: str) -> bool:
    return hostname == "xiaohongshu.com" or hostname.endswith(".xiaohongshu.com")


def _download_xiaohongshu_media(url: str) -> bytes:
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").rstrip(".").lower()
    if (
        parsed.scheme != "https"
        or parsed.username
        or parsed.password
        or parsed.port not in {None, 443}
        or not (hostname == "xhscdn.com" or hostname.endswith(".xhscdn.com"))
    ):
        raise ValueError("Xiaohongshu media URL is not approved")
    headers = {
        "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5",
        "Referer": "https://www.xiaohongshu.com/",
        "User-Agent": "Mozilla/5.0 ArchResearch/2.2",
    }
    with httpx.Client(
        follow_redirects=False,
        headers=headers,
        timeout=10.0,
    ) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            if response.is_redirect:
                raise ValueError("Xiaohongshu media redirects are not allowed")
            content_type = response.headers.get("content-type", "").split(";", 1)[0]
            if not content_type.startswith("image/"):
                raise ValueError("Xiaohongshu media response is not an image")
            chunks: list[bytes] = []
            size = 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > MAX_CROP_BYTES:
                    raise ValueError("Xiaohongshu media exceeds the allowed size")
                chunks.append(chunk)
    image_bytes = b"".join(chunks)
    if not image_bytes:
        raise ValueError("Xiaohongshu media response was empty")
    return image_bytes


def _unseen_media(
    media: list[PageMedia],
    seen_media: set[tuple[object, ...]],
) -> list[PageMedia]:
    unseen: list[PageMedia] = []
    for item in media:
        if len(seen_media) >= MAX_MEDIA_PER_PAGE:
            break
        identity = _media_identity(item)
        if identity in seen_media:
            continue
        seen_media.add(identity)
        unseen.append(item)
    return unseen


def _media_identity(item: PageMedia) -> tuple[object, ...]:
    if item.url:
        return ("url", item.url)
    return (
        item.media_type,
        item.alt,
        item.adjacent_text,
        item.intrinsic_width,
        item.intrinsic_height,
        round(item.region.x),
        round(item.region.width),
        round(item.region.height),
    )


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
