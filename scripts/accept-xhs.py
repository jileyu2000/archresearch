from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from collections.abc import Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import uvicorn
from fastapi import FastAPI

WORKSPACE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WORKSPACE / "apps" / "api" / "src"))

from archresearch_api.browser import (  # noqa: E402
    BrowserBroker,
    PairingAuthority,
    create_browser_router,
)
from archresearch_api.xiaohongshu import XiaohongshuBrowserSearch  # noqa: E402


class AuditedBrowser:
    def __init__(self, broker: BrowserBroker) -> None:
        self._broker = broker
        self.actions: list[str] = []
        self.enumerations: list[dict[str, int]] = []
        self.failed_action: str | None = None

    @property
    def connected(self) -> bool:
        return self._broker.connected

    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        self.actions.append(action)
        try:
            result = self._broker.send_command_sync(
                action,
                payload,
                timeout_seconds=timeout_seconds,
            )
        except Exception:
            self.failed_action = action
            raise
        if action == "enumerate_media":
            self.enumerations.append(_summarize_media(result))
        return result


def _summarize_media(value: Any) -> dict[str, int]:
    media = value.get("media", []) if isinstance(value, dict) else []
    if not isinstance(media, list):
        media = []
    note_links: set[str] = set()
    image_count = 0
    contextual_count = 0
    for item in media:
        if not isinstance(item, dict):
            continue
        if item.get("media_type") == "image" and item.get("url"):
            image_count += 1
        if item.get("adjacent_text") or item.get("alt"):
            contextual_count += 1
        link = item.get("link_url")
        if isinstance(link, str) and _is_note_url(link):
            note_links.add(urlparse(link).path)
    return {
        "media": len(media),
        "images": image_count,
        "note_links": len(note_links),
        "with_context": contextual_count,
    }


def _is_note_url(value: str) -> bool:
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").rstrip(".").lower()
    return (
        hostname == "xiaohongshu.com" or hostname.endswith(".xiaohongshu.com")
    ) and (
        parsed.path.startswith("/explore/")
        or parsed.path.startswith("/discovery/item/")
    )


def _wait_for(predicate: Callable[[], bool], timeout_seconds: float) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.1)
    return predicate()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", default="建筑分析图 图纸表达")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    data_dir = WORKSPACE / ".archresearch"
    pairing_token = data_dir / "browser-pairing-token"
    if not pairing_token.is_file():
        print(json.dumps({"status": "blocked", "reason": "pairing_token_missing"}))
        return 2

    broker = BrowserBroker()
    authority = PairingAuthority(data_dir)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        broker.bind_loop()
        yield

    app = FastAPI(lifespan=lifespan)
    app.include_router(create_browser_router(authority, broker))
    server = uvicorn.Server(
        uvicorn.Config(
            app,
            host="127.0.0.1",
            port=args.port,
            log_level="warning",
        )
    )
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()
    started_at = time.monotonic()
    status = "blocked"
    summary: dict[str, Any] = {
        "status": status,
        "provider_calls": 0,
    }
    audited: AuditedBrowser | None = None
    try:
        if not _wait_for(lambda: server.started, 10):
            summary["reason"] = "broker_start_timeout"
            return_code = 2
        elif not _wait_for(lambda: broker.connected, 20):
            summary["reason"] = "extension_connection_timeout"
            return_code = 2
        else:
            audited = AuditedBrowser(broker)
            sources = XiaohongshuBrowserSearch(audited).search(args.query, limit=4)
            unique_sources = {urlparse(source.url).path for source in sources}
            totals = {
                key: sum(item[key] for item in audited.enumerations)
                for key in ("media", "images", "note_links", "with_context")
            }
            has_visible_assets = (
                len(audited.enumerations) == 2
                and totals["images"] > 0
                and bool(unique_sources)
            )
            status = "completed" if has_visible_assets else "blocked"
            summary.update(
                {
                    "status": status,
                    "connected": True,
                    "actions": audited.actions,
                    "enumerations": audited.enumerations,
                    "totals": totals,
                    "unique_note_sources": len(unique_sources),
                    "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                }
            )
            if not unique_sources:
                summary["reason"] = "no_visible_note_links"
            elif totals["images"] == 0:
                summary["reason"] = "no_visible_images"
            elif len(audited.enumerations) != 2:
                summary["reason"] = "incomplete_media_scan"
            return_code = 0 if has_visible_assets else 2
    except Exception as error:
        summary.update(
            {
                "status": "blocked",
                "reason": "browser_protocol_error",
                "error_type": type(error).__name__,
            }
        )
        if audited is not None:
            summary.update(
                {
                    "actions": audited.actions,
                    "enumerations": audited.enumerations,
                    "failed_action": audited.failed_action,
                }
            )
        return_code = 2
    finally:
        if broker.connected:
            broker.notify_terminal(status)
        server.should_exit = True
        server_thread.join(timeout=5)
        print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
