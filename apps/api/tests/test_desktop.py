import socket
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import archresearch_api.desktop as desktop_module
from archresearch_api.config import Settings
from archresearch_api.desktop import (
    bundled_resource_root,
    clear_recorded_desktop_port,
    create_desktop_app,
    find_running_desktop_port,
    installed_data_dir,
    load_recorded_desktop_port,
    record_desktop_port,
    select_desktop_port,
)


def test_installed_data_dir_is_outside_the_program_directory() -> None:
    data_dir = installed_data_dir({"LOCALAPPDATA": r"C:\Users\student\AppData\Local"})

    assert data_dir == Path(r"C:\Users\student\AppData\Local\ArchResearch\data")


def test_installed_data_dir_requires_windows_local_app_data() -> None:
    with pytest.raises(RuntimeError, match="LOCALAPPDATA"):
        installed_data_dir({})


def test_bundled_resource_root_uses_the_pyinstaller_runtime_directory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    assert bundled_resource_root() == tmp_path


def test_desktop_app_serves_board_and_api_from_one_loopback_origin(
    tmp_path: Path,
) -> None:
    board_dir = tmp_path / "board"
    board_dir.mkdir()
    (board_dir / "index.html").write_text(
        "<!doctype html><title>ArchResearch installed board</title>",
        encoding="utf-8",
    )
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'data' / 'archresearch.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )

    opened_urls: list[str] = []
    selected_port = 49152
    app = create_desktop_app(
        settings=settings,
        board_dir=board_dir,
        version="9.8.7",
        port=selected_port,
        chrome_launcher=lambda url: opened_urls.append(url) or True,
    )

    with TestClient(app) as client:
        assert client.get("/desktop-health").json() == {
            "app": "ArchResearch",
            "version": "9.8.7",
            "port": selected_port,
        }
        assert client.get("/health").json()["status"] == "ok"
        assert "ArchResearch installed board" in client.get("/").text
        assert client.post("/v1/browser/open-chrome").json() == {"opened": True}
        assert opened_urls == [f"http://127.0.0.1:{selected_port}/?connect=chrome"]


def test_desktop_selects_a_free_loopback_port_when_the_default_is_occupied() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as occupied:
        occupied.bind(("127.0.0.1", 0))
        occupied.listen()
        occupied_port = int(occupied.getsockname()[1])

        selected_port = select_desktop_port(preferred_port=occupied_port)

    assert selected_port != occupied_port
    assert 1 <= selected_port <= 65535
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as verification:
        verification.bind(("127.0.0.1", selected_port))


def test_desktop_reuses_only_a_verified_recorded_port(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    record_desktop_port(tmp_path, 49152)
    checked_ports: list[int] = []

    def instance_ready(port: int, timeout_seconds: float = 0.5) -> bool:
        checked_ports.append(port)
        return port == 49152

    monkeypatch.setattr(desktop_module, "desktop_instance_ready", instance_ready)

    assert load_recorded_desktop_port(tmp_path) == 49152
    assert find_running_desktop_port(tmp_path) == 49152
    assert checked_ports == [49152]

    clear_recorded_desktop_port(tmp_path, 49152)
    assert load_recorded_desktop_port(tmp_path) is None


def test_desktop_ignores_a_stale_record_before_reusing_the_default_instance(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    record_desktop_port(tmp_path, 49152)
    monkeypatch.setattr(
        desktop_module,
        "desktop_instance_ready",
        lambda port, timeout_seconds=0.5: port == 8000,
    )

    assert find_running_desktop_port(tmp_path) == 8000
