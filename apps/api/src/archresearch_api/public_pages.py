from __future__ import annotations

import ipaddress
import re
from typing import Any, Protocol, runtime_checkable
from urllib.parse import unquote, urlparse

import httpx
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .visual import ArchitectureAssetType

MAX_MARKDOWN_CHARS = 12_000
MAX_LINKS = 40
MAX_IMAGES = 40
FIRECRAWL_REQUEST_TIMEOUT_SECONDS = 20.0
IMAGE_DELIVERY_VARIANTS = {
    "thumb_jpg": 0,
    "small_jpg": 1,
    "newsletter": 2,
    "slideshow": 3,
    "medium_jpg": 3,
    "large_jpg": 4,
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ParsedPageImage(StrictModel):
    url: str
    alt: str = Field(default="", max_length=300)

    @field_validator("url")
    @classmethod
    def require_public_url(cls, value: str) -> str:
        return _public_http_url(value)


class ParsedPublicPage(StrictModel):
    source_url: str
    title: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=1_000)
    markdown: str = Field(default="", max_length=MAX_MARKDOWN_CHARS)
    links: list[str] = Field(default_factory=list, max_length=MAX_LINKS)
    images: list[ParsedPageImage] = Field(default_factory=list, max_length=MAX_IMAGES)

    @field_validator("source_url")
    @classmethod
    def require_public_source(cls, value: str) -> str:
        return _public_http_url(value)

    @field_validator("links")
    @classmethod
    def require_public_links(cls, values: list[str]) -> list[str]:
        return [_public_http_url(value) for value in values]


class PublicSearchLead(StrictModel):
    url: str
    title: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=1_000)

    @field_validator("url")
    @classmethod
    def require_public_url(cls, value: str) -> str:
        return _public_http_url(value)


class PublicPageParser(Protocol):
    name: str

    def parse(self, url: str) -> ParsedPublicPage: ...


@runtime_checkable
class PublicSearchProvider(Protocol):
    name: str

    def search(
        self,
        query: str,
        *,
        limit: int,
        include_domains: list[str],
    ) -> list[PublicSearchLead]: ...


class FirecrawlPageParser:
    name = "firecrawl"
    worst_case_call_seconds = FIRECRAWL_REQUEST_TIMEOUT_SECONDS

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.firecrawl.dev/v2",
        client: httpx.Client | None = None,
    ) -> None:
        normalized_key = api_key.strip()
        if not normalized_key:
            raise ValueError("Firecrawl API key is required")
        self.api_key = normalized_key
        self.base_url = _public_https_base_url(base_url)
        self.client = client or httpx.Client(timeout=FIRECRAWL_REQUEST_TIMEOUT_SECONDS)

    def search(
        self,
        query: str,
        *,
        limit: int = 4,
        include_domains: list[str] | None = None,
    ) -> list[PublicSearchLead]:
        bounded_query = " ".join(query.split())[:500]
        if not bounded_query:
            raise ValueError("Firecrawl search query is required")
        if limit < 1 or limit > 10:
            raise ValueError("Firecrawl search limit must be between 1 and 10")
        domains = _bounded_domains(include_domains or [])
        request_body: dict[str, Any] = {
            "query": bounded_query,
            "limit": limit,
            "sources": ["web"],
            "ignoreInvalidURLs": True,
            "timeout": int(FIRECRAWL_REQUEST_TIMEOUT_SECONDS * 1_000),
        }
        if domains:
            request_body["includeDomains"] = domains
        response = self.client.post(
            f"{self.base_url}/search",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=request_body,
        )
        response.raise_for_status()
        payload: Any = response.json()
        if not isinstance(payload, dict) or payload.get("success") is not True:
            raise ValueError("Firecrawl did not return a successful search")
        data = payload.get("data")
        if not isinstance(data, dict):
            raise ValueError("Firecrawl search did not return valid data")
        web_results = data.get("web")
        if not isinstance(web_results, list):
            return []

        leads: list[PublicSearchLead] = []
        seen: set[str] = set()
        for item in web_results:
            if len(leads) >= limit:
                break
            if not isinstance(item, dict) or not isinstance(item.get("url"), str):
                continue
            try:
                lead = PublicSearchLead(
                    url=item["url"],
                    title=_bounded_string(item.get("title"), 500),
                    description=_bounded_string(item.get("description"), 1_000),
                )
            except ValueError:
                continue
            if lead.url in seen:
                continue
            seen.add(lead.url)
            leads.append(lead)
        return leads

    def parse(self, url: str) -> ParsedPublicPage:
        source_url = _public_http_url(url)
        response = self.client.post(
            f"{self.base_url}/scrape",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "url": source_url,
                "formats": ["markdown", "links", "images"],
                "onlyMainContent": True,
                "maxAge": 0,
                "timeout": int(FIRECRAWL_REQUEST_TIMEOUT_SECONDS * 1_000),
            },
        )
        response.raise_for_status()
        payload: Any = response.json()
        if not isinstance(payload, dict) or payload.get("success") is not True:
            raise ValueError("Firecrawl did not return a successful scrape")
        data = payload.get("data")
        if not isinstance(data, dict):
            raise ValueError("Firecrawl did not return valid data")

        markdown = _bounded_string(data.get("markdown"), MAX_MARKDOWN_CHARS)
        metadata_value = data.get("metadata")
        metadata: dict[str, Any] = metadata_value if isinstance(metadata_value, dict) else {}
        links = _public_url_list(data.get("links"), MAX_LINKS)
        images = _page_images(data.get("images"), markdown)
        return ParsedPublicPage(
            source_url=source_url,
            title=_bounded_string(metadata.get("title"), 500),
            description=_bounded_string(metadata.get("description"), 1_000),
            markdown=markdown,
            links=links,
            images=images,
        )


def infer_architecture_asset_type(image: ParsedPageImage) -> ArchitectureAssetType | None:
    text = unquote(f"{image.alt} {urlparse(image.url).path}").lower()
    patterns: tuple[tuple[ArchitectureAssetType, tuple[str, ...]], ...] = (
        (ArchitectureAssetType.site_plan, ("site plan", "site-plan", "masterplan", "总平面")),
        (ArchitectureAssetType.section, ("section", "cross-section", "剖面")),
        (ArchitectureAssetType.elevation, ("elevation", "facade-drawing", "立面")),
        (ArchitectureAssetType.axonometric, ("axonometric", "isometric", "轴测")),
        (ArchitectureAssetType.circulation, ("circulation", "flow-diagram", "流线")),
        (ArchitectureAssetType.analysis_diagram, ("analysis", "diagram", "分析图")),
        (ArchitectureAssetType.render, ("render", "visualization", "效果图")),
        (ArchitectureAssetType.plan, ("floor plan", "floor-plan", "ground-plan", "平面图")),
    )
    for asset_type, keywords in patterns:
        if any(keyword in text for keyword in keywords):
            return asset_type
    return None


def _page_images(value: Any, markdown: str) -> list[ParsedPageImage]:
    markdown_alts: dict[str, str] = {}
    for match in re.finditer(r"!\[([^\]]*)\]\((https?://[^)\s]+)[^)]*\)", markdown):
        try:
            image_url = _public_http_url(match.group(2))
        except ValueError:
            continue
        markdown_alts[image_url] = " ".join(match.group(1).split())[:300]

    candidates: list[tuple[str, str]] = list(markdown_alts.items())
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str):
                candidates.append((item, markdown_alts.get(item, "")))
            elif isinstance(item, dict):
                raw_url = item.get("url")
                raw_alt = item.get("alt")
                if isinstance(raw_url, str):
                    candidates.append((raw_url, raw_alt if isinstance(raw_alt, str) else ""))

    selected: dict[str, tuple[int, ParsedPageImage]] = {}
    order: list[str] = []
    for raw_url, alt in candidates:
        try:
            image_url = _public_http_url(raw_url)
        except ValueError:
            continue
        key, quality = _image_delivery_identity(image_url)
        image = ParsedPageImage(url=image_url, alt=" ".join(alt.split())[:300])
        current = selected.get(key)
        if current is None:
            order.append(key)
            selected[key] = (quality, image)
        elif quality > current[0]:
            if not image.alt:
                image = image.model_copy(update={"alt": current[1].alt})
            selected[key] = (quality, image)
    return [selected[key][1] for key in order[:MAX_IMAGES]]


def _image_delivery_identity(value: str) -> tuple[str, int]:
    parsed = urlparse(value)
    parts = parsed.path.split("/")
    for index, part in enumerate(parts):
        quality = IMAGE_DELIVERY_VARIANTS.get(part.lower())
        if quality is None:
            continue
        parts[index] = "{variant}"
        lower_parts = [path_part.lower() for path_part in parts]
        for media_index in range(len(lower_parts) - 1):
            if lower_parts[media_index : media_index + 2] == ["media", "images"]:
                shared_path = "/".join(lower_parts[media_index:])
                return f"shared-media:{shared_path}", quality
        identity = parsed._replace(path="/".join(parts), query="", fragment="").geturl()
        return identity, quality
    return value, 0


def _public_url_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    urls: list[str] = []
    for item in value:
        if len(urls) >= limit:
            break
        if not isinstance(item, str):
            continue
        try:
            public_url = _public_http_url(item)
        except ValueError:
            continue
        if public_url not in urls:
            urls.append(public_url)
    return urls


def _bounded_string(value: Any, limit: int) -> str:
    return value[:limit] if isinstance(value, str) else ""


def _bounded_domains(values: list[str]) -> list[str]:
    domains: list[str] = []
    for value in values:
        domain = value.strip().lower().rstrip(".")
        if (
            domain
            and len(domain) <= 253
            and "/" not in domain
            and ":" not in domain
            and domain not in domains
        ):
            domains.append(domain)
    return domains[:20]


def _public_https_base_url(value: str) -> str:
    normalized = _public_http_url(value)
    if urlparse(normalized).scheme != "https":
        raise ValueError("Firecrawl base URL must be public HTTPS")
    return normalized.rstrip("/")


def _public_http_url(value: str) -> str:
    if value.count("(") != value.count(")"):
        raise ValueError("URL contains unmatched parentheses")
    parsed = urlparse(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("Only public HTTP(S) URLs are allowed")
    hostname = parsed.hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith((".localhost", ".local")):
        raise ValueError("Only public HTTP(S) URLs are allowed")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        return value
    if not address.is_global:
        raise ValueError("Only public HTTP(S) URLs are allowed")
    return value
