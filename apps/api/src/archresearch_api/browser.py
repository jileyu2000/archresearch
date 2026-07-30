from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import os
import secrets
import socket
import subprocess
import time
from collections.abc import Callable, Iterable, Mapping
from pathlib import Path
from typing import Any, Literal, Protocol, cast
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError, model_validator

PROTOCOL_VERSION: Literal[1] = 1
PAIRING_CODE_TTL_SECONDS = 300
CHROME_BOARD_URL = "http://127.0.0.1:5173/?connect=chrome"
INSTALLED_CHROME_BOARD_URL = "http://127.0.0.1:8000/?connect=chrome"

BrowserAction = Literal[
    "open_url",
    "wait",
    "page_metadata",
    "page_snapshot",
    "enumerate_media",
    "scroll",
    "safe_click",
    "capture_region",
    "type_search_query",
    "close_tab",
]
TerminalState = Literal["completed", "partial", "blocked", "cancelled", "failed"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PairingCodeRead(StrictModel):
    code: str
    expires_in_seconds: int = PAIRING_CODE_TTL_SECONDS


class BrowserStatusRead(StrictModel):
    connected: bool
    xiaohongshu_search_available: bool


class ChromeLaunchRead(StrictModel):
    opened: bool


class BrowserAuthenticate(StrictModel):
    type: Literal["browser.authenticate"]
    protocol_version: Literal[1]
    token: str = Field(min_length=1, max_length=512)


class OpenUrlPayload(StrictModel):
    url: str = Field(min_length=1, max_length=4_000)

    @model_validator(mode="after")
    def require_public_http_url(self) -> OpenUrlPayload:
        parsed = urlparse(self.url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
        ):
            raise ValueError("Navigation requires a safe public HTTP URL")
        hostname = parsed.hostname.rstrip(".").lower()
        if (
            hostname == "localhost"
            or hostname.endswith(".localhost")
            or hostname.endswith(".local")
        ):
            raise ValueError("Navigation requires a safe public HTTP URL")
        try:
            address = ipaddress.ip_address(hostname)
        except ValueError:
            return self
        if not address.is_global:
            raise ValueError("Navigation requires a safe public HTTP URL")
        return self


class WaitPayload(StrictModel):
    milliseconds: int = Field(ge=0, le=10_000)


class TabPayload(StrictModel):
    tab_id: int = Field(ge=1)


class ScrollPayload(TabPayload):
    direction: Literal["up", "down"]
    distance: int = Field(ge=1, le=2_000)


class SafeClickPayload(TabPayload):
    target: Literal["expand", "next_media", "previous_media", "load_more"]


class CaptureRegion(StrictModel):
    x: float = Field(ge=0, le=100_000)
    y: float = Field(ge=0, le=100_000)
    width: float = Field(gt=0, le=8_192)
    height: float = Field(gt=0, le=8_192)

    @model_validator(mode="after")
    def limit_area(self) -> CaptureRegion:
        if self.width * self.height > 16_777_216:
            raise ValueError("Capture region is outside allowed bounds")
        return self


class CaptureRegionPayload(TabPayload):
    region: CaptureRegion


class TypeSearchQueryPayload(TabPayload):
    query: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def reject_control_characters(self) -> TypeSearchQueryPayload:
        if any(ord(character) < 32 and character not in "\t\n\r" for character in self.query):
            raise ValueError("Search query contains control characters")
        return self


PAYLOAD_ADAPTERS: Mapping[BrowserAction, TypeAdapter[Any]] = {
    "open_url": TypeAdapter(OpenUrlPayload),
    "wait": TypeAdapter(WaitPayload),
    "page_metadata": TypeAdapter(TabPayload),
    "page_snapshot": TypeAdapter(TabPayload),
    "enumerate_media": TypeAdapter(TabPayload),
    "scroll": TypeAdapter(ScrollPayload),
    "safe_click": TypeAdapter(SafeClickPayload),
    "capture_region": TypeAdapter(CaptureRegionPayload),
    "type_search_query": TypeAdapter(TypeSearchQueryPayload),
    "close_tab": TypeAdapter(TabPayload),
}


class BrowserCommand(StrictModel):
    type: Literal["browser.command"] = "browser.command"
    protocol_version: Literal[1] = PROTOCOL_VERSION
    id: str = Field(default_factory=lambda: str(uuid4()), min_length=1, max_length=128)
    action: BrowserAction
    payload: dict[str, Any]

    @model_validator(mode="after")
    def validate_action_payload(self) -> BrowserCommand:
        validated = PAYLOAD_ADAPTERS[self.action].validate_python(self.payload)
        self.payload = cast(BaseModel, validated).model_dump(mode="json")
        return self


class BrowserResultError(StrictModel):
    code: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=1_000)


class BrowserResult(StrictModel):
    type: Literal["browser.result"]
    protocol_version: Literal[1]
    id: str = Field(min_length=1, max_length=128)
    ok: bool
    result: Any = None
    error: BrowserResultError | None = None

    @model_validator(mode="after")
    def require_matching_outcome(self) -> BrowserResult:
        has_result = "result" in self.model_fields_set
        has_error = "error" in self.model_fields_set
        if self.ok and (not has_result or has_error):
            raise ValueError("Successful browser results require only result")
        if not self.ok and (not has_error or has_result or self.error is None):
            raise ValueError("Failed browser results require only error")
        return self


class BrowserHeartbeat(StrictModel):
    type: Literal["browser.heartbeat"]
    protocol_version: Literal[1]


class ResearchSessionMessage(StrictModel):
    type: Literal["research.session"] = "research.session"
    protocol_version: Literal[1] = PROTOCOL_VERSION
    state: TerminalState


class BrowserSocket(Protocol):
    async def send_json(self, data: Any) -> None: ...


class BrowserUnavailableError(RuntimeError):
    pass


class BrowserCommandError(RuntimeError):
    pass


class BrowserNavigationError(RuntimeError):
    pass


HostnameResolver = Callable[[str], Iterable[str]]


def resolve_hostname(hostname: str) -> Iterable[str]:
    addresses: set[str] = set()
    for _, _, _, _, socket_address in socket.getaddrinfo(
        hostname,
        None,
        type=socket.SOCK_STREAM,
    ):
        resolved = socket_address[0]
        if isinstance(resolved, str):
            addresses.add(resolved)
    return addresses


class PairingAuthority:
    def __init__(self, data_dir: Path) -> None:
        self._token_path = data_dir / "browser-pairing-token"
        self._persistent_token_hash = self._load_token_hash()
        self._pairing_code: str | None = None
        self._pairing_code_expires_at = 0.0

    def issue_code(self) -> str:
        self._pairing_code = secrets.token_urlsafe(18)
        self._pairing_code_expires_at = time.monotonic() + PAIRING_CODE_TTL_SECONDS
        return self._pairing_code

    def authenticate(
        self, token: str
    ) -> tuple[Literal["paired", "authenticated"], str | None] | None:
        pairing_code = self._pairing_code
        if (
            pairing_code is not None
            and time.monotonic() <= self._pairing_code_expires_at
            and secrets.compare_digest(token, pairing_code)
        ):
            self._pairing_code = None
            self._pairing_code_expires_at = 0.0
            persistent_token = secrets.token_urlsafe(32)
            self._store_token(persistent_token)
            self._persistent_token_hash = hashlib.sha256(persistent_token.encode()).hexdigest()
            return "paired", persistent_token
        existing_hash = self._persistent_token_hash
        candidate_hash = hashlib.sha256(token.encode()).hexdigest()
        if existing_hash is not None and secrets.compare_digest(candidate_hash, existing_hash):
            return "authenticated", None
        return None

    def _load_token_hash(self) -> str | None:
        try:
            token_hash = self._token_path.read_text(encoding="utf-8").strip()
        except FileNotFoundError:
            return None
        if len(token_hash) != 64 or any(
            character not in "0123456789abcdef" for character in token_hash
        ):
            return None
        return token_hash

    def _store_token(self, token: str) -> None:
        self._token_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self._token_path.with_suffix(".tmp")
        temporary_path.write_text(hashlib.sha256(token.encode()).hexdigest(), encoding="utf-8")
        os.chmod(temporary_path, 0o600)
        temporary_path.replace(self._token_path)


class BrowserBroker:
    def __init__(self, hostname_resolver: HostnameResolver | None = None) -> None:
        self._socket: BrowserSocket | None = None
        self._pending: dict[str, asyncio.Future[Any]] = {}
        self._send_lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._hostname_resolver = hostname_resolver or resolve_hostname

    def bind_loop(self) -> None:
        self._loop = asyncio.get_running_loop()

    @property
    def connected(self) -> bool:
        return self._socket is not None

    async def attach(self, socket: BrowserSocket) -> None:
        if self._socket is not socket:
            self._fail_pending(BrowserUnavailableError("Browser connection was replaced"))
        self._socket = socket

    async def detach(self, socket: BrowserSocket) -> None:
        if self._socket is socket:
            self._socket = None
            self._fail_pending(BrowserUnavailableError("Browser connection closed"))

    async def send_command(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        command = BrowserCommand.model_validate({"action": action, "payload": payload})
        socket = self._socket
        if socket is None:
            raise BrowserUnavailableError("Browser extension is not connected")
        if command.action == "open_url":
            await asyncio.to_thread(self._require_public_resolution, command.payload["url"])
        future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        self._pending[command.id] = future
        try:
            async with self._send_lock:
                await socket.send_json(command.model_dump(mode="json"))
            return await asyncio.wait_for(future, timeout=timeout_seconds)
        finally:
            self._pending.pop(command.id, None)

    def send_command_sync(
        self,
        action: str,
        payload: dict[str, Any],
        *,
        timeout_seconds: float = 30,
    ) -> Any:
        loop = self._loop
        if loop is None or loop.is_closed():
            raise BrowserUnavailableError("Browser event loop is not available")
        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None
        if running_loop is loop:
            raise BrowserUnavailableError("Synchronous browser commands require a worker thread")
        future = asyncio.run_coroutine_threadsafe(
            self.send_command(action, payload, timeout_seconds=timeout_seconds),
            loop,
        )
        try:
            return future.result(timeout=timeout_seconds + 1)
        except TimeoutError:
            future.cancel()
            raise

    async def receive_result(self, message: BrowserResult | dict[str, Any]) -> None:
        result = (
            message if isinstance(message, BrowserResult) else BrowserResult.model_validate(message)
        )
        future = self._pending.get(result.id)
        if future is None or future.done():
            return
        if result.ok:
            future.set_result(result.result)
        else:
            assert result.error is not None
            future.set_exception(BrowserCommandError(result.error.message))

    async def broadcast_terminal(self, state: str) -> None:
        message = ResearchSessionMessage.model_validate({"state": state})
        socket = self._socket
        if socket is None:
            return
        async with self._send_lock:
            await socket.send_json(message.model_dump(mode="json"))

    def notify_terminal(self, state: str) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None
        if running_loop is loop:
            loop.create_task(self.broadcast_terminal(state))
        else:
            delivery = asyncio.run_coroutine_threadsafe(
                self.broadcast_terminal(state),
                loop,
            )
            try:
                delivery.result(timeout=5)
            except Exception:
                delivery.cancel()

    def _fail_pending(self, error: Exception) -> None:
        for future in self._pending.values():
            if not future.done():
                future.set_exception(error)
        self._pending.clear()

    def _require_public_resolution(self, url: str) -> None:
        hostname = urlparse(url).hostname
        if hostname is None:
            raise BrowserNavigationError("Navigation host could not be resolved")
        try:
            literal = ipaddress.ip_address(hostname)
        except ValueError:
            try:
                raw_addresses = tuple(self._hostname_resolver(hostname))
            except Exception as exc:
                raise BrowserNavigationError("Navigation host could not be resolved") from exc
        else:
            raw_addresses = (str(literal),)
        if not raw_addresses:
            raise BrowserNavigationError("Navigation host could not be resolved")
        for raw_address in raw_addresses:
            try:
                address = ipaddress.ip_address(raw_address.split("%", 1)[0])
            except ValueError as exc:
                raise BrowserNavigationError("Navigation host returned an invalid address") from exc
            mapped = getattr(address, "ipv4_mapped", None)
            effective_address = mapped or address
            if not effective_address.is_global:
                raise BrowserNavigationError(
                    "Navigation host must resolve only to a public address"
                )


def open_board_in_chrome(url: str) -> bool:
    if os.name != "nt" or url not in {CHROME_BOARD_URL, INSTALLED_CHROME_BOARD_URL}:
        return False
    local_app_data = os.environ.get("LOCALAPPDATA")
    candidates = [
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    ]
    if local_app_data:
        candidates.append(Path(local_app_data) / "Google/Chrome/Application/chrome.exe")
    chrome = next((candidate for candidate in candidates if candidate.is_file()), None)
    if chrome is None:
        return False
    launch_url = f"{url}&attempt={uuid4().hex}"
    subprocess.Popen([str(chrome), "--new-tab", launch_url], close_fds=True)
    return True


def create_browser_router(
    authority: PairingAuthority,
    broker: BrowserBroker,
    chrome_launcher: Callable[[str], bool] | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/v1")
    resolved_chrome_launcher = chrome_launcher or open_board_in_chrome

    @router.post(
        "/browser/pairing-code",
        response_model=PairingCodeRead,
        status_code=status.HTTP_201_CREATED,
    )
    def issue_pairing_code() -> PairingCodeRead:
        return PairingCodeRead(code=authority.issue_code())

    @router.get("/browser/status", response_model=BrowserStatusRead)
    def browser_status(request: Request) -> BrowserStatusRead:
        return BrowserStatusRead(
            connected=broker.connected,
            xiaohongshu_search_available=(
                getattr(request.app.state, "xiaohongshu_search", None) is not None
            ),
        )

    @router.post("/browser/open-chrome", response_model=ChromeLaunchRead)
    def open_chrome() -> ChromeLaunchRead:
        try:
            opened = resolved_chrome_launcher(CHROME_BOARD_URL)
        except OSError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google Chrome could not be opened",
            ) from exc
        if not opened:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google Chrome is not installed",
            )
        return ChromeLaunchRead(opened=True)

    @router.websocket("/browser")
    async def browser_socket(websocket: WebSocket) -> None:
        await websocket.accept()
        attached = False
        try:
            try:
                authentication = BrowserAuthenticate.model_validate(await websocket.receive_json())
            except (ValidationError, ValueError):
                await websocket.close(code=1008, reason="Authentication failed")
                return
            authenticated = authority.authenticate(authentication.token)
            if authenticated is None:
                await websocket.close(code=1008, reason="Authentication failed")
                return
            auth_type, rotated_token = authenticated
            if auth_type == "paired":
                await websocket.send_json(
                    {
                        "type": "browser.paired",
                        "protocol_version": PROTOCOL_VERSION,
                        "token": rotated_token,
                    }
                )
            else:
                await websocket.send_json(
                    {"type": "browser.authenticated", "protocol_version": PROTOCOL_VERSION}
                )
            await broker.attach(websocket)
            attached = True
            while True:
                try:
                    message = await websocket.receive_json()
                    if isinstance(message, dict) and message.get("type") == "browser.heartbeat":
                        BrowserHeartbeat.model_validate(message)
                        await websocket.send_json(
                            {
                                "type": "browser.heartbeat_ack",
                                "protocol_version": PROTOCOL_VERSION,
                            }
                        )
                        continue
                    result = BrowserResult.model_validate(message)
                except (ValidationError, ValueError):
                    await websocket.close(code=1003, reason="Invalid browser message")
                    return
                await broker.receive_result(result)
        except WebSocketDisconnect:
            pass
        finally:
            if attached:
                await broker.detach(websocket)

    return router
