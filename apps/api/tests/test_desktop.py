import socket
import sys
from pathlib import Path
from types import SimpleNamespace

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


def test_windowed_desktop_server_does_not_load_console_logging(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    board_dir = tmp_path / "board"
    board_dir.mkdir()
    (board_dir / "index.html").write_text("<!doctype html>", encoding="utf-8")
    data_dir = tmp_path / "data"
    captured: dict[str, object] = {}

    class DormantThread:
        def __init__(self, **_: object) -> None:
            pass

        def start(self) -> None:
            pass

    monkeypatch.setattr(desktop_module, "bundled_resource_root", lambda: tmp_path)
    monkeypatch.setattr(desktop_module, "installed_data_dir", lambda: data_dir)
    monkeypatch.setattr(desktop_module, "get_windows_keyring", object)
    monkeypatch.setattr(desktop_module, "find_running_desktop_port", lambda _path: None)
    monkeypatch.setattr(
        desktop_module,
        "load_provider_runtime",
        lambda *_args: SimpleNamespace(),
    )
    monkeypatch.setattr(desktop_module, "select_desktop_port", lambda: 49152)
    monkeypatch.setattr(desktop_module, "create_desktop_app", lambda **_kwargs: object())
    monkeypatch.setattr(desktop_module, "record_desktop_port", lambda *_args: None)
    monkeypatch.setattr(desktop_module, "clear_recorded_desktop_port", lambda *_args: None)
    monkeypatch.setattr(desktop_module.threading, "Thread", DormantThread)
    monkeypatch.setattr(
        desktop_module.uvicorn,
        "run",
        lambda _app, **kwargs: captured.update(kwargs),
    )
    monkeypatch.setattr(sys, "stdout", None)
    monkeypatch.setattr(sys, "stderr", None)

    assert desktop_module.main([]) == 0
    assert captured["host"] == "127.0.0.1"
    assert captured["port"] == 49152
    assert captured["log_config"] is None


def test_provider_setup_keeps_model_fetch_action_visible(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    import tkinter as tk

    try:
        probe_root = tk.Tk()
    except tk.TclError:
        pytest.skip("Tk is unavailable in this test environment")
    probe_root.destroy()

    real_tk = tk.Tk
    captured: dict[str, bool] = {}

    class InspectRoot(real_tk):
        def mainloop(self, *args: object, **kwargs: object) -> None:
            self.update()
            surface = self.winfo_children()[0]
            actions = next(
                child for child in surface.winfo_children() if child.winfo_class() == "TFrame"
            )
            fetch_button = next(
                child
                for child in actions.winfo_children()
                if child.winfo_class() == "Button" and child.cget("text") == "获取模型列表"
            )
            captured["fetch_is_mapped"] = bool(fetch_button.winfo_ismapped())
            captured["fetch_is_in_action_row"] = fetch_button.winfo_parent() == str(actions)
            self.destroy()

    monkeypatch.setattr(tk, "Tk", InspectRoot)

    assert desktop_module.prompt_for_provider_config(tmp_path, object()) is False
    assert captured == {
        "fetch_is_mapped": True,
        "fetch_is_in_action_row": True,
    }
