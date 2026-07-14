from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from archresearch_api.browser import BrowserBroker, BrowserNavigationError
from archresearch_api.config import Settings
from archresearch_api.main import create_app
from archresearch_api.models import ResearchRun
from archresearch_api.schemas import BUDGETS, BudgetMode, ResearchGoal, RunStatus


class RecordingSocket:
    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    async def send_json(self, message: dict[str, Any]) -> None:
        self.messages.append(message)


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
    assert client.get("/v1/browser/status").json() == {"connected": False}


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
        assert client.get("/v1/browser/status").json() == {"connected": True}
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
        assert client.get("/v1/browser/status").json() == {"connected": True}

    assert client.get("/v1/browser/status").json() == {"connected": False}


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
