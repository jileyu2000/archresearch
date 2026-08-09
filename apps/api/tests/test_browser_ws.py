from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

import archresearch_api.browser as browser_module
from archresearch_api.browser import (
    CHROME_BOARD_URL,
    BrowserBroker,
    BrowserCommand,
    BrowserNavigationError,
    is_allowed_chrome_board_url,
    open_board_in_chrome,
)
from archresearch_api.config import Settings
from archresearch_api.main import create_app
from archresearch_api.models import ResearchRun
from archresearch_api.schemas import BUDGETS, BudgetMode, ResearchGoal, RunStatus
from archresearch_api.xiaohongshu import XiaohongshuBrowserSearch


class RecordingSocket:
    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    async def send_json(self, message: dict[str, Any]) -> None:
        self.messages.append(message)


class SessionCheckingXiaohongshu:
    name = "session-checking-xiaohongshu"

    def __init__(self, session_status: str) -> None:
        self.session_status = session_status
        self.checks = 0

    def check_login(self) -> str:
        self.checks += 1
        return self.session_status


class SessionCheckingBroker(BrowserBroker):
    def __init__(self, session_status: str | list[str]) -> None:
        super().__init__()
        self.session_statuses = (
            session_status if isinstance(session_status, list) else [session_status]
        )
        self.session_status_index = 0
        self.commands: list[tuple[str, dict[str, Any]]] = []

    @property
    def connected(self) -> bool:
        return True

    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        del timeout_seconds
        self.commands.append((action, payload))
        if action == "open_url":
            return {"tab_id": 73, "url": payload["url"]}
        if action == "wait":
            return {"waited_ms": payload["milliseconds"]}
        if action == "xiaohongshu_session_status":
            session_status = self.session_statuses[
                min(self.session_status_index, len(self.session_statuses) - 1)
            ]
            self.session_status_index += 1
            return {"status": session_status}
        if action == "close_tab":
            return {"closed": True}
        raise AssertionError(f"Unexpected browser command: {action}")


def test_real_chrome_launcher_adds_a_unique_connection_attempt(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    chrome = tmp_path / "Google" / "Chrome" / "Application" / "chrome.exe"
    launched: list[tuple[list[str], bool]] = []
    monkeypatch.setattr(browser_module.os, "name", "nt")
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    monkeypatch.setattr(
        browser_module.Path,
        "is_file",
        lambda path: path == chrome,
    )
    monkeypatch.setattr(
        browser_module.subprocess,
        "Popen",
        lambda args, close_fds: launched.append((args, close_fds)),
    )

    assert open_board_in_chrome(CHROME_BOARD_URL) is True
    assert len(launched) == 1
    args, close_fds = launched[0]
    assert args[:2] == [str(chrome), "--new-tab"]
    assert args[2].startswith(f"{CHROME_BOARD_URL}&attempt=")
    assert len(args[2].removeprefix(f"{CHROME_BOARD_URL}&attempt=")) == 32
    assert close_fds is True


def test_pairing_code_rotates_once_and_persistent_token_survives_restart(tmp_path: Path) -> None:
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )

    with TestClient(create_app(settings)) as client:
        response = client.post("/v1/browser/pairing-code")
        assert response.status_code == 201
        pairing_code = response.json()["code"]

        with client.websocket_connect("/v1/browser") as websocket:
            websocket.send_json(
                {
                    "type": "browser.authenticate",
                    "protocol_version": 1,
                    "token": pairing_code,
                }
            )
            paired = websocket.receive_json()

        assert paired["type"] == "browser.paired"
        assert paired["protocol_version"] == 1
        persistent_token = paired["token"]
        assert persistent_token != pairing_code
        token_file = settings.data_dir / "browser-pairing-token"
        assert token_file.exists()
        assert persistent_token not in token_file.read_text(encoding="utf-8")

        with client.websocket_connect("/v1/browser") as websocket:
            websocket.send_json(
                {
                    "type": "browser.authenticate",
                    "protocol_version": 1,
                    "token": pairing_code,
                }
            )
            with pytest.raises(WebSocketDisconnect) as rejected:
                websocket.receive_json()
        assert rejected.value.code == 1008

    with TestClient(create_app(settings)) as restarted_client:
        with restarted_client.websocket_connect("/v1/browser") as websocket:
            websocket.send_json(
                {
                    "type": "browser.authenticate",
                    "protocol_version": 1,
                    "token": persistent_token,
                }
            )
            assert websocket.receive_json() == {
                "type": "browser.authenticated",
                "protocol_version": 1,
            }


def test_browser_status_tracks_authenticated_extension_connection(client: TestClient) -> None:
    assert client.get("/v1/browser/status").json() == {
        "connected": False,
        "xiaohongshu_search_available": False,
    }


def test_browser_status_reports_independent_xiaohongshu_search_backend(
    client: TestClient,
) -> None:
    client.app.state.xiaohongshu_search = object()

    assert client.get("/v1/browser/status").json() == {
        "connected": False,
        "xiaohongshu_search_available": True,
    }


@pytest.mark.parametrize("session_status", ["logged_in", "not_logged_in", "unknown"])
def test_xiaohongshu_session_preflight_checks_the_configured_backend(
    tmp_path: Path,
    session_status: str,
) -> None:
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )
    xiaohongshu = SessionCheckingXiaohongshu(session_status)

    with TestClient(create_app(settings, xiaohongshu_search=xiaohongshu)) as test_client:
        response = test_client.post("/v1/browser/xiaohongshu-session")

    assert response.status_code == 200
    assert response.json() == {
        "status": session_status,
        "channel": "local_search",
    }
    assert xiaohongshu.checks == 1


def test_xiaohongshu_session_preflight_fails_closed_without_a_channel(
    client: TestClient,
) -> None:
    response = client.post("/v1/browser/xiaohongshu-session")

    assert response.status_code == 200
    assert response.json() == {"status": "unavailable", "channel": "none"}


def test_xiaohongshu_session_preflight_uses_logged_in_chrome_when_local_probe_is_unknown(
    tmp_path: Path,
) -> None:
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )
    local_search = SessionCheckingXiaohongshu("unknown")
    browser_broker = SessionCheckingBroker("logged_in")

    with TestClient(
        create_app(
            settings,
            browser_broker=browser_broker,
            xiaohongshu_search=local_search,
        )
    ) as test_client:
        response = test_client.post("/v1/browser/xiaohongshu-session")

    assert response.status_code == 200
    assert response.json() == {
        "status": "logged_in",
        "channel": "chrome_extension",
    }
    assert local_search.checks == 0
    assert [action for action, _payload in browser_broker.commands] == [
        "open_url",
        "wait",
        "xiaohongshu_session_status",
        "close_tab",
    ]


def test_xiaohongshu_session_preflight_uses_logged_out_chrome_over_local_login(
    tmp_path: Path,
) -> None:
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )
    local_search = SessionCheckingXiaohongshu("logged_in")
    browser_broker = SessionCheckingBroker("not_logged_in")

    with TestClient(
        create_app(
            settings,
            browser_broker=browser_broker,
            xiaohongshu_search=local_search,
        )
    ) as test_client:
        response = test_client.post("/v1/browser/xiaohongshu-session")

    assert response.status_code == 200
    assert response.json() == {
        "status": "not_logged_in",
        "channel": "chrome_extension",
    }
    assert local_search.checks == 0
    assert [action for action, _payload in browser_broker.commands] == [
        "open_url",
        "wait",
        "xiaohongshu_session_status",
        "close_tab",
    ]


def test_xiaohongshu_session_preflight_does_not_run_a_second_browser_checker(
    tmp_path: Path,
) -> None:
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )
    browser_broker = SessionCheckingBroker("unknown")
    browser_search = XiaohongshuBrowserSearch(browser_broker)

    with TestClient(
        create_app(
            settings,
            browser_broker=browser_broker,
            xiaohongshu_search=browser_search,
        )
    ) as test_client:
        response = test_client.post("/v1/browser/xiaohongshu-session")

    assert response.status_code == 200
    assert response.json() == {
        "status": "unknown",
        "channel": "chrome_extension",
    }
    assert [action for action, _payload in browser_broker.commands] == [
        "open_url",
        "wait",
        "xiaohongshu_session_status",
        "close_tab",
    ]


def test_xiaohongshu_session_preflight_reuses_one_safety_verification_tab(
    tmp_path: Path,
) -> None:
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )
    browser_broker = SessionCheckingBroker(["verification_required", "logged_in"])

    with TestClient(create_app(settings, browser_broker=browser_broker)) as test_client:
        first = test_client.post("/v1/browser/xiaohongshu-session")
        second = test_client.post("/v1/browser/xiaohongshu-session")

    assert first.status_code == 200
    assert first.json() == {
        "status": "verification_required",
        "channel": "chrome_extension",
    }
    assert second.status_code == 200
    assert second.json() == {
        "status": "logged_in",
        "channel": "chrome_extension",
    }
    assert [action for action, _payload in browser_broker.commands] == [
        "open_url",
        "wait",
        "xiaohongshu_session_status",
        "xiaohongshu_session_status",
        "close_tab",
    ]


def test_authenticated_extension_heartbeat_keeps_connection_active(
    client: TestClient,
) -> None:
    pairing_code = client.post("/v1/browser/pairing-code").json()["code"]

    with client.websocket_connect("/v1/browser") as websocket:
        websocket.send_json(
            {
                "type": "browser.authenticate",
                "protocol_version": 1,
                "token": pairing_code,
            }
        )
        assert websocket.receive_json()["type"] == "browser.paired"

        websocket.send_json({"type": "browser.heartbeat", "protocol_version": 1})

        assert websocket.receive_json() == {
            "type": "browser.heartbeat_ack",
            "protocol_version": 1,
        }
        assert client.get("/v1/browser/status").json() == {
            "connected": True,
            "xiaohongshu_search_available": False,
        }
    pairing_code = client.post("/v1/browser/pairing-code").json()["code"]

    with client.websocket_connect("/v1/browser") as websocket:
        websocket.send_json(
            {
                "type": "browser.authenticate",
                "protocol_version": 1,
                "token": pairing_code,
            }
        )
        assert websocket.receive_json()["type"] == "browser.paired"
        assert client.get("/v1/browser/status").json() == {
            "connected": True,
            "xiaohongshu_search_available": False,
        }

    assert client.get("/v1/browser/status").json() == {
        "connected": False,
        "xiaohongshu_search_available": False,
    }


def test_open_chrome_board_uses_only_the_fixed_local_connection_url(tmp_path: Path) -> None:
    opened_urls: list[str] = []
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )

    with TestClient(
        create_app(settings, chrome_launcher=lambda url: opened_urls.append(url) or True)
    ) as test_client:
        response = test_client.post("/v1/browser/open-chrome")

    assert response.status_code == 200
    assert response.json() == {"opened": True}
    assert opened_urls == ["http://127.0.0.1:5173/?connect=chrome"]


def test_open_xiaohongshu_login_uses_only_the_fixed_site_url(tmp_path: Path) -> None:
    opened_urls: list[str] = []
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )

    with TestClient(
        create_app(settings, chrome_launcher=lambda url: opened_urls.append(url) or True)
    ) as test_client:
        response = test_client.post("/v1/browser/open-xiaohongshu-login")

    assert response.status_code == 200
    assert response.json() == {"opened": True}
    assert opened_urls == ["https://www.xiaohongshu.com/explore"]


@pytest.mark.parametrize(
    ("url", "allowed"),
    [
        ("http://127.0.0.1:8000/?connect=chrome", True),
        ("http://127.0.0.1:49152/?connect=chrome", True),
        ("http://localhost:49152/?connect=chrome", False),
        ("http://127.0.0.1:49152/private?connect=chrome", False),
        ("http://127.0.0.1:49152/?connect=chrome&next=https://example.com", False),
        ("https://127.0.0.1:49152/?connect=chrome", False),
    ],
)
def test_chrome_launcher_accepts_only_the_bounded_installed_loopback_url(
    url: str,
    allowed: bool,
) -> None:
    assert is_allowed_chrome_board_url(url) is allowed


def test_open_chrome_board_reports_when_chrome_is_unavailable(tmp_path: Path) -> None:
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )

    with TestClient(create_app(settings, chrome_launcher=lambda _url: False)) as test_client:
        response = test_client.post("/v1/browser/open-chrome")

    assert response.status_code == 503
    assert response.json() == {"detail": "Google Chrome is not installed"}


def test_invalid_authentication_is_rejected_without_echoing_secret(client: TestClient) -> None:
    hostile_secret = "secret-from-password-field"

    with client.websocket_connect("/v1/browser") as websocket:
        websocket.send_json(
            {
                "type": "browser.authenticate",
                "protocol_version": 1,
                "token": hostile_secret,
            }
        )
        with pytest.raises(WebSocketDisconnect) as rejected:
            websocket.receive_json()

    assert rejected.value.code == 1008
    assert hostile_secret not in rejected.value.reason


def test_broker_sends_only_enumerated_commands_and_correlates_results() -> None:
    async def exercise() -> None:
        broker = BrowserBroker()
        socket = RecordingSocket()
        await broker.attach(socket)

        pending = asyncio.create_task(broker.send_command("wait", {"milliseconds": 25}))
        await asyncio.sleep(0)
        command = socket.messages.pop()

        assert command == {
            "type": "browser.command",
            "protocol_version": 1,
            "id": command["id"],
            "action": "wait",
            "payload": {"milliseconds": 25},
        }

        await broker.receive_result(
            {
                "type": "browser.result",
                "protocol_version": 1,
                "id": command["id"],
                "ok": True,
                "result": {"waited_ms": 25},
            }
        )
        assert await pending == {"waited_ms": 25}

        with pytest.raises(ValidationError):
            await broker.send_command("execute_script", {"code": "document.cookie"})
        with pytest.raises(ValidationError):
            await broker.send_command("page_metadata", {"tab_id": 1, "selector": "body"})

    asyncio.run(exercise())


def test_browser_command_allows_only_bounded_xiaohongshu_note_navigation() -> None:
    command = BrowserCommand.model_validate(
        {
            "action": "open_xiaohongshu_note",
            "payload": {
                "search_url": (
                    "https://www.xiaohongshu.com/search_result?keyword=section"
                    "&source=web_search_result_notes"
                ),
                "note_url": "https://www.xiaohongshu.com/explore/note-42?xsec_token=visible",
            },
        }
    )

    assert command.action == "open_xiaohongshu_note"
    assert command.payload == {
        "search_url": (
            "https://www.xiaohongshu.com/search_result?keyword=section"
            "&source=web_search_result_notes"
        ),
        "note_url": "https://www.xiaohongshu.com/explore/note-42?xsec_token=visible",
    }

    search_result_note = BrowserCommand.model_validate(
        {
            "action": "open_xiaohongshu_note",
            "payload": {
                "search_url": "https://www.xiaohongshu.com/search_result?keyword=section",
                "note_url": "https://www.xiaohongshu.com/search_result/68da3657000000001400aedf",
            },
        }
    )
    assert search_result_note.payload["note_url"] == (
        "https://www.xiaohongshu.com/search_result/68da3657000000001400aedf"
    )

    invalid_payloads = [
        {
            "search_url": "https://www.xiaohongshu.com/explore",
            "note_url": "https://www.xiaohongshu.com/explore/note-42",
        },
        {
            "search_url": "https://www.xiaohongshu.com/search_result?keyword=section",
            "note_url": "https://example.com/explore/note-42",
        },
        {
            "search_url": "https://www.xiaohongshu.com/search_result?keyword=section",
            "note_url": "https://www.xiaohongshu.com/explore/",
        },
        {
            "search_url": "https://www.xiaohongshu.com/search_result?keyword=section",
            "note_url": "https://www.xiaohongshu.com/search_result/",
        },
    ]
    for payload in invalid_payloads:
        with pytest.raises(ValidationError):
            BrowserCommand.model_validate(
                {
                    "action": "open_xiaohongshu_note",
                    "payload": payload,
                }
            )


def test_broker_rejects_open_url_when_any_resolved_address_is_not_global() -> None:
    async def exercise() -> None:
        broker = BrowserBroker(
            hostname_resolver=lambda hostname: [
                "93.184.216.34",
                "::ffff:192.168.1.20",
            ]
        )
        socket = RecordingSocket()
        await broker.attach(socket)

        with pytest.raises(BrowserNavigationError, match="public address"):
            await broker.send_command("open_url", {"url": "https://project.example/page"})

        assert socket.messages == []

    asyncio.run(exercise())


@pytest.mark.parametrize(
    "url",
    [
        "file:///C:/secrets.txt",
        "ftp://project.example/page",
        "chrome://settings/",
    ],
)
def test_broker_rejects_non_http_navigation_without_sending_a_command(url: str) -> None:
    async def exercise() -> None:
        broker = BrowserBroker()
        socket = RecordingSocket()
        await broker.attach(socket)

        with pytest.raises(ValidationError, match="safe public HTTP"):
            await broker.send_command("open_url", {"url": url})

        assert socket.messages == []

    asyncio.run(exercise())


def test_broker_rejects_open_url_when_dns_resolution_fails() -> None:
    def failing_resolver(hostname: str) -> list[str]:
        del hostname
        raise OSError("DNS unavailable")

    async def exercise() -> None:
        broker = BrowserBroker(hostname_resolver=failing_resolver)
        socket = RecordingSocket()
        await broker.attach(socket)

        with pytest.raises(BrowserNavigationError, match="could not be resolved"):
            await broker.send_command("open_url", {"url": "https://project.example/page"})

        assert socket.messages == []

    asyncio.run(exercise())


@pytest.mark.parametrize("state", ["completed", "partial", "blocked", "cancelled", "failed"])
def test_broker_broadcasts_research_terminal_states(state: str) -> None:
    async def exercise() -> None:
        broker = BrowserBroker()
        socket = RecordingSocket()
        await broker.attach(socket)

        await broker.broadcast_terminal(state)

        assert socket.messages == [
            {
                "type": "research.session",
                "protocol_version": 1,
                "state": state,
            }
        ]

    asyncio.run(exercise())


def test_worker_terminal_notification_waits_for_extension_cleanup_delivery() -> None:
    async def exercise() -> None:
        started = asyncio.Event()
        release = asyncio.Event()

        class BlockingSocket(RecordingSocket):
            async def send_json(self, message: dict[str, Any]) -> None:
                started.set()
                await release.wait()
                await super().send_json(message)

        broker = BrowserBroker()
        broker.bind_loop()
        socket = BlockingSocket()
        await broker.attach(socket)

        notification = asyncio.create_task(asyncio.to_thread(broker.notify_terminal, "completed"))
        await started.wait()
        await asyncio.sleep(0)

        assert notification.done() is False
        release.set()
        await asyncio.wait_for(notification, timeout=1)
        assert socket.messages[0]["state"] == "completed"

    asyncio.run(exercise())


def test_broker_rejects_non_terminal_research_state() -> None:
    async def exercise() -> None:
        broker = BrowserBroker()
        with pytest.raises(ValidationError):
            await broker.broadcast_terminal("searching")

    asyncio.run(exercise())


def test_run_completion_notifies_the_browser_broker(client: TestClient, workspace_id: str) -> None:
    states: list[str] = []
    client.app.state.browser_broker.notify_terminal = states.append

    response = client.post(
        f"/v1/workspaces/{workspace_id}/runs",
        json={
            "question": "如何形成有层次的剖面？",
            "goal": "precedent_research",
            "budget_mode": "balanced",
        },
    )

    assert response.status_code == 201
    assert states == ["completed"]


def test_run_cancellation_notifies_the_browser_broker(
    client: TestClient, workspace_id: str
) -> None:
    states: list[str] = []
    client.app.state.browser_broker.notify_terminal = states.append
    database = client.app.state.database
    with database.session_factory() as session:
        run = ResearchRun(
            workspace_id=workspace_id,
            question="测试取消",
            goal=ResearchGoal.precedent_research.value,
            budget_mode=BudgetMode.quick.value,
            budget=BUDGETS[BudgetMode.quick].model_dump(),
            allowed_domains=[],
            status=RunStatus.searching.value,
            coverage_report={},
        )
        session.add(run)
        session.commit()
        run_id = run.id

    response = client.post(f"/v1/runs/{run_id}/cancel")

    assert response.status_code == 200
    assert states == ["cancelled"]
