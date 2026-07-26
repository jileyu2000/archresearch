from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from archresearch_api.public_pages import (
    BrowserImageSnapshot,
    BrowserLinkSnapshot,
    BrowserPageSnapshot,
    BrowserSearchSnapshot,
    LocalBrowserPageParser,
    ParsedPageImage,
    ParsedPublicPage,
    PlaywrightBrowserBackend,
    infer_architecture_asset_type,
    select_project_page_links,
)
from archresearch_api.schemas import ArchitectureAssetType


class FakeBrowserBackend:
    def __init__(
        self,
        *,
        page: BrowserPageSnapshot | None = None,
        results: list[BrowserSearchSnapshot] | None = None,
    ) -> None:
        self.page = page
        self.results = results or []
        self.read_urls: list[str] = []
        self.search_urls: list[str] = []

    def read(self, url: str) -> BrowserPageSnapshot:
        self.read_urls.append(url)
        if self.page is None:
            raise RuntimeError("missing page fixture")
        return self.page

    def search(self, url: str) -> list[BrowserSearchSnapshot]:
        self.search_urls.append(url)
        return self.results


class FakeLocator:
    def __init__(
        self,
        *,
        count: int = 1,
        attribute: str | None = None,
        text: str = "",
        evaluated: list[dict[str, str]] | None = None,
    ) -> None:
        self._count = count
        self._attribute = attribute
        self._text = text
        self._evaluated = evaluated or []

    @property
    def first(self) -> FakeLocator:
        return self

    def count(self) -> int:
        return self._count

    def get_attribute(self, name: str, *, timeout: int) -> str | None:
        del name, timeout
        if self._count == 0:
            raise AssertionError("missing metadata must not be awaited")
        return self._attribute

    def inner_text(self, *, timeout: int) -> str:
        del timeout
        return self._text

    def evaluate_all(self, script: str) -> list[dict[str, str]]:
        del script
        return self._evaluated


class PageWithoutDescription:
    url = "https://example.com/"

    def locator(self, selector: str) -> FakeLocator:
        if selector.startswith("meta[name"):
            return FakeLocator(count=0)
        if selector == "article, main, [role=main]":
            return FakeLocator(count=0)
        if selector == "body":
            return FakeLocator(text="Example body")
        return FakeLocator(evaluated=[])

    def title(self) -> str:
        return "Example Domain"


class PageWithMultipleContentRoots(PageWithoutDescription):
    def locator(self, selector: str) -> FakeLocator:
        if selector.startswith("meta[name"):
            return FakeLocator(count=0)
        if selector == "article, main, [role=main]":
            return FakeLocator(
                text="Navigation",
                evaluated=[
                    {"text": "Navigation"},
                    {"text": "Complete project article with plans and sections"},
                ],
            )
        return super().locator(selector)


class PageWithFragmentedContentRoots(PageWithoutDescription):
    def locator(self, selector: str) -> FakeLocator:
        if selector.startswith("meta[name"):
            return FakeLocator(count=0)
        if selector == "article, main, [role=main]":
            return FakeLocator(evaluated=[{"text": "Project navigation"}])
        if selector == "body":
            return FakeLocator(text="Complete project body with evidence and drawing captions")
        return super().locator(selector)


class SemanticRootLocator(FakeLocator):
    def evaluate_all(self, script: str) -> list[dict[str, object]]:
        project_text = "Complete project article with plans, sections, and evidence. " * 30
        if "images:" in script:
            return [
                {
                    "text": "Related story",
                    "kind": "article",
                    "images": [
                        {
                            "url": "https://cdn.example/related-250x200.jpg",
                            "alt": "Related house story",
                        }
                    ],
                },
                {
                    "text": project_text,
                    "kind": "article",
                    "images": [
                        {
                            "url": "https://cdn.example/project-section.jpg",
                            "alt": "Longitudinal section",
                        },
                        {
                            "url": "https://assets.example/loader-white.gif",
                            "alt": "Content Loader",
                        },
                    ],
                },
                {
                    "text": project_text + ("Related navigation and current news. " * 40),
                    "kind": "main",
                    "images": [
                        {
                            "url": "https://cdn.example/project-section.jpg",
                            "alt": "Longitudinal section",
                        },
                        {
                            "url": "https://cdn.example/related-250x200.jpg",
                            "alt": "Related house story",
                        },
                        {
                            "url": "https://cdn.consentmanager.net/delivery/recall.svg",
                            "alt": "Privacy settings",
                        },
                    ],
                },
            ]
        return [
            {"text": "Related story"},
            {"text": project_text},
            {"text": project_text + ("Related navigation and current news. " * 40)},
        ]


class PageWithSemanticProjectImages(PageWithoutDescription):
    url = "https://example.com/projects/courtyard-archive"

    def locator(self, selector: str) -> FakeLocator:
        if selector.startswith("meta[name"):
            return FakeLocator(count=0)
        if selector == "article, main, [role=main]":
            return SemanticRootLocator()
        if selector == "body":
            return FakeLocator(text="Body also contains navigation and related stories")
        if selector.startswith("img[src]"):
            return FakeLocator(
                evaluated=[
                    {
                        "url": "https://cdn.example/project-section.jpg",
                        "alt": "Longitudinal section",
                    },
                    {
                        "url": "https://cdn.example/courtyard-archive-plan.jpg",
                        "alt": "Courtyard Archive ground floor plan",
                    },
                    {
                        "url": "https://cdn.example/thumb_jpg/first.jpg",
                        "alt": "",
                        "link_url": (
                            "https://example.com/projects/courtyard-archive/first-floor-plan"
                        ),
                    },
                    {
                        "url": "https://cdn.example/medium_jpg/first.jpg",
                        "alt": "Image 16 of 19",
                        "link_url": (
                            "https://example.com/projects/courtyard-archive/first-floor-plan"
                        ),
                    },
                    {
                        "url": "https://cdn.example/medium_jpg/other.jpg",
                        "alt": "Related project image",
                        "link_url": "https://example.com/projects/unrelated-school/gallery",
                    },
                    {
                        "url": "https://cdn.example/related-250x200.jpg",
                        "alt": "Related house story",
                    },
                    {
                        "url": "https://cdn.example/pelloverton-unrelated-school.jpg",
                        "alt": "PellOverton unveils an unrelated school",
                    },
                    {
                        "url": "https://cdn.consentmanager.net/delivery/recall.svg",
                        "alt": "Privacy settings",
                    },
                ]
            )
        return FakeLocator(evaluated=[])

    def title(self) -> str:
        return "Courtyard Archive / PellOverton Architects"


class PageWithBodyOnlyImages(PageWithoutDescription):
    def locator(self, selector: str) -> FakeLocator:
        if selector.startswith("img[src]"):
            return FakeLocator(
                evaluated=[
                    {
                        "url": "https://cdn.example/body-project-plan.jpg",
                        "alt": "Ground floor plan",
                    }
                ]
            )
        return super().locator(selector)


class PageWithAcronymGalleryImages(PageWithoutDescription):
    def locator(self, selector: str) -> FakeLocator:
        if selector.startswith("meta[name"):
            return FakeLocator(count=0)
        if selector == "article, main, [role=main]":
            return FakeLocator(
                evaluated=[
                    {
                        "text": "Project evidence. " * 100,
                        "kind": "article",
                        "images": [
                            {
                                "url": "https://cdn.example/current-project-photo.jpg",
                                "alt": "Processing centre interior",
                            }
                        ],
                    }
                ]
            )
        if selector == "body":
            return FakeLocator(text="Project evidence. " * 100)
        if selector.startswith("img[src]"):
            return FakeLocator(
                evaluated=[
                    {
                        "url": "https://cdn.example/current-project-photo.jpg",
                        "alt": "Processing centre interior",
                    },
                    {
                        "url": "https://cdn.example/14_DesignInc_ARCBS_Elevations.jpg",
                        "alt": "",
                    },
                    {
                        "url": "https://cdn.example/parramatta-designinc-project.jpg",
                        "alt": "",
                    },
                ]
            )
        return FakeLocator(evaluated=[])

    def title(self) -> str:
        return "Australian Red Cross Blood Service Melbourne Processing Centre / DesignInc"


def test_playwright_reader_does_not_wait_for_missing_optional_metadata() -> None:
    page = PlaywrightBrowserBackend._read_page(PageWithoutDescription())  # type: ignore[arg-type]

    assert page.title == "Example Domain"
    assert page.description == ""
    assert page.text == "Example body"


def test_playwright_reader_uses_the_longest_content_root() -> None:
    page = PlaywrightBrowserBackend._read_page(PageWithMultipleContentRoots())  # type: ignore[arg-type]

    assert page.text == "Complete project article with plans and sections"


def test_playwright_reader_uses_body_when_semantic_roots_are_fragments() -> None:
    page = PlaywrightBrowserBackend._read_page(PageWithFragmentedContentRoots())  # type: ignore[arg-type]

    assert page.text == "Complete project body with evidence and drawing captions"


def test_playwright_reader_limits_images_to_the_longest_semantic_root() -> None:
    page = PlaywrightBrowserBackend._read_page(PageWithSemanticProjectImages())  # type: ignore[arg-type]

    assert page.images == [
        BrowserImageSnapshot(
            url="https://cdn.example/project-section.jpg",
            alt="Longitudinal section",
        ),
        BrowserImageSnapshot(
            url="https://cdn.example/courtyard-archive-plan.jpg",
            alt="Courtyard Archive ground floor plan",
        ),
        BrowserImageSnapshot(
            url="https://cdn.example/medium_jpg/first.jpg",
            alt="Image 16 of 19",
        ),
    ]


def test_playwright_reader_falls_back_to_body_images_without_semantic_media() -> None:
    page = PlaywrightBrowserBackend._read_page(PageWithBodyOnlyImages())  # type: ignore[arg-type]

    assert page.images == [
        BrowserImageSnapshot(
            url="https://cdn.example/body-project-plan.jpg",
            alt="Ground floor plan",
        )
    ]


def test_playwright_reader_recovers_title_acronym_gallery_images_only() -> None:
    page = PlaywrightBrowserBackend._read_page(PageWithAcronymGalleryImages())  # type: ignore[arg-type]

    assert page.images == [
        BrowserImageSnapshot(
            url="https://cdn.example/current-project-photo.jpg",
            alt="Processing centre interior",
        ),
        BrowserImageSnapshot(
            url="https://cdn.example/14_DesignInc_ARCBS_Elevations.jpg",
            alt="",
        ),
    ]


def test_playwright_page_read_allows_client_rendered_content_to_settle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    backend = PlaywrightBrowserBackend()
    captured: dict[str, int] = {}

    def fake_visit(
        url: str, reader: object, *, scroll: bool, settle_ms: int
    ) -> BrowserPageSnapshot:
        del reader, scroll
        captured["settle_ms"] = settle_ms
        return BrowserPageSnapshot(url=url)

    monkeypatch.setattr(backend, "_visit", fake_visit)

    backend.read("https://example.com/project")

    assert captured["settle_ms"] == 3_500


def test_playwright_page_read_keeps_the_richer_late_dynamic_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    backend = PlaywrightBrowserBackend()
    snapshots = [
        BrowserPageSnapshot(
            url="https://example.com/project",
            text="Project introduction",
        ),
        BrowserPageSnapshot(
            url="https://example.com/project",
            text="Project introduction\nLate structural intervention details",
        ),
    ]

    class SettlingPage:
        def __init__(self) -> None:
            self.waits: list[int] = []

        def wait_for_timeout(self, timeout_ms: int) -> None:
            self.waits.append(timeout_ms)

    page = SettlingPage()
    monkeypatch.setattr(backend, "_read_page", lambda _page: snapshots.pop(0))

    result = backend._read_settled_page(page)  # type: ignore[arg-type]

    assert page.waits == [1_000]
    assert result.text.endswith("Late structural intervention details")


def test_local_browser_search_is_site_bounded_and_filters_untrusted_results() -> None:
    backend = FakeBrowserBackend(
        results=[
            BrowserSearchSnapshot(
                url="https://www.archdaily.com/",
                title="The global reference for architecture",
            ),
            BrowserSearchSnapshot(
                url="https://www.archdaily.com/123456/courtyard-archive",
                title="Courtyard Archive",
                description="Adaptive reuse project",
            ),
            BrowserSearchSnapshot(
                url="https://studio.example/project",
                title="Off-domain result",
                description="Must be filtered locally",
            ),
            BrowserSearchSnapshot(
                url="http://127.0.0.1/private",
                title="Private result",
            ),
        ]
    )
    parser = LocalBrowserPageParser(backend=backend)

    leads = parser.search(
        "industrial building adaptive reuse section",
        limit=4,
        include_domains=["archdaily.com"],
    )

    assert [lead.model_dump() for lead in leads] == [
        {
            "url": "https://www.archdaily.com/123456/courtyard-archive",
            "title": "Courtyard Archive",
            "description": "Adaptive reuse project",
        }
    ]
    search_url = urlparse(backend.search_urls[0])
    assert search_url.scheme == "https"
    assert search_url.hostname == "www.archdaily.com"
    assert search_url.path == "/search/projects"
    query = parse_qs(search_url.query)["q"][0]
    assert query == "industrial reuse sectional hierarchy"
    assert "site:" not in query
    assert parser.name == "local_browser"
    assert parser.worst_case_call_seconds == 20.0


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        (
            "adaptive reuse industrial building program insertion box-in-box floor plan section "
            "separate entrance service space circulation core",
            "industrial reuse program insertion",
        ),
        (
            "adaptive reuse industrial building visitor circulation staff circulation "
            "back-of-house loading dock roof extension",
            "industrial reuse visitor staff back-of-house circulation",
        ),
        (
            "adaptive reuse industrial building daylight strategy skylight inserted volume "
            "separate entrance service space circulation core",
            "industrial reuse daylight strategy",
        ),
        (
            "adaptive reuse industrial building sectional hierarchy mezzanine roof extension "
            "vertical circulation separate entrance",
            "industrial reuse sectional hierarchy",
        ),
        ("旧工业建筑更新 功能植入 盒中盒 剖面图", "工业改造 功能植入"),
        ("旧工业建筑更新 公共后勤流线 独立入口 屋顶加建", "工业改造 公众后勤流线"),
        ("旧工业建筑更新 采光策略 插入天窗 剖面图", "工业改造 采光策略"),
        ("旧工业建筑更新 剖面层次 夹层 下沉 屋顶加建 后勤需求", "工业改造 剖面层次"),
        (
            "community cultural center visitor staff circulation",
            "community cultural center visitor staff back-of-house circulation",
        ),
        (
            "adaptive reuse industrial building community cultural center visitor staff "
            "back-of-house circulation",
            "industrial reuse community cultural center visitor staff back-of-house circulation",
        ),
        (
            "旧工业建筑更新 新旧构造界面 保留柱网 楼板 桁架 开洞 退让 跨接 后勤设施",
            "工业改造 新旧构造界面",
        ),
        (
            "industrial reuse old-new structural interface retained frame slab truss "
            "reversible connection back-of-house service",
            "industrial reuse old new structural interface",
        ),
    ],
)
def test_known_site_query_compaction_preserves_typology_and_weighted_issue_intent(
    query: str,
    expected: str,
) -> None:
    backend = FakeBrowserBackend()
    parser = LocalBrowserPageParser(backend=backend)

    parser.search(query, limit=4, include_domains=["archdaily.com"])

    search_url = urlparse(backend.search_urls[0])
    assert parse_qs(search_url.query)["q"] == [expected]


@pytest.mark.parametrize(
    ("domain", "expected"),
    [
        ("archdaily.cn", "工业改造 社区文化中心 公众后勤流线"),
        (
            "designboom.com",
            "industrial reuse community cultural center visitor staff back-of-house circulation",
        ),
        (
            "dezeen.com",
            "industrial reuse community cultural center visitor staff back-of-house circulation",
        ),
    ],
)
def test_known_site_query_compaction_uses_target_site_language_for_mixed_queries(
    domain: str,
    expected: str,
) -> None:
    backend = FakeBrowserBackend()
    parser = LocalBrowserPageParser(backend=backend)

    parser.search(
        "architecture project drawings: adaptive reuse industrial building "
        "community cultural center visitor staff back-of-house circulation "
        "旧工业建筑更新中的公众与后勤流线",
        limit=4,
        include_domains=[domain],
    )

    search_url = urlparse(backend.search_urls[0])
    search_params = parse_qs(search_url.query)
    assert search_params.get("q", search_params.get("s")) == [expected]


def test_multi_domain_exact_project_query_keeps_project_name_and_focus() -> None:
    backend = FakeBrowserBackend()
    parser = LocalBrowserPageParser(backend=backend)

    parser.search(
        '"GATE M West Bund Dream Center" section mezzanine',
        limit=4,
        include_domains=["archdaily.com", "designboom.com"],
    )

    search_url = urlparse(backend.search_urls[0])
    query = parse_qs(search_url.query)["q"][0]
    assert "GATE M West Bund Dream Center" in query
    assert "section mezzanine" in query


@pytest.mark.parametrize(
    ("domain", "search_host", "result_url"),
    [
        (
            "designboom.com",
            "www.designboom.com",
            "https://www.designboom.com/architecture/factory-adaptive-reuse-07-16-2026/",
        ),
        (
            "dezeen.com",
            "www.dezeen.com",
            "https://www.dezeen.com/2026/07/16/factory-adaptive-reuse/",
        ),
        (
            "divisare.com",
            "divisare.com",
            "https://divisare.com/projects/123456-factory-adaptive-reuse",
        ),
    ],
)
def test_known_architecture_site_searches_drop_navigation_links(
    domain: str,
    search_host: str,
    result_url: str,
) -> None:
    backend = FakeBrowserBackend(
        results=[
            BrowserSearchSnapshot(url=f"https://{search_host}/", title="Home"),
            BrowserSearchSnapshot(url=result_url, title="Factory Adaptive Reuse / Studio"),
        ]
    )
    parser = LocalBrowserPageParser(backend=backend)

    leads = parser.search("industrial reuse", limit=4, include_domains=[domain])

    assert [lead.url for lead in leads] == [result_url.rstrip("/")]
    assert urlparse(backend.search_urls[0]).hostname == search_host


@pytest.mark.parametrize(
    ("query", "relevant_title"),
    [
        (
            "adaptive reuse industrial building program insertion",
            "architects convert factory with an inserted exhibition volume",
        ),
        (
            "adaptive reuse industrial building visitor staff circulation",
            "warehouse conversion separates visitor entrance and loading service route",
        ),
        (
            "adaptive reuse industrial building daylight strategy",
            "textile mill renovation adds a skylight and courtyard",
        ),
        (
            "adaptive reuse industrial building sectional hierarchy",
            "LYCS architects convert textile warehouse into headquarters",
        ),
    ],
)
def test_known_site_search_prioritizes_industrial_conversion_projects(
    query: str,
    relevant_title: str,
) -> None:
    relevant_url = (
        "https://www.designboom.com/architecture/"
        "lycs-architecture-headquarters-dave-bella-china-10-17-2017"
    )
    backend = FakeBrowserBackend(
        results=[
            BrowserSearchSnapshot(
                url=(
                    "https://www.designboom.com/architecture/frank-lloyd-wright-house-preservation"
                ),
                title="architects preserve frank lloyd wright house",
            ),
            BrowserSearchSnapshot(
                url="https://www.designboom.com/architecture/concrete-rooftop-garden-house",
                title="rooftop garden crowns concrete house",
            ),
            BrowserSearchSnapshot(
                url=relevant_url,
                title=relevant_title,
            ),
        ]
    )
    parser = LocalBrowserPageParser(backend=backend)

    leads = parser.search(
        query,
        limit=2,
        include_domains=["designboom.com"],
    )

    assert leads[0].url == relevant_url


def test_known_site_search_preserves_engine_order_for_metadata_empty_cards() -> None:
    result_urls = [
        "https://www.archdaily.com/431879/australian-red-cross-processing-centre",
        "https://www.archdaily.com/878171/akqa-agency",
        "https://www.archdaily.com/1039156/de-nederlandsche-bank-mecanoo",
        "https://www.archdaily.com/1006022/shrewsbury-flaxmill-maltings",
    ]
    backend = FakeBrowserBackend(
        results=[
            *[BrowserSearchSnapshot(url=url) for url in result_urls],
            BrowserSearchSnapshot(
                url=result_urls[3],
                title="Shrewsbury Flaxmill Maltings adaptive reuse",
            ),
            BrowserSearchSnapshot(
                url=result_urls[0],
                title="Australian Red Cross Processing Centre",
            ),
        ]
    )
    parser = LocalBrowserPageParser(backend=backend)

    leads = parser.search(
        "industrial reuse visitor staff back-of-house circulation",
        limit=3,
        include_domains=["archdaily.com"],
    )

    assert [lead.url for lead in leads] == result_urls[:3]


def test_local_browser_parser_maps_bounded_text_links_images_and_alts() -> None:
    backend = FakeBrowserBackend(
        page=BrowserPageSnapshot(
            url="https://studio.example/project",
            title="Courtyard Archive",
            description="Adaptive reuse project",
            text="M" * 20_000,
            links=[
                BrowserLinkSnapshot(
                    url="https://studio.example/projects/courtyard-archive",
                    text="Courtyard Archive / Studio Example",
                ),
                BrowserLinkSnapshot(url="http://127.0.0.1/private", text="Private"),
            ],
            images=[
                BrowserImageSnapshot(
                    url="https://cdn.example/section.png",
                    alt="Longitudinal section",
                ),
                BrowserImageSnapshot(url="http://192.168.1.2/private.png"),
            ],
        )
    )
    parser = LocalBrowserPageParser(backend=backend)

    page = parser.parse("https://studio.example/project")

    assert page.title == "Courtyard Archive"
    assert page.description == "Adaptive reuse project"
    assert len(page.markdown) == 12_000
    assert page.markdown.startswith("M" * 6_000)
    assert "[Courtyard Archive / Studio Example]" not in page.markdown[:6_000]
    assert page.links == ["https://studio.example/projects/courtyard-archive"]
    assert [image.model_dump() for image in page.images] == [
        {
            "url": "https://cdn.example/section.png",
            "alt": "Longitudinal section",
        }
    ]
    assert backend.read_urls == ["https://studio.example/project"]


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("intrusswetrust-seccion-1.jpg", ArchitectureAssetType.section),
        ("intrusswetrust-axonometria.jpg", ArchitectureAssetType.axonometric),
        ("intrusswetrust-axo.jpg", ArchitectureAssetType.axonometric),
    ],
)
def test_archdaily_drawing_filenames_are_classified_across_source_languages(
    filename: str,
    expected: ArchitectureAssetType,
) -> None:
    image = ParsedPageImage(
        url=f"https://images.adsttc.com/media/images/example/medium_jpg/{filename}",
        alt="Reuse of an Industrial Space - Image 21 of 21",
    )

    assert infer_architecture_asset_type(image) is expected


def test_local_browser_rejects_private_input_and_private_redirect() -> None:
    backend = FakeBrowserBackend(
        page=BrowserPageSnapshot(
            url="http://127.0.0.1/private",
            title="Redirected",
        )
    )
    parser = LocalBrowserPageParser(backend=backend)

    with pytest.raises(ValueError, match="public HTTP"):
        parser.parse("http://127.0.0.1/private")
    assert backend.read_urls == []

    with pytest.raises(ValueError, match="public HTTP"):
        parser.parse("https://studio.example/redirect")


def test_project_page_link_selection_is_same_host_bounded_and_excludes_navigation() -> None:
    page = ParsedPublicPage(
        source_url="https://magazine.example/tag/adaptive-reuse",
        links=[
            "https://magazine.example/about",
            "https://magazine.example/projects/courtyard-archive",
            "https://magazine.example/12345/foundry-renovation",
            "https://magazine.example/category/renovation",
            "https://studio.example/projects/courtyard-archive",
            "https://magazine.example/works/third-project",
        ],
    )

    assert select_project_page_links(page, limit=2) == [
        "https://magazine.example/projects/courtyard-archive",
        "https://magazine.example/12345/foundry-renovation",
    ]


def test_project_page_link_selection_rejects_section_roots() -> None:
    project_url = "https://www.designboom.com/architecture/textile-warehouse-conversion"
    page = ParsedPublicPage(
        source_url="https://www.designboom.com/architecture/unrelated-house-story",
        links=[
            "https://www.designboom.com/architecture/",
            project_url,
        ],
    )

    assert select_project_page_links(page, limit=2) == [project_url]


def test_archdaily_project_link_selection_rejects_self_gallery_and_editorial_links() -> None:
    project_url = "https://www.archdaily.com/123456/el-roser-social-center-studio-example"
    page = ParsedPublicPage(
        source_url=(
            "https://www.archdaily.com/998949/"
            "12-cultural-spaces-that-owe-their-power-to-adaptive-reuse"
        ),
        title="12 Cultural Spaces That Owe Their Power to Adaptive Reuse",
        markdown=f"[El Roser Social Center / Studio Example]({project_url})",
        links=[
            (
                "https://www.archdaily.com/998949/"
                "12-cultural-spaces-that-owe-their-power-to-adaptive-reuse#"
            ),
            (
                "https://www.archdaily.com/998949/"
                "12-cultural-spaces-that-owe-their-power-to-adaptive-reuse/"
                "642c4220-gallery-photo"
            ),
            "https://www.archdaily.com/989619/the-principles-of-new-urbanism",
            project_url,
        ],
    )

    assert select_project_page_links(page, limit=2) == [project_url]
