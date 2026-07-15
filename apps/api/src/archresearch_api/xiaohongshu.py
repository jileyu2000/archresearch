from __future__ import annotations

from urllib.parse import quote_plus, urlparse

from .inspection import BrowserCommandClient, MediaEnumeration, OpenPageResult
from .providers import ProviderSource
from .schemas import PublicationTier

XIAOHONGSHU_SEARCH_URL = "https://www.xiaohongshu.com/search_result"
XIAOHONGSHU_WAIT_MILLISECONDS = 1_200
XIAOHONGSHU_SCROLL_DISTANCE = 1_200
XIAOHONGSHU_MAX_RESULTS = 4


class XiaohongshuBrowserSearch:
    def __init__(self, browser: BrowserCommandClient) -> None:
        self._browser = browser

    def search(self, query: str, *, limit: int = XIAOHONGSHU_MAX_RESULTS) -> list[ProviderSource]:
        bounded_limit = max(1, min(limit, XIAOHONGSHU_MAX_RESULTS))
        search_url = (
            f"{XIAOHONGSHU_SEARCH_URL}?keyword={quote_plus(query[:500])}"
            "&source=web_search_result_notes"
        )
        opened = OpenPageResult.model_validate(
            self._browser.send_command_sync("open_url", {"url": search_url})
        )
        media = []
        try:
            self._browser.send_command_sync("wait", {"milliseconds": XIAOHONGSHU_WAIT_MILLISECONDS})
            first = MediaEnumeration.model_validate(
                self._browser.send_command_sync("enumerate_media", {"tab_id": opened.tab_id})
            )
            media.extend(first.media)
            self._browser.send_command_sync(
                "scroll",
                {
                    "tab_id": opened.tab_id,
                    "direction": "down",
                    "distance": XIAOHONGSHU_SCROLL_DISTANCE,
                },
            )
            self._browser.send_command_sync("wait", {"milliseconds": 350})
            second = MediaEnumeration.model_validate(
                self._browser.send_command_sync("enumerate_media", {"tab_id": opened.tab_id})
            )
            media.extend(second.media)
        finally:
            self._browser.send_command_sync("close_tab", {"tab_id": opened.tab_id})

        sources: list[ProviderSource] = []
        seen: set[str] = set()
        for item in media:
            if item.link_url is None or item.link_url in seen:
                continue
            if not _is_xiaohongshu_note_url(item.link_url):
                continue
            seen.add(item.link_url)
            sources.append(
                ProviderSource(
                    url=item.link_url,
                    publisher="小红书",
                    title=(item.adjacent_text or item.alt or "小红书视觉参考")[:300],
                    publication_tier=PublicationTier.aggregator,
                )
            )
            if len(sources) == bounded_limit:
                break
        return sources


def _is_xiaohongshu_note_url(value: str) -> bool:
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").rstrip(".").lower()
    if hostname != "xiaohongshu.com" and not hostname.endswith(".xiaohongshu.com"):
        return False
    return parsed.path.startswith("/explore/") or parsed.path.startswith("/discovery/item/")
