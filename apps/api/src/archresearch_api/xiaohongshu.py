from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any, Literal, Protocol, runtime_checkable
from urllib.parse import quote_plus, urlparse

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .inspection import BrowserCommandClient, OpenPageResult, PageMedia
from .providers import ProviderSource
from .schemas import PublicationTier

XIAOHONGSHU_SEARCH_URL = "https://www.xiaohongshu.com/search_result"
XIAOHONGSHU_INITIAL_WAIT_MILLISECONDS = 3_500
XIAOHONGSHU_RESULT_POLL_ATTEMPTS = 5
XIAOHONGSHU_RESULT_POLL_INTERVAL_MILLISECONDS = 1_000
XIAOHONGSHU_SCROLL_WAIT_MILLISECONDS = 1_000
XIAOHONGSHU_SCROLL_DISTANCE = 1_200
XIAOHONGSHU_MAX_RESULTS = 4
XIAOHONGSHU_MAX_SEARCH_RESULTS = 8
XIAOHONGSHU_MAX_MEDIA_CANDIDATES = 200
OPENCLI_TIMEOUT_SECONDS = 30
OPENCLI_AUTH_TIMEOUT_SECONDS = 8
OPENCLI_AUTH_PROCESS_TIMEOUT_SECONDS = 12
OPENCLI_IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})
OPENCLI_ENTRY_RELATIVE_PATH = Path("node_modules/@jackwener/opencli/dist/src/main.js")


class OpenCliCommandError(RuntimeError):
    """An OpenCLI read command failed without exposing browser-session output."""


@runtime_checkable
class XiaohongshuSearch(Protocol):
    name: str

    def search(
        self, query: str, *, limit: int = XIAOHONGSHU_MAX_RESULTS
    ) -> list[ProviderSource]: ...


@runtime_checkable
class XiaohongshuAssetDownloader(Protocol):
    name: str

    def download(
        self,
        note_url: str,
        output_dir: Path,
        *,
        limit: int = XIAOHONGSHU_MAX_RESULTS,
    ) -> list[Path]: ...


class _OpenCliSearchItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    rank: int = Field(ge=1)
    author: str = Field(default="", max_length=200)
    author_url: str | None = Field(default=None, max_length=2_000)
    likes: str | int = ""
    title: str = Field(default="", max_length=500)
    url: str = Field(min_length=1, max_length=2_000)
    published_at: str = Field(default="", max_length=100)


XiaohongshuSessionStatus = Literal[
    "logged_in",
    "not_logged_in",
    "verification_required",
    "unknown",
]


class _OpenCliAuthStatusRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    site: Literal["xiaohongshu"]
    status: Literal["logged_in", "not_logged_in", "unknown", "error"]
    logged_in: bool | Literal[""] = ""


class _XiaohongshuSessionRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: XiaohongshuSessionStatus


@runtime_checkable
class XiaohongshuSessionChecker(Protocol):
    name: str

    def check_login(self) -> XiaohongshuSessionStatus: ...


class OpenCliXiaohongshuSearch:
    name = "opencli-xiaohongshu"

    def __init__(
        self,
        *,
        node_executable: str,
        entry_path: Path,
        run_command: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
    ) -> None:
        self._node_executable = node_executable
        self._entry_path = entry_path.resolve()
        self._run_process = run_command

    @classmethod
    def discover(cls, project_root: Path | None = None) -> OpenCliXiaohongshuSearch | None:
        node_executable = shutil.which("node")
        root = project_root or Path(__file__).resolve().parents[4]
        entry_path = root / OPENCLI_ENTRY_RELATIVE_PATH
        if node_executable is None or not entry_path.is_file():
            return None
        return cls(node_executable=node_executable, entry_path=entry_path)

    def search(
        self,
        query: str,
        *,
        limit: int = XIAOHONGSHU_MAX_RESULTS,
    ) -> list[ProviderSource]:
        bounded_query = " ".join(query.split())[:500]
        if not bounded_query:
            raise ValueError("Xiaohongshu search query is required")
        bounded_limit = max(1, min(limit, XIAOHONGSHU_MAX_SEARCH_RESULTS))
        stdout = self._run_read_command(
            "search",
            [bounded_query, "--limit", str(bounded_limit)],
        )
        items = _parse_opencli_search_output(stdout)
        sources: list[ProviderSource] = []
        seen: set[str] = set()
        for item in items:
            if item.url in seen or not _is_xiaohongshu_note_url(item.url):
                continue
            seen.add(item.url)
            publisher = f"小红书 · {item.author.strip()}" if item.author.strip() else "小红书"
            source = ProviderSource(
                url=item.url,
                publisher=publisher,
                title=(item.title.strip() or "小红书视觉参考")[:300],
                publication_tier=PublicationTier.aggregator,
            )
            source._search_description = " ".join(
                part
                for part in (
                    item.title.strip(),
                    item.author.strip(),
                    f"点赞 {item.likes}" if str(item.likes).strip() else "",
                    item.published_at.strip(),
                )
                if part
            )[:1_000]
            sources.append(source)
            if len(sources) == bounded_limit:
                break
        return sources

    def check_login(self) -> XiaohongshuSessionStatus:
        stdout = self._run_command(
            [
                self._node_executable,
                str(self._entry_path),
                "auth",
                "status",
                "--site",
                "xiaohongshu",
                "--timeout",
                str(OPENCLI_AUTH_TIMEOUT_SECONDS),
                "-f",
                "json",
            ],
            operation="auth status",
            timeout_seconds=OPENCLI_AUTH_PROCESS_TIMEOUT_SECONDS,
        )
        return _parse_opencli_auth_status(stdout)

    def download(
        self,
        note_url: str,
        output_dir: Path,
        *,
        limit: int = XIAOHONGSHU_MAX_RESULTS,
    ) -> list[Path]:
        if not _is_xiaohongshu_note_url(note_url):
            raise ValueError("Only Xiaohongshu note URLs can be downloaded")
        bounded_limit = max(1, min(limit, XIAOHONGSHU_MAX_RESULTS))
        resolved_output = output_dir.resolve()
        resolved_output.mkdir(parents=True, exist_ok=True)
        self._run_read_command(
            "download",
            [note_url, "--output", str(resolved_output)],
        )
        candidates = sorted(
            (
                path.resolve()
                for path in resolved_output.rglob("*")
                if path.is_file() and path.suffix.casefold() in OPENCLI_IMAGE_EXTENSIONS
            ),
            key=lambda path: path.name.casefold(),
        )
        safe_candidates = [
            path
            for path in candidates
            if resolved_output == path.parent or resolved_output in path.parents
        ]
        return _evenly_sampled(safe_candidates, bounded_limit)

    def _run_read_command(
        self,
        operation: Literal["search", "note", "download"],
        arguments: list[str],
    ) -> str:
        command = [
            self._node_executable,
            str(self._entry_path),
            "xiaohongshu",
            operation,
            *arguments,
            "-f",
            "json",
            "--window",
            "background",
        ]
        return self._run_command(command, operation=operation)

    def _run_command(
        self,
        command: list[str],
        *,
        operation: str,
        timeout_seconds: int = OPENCLI_TIMEOUT_SECONDS,
    ) -> str:
        environment = os.environ.copy()
        environment["NODE_NO_WARNINGS"] = "1"
        try:
            completed = self._run_process(
                command,
                shell=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
                env=environment,
                check=False,
            )
        except subprocess.TimeoutExpired:
            raise OpenCliCommandError(f"OpenCLI {operation} timed out") from None
        except OSError:
            raise OpenCliCommandError(f"OpenCLI {operation} could not start") from None
        if completed.returncode != 0:
            raise OpenCliCommandError(f"OpenCLI {operation} failed")
        return completed.stdout


class XiaohongshuBrowserSearch:
    name = "archresearch-extension-xiaohongshu"

    def __init__(
        self,
        browser: BrowserCommandClient,
        *,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._browser = browser
        self._sleep = sleep
        self._session_check_lock = threading.Lock()
        self._verification_tab_id: int | None = None

    def check_login(self) -> XiaohongshuSessionStatus:
        with self._session_check_lock:
            return self._check_login_locked()

    def _check_login_locked(self) -> XiaohongshuSessionStatus:
        search_url = (
            f"{XIAOHONGSHU_SEARCH_URL}?keyword={quote_plus('建筑图纸')}"
            "&source=web_search_result_notes"
        )
        opened_new_tab = self._verification_tab_id is None
        if opened_new_tab:
            opened = OpenPageResult.model_validate(
                self._browser.send_command_sync("open_url", {"url": search_url})
            )
            self._verification_tab_id = opened.tab_id
        tab_id = self._verification_tab_id
        if tab_id is None:
            raise RuntimeError("Xiaohongshu session tab was not opened")
        try:
            if opened_new_tab:
                self._browser.send_command_sync(
                    "wait", {"milliseconds": XIAOHONGSHU_INITIAL_WAIT_MILLISECONDS}
                )
            result = _XiaohongshuSessionRead.model_validate(
                self._browser.send_command_sync("xiaohongshu_session_status", {"tab_id": tab_id})
            )
        except Exception:
            self._verification_tab_id = None
            try:
                self._browser.send_command_sync("close_tab", {"tab_id": tab_id})
            except Exception:
                pass
            raise
        if result.status == "verification_required":
            return result.status
        self._verification_tab_id = None
        self._browser.send_command_sync("close_tab", {"tab_id": tab_id})
        return result.status

    def search(self, query: str, *, limit: int = XIAOHONGSHU_MAX_RESULTS) -> list[ProviderSource]:
        bounded_limit = max(1, min(limit, XIAOHONGSHU_MAX_SEARCH_RESULTS))
        search_url = (
            f"{XIAOHONGSHU_SEARCH_URL}?keyword={quote_plus(query[:500])}"
            "&source=web_search_result_notes"
        )
        opened = OpenPageResult.model_validate(
            self._browser.send_command_sync("open_url", {"url": search_url})
        )
        media = []
        try:
            self._sleep(XIAOHONGSHU_INITIAL_WAIT_MILLISECONDS / 1_000)
            first: list[PageMedia] = []
            for attempt in range(XIAOHONGSHU_RESULT_POLL_ATTEMPTS):
                first = _validated_media(
                    self._browser.send_command_sync("enumerate_media", {"tab_id": opened.tab_id})
                )
                if any(
                    item.link_url is not None and _is_xiaohongshu_note_url(item.link_url)
                    for item in first
                ):
                    break
                if attempt < XIAOHONGSHU_RESULT_POLL_ATTEMPTS - 1:
                    self._sleep(XIAOHONGSHU_RESULT_POLL_INTERVAL_MILLISECONDS / 1_000)
            media.extend(first)
            self._browser.send_command_sync(
                "scroll",
                {
                    "tab_id": opened.tab_id,
                    "direction": "down",
                    "distance": XIAOHONGSHU_SCROLL_DISTANCE,
                },
            )
            self._sleep(XIAOHONGSHU_SCROLL_WAIT_MILLISECONDS / 1_000)
            second = _validated_media(
                self._browser.send_command_sync("enumerate_media", {"tab_id": opened.tab_id})
            )
            media.extend(second)
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
    return (
        parsed.path.startswith("/explore/")
        or parsed.path.startswith("/discovery/item/")
        or parsed.path.startswith("/search_result/")
    )


def _parse_opencli_search_output(value: str) -> list[_OpenCliSearchItem]:
    try:
        raw_items = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        raise OpenCliCommandError("OpenCLI search returned invalid JSON") from None
    if not isinstance(raw_items, list):
        raise OpenCliCommandError("OpenCLI search returned an invalid result shape")
    items: list[_OpenCliSearchItem] = []
    for raw_item in raw_items[:20]:
        try:
            items.append(_OpenCliSearchItem.model_validate(raw_item))
        except ValidationError:
            continue
    return items


def _parse_opencli_auth_status(value: str) -> XiaohongshuSessionStatus:
    try:
        raw_items = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        raise OpenCliCommandError("OpenCLI auth status returned invalid JSON") from None
    if not isinstance(raw_items, list):
        raise OpenCliCommandError("OpenCLI auth status returned an invalid result shape")
    for raw_item in raw_items[:10]:
        try:
            item = _OpenCliAuthStatusRow.model_validate(raw_item)
        except ValidationError:
            continue
        if item.status == "logged_in" and item.logged_in is True:
            return "logged_in"
        if item.status == "not_logged_in" and item.logged_in is False:
            return "not_logged_in"
        return "unknown"
    return "unknown"


def _evenly_sampled(paths: list[Path], limit: int) -> list[Path]:
    if len(paths) <= limit:
        return paths
    last_index = len(paths) - 1
    indexes = [round(position * last_index / (limit - 1)) for position in range(limit)]
    return [paths[index] for index in indexes]


def _validated_media(value: Any) -> list[PageMedia]:
    if not isinstance(value, dict) or not isinstance(value.get("media"), list):
        return []
    media: list[PageMedia] = []
    for candidate in value["media"][:XIAOHONGSHU_MAX_MEDIA_CANDIDATES]:
        try:
            media.append(PageMedia.model_validate(candidate))
        except ValidationError:
            continue
    return media
