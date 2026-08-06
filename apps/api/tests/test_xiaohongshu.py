import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from archresearch_api.schemas import PublicationTier
from archresearch_api.xiaohongshu import (
    OpenCliCommandError,
    OpenCliXiaohongshuSearch,
    XiaohongshuBrowserSearch,
)


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
                        "media_type": "svg",
                        "url": None,
                        "link_url": "https://www.xiaohongshu.com/explore/broken-icon",
                        "alt": "",
                        "adjacent_text": "",
                        "intrinsic_width": 0,
                        "intrinsic_height": 0,
                        "region": {"x": 0, "y": 0, "width": 600, "height": 450},
                    },
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


class DelayedSearchResultsBrowser(RecordingBrowser):
    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        if action != "enumerate_media":
            return super().send_command_sync(
                action,
                payload,
                timeout_seconds=timeout_seconds,
            )
        self.calls.append((action, payload))
        self.enumerations += 1
        if self.enumerations <= 2:
            return {"media": []}
        return {
            "media": [
                {
                    "media_type": "image",
                    "url": "https://sns-img.example/delayed.jpg",
                    "link_url": "https://www.xiaohongshu.com/search_result/note-delayed",
                    "alt": "延迟渲染的剖面图",
                    "adjacent_text": "精细线稿剖面",
                    "intrinsic_width": 1200,
                    "intrinsic_height": 900,
                    "region": {"x": 0, "y": 0, "width": 600, "height": 450},
                }
            ]
        }


class EmptySearchResultsBrowser(RecordingBrowser):
    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        if action != "enumerate_media":
            return super().send_command_sync(
                action,
                payload,
                timeout_seconds=timeout_seconds,
            )
        self.calls.append((action, payload))
        self.enumerations += 1
        return {"media": []}


class SessionBrowser:
    connected = True

    def __init__(self, status: str | list[str]) -> None:
        self.statuses = status if isinstance(status, list) else [status]
        self.status_index = 0
        self.calls: list[tuple[str, dict[str, Any]]] = []

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
            return {"tab_id": 23, "url": payload["url"]}
        if action == "wait":
            return {"waited_ms": payload["milliseconds"]}
        if action == "xiaohongshu_session_status":
            status = self.statuses[min(self.status_index, len(self.statuses) - 1)]
            self.status_index += 1
            return {"status": status}
        if action == "close_tab":
            return {"closed": True}
        raise AssertionError(f"unexpected browser action: {action}")


def test_visible_xiaohongshu_search_returns_bounded_note_sources() -> None:
    browser = RecordingBrowser()
    sleeps: list[float] = []
    search = XiaohongshuBrowserSearch(browser, sleep=sleeps.append)

    sources = search.search("旧厂房 剖面 空间层次", limit=4)

    assert len(sources) == 1
    assert sources[0].url == ("https://www.xiaohongshu.com/explore/note-42?xsec_token=visible")
    assert sources[0].title == "旧厂房更新：架空步道与公共展厅的剖面关系"
    assert sources[0].publisher == "小红书"
    assert sources[0].publication_tier is PublicationTier.aggregator
    open_call = browser.calls[0]
    assert open_call[0] == "open_url"
    assert open_call[1]["url"].startswith("https://www.xiaohongshu.com/search_result?keyword=")
    assert "source=web_search_result_notes" in open_call[1]["url"]
    assert browser.calls[-1] == ("close_tab", {"tab_id": 17})
    assert [action for action, _ in browser.calls].count("scroll") == 1
    assert [action for action, _ in browser.calls].count("enumerate_media") == 2
    assert [action for action, _ in browser.calls].count("wait") == 0
    assert sleeps == [3.5, 1.0]


def test_visible_xiaohongshu_search_waits_for_delayed_note_cards() -> None:
    browser = DelayedSearchResultsBrowser()
    sleeps: list[float] = []
    search = XiaohongshuBrowserSearch(browser, sleep=sleeps.append)

    sources = search.search("剖面图 精细线稿", limit=4)

    assert [source.url for source in sources] == [
        "https://www.xiaohongshu.com/search_result/note-delayed"
    ]
    assert browser.enumerations == 4
    assert sleeps == [3.5, 1.0, 1.0, 1.0]
    assert browser.calls[-1] == ("close_tab", {"tab_id": 17})


def test_visible_xiaohongshu_search_stops_polling_when_results_stay_empty() -> None:
    browser = EmptySearchResultsBrowser()
    sleeps: list[float] = []
    search = XiaohongshuBrowserSearch(browser, sleep=sleeps.append)

    assert search.search("剖面图 精细线稿", limit=4) == []
    assert browser.enumerations == 6
    assert sleeps == [3.5, 1.0, 1.0, 1.0, 1.0, 1.0]
    assert browser.calls[-1] == ("close_tab", {"tab_id": 17})


@pytest.mark.parametrize("status", ["logged_in", "not_logged_in", "unknown"])
def test_browser_xiaohongshu_login_preflight_returns_only_bounded_status(status: str) -> None:
    browser = SessionBrowser(status)
    sleeps: list[float] = []
    search = XiaohongshuBrowserSearch(browser, sleep=sleeps.append)

    assert search.check_login() == status
    assert [action for action, _ in browser.calls] == [
        "open_url",
        "wait",
        "xiaohongshu_session_status",
        "close_tab",
    ]
    assert browser.calls[0][1]["url"].startswith(
        "https://www.xiaohongshu.com/search_result?keyword="
    )
    assert sleeps == []


def test_browser_xiaohongshu_login_reuses_a_retained_safety_verification_tab() -> None:
    browser = SessionBrowser(["verification_required", "verification_required", "logged_in"])
    search = XiaohongshuBrowserSearch(browser)

    assert search.check_login() == "verification_required"
    assert [action for action, _ in browser.calls] == [
        "open_url",
        "wait",
        "xiaohongshu_session_status",
    ]

    assert search.check_login() == "verification_required"
    assert [action for action, _ in browser.calls].count("open_url") == 1
    assert [action for action, _ in browser.calls].count("close_tab") == 0

    assert search.check_login() == "logged_in"
    assert [action for action, _ in browser.calls] == [
        "open_url",
        "wait",
        "xiaohongshu_session_status",
        "xiaohongshu_session_status",
        "xiaohongshu_session_status",
        "close_tab",
    ]


class RecordingRunner:
    def __init__(self, stdout: str, *, returncode: int = 0) -> None:
        self.stdout = stdout
        self.returncode = returncode
        self.calls: list[tuple[list[str], dict[str, Any]]] = []

    def __call__(self, command: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
        self.calls.append((command, kwargs))
        return subprocess.CompletedProcess(
            command,
            self.returncode,
            stdout=self.stdout,
            stderr="private browser diagnostics",
        )


def _opencli_search_payload() -> str:
    return json.dumps(
        [
            {
                "rank": 1,
                "author": "林中空地",
                "author_url": "https://www.xiaohongshu.com/user/profile/author-1",
                "likes": "606",
                "title": "工业遗址新生：首钢剧场改造分析图",
                "url": (
                    "https://www.xiaohongshu.com/search_result/note-42?xsec_token=private-token"
                ),
                "published_at": "2025-09-11",
            },
            {
                "rank": 2,
                "author": "无效来源",
                "likes": "1",
                "title": "站外链接",
                "url": "https://tracking.example/note-2",
                "published_at": "2025-09-10",
            },
        ],
        ensure_ascii=False,
    )


def test_opencli_search_uses_fixed_shell_free_json_command(tmp_path: Path) -> None:
    entry = tmp_path / "main.js"
    entry.write_text("// fixture", encoding="utf-8")
    runner = RecordingRunner(_opencli_search_payload())
    search = OpenCliXiaohongshuSearch(
        node_executable="node.exe",
        entry_path=entry,
        run_command=runner,
    )

    sources = search.search("旧厂房改造 分析图", limit=4)

    assert len(sources) == 1
    assert sources[0].title == "工业遗址新生：首钢剧场改造分析图"
    assert sources[0].publisher == "小红书 · 林中空地"
    assert sources[0].publication_tier is PublicationTier.aggregator
    command, kwargs = runner.calls[0]
    assert command == [
        "node.exe",
        str(entry),
        "xiaohongshu",
        "search",
        "旧厂房改造 分析图",
        "--limit",
        "4",
        "-f",
        "json",
        "--window",
        "background",
    ]
    assert kwargs["shell"] is False
    assert kwargs["capture_output"] is True
    assert kwargs["text"] is True
    assert kwargs["timeout"] == 30
    assert kwargs["env"]["NODE_NO_WARNINGS"] == "1"


@pytest.mark.parametrize(
    ("payload", "expected"),
    [
        ([{"site": "xiaohongshu", "status": "logged_in", "logged_in": True}], "logged_in"),
        (
            [{"site": "xiaohongshu", "status": "not_logged_in", "logged_in": False}],
            "not_logged_in",
        ),
        ([{"site": "xiaohongshu", "status": "unknown", "logged_in": ""}], "unknown"),
    ],
)
def test_opencli_login_preflight_uses_fixed_auth_status_command(
    tmp_path: Path,
    payload: list[dict[str, object]],
    expected: str,
) -> None:
    entry = tmp_path / "main.js"
    entry.write_text("// fixture", encoding="utf-8")
    runner = RecordingRunner(json.dumps(payload))
    search = OpenCliXiaohongshuSearch(
        node_executable="node.exe",
        entry_path=entry,
        run_command=runner,
    )

    assert search.check_login() == expected
    command, kwargs = runner.calls[0]
    assert command == [
        "node.exe",
        str(entry),
        "auth",
        "status",
        "--site",
        "xiaohongshu",
        "--timeout",
        "8",
        "-f",
        "json",
    ]
    assert kwargs["shell"] is False
    assert kwargs["capture_output"] is True


def test_opencli_login_preflight_rejects_private_or_malformed_output(tmp_path: Path) -> None:
    entry = tmp_path / "main.js"
    entry.write_text("// fixture", encoding="utf-8")
    runner = RecordingRunner('private-account {"status":"logged_in"}')
    search = OpenCliXiaohongshuSearch(
        node_executable="node.exe",
        entry_path=entry,
        run_command=runner,
    )

    with pytest.raises(OpenCliCommandError) as error:
        search.check_login()

    assert "private-account" not in str(error.value)


def test_opencli_search_rejects_malformed_json_without_leaking_output(tmp_path: Path) -> None:
    entry = tmp_path / "main.js"
    entry.write_text("// fixture", encoding="utf-8")
    runner = RecordingRunner("not-json private-token")
    search = OpenCliXiaohongshuSearch(
        node_executable="node.exe",
        entry_path=entry,
        run_command=runner,
    )

    with pytest.raises(OpenCliCommandError) as error:
        search.search("分析图")

    assert "private-token" not in str(error.value)
    assert "not-json" not in str(error.value)


def test_opencli_search_redacts_failed_command_diagnostics(tmp_path: Path) -> None:
    entry = tmp_path / "main.js"
    entry.write_text("// fixture", encoding="utf-8")
    runner = RecordingRunner("", returncode=2)
    search = OpenCliXiaohongshuSearch(
        node_executable="node.exe",
        entry_path=entry,
        run_command=runner,
    )

    with pytest.raises(OpenCliCommandError) as error:
        search.search("secret-query")

    assert "secret-query" not in str(error.value)
    assert "private browser diagnostics" not in str(error.value)


def test_opencli_download_returns_only_bounded_image_files(tmp_path: Path) -> None:
    entry = tmp_path / "main.js"
    entry.write_text("// fixture", encoding="utf-8")
    output_dir = tmp_path / "downloads"

    class DownloadRunner(RecordingRunner):
        def __call__(self, command: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
            output = Path(command[command.index("--output") + 1])
            output.mkdir(parents=True, exist_ok=True)
            for index in range(1, 7):
                (output / f"note_{index}.jpg").write_bytes(f"image-{index}".encode())
            (output / "note.mp4").write_bytes(b"video")
            return super().__call__(command, **kwargs)

    runner = DownloadRunner("[]")
    search = OpenCliXiaohongshuSearch(
        node_executable="node.exe",
        entry_path=entry,
        run_command=runner,
    )

    files = search.download(
        "https://www.xiaohongshu.com/search_result/note-42?xsec_token=private-token",
        output_dir,
        limit=4,
    )

    assert [path.name for path in files] == [
        "note_1.jpg",
        "note_3.jpg",
        "note_4.jpg",
        "note_6.jpg",
    ]
    command, kwargs = runner.calls[0]
    assert command[:4] == ["node.exe", str(entry), "xiaohongshu", "download"]
    assert command[5:] == [
        "--output",
        str(output_dir.resolve()),
        "-f",
        "json",
        "--window",
        "background",
    ]
    assert kwargs["shell"] is False


def test_opencli_download_rejects_non_xiaohongshu_url_before_command(tmp_path: Path) -> None:
    entry = tmp_path / "main.js"
    entry.write_text("// fixture", encoding="utf-8")
    runner = RecordingRunner("[]")
    search = OpenCliXiaohongshuSearch(
        node_executable="node.exe",
        entry_path=entry,
        run_command=runner,
    )

    with pytest.raises(ValueError):
        search.download("https://tracking.example/note", tmp_path / "downloads")

    assert runner.calls == []
