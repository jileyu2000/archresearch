from __future__ import annotations

import ipaddress
import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol, TypeVar, runtime_checkable
from urllib.parse import quote_plus, unquote, urlparse

from playwright.sync_api import Page, Route, sync_playwright
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .visual import ArchitectureAssetType

MAX_MARKDOWN_CHARS = 12_000
MAX_LINKS = 40
MAX_IMAGES = 40
LOCAL_BROWSER_TIMEOUT_SECONDS = 20.0
LOCAL_BROWSER_NAVIGATION_TIMEOUT_MS = 15_000
LOCAL_BROWSER_SETTLE_MS = 3_500
LOCAL_BROWSER_REREAD_MS = 1_000
LOCAL_BROWSER_SEARCH_URL = "https://www.bing.com/search"
SITE_SEARCH_URLS = {
    "archdaily.com": "https://www.archdaily.com/search/projects?q={query}",
    "archdaily.cn": "https://www.archdaily.cn/cn/search/projects?q={query}",
    "designboom.com": "https://www.designboom.com/?s={query}",
    "dezeen.com": "https://www.dezeen.com/?s={query}",
    "divisare.com": "https://divisare.com/search?q={query}",
}
IMAGE_DELIVERY_VARIANTS = {
    "thumb_jpg": 0,
    "small_jpg": 1,
    "newsletter": 2,
    "slideshow": 3,
    "medium_jpg": 3,
    "large_jpg": 4,
}
PROJECT_PATH_MARKERS = {"architecture", "portfolio", "project", "projects", "work", "works"}
NON_PROJECT_PATH_MARKERS = {
    "about",
    "author",
    "authors",
    "categories",
    "category",
    "contact",
    "search",
    "tag",
    "tags",
}
ARCHDAILY_DOMAINS = {"archdaily.com", "archdaily.cn"}


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


@dataclass(frozen=True)
class BrowserLinkSnapshot:
    url: str
    text: str = ""


@dataclass(frozen=True)
class BrowserImageSnapshot:
    url: str
    alt: str = ""


@dataclass(frozen=True)
class BrowserPageSnapshot:
    url: str
    title: str = ""
    description: str = ""
    text: str = ""
    links: list[BrowserLinkSnapshot] | None = None
    images: list[BrowserImageSnapshot] | None = None


@dataclass(frozen=True)
class BrowserSearchSnapshot:
    url: str
    title: str = ""
    description: str = ""


class LocalBrowserBackend(Protocol):
    def read(self, url: str) -> BrowserPageSnapshot: ...

    def search(self, url: str) -> list[BrowserSearchSnapshot]: ...


ResultT = TypeVar("ResultT")


class PlaywrightBrowserBackend:
    """Fixed, read-only browser operations over an isolated system-Chrome context."""

    def read(self, url: str) -> BrowserPageSnapshot:
        return self._visit(
            url,
            self._read_settled_page,
            scroll=True,
            settle_ms=LOCAL_BROWSER_SETTLE_MS,
        )

    def search(self, url: str) -> list[BrowserSearchSnapshot]:
        return self._visit(url, self._read_search_results, scroll=False, settle_ms=3_500)

    def _visit(
        self,
        url: str,
        reader: Callable[[Page], ResultT],
        *,
        scroll: bool,
        settle_ms: int,
    ) -> ResultT:
        safe_url = _public_http_url(url)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                channel="chrome",
                headless=True,
                args=[
                    "--disable-background-networking",
                    "--disable-component-update",
                    "--disable-sync",
                    "--no-first-run",
                ],
            )
            context = browser.new_context(
                accept_downloads=False,
                locale="zh-CN",
                service_workers="block",
                viewport={"width": 1440, "height": 900},
            )
            try:
                page = context.new_page()
                page.route("**/*", self._route_request)
                page.on("dialog", lambda dialog: dialog.dismiss())
                page.on("download", lambda download: download.cancel())
                page.goto(
                    safe_url,
                    wait_until="domcontentloaded",
                    timeout=LOCAL_BROWSER_NAVIGATION_TIMEOUT_MS,
                )
                page.wait_for_timeout(settle_ms)
                if scroll:
                    page.evaluate(
                        "window.scrollTo(0, Math.min(document.body.scrollHeight, "
                        "window.innerHeight * 1.5))"
                    )
                    page.wait_for_timeout(250)
                return reader(page)
            finally:
                context.close()
                browser.close()

    @staticmethod
    def _route_request(route: Route) -> None:
        request = route.request
        if request.resource_type in {"font", "image", "media"}:
            route.abort()
            return
        parsed = urlparse(request.url)
        if parsed.scheme in {"http", "https"}:
            try:
                _public_http_url(request.url)
            except ValueError:
                route.abort()
                return
        route.continue_()

    def _read_settled_page(self, page: Page) -> BrowserPageSnapshot:
        first = self._read_page(page)
        page.wait_for_timeout(LOCAL_BROWSER_REREAD_MS)
        second = self._read_page(page)
        return max((first, second), key=lambda snapshot: len(snapshot.text))

    @staticmethod
    def _read_page(page: Page) -> BrowserPageSnapshot:
        page_title = page.title()
        description_locator = page.locator(
            'meta[name="description"], meta[property="og:description"]'
        )
        description = (
            description_locator.first.get_attribute("content", timeout=3_000)
            if description_locator.count() > 0
            else None
        )
        raw_content: Any = page.locator("article, main, [role=main]").evaluate_all(
            "elements => elements.map(element => ({"
            "text: (element.innerText || '').trim(), "
            "kind: element.tagName?.toLowerCase() || '', "
            "images: Array.from(element.querySelectorAll("
            "'img[src], img[data-src], source[srcset]')).map(image => ({"
            "url: image.currentSrc || image.src || image.dataset?.src || "
            "image.srcset?.split(',')[0]?.trim().split(' ')[0] || '', "
            "alt: image.alt || ''}))}))"
        )
        content_texts = [
            item["text"]
            for item in raw_content
            if isinstance(item, dict) and isinstance(item.get("text"), str)
        ]
        body_text = page.locator("body").inner_text(timeout=3_000)
        text = max([*content_texts, body_text], key=len)
        raw_links: Any = page.locator("a[href]").evaluate_all(
            "elements => elements.map(element => ({"
            "url: element.href || '', text: (element.innerText || '').trim()}))"
        )
        raw_images: Any = page.locator(
            "img[src], img[data-src], source[srcset], meta[property='og:image']"
        ).evaluate_all(
            "elements => elements.map(element => ({"
            "url: element.currentSrc || element.src || element.dataset?.src || "
            "element.srcset?.split(',')[0]?.trim().split(' ')[0] || "
            "element.content || '', alt: element.alt || '', "
            "link_url: element.closest('a[href]')?.href || ''}))"
        )
        semantic_content = [
            item
            for item in raw_content
            if isinstance(item, dict)
            and isinstance(item.get("text"), str)
            and isinstance(item.get("images"), list)
            and item["images"]
        ]
        if semantic_content:
            article_content = [
                item
                for item in semantic_content
                if item.get("kind") == "article" and len(item["text"]) >= 1_000
            ]
            image_content = article_content or semantic_content
            semantic_images = max(image_content, key=lambda item: len(item["text"]))["images"]
            raw_images = _merge_raw_images(
                semantic_images,
                _project_matched_raw_images(raw_images, page_title, page.url),
            )
        return BrowserPageSnapshot(
            url=page.url,
            title=page_title,
            description=description or "",
            text=text,
            links=_link_snapshots(raw_links),
            images=_image_snapshots(raw_images),
        )

    @staticmethod
    def _read_search_results(page: Page) -> list[BrowserSearchSnapshot]:
        rss_items = page.locator("item")
        if rss_items.count() > 0:
            raw_results: Any = rss_items.evaluate_all(
                "elements => elements.map(element => {"
                "const description = document.createElement('div');"
                "description.innerHTML = element.querySelector('description')?.textContent || '';"
                "return {url: element.querySelector('link')?.textContent?.trim() || '', "
                "title: element.querySelector('title')?.textContent?.trim() || '', "
                "description: description.textContent?.trim() || ''};})"
            )
        else:
            raw_results = page.locator("a[href]").evaluate_all(
                "elements => elements.slice(0, 300).map(element => {"
                "const container = element.closest('article, li, [class*=card], [class*=result]');"
                "return {url: element.href || '', "
                "title: (element.innerText || element.textContent || '').trim(), "
                "description: (container?.innerText || '').trim()};})"
            )
        return _search_snapshots(raw_results)


class LocalBrowserPageParser:
    name = "local_browser"
    worst_case_call_seconds = LOCAL_BROWSER_TIMEOUT_SECONDS

    def __init__(self, backend: LocalBrowserBackend | None = None) -> None:
        self.backend = backend or PlaywrightBrowserBackend()

    def search(
        self,
        query: str,
        *,
        limit: int = 4,
        include_domains: list[str] | None = None,
    ) -> list[PublicSearchLead]:
        bounded_query = " ".join(query.split())[:500]
        if not bounded_query:
            raise ValueError("Public search query is required")
        if limit < 1 or limit > 10:
            raise ValueError("Public search limit must be between 1 and 10")
        domains = _bounded_domains(include_domains or [])
        search_url = _browser_search_url(bounded_query, domains, limit)
        results = self.backend.search(search_url)

        selected: dict[str, PublicSearchLead] = {}
        order: list[str] = []
        initial_metadata: dict[str, bool] = {}
        for item in results:
            try:
                lead = PublicSearchLead(
                    url=_canonical_page_url(item.url),
                    title=" ".join(item.title.split())[:500],
                    description=" ".join(item.description.split())[:1_000],
                )
            except ValueError:
                continue
            if domains and not _url_matches_any_domain(lead.url, domains):
                continue
            if len(domains) == 1 and not _is_known_site_result(lead.url, domains[0]):
                continue
            current = selected.get(lead.url)
            if current is None:
                order.append(lead.url)
                initial_metadata[lead.url] = bool(lead.title.strip() or lead.description.strip())
                selected[lead.url] = lead
            elif len(lead.title) + len(lead.description) > len(current.title) + len(
                current.description
            ):
                selected[lead.url] = lead
        preserve_site_order = bool(order[:limit]) and all(
            not initial_metadata[url] for url in order[:limit]
        )
        ranked = (
            order
            if preserve_site_order
            else sorted(
                order,
                key=lambda url: (
                    public_search_relevance_score(
                        bounded_query,
                        title=selected[url].title,
                        description=selected[url].description,
                        url=selected[url].url,
                    )
                    if selected[url].title.strip() or selected[url].description.strip()
                    else 0
                ),
                reverse=True,
            )
        )
        return [selected[url] for url in ranked[:limit]]

    def parse(self, url: str) -> ParsedPublicPage:
        source_url = _public_http_url(url)
        snapshot = self.backend.read(source_url)
        final_url = _public_http_url(snapshot.url)
        safe_links = _safe_link_snapshots(snapshot.links or [])
        link_markdown = "\n".join(f"[{link.text}]({link.url})" for link in safe_links if link.text)
        markdown = "\n\n".join(part for part in (snapshot.text, link_markdown) if part)[
            :MAX_MARKDOWN_CHARS
        ]
        raw_images = [{"url": image.url, "alt": image.alt} for image in (snapshot.images or [])]
        return ParsedPublicPage(
            source_url=final_url,
            title=" ".join(snapshot.title.split())[:500],
            description=" ".join(snapshot.description.split())[:1_000],
            markdown=markdown,
            links=[link.url for link in safe_links[:MAX_LINKS]],
            images=_page_images(raw_images, markdown),
        )


def infer_architecture_asset_type(image: ParsedPageImage) -> ArchitectureAssetType | None:
    text = unquote(f"{image.alt} {urlparse(image.url).path}").lower()
    patterns: tuple[tuple[ArchitectureAssetType, tuple[str, ...]], ...] = (
        (ArchitectureAssetType.site_plan, ("site plan", "site-plan", "masterplan", "总平面")),
        (
            ArchitectureAssetType.section,
            ("section", "cross-section", "seccion", "sección", "剖面"),
        ),
        (ArchitectureAssetType.elevation, ("elevation", "facade-drawing", "立面")),
        (
            ArchitectureAssetType.axonometric,
            (
                "axonometric",
                "axonometria",
                "axonometría",
                "isometric",
                "-axo.",
                "_axo.",
                "轴测",
            ),
        ),
        (ArchitectureAssetType.circulation, ("circulation", "flow-diagram", "流线")),
        (ArchitectureAssetType.analysis_diagram, ("analysis", "diagram", "分析图")),
        (ArchitectureAssetType.render, ("render", "visualization", "效果图")),
        (ArchitectureAssetType.plan, ("floor plan", "floor-plan", "ground-plan", "平面图")),
    )
    for asset_type, keywords in patterns:
        if any(keyword in text for keyword in keywords):
            return asset_type
    return None


def select_project_page_links(page: ParsedPublicPage, *, limit: int = 2) -> list[str]:
    source_host = _normalized_host(page.source_url)
    source_identity = _canonical_page_url(page.source_url)
    is_archdaily = source_host in ARCHDAILY_DOMAINS
    if is_archdaily and is_concrete_project_page(page):
        return []
    labeled_archdaily_projects = (
        _markdown_project_urls(page.markdown, source_host) if is_archdaily else set()
    )
    selected: list[str] = []
    for link in page.links:
        if len(selected) >= limit:
            break
        parsed = urlparse(link)
        segments = [unquote(segment).casefold() for segment in parsed.path.split("/") if segment]
        if (
            _normalized_host(link) != source_host
            or _canonical_page_url(link) == source_identity
            or any(segment in NON_PROJECT_PATH_MARKERS for segment in segments)
        ):
            continue
        if is_archdaily:
            if _canonical_page_url(
                link
            ) not in labeled_archdaily_projects or not _is_archdaily_numeric_project_path(link):
                continue
        elif not (
            any(
                segment in PROJECT_PATH_MARKERS and index < len(segments) - 1
                for index, segment in enumerate(segments)
            )
            or any(re.fullmatch(r"[0-9]{4,}", segment) for segment in segments)
        ):
            continue
        if link not in selected:
            selected.append(link)
    return selected


def is_concrete_project_page(page: ParsedPublicPage, *, source_title: str = "") -> bool:
    if _normalized_host(page.source_url) not in ARCHDAILY_DOMAINS:
        return True
    title = f"{page.title} {source_title}"
    return " / " in title and _is_archdaily_numeric_project_path(page.source_url)


def _markdown_project_urls(markdown: str, source_host: str) -> set[str]:
    urls: set[str] = set()
    for match in re.finditer(r"\[([^\]]+)\]\((https?://[^)\s]+)[^)]*\)", markdown):
        if " / " not in " ".join(match.group(1).split()):
            continue
        try:
            url = _public_http_url(match.group(2))
        except ValueError:
            continue
        if _normalized_host(url) == source_host:
            urls.add(_canonical_page_url(url))
    return urls


def _is_archdaily_numeric_project_path(url: str) -> bool:
    segments = [unquote(segment).casefold() for segment in urlparse(url).path.split("/") if segment]
    if segments and segments[0] == "cn":
        segments = segments[1:]
    return len(segments) == 2 and re.fullmatch(r"[0-9]{4,}", segments[0]) is not None


def _is_known_site_result(url: str, domain: str) -> bool:
    segments = [unquote(segment).casefold() for segment in urlparse(url).path.split("/") if segment]
    if domain in ARCHDAILY_DOMAINS:
        return _is_archdaily_numeric_project_path(url)
    if domain == "designboom.com":
        return len(segments) >= 2 and segments[0] == "architecture"
    if domain == "dezeen.com":
        return (
            len(segments) >= 4
            and re.fullmatch(r"20\d{2}", segments[0]) is not None
            and re.fullmatch(r"(?:0?[1-9]|1[0-2])", segments[1]) is not None
            and re.fullmatch(r"(?:0?[1-9]|[12]\d|3[01])", segments[2]) is not None
        )
    if domain == "divisare.com":
        return (
            len(segments) == 2
            and segments[0] == "projects"
            and re.match(r"\d{4,}", segments[1]) is not None
        )
    return True


def _canonical_page_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.rstrip("/") or "/"
    return parsed._replace(path=path, query="", fragment="").geturl()


def _normalized_host(url: str) -> str:
    host = (urlparse(url).hostname or "").casefold().rstrip(".")
    return host[4:] if host.startswith("www.") else host


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


def _link_snapshots(value: Any) -> list[BrowserLinkSnapshot]:
    if not isinstance(value, list):
        return []
    snapshots: list[BrowserLinkSnapshot] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        text = item.get("text")
        if isinstance(url, str):
            snapshots.append(
                BrowserLinkSnapshot(url=url, text=text if isinstance(text, str) else "")
            )
    return snapshots


def _image_snapshots(value: Any) -> list[BrowserImageSnapshot]:
    if not isinstance(value, list):
        return []
    snapshots: list[BrowserImageSnapshot] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        alt = item.get("alt")
        normalized_alt = alt if isinstance(alt, str) else ""
        if isinstance(url, str) and not _is_loading_placeholder(url, normalized_alt):
            snapshots.append(BrowserImageSnapshot(url=url, alt=normalized_alt))
    return snapshots


def _is_loading_placeholder(url: str, alt: str) -> bool:
    text = f"{unquote(urlparse(url).path)} {alt}".casefold()
    return bool(
        re.search(
            r"(?:^|[^a-z0-9])(loader|loading|spinner|placeholder)(?:[^a-z0-9]|$)",
            text,
        )
    )


def _project_matched_raw_images(
    value: Any,
    page_title: str,
    page_url: str,
) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    matched: list[dict[str, str]] = []
    index_by_link: dict[str, int] = {}
    for item in value:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        alt = item.get("alt")
        link_url = item.get("link_url")
        if not isinstance(url, str):
            continue
        normalized_alt = alt if isinstance(alt, str) else ""
        normalized_link = link_url if isinstance(link_url, str) else ""
        title_match = project_image_identity_score(page_title, url, normalized_alt) >= 2
        descendant_match = _is_page_descendant_url(page_url, normalized_link)
        if not title_match and not descendant_match:
            continue
        image = {"url": url, "alt": normalized_alt}
        if not descendant_match:
            matched.append(image)
            continue
        current_index = index_by_link.get(normalized_link)
        if current_index is None:
            index_by_link[normalized_link] = len(matched)
            matched.append(image)
        elif _raw_image_variant_sort_key(image) > _raw_image_variant_sort_key(
            matched[current_index]
        ):
            matched[current_index] = image
    return matched


def _is_page_descendant_url(page_url: str, candidate_url: str) -> bool:
    page = urlparse(page_url)
    candidate = urlparse(candidate_url)
    page_path = unquote(page.path).rstrip("/")
    candidate_path = unquote(candidate.path).rstrip("/")
    return bool(
        page_path
        and _normalized_host(page_url) == _normalized_host(candidate_url)
        and candidate_path.startswith(f"{page_path}/")
    )


def _raw_image_variant_sort_key(image: dict[str, str]) -> tuple[int, int]:
    path = unquote(urlparse(image["url"]).path).casefold()
    return (int(bool(image["alt"].strip())), int("/thumb" not in path))


def project_image_identity_score(page_title: str, image_url: str, image_alt: str = "") -> int:
    title_tokens = _project_identity_tokens(page_title)
    if not title_tokens:
        return 0
    image_tokens = _project_identity_tokens(
        f"{urlparse(image_url).path.replace('-', ' ')} {image_alt}"
    )
    acronym_match = bool(_project_identity_acronyms(page_title) & image_tokens)
    return len(title_tokens & image_tokens) + (4 if acronym_match else 0)


def _project_identity_tokens(value: str) -> set[str]:
    stop_words = {
        "archdaily",
        "architecture",
        "architects",
        "building",
        "center",
        "centre",
        "convert",
        "converted",
        "designboom",
        "headquarters",
        "image",
        "library",
        "museum",
        "office",
        "project",
        "renovation",
        "studio",
        "transform",
        "transformation",
    }
    normalized = unquote(value).casefold()
    tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", normalized)
        if len(token) >= 3 and token not in stop_words
    }
    for sequence in re.findall(r"[\u4e00-\u9fff]+", normalized):
        if len(sequence) < 2:
            continue
        tokens.add(sequence)
        tokens.update(sequence[index : index + 2] for index in range(len(sequence) - 1))
    return tokens


def _project_identity_acronyms(value: str) -> set[str]:
    ordered_tokens = [
        token
        for token in re.findall(r"[a-z0-9]+", unquote(value).casefold())
        if token in _project_identity_tokens(value)
    ]
    acronyms: set[str] = set()
    for length in range(4, 7):
        acronyms.update(
            "".join(token[0] for token in ordered_tokens[index : index + length])
            for index in range(len(ordered_tokens) - length + 1)
        )
    return acronyms


def _merge_raw_images(*groups: Any) -> list[dict[str, str]]:
    merged: list[dict[str, str]] = []
    index_by_url: dict[str, int] = {}
    for group in groups:
        if not isinstance(group, list):
            continue
        for item in group:
            if not isinstance(item, dict):
                continue
            raw_url = item.get("url")
            raw_alt = item.get("alt")
            if not isinstance(raw_url, str):
                continue
            url = raw_url
            alt = raw_alt if isinstance(raw_alt, str) else ""
            current_index = index_by_url.get(url)
            if current_index is None:
                index_by_url[url] = len(merged)
                merged.append({"url": url, "alt": alt})
            elif not merged[current_index]["alt"] and alt:
                merged[current_index] = {"url": url, "alt": alt}
    return merged


def _search_snapshots(value: Any) -> list[BrowserSearchSnapshot]:
    if not isinstance(value, list):
        return []
    snapshots: list[BrowserSearchSnapshot] = []
    for item in value:
        if len(snapshots) >= 300:
            break
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        title = item.get("title")
        description = item.get("description")
        if isinstance(url, str):
            snapshots.append(
                BrowserSearchSnapshot(
                    url=url,
                    title=title if isinstance(title, str) else "",
                    description=description if isinstance(description, str) else "",
                )
            )
    return snapshots


def _safe_link_snapshots(values: list[BrowserLinkSnapshot]) -> list[BrowserLinkSnapshot]:
    snapshots: list[BrowserLinkSnapshot] = []
    seen: set[str] = set()
    for item in values:
        if len(snapshots) >= MAX_LINKS:
            break
        try:
            url = _public_http_url(item.url)
        except ValueError:
            continue
        if url in seen:
            continue
        seen.add(url)
        snapshots.append(BrowserLinkSnapshot(url=url, text=" ".join(item.text.split())[:300]))
    return snapshots


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


def public_search_relevance_score(
    query: str,
    *,
    title: str = "",
    description: str = "",
    url: str = "",
) -> int:
    query_text = query.casefold()
    lead_text = " ".join(
        (
            title,
            description,
            unquote(urlparse(url).path).replace("-", " "),
        )
    ).casefold()
    stop_words = {
        "architecture",
        "building",
        "drawings",
        "floor",
        "page",
        "plan",
        "project",
        "with",
    }
    query_tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", query_text)
        if len(token) >= 3 and token not in stop_words
    }
    lead_tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", lead_text)
        if len(token) >= 3 and token not in stop_words
    }
    score = len(query_tokens & lead_tokens)

    if _contains_any(query_text, ("工业", "厂房", "industrial", "factory")) and _contains_any(
        lead_text,
        (
            "工业",
            "厂房",
            "仓库",
            "电厂",
            "factory",
            "industrial",
            "mill",
            "plant",
            "power station",
            "textile",
            "warehouse",
        ),
    ):
        score += 6
    if _contains_any(
        query_text,
        ("旧", "改造", "更新", "adaptive", "existing", "renovation", "reuse"),
    ) and _contains_any(
        lead_text,
        (
            "保护",
            "改造",
            "更新",
            "再利用",
            "adaptive",
            "conversion",
            "convert",
            "preservation",
            "renovation",
            "retrofit",
            "reuse",
            "revitalization",
            "transformation",
        ),
    ):
        score += 4

    issue_terms = {
        "interface": (
            "connection",
            "interface",
            "joint",
            "retained frame",
            "slab",
            "truss",
            "加固",
            "构造",
            "界面",
            "跨接",
        ),
        "flow": (
            "circulation",
            "entrance",
            "loading",
            "route",
            "service",
            "流线",
            "入口",
            "后勤",
        ),
        "daylight": (
            "clerestory",
            "courtyard",
            "daylight",
            "skylight",
            "采光",
            "天窗",
            "庭院",
        ),
        "program": (
            "box-in-box",
            "conversion",
            "exhibition",
            "insert",
            "program",
            "volume",
            "workshop",
            "功能",
            "植入",
        ),
        "section": (
            "atrium",
            "double-height",
            "mezzanine",
            "roof",
            "section",
            "stair",
            "vertical",
            "void",
            "中庭",
            "剖面",
            "夹层",
            "挑空",
            "楼梯",
        ),
    }
    intent = infer_research_issue_intent(query_text)
    if intent in issue_terms and _contains_any(lead_text, issue_terms[intent]):
        score += 3
    return score


def _contains_any(value: str, terms: tuple[str, ...]) -> bool:
    return any(term in value for term in terms)


def _compact_browser_query(query: str, domains: list[str]) -> str:
    embedded_domains = re.findall(r"\bsite:([A-Za-z0-9.-]+)", query, flags=re.IGNORECASE)
    selected_domains = domains or _bounded_domains(embedded_domains)
    without_sites = re.sub(r"\bsite:[A-Za-z0-9.-]+", " ", query, flags=re.IGNORECASE)
    terms = re.findall(r"[^\W_]+(?:-[^\W_]+)*", without_sites, flags=re.UNICODE)
    compact_terms = " ".join(terms[:18])
    site_clause = " OR ".join(f"site:{domain}" for domain in selected_domains[:4])
    return " ".join(part for part in (site_clause, compact_terms) if part)[:300]


def _browser_search_url(query: str, domains: list[str], limit: int) -> str:
    if len(domains) == 1 and domains[0] in SITE_SEARCH_URLS:
        site_query = _compact_site_query(query, target_domain=domains[0])
        return SITE_SEARCH_URLS[domains[0]].format(query=quote_plus(site_query))
    browser_query = _compact_browser_query(query, domains)
    return f"{LOCAL_BROWSER_SEARCH_URL}?format=rss&q={quote_plus(browser_query)}&count={limit}"


def _compact_site_query(query: str, *, target_domain: str | None = None) -> str:
    normalized = re.sub(r"\bsite:[A-Za-z0-9.-]+", " ", query, flags=re.IGNORECASE).casefold()
    contains_chinese = bool(re.search(r"[\u4e00-\u9fff]", normalized))
    contains_latin = bool(re.search(r"[a-z]", normalized))
    chinese = contains_chinese
    if contains_chinese and contains_latin and target_domain in SITE_SEARCH_URLS:
        chinese = target_domain == "archdaily.cn"
    typology_terms: list[str] = []
    if any(term in normalized for term in ("工业", "厂房", "industrial", "factory")):
        typology_terms.append("工业改造" if chinese else "industrial reuse")
    if any(term in normalized for term in ("社区", "文化", "community", "cultural")):
        typology_terms.append("社区文化中心" if chinese else "community cultural center")
    if not typology_terms:
        typology_terms.append("适应性改造" if chinese else "adaptive reuse")

    intent = infer_research_issue_intent(normalized)
    intent_terms = {
        "interface": "新旧构造界面" if chinese else "old new structural interface",
        "flow": "公众后勤流线" if chinese else "visitor staff back-of-house circulation",
        "daylight": "采光策略" if chinese else "daylight strategy",
        "program": "功能植入" if chinese else "program insertion",
        "section": "剖面层次" if chinese else "sectional hierarchy",
    }
    if intent in intent_terms:
        typology_terms.append(intent_terms[intent])
    return " ".join(typology_terms)


def infer_research_issue_intent(text: str) -> str:
    normalized = text.casefold()
    weighted_terms = {
        "interface": (
            ("新旧构造界面", 6),
            ("新旧结构界面", 6),
            ("构造界面", 5),
            ("结构界面", 5),
            ("old-new structural interface", 6),
            ("old new structural interface", 6),
            ("structural interface", 5),
            ("material interface", 5),
            ("retained column", 2),
            ("retained frame", 2),
            ("柱网", 2),
            ("楼板", 2),
            ("slab", 2),
            ("桁架", 2),
            ("truss", 2),
            ("开洞", 2),
            ("opening", 2),
            ("退让", 2),
            ("setback", 2),
            ("跨接", 2),
            ("bridge", 2),
            ("可逆", 2),
            ("reversible", 2),
            ("脱开", 2),
            ("detached", 2),
            ("加固", 2),
            ("reinforcement", 2),
            ("connection detail", 2),
        ),
        "flow": (
            ("流线", 4),
            ("circulation", 4),
            ("后勤", 3),
            ("back-of-house", 3),
            ("service route", 3),
            ("访客", 1),
            ("visitor", 1),
            ("工作人员", 1),
            ("staff", 1),
            ("货运", 1),
            ("loading", 1),
            ("入口", 1),
            ("entrance", 1),
            ("核心筒", 1),
        ),
        "daylight": (
            ("采光策略", 5),
            ("daylight strategy", 5),
            ("采光", 3),
            ("daylight", 3),
            ("天窗", 2),
            ("skylight", 2),
            ("高侧窗", 2),
            ("clerestory", 2),
            ("庭院", 1),
            ("courtyard", 1),
        ),
        "program": (
            ("功能植入", 5),
            ("program insertion", 5),
            ("盒中盒", 4),
            ("box-in-box", 4),
            ("inserted volume", 4),
            ("新功能", 2),
            ("植入", 2),
            ("插入", 2),
            ("嵌套", 2),
            ("盒体", 2),
            ("加建", 1),
            ("悬挂", 1),
            ("extension", 1),
        ),
        "section": (
            ("剖面层次", 5),
            ("sectional hierarchy", 5),
            ("垂直组织", 4),
            ("vertical organization", 4),
            ("垂直关系", 3),
            ("vertical relationship", 3),
            ("剖面", 2),
            ("sectional", 2),
            ("section", 1),
            ("层高", 2),
            ("floor-to-floor", 2),
            ("vertical circulation", 2),
            ("double-height", 2),
            ("大跨", 1),
            ("挑空", 1),
            ("夹层", 1),
            ("mezzanine", 1),
            ("下沉", 1),
            ("sunken", 1),
            ("屋顶", 1),
            ("roof", 1),
        ),
    }
    scores = {
        intent: sum(weight for term, weight in terms if term in normalized)
        for intent, terms in weighted_terms.items()
    }
    intent = max(scores, key=scores.__getitem__)
    return intent if scores[intent] > 0 else "other"


def _url_matches_any_domain(url: str, domains: list[str]) -> bool:
    hostname = _normalized_host(url)
    return any(hostname == domain or hostname.endswith(f".{domain}") for domain in domains)


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
