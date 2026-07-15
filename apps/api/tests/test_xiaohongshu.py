from typing import Any

from archresearch_api.schemas import PublicationTier
from archresearch_api.xiaohongshu import XiaohongshuBrowserSearch


class RecordingBrowser:
    connected = True

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.enumerations = 0

    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        del timeout_seconds
        self.calls.append((action, payload))
        if action == "open_url":
            return {"tab_id": 17, "url": payload["url"]}
        if action == "wait":
            return {"waited_ms": payload["milliseconds"]}
        if action == "scroll":
            return {"scrolled": True}
        if action == "enumerate_media":
            self.enumerations += 1
            return {
                "media": [
                    {
                        "media_type": "image",
                        "url": f"https://sns-img.example/{self.enumerations}.jpg",
                        "link_url": "https://www.xiaohongshu.com/explore/note-42?xsec_token=visible",
                        "alt": "旧厂房剖面",
                        "adjacent_text": "旧厂房更新：架空步道与公共展厅的剖面关系",
                        "intrinsic_width": 1200,
                        "intrinsic_height": 900,
                        "region": {"x": 0, "y": 0, "width": 600, "height": 450},
                    },
                    {
                        "media_type": "image",
                        "url": "https://sns-img.example/external.jpg",
                        "link_url": "https://tracking.example/redirect",
                        "alt": "外部链接",
                        "adjacent_text": "不应进入结果",
                        "intrinsic_width": 1200,
                        "intrinsic_height": 900,
                        "region": {"x": 0, "y": 0, "width": 600, "height": 450},
                    },
                ]
            }
        if action == "close_tab":
            return {"closed": True}
        raise AssertionError(f"unexpected browser action: {action}")


def test_visible_xiaohongshu_search_returns_bounded_note_sources() -> None:
    browser = RecordingBrowser()
    search = XiaohongshuBrowserSearch(browser)

    sources = search.search("旧厂房 剖面 空间层次", limit=4)

    assert len(sources) == 1
    assert sources[0].url == ("https://www.xiaohongshu.com/explore/note-42?xsec_token=visible")
    assert sources[0].title == "旧厂房更新：架空步道与公共展厅的剖面关系"
    assert sources[0].publisher == "小红书"
    assert sources[0].publication_tier is PublicationTier.aggregator
    open_call = browser.calls[0]
    assert open_call[0] == "open_url"
    assert open_call[1]["url"].startswith("https://www.xiaohongshu.com/search_result?keyword=")
    assert browser.calls[-1] == ("close_tab", {"tab_id": 17})
    assert [action for action, _ in browser.calls].count("scroll") == 1
    assert [action for action, _ in browser.calls].count("enumerate_media") == 2
