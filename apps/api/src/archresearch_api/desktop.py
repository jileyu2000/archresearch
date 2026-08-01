from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import threading
import time
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any
from urllib.request import urlopen

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import __version__
from .browser import installed_chrome_board_url, open_board_in_chrome
from .config import Settings
from .main import create_app
from .provider_credentials import (
    KeyringBackend,
    ProviderConfigurationError,
    get_windows_keyring,
    load_provider_runtime,
)
from .provider_setup import configure_provider, list_provider_models

DESKTOP_PORT = 8000
DESKTOP_PORT_STATE_FILENAME = "desktop-port.json"
CREDENTIAL_DESTINATION = "Windows Credential Manager"

ChromeLauncher = Callable[[str], bool]


def desktop_board_url(port: int) -> str:
    return installed_chrome_board_url(port)


def installed_data_dir(environment: Mapping[str, str] | None = None) -> Path:
    values = environment if environment is not None else os.environ
    local_app_data = values.get("LOCALAPPDATA", "").strip()
    if not local_app_data:
        raise RuntimeError("LOCALAPPDATA is required for the installed ArchResearch edition")
    return Path(local_app_data) / "ArchResearch" / "data"


def bundled_resource_root() -> Path:
    frozen_root = getattr(sys, "_MEIPASS", None)
    if isinstance(frozen_root, str) and frozen_root:
        return Path(frozen_root)
    return Path(__file__).resolve().parents[2]


def create_desktop_app(
    *,
    settings: Settings,
    board_dir: Path,
    version: str = __version__,
    port: int = DESKTOP_PORT,
    chrome_launcher: ChromeLauncher | None = None,
) -> FastAPI:
    resolved_chrome_launcher = chrome_launcher or open_board_in_chrome
    board_url = desktop_board_url(port)
    app = create_app(
        settings,
        chrome_launcher=lambda _development_url: resolved_chrome_launcher(board_url),
    )

    @app.get("/desktop-health")
    def desktop_health() -> dict[str, str | int]:
        return {
            "app": "ArchResearch",
            "version": version,
            "port": port,
        }

    app.mount("/", StaticFiles(directory=board_dir, html=True), name="board")
    return app


def desktop_health_url(port: int) -> str:
    return f"http://127.0.0.1:{port}/desktop-health"


def desktop_instance_ready(port: int = DESKTOP_PORT, timeout_seconds: float = 0.5) -> bool:
    try:
        with urlopen(desktop_health_url(port), timeout=timeout_seconds) as response:
            if response.status != 200:
                return False
            payload: Any = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError):
        return False
    return (
        isinstance(payload, dict)
        and payload.get("app") == "ArchResearch"
        and payload.get("port") == port
    )


def desktop_port_available(port: int = DESKTOP_PORT) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
        try:
            candidate.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def select_desktop_port(preferred_port: int = DESKTOP_PORT) -> int:
    if desktop_port_available(preferred_port):
        return preferred_port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
        candidate.bind(("127.0.0.1", 0))
        return int(candidate.getsockname()[1])


def load_recorded_desktop_port(data_dir: Path) -> int | None:
    state_path = data_dir / DESKTOP_PORT_STATE_FILENAME
    try:
        payload: Any = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    port = payload.get("port") if isinstance(payload, dict) else None
    if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
        return None
    return port


def record_desktop_port(data_dir: Path, port: int) -> None:
    state_path = data_dir / DESKTOP_PORT_STATE_FILENAME
    temporary_path = state_path.with_suffix(".tmp")
    temporary_path.write_text(
        json.dumps({"port": port}, ensure_ascii=False),
        encoding="utf-8",
    )
    os.replace(temporary_path, state_path)


def clear_recorded_desktop_port(data_dir: Path, port: int) -> None:
    state_path = data_dir / DESKTOP_PORT_STATE_FILENAME
    if load_recorded_desktop_port(data_dir) == port:
        state_path.unlink(missing_ok=True)


def find_running_desktop_port(data_dir: Path) -> int | None:
    recorded_port = load_recorded_desktop_port(data_dir)
    candidates = dict.fromkeys(port for port in (recorded_port, DESKTOP_PORT) if port is not None)
    return next((port for port in candidates if desktop_instance_ready(port)), None)


def prompt_for_provider_config(
    data_dir: Path,
    keyring_backend: KeyringBackend,
    *,
    client_factory: Callable[..., Any] | None = None,
) -> bool:
    import tkinter as tk
    from tkinter import ttk

    configured = False
    root = tk.Tk()
    root.title("ArchResearch · 首次配置")
    root.geometry("520x640")
    root.minsize(520, 640)
    root.maxsize(520, 640)
    root.configure(background="#eef0ed")

    style = ttk.Style(root)
    style.theme_use("vista")
    style.configure("Surface.TFrame", background="#ffffff")
    style.configure(
        "Title.TLabel",
        background="#ffffff",
        foreground="#171a18",
        font=("Segoe UI", 20, "bold"),
    )
    style.configure(
        "Body.TLabel",
        background="#ffffff",
        foreground="#5e6661",
        font=("Microsoft YaHei UI", 10),
    )
    style.configure(
        "Status.TLabel",
        background="#ffffff",
        foreground="#5e6661",
        font=("Microsoft YaHei UI", 9),
    )
    surface = ttk.Frame(root, style="Surface.TFrame", padding=(34, 30))
    surface.pack(fill="both", expand=True, padx=24, pady=24)
    ttk.Label(surface, text="连接你的研究接口", style="Title.TLabel").pack(anchor="w")
    ttk.Label(
        surface,
        text=(
            "填写 OpenAI-compatible 接口地址（可填服务根地址或完整 API 路径）和 Key。程序会在"
            "同一服务地址上自动尝试常见路径，再从上游模型列表中选择模型。模型 ID 不可手输。"
        ),
        style="Body.TLabel",
        wraplength=430,
        justify="left",
    ).pack(anchor="w", fill="x", pady=(10, 18))

    ttk.Label(surface, text="API 接口地址", style="Body.TLabel").pack(anchor="w")
    endpoint_value = tk.StringVar()
    endpoint_entry = ttk.Entry(
        surface,
        textvariable=endpoint_value,
        font=("Segoe UI", 11),
    )
    endpoint_entry.pack(fill="x", pady=(7, 16), ipady=8)

    ttk.Label(surface, text="API Key", style="Body.TLabel").pack(anchor="w")
    key_value = tk.StringVar()
    key_entry = ttk.Entry(surface, textvariable=key_value, show="●", font=("Segoe UI", 11))
    key_entry.pack(fill="x", pady=(7, 8), ipady=8)

    reveal_value = tk.BooleanVar(value=False)

    def toggle_key_visibility() -> None:
        key_entry.configure(show="" if reveal_value.get() else "●")

    ttk.Checkbutton(
        surface,
        text="显示 Key",
        variable=reveal_value,
        command=toggle_key_visibility,
    ).pack(anchor="w")

    ttk.Label(surface, text="模型名称（从上游获取）", style="Body.TLabel").pack(
        anchor="w",
        pady=(18, 0),
    )
    model_value = tk.StringVar()
    model_entry = ttk.Combobox(
        surface,
        textvariable=model_value,
        state="disabled",
        font=("Segoe UI", 11),
    )
    model_entry.pack(fill="x", pady=(7, 4), ipady=6)

    status_value = tk.StringVar(
        value="模型列表读取成功后才能选择模型；Key 只存入 Windows 凭据管理器。"
    )
    status_label = ttk.Label(
        surface,
        textvariable=status_value,
        style="Status.TLabel",
        wraplength=430,
        justify="left",
    )
    status_label.pack(anchor="w", fill="x", pady=(18, 16))

    actions = ttk.Frame(surface, style="Surface.TFrame")
    actions.pack(fill="x", side="bottom")

    def fetch_models() -> None:
        base_url = endpoint_value.get().strip()
        api_key = key_value.get().strip()
        if not base_url:
            status_label.configure(foreground="#a63827")
            status_value.set("请输入 API 接口地址后再获取模型。")
            endpoint_entry.focus_set()
            return
        if not api_key:
            status_label.configure(foreground="#a63827")
            status_value.set("请输入 Key 后再获取模型。")
            key_entry.focus_set()
            return
        fetch_models_button.configure(state="disabled", background="#8b938e")
        submit_button.configure(state="disabled", background="#8b938e")
        endpoint_entry.state(["disabled"])
        key_entry.state(["disabled"])
        model_entry.configure(state="disabled")
        status_label.configure(foreground="#5e6661")
        status_value.set("正在从上游获取模型列表，请稍候…")
        root.update_idletasks()
        try:
            models = list_provider_models(
                base_url,
                api_key,
                client_factory=client_factory,
            )
        except Exception:
            status_label.configure(foreground="#a63827")
            status_value.set("获取模型失败。请确认地址、Key 和上游模型列表接口后重试。")
            endpoint_entry.state(["!disabled"])
            key_entry.state(["!disabled"])
            fetch_models_button.configure(state="normal", background="#ffffff")
            submit_button.configure(state="normal", background="#2f5bff")
            endpoint_entry.focus_set()
            return
        model_entry.configure(values=models, state="readonly")
        model_value.set("")
        status_label.configure(foreground="#1b7f5e")
        status_value.set(f"已获取 {len(models)} 个模型，请选择后验证并开始使用。")
        endpoint_entry.state(["!disabled"])
        key_entry.state(["!disabled"])
        fetch_models_button.configure(state="normal", background="#ffffff")
        submit_button.configure(state="normal", background="#2f5bff")
        model_entry.focus_set()

    def cancel() -> None:
        root.destroy()

    def submit() -> None:
        nonlocal configured
        base_url = endpoint_value.get().strip()
        model = model_value.get().strip()
        api_key = key_value.get().strip()
        if not base_url:
            status_label.configure(foreground="#a63827")
            status_value.set("请输入 API 接口地址后再继续。")
            endpoint_entry.focus_set()
            return
        if not api_key:
            status_label.configure(foreground="#a63827")
            status_value.set("请输入 Key 后再继续。")
            key_entry.focus_set()
            return
        if not model:
            status_label.configure(foreground="#a63827")
            status_value.set("请先获取模型列表并选择一个模型。")
            fetch_models_button.focus_set()
            return
        submit_button.configure(state="disabled", background="#8b938e")
        cancel_button.configure(state="disabled", background="#f6f7f5")
        fetch_models_button.configure(state="disabled", background="#8b938e")
        endpoint_entry.state(["disabled"])
        key_entry.state(["disabled"])
        model_entry.configure(state="disabled")
        status_label.configure(foreground="#5e6661")
        status_value.set("正在验证所选模型，请稍候…")
        root.update_idletasks()
        try:
            configure_provider(
                base_url,
                model,
                api_key,
                data_dir=data_dir,
                keyring_backend=keyring_backend,
                client_factory=client_factory,
            )
        except ProviderConfigurationError:
            status_label.configure(foreground="#a63827")
            status_value.set("安全保存失败。请确认 Windows 凭据管理器可用后重试。")
        except Exception:
            status_label.configure(foreground="#a63827")
            status_value.set("连接验证失败。请确认所选模型支持结构化输出后重试。")
        else:
            configured = True
            key_value.set("")
            status_label.configure(foreground="#1b7f5e")
            status_value.set("连接成功，正在打开 ArchResearch…")
            root.after(500, root.destroy)
            return
        submit_button.configure(state="normal", background="#2f5bff")
        cancel_button.configure(state="normal", background="#ffffff")
        fetch_models_button.configure(state="normal", background="#ffffff")
        endpoint_entry.state(["!disabled"])
        key_entry.state(["!disabled"])
        model_entry.configure(state="readonly")
        endpoint_entry.focus_set()

    fetch_models_button = tk.Button(
        actions,
        text="获取模型列表",
        command=fetch_models,
        font=("Microsoft YaHei UI", 10),
        foreground="#171a18",
        background="#ffffff",
        activeforeground="#171a18",
        activebackground="#f6f7f5",
        disabledforeground="#8b938e",
        relief="solid",
        borderwidth=1,
        padx=14,
        pady=6,
        cursor="hand2",
        takefocus=True,
    )
    fetch_models_button.pack(side="left")

    cancel_button = tk.Button(
        actions,
        text="取消",
        command=cancel,
        font=("Microsoft YaHei UI", 10),
        foreground="#171a18",
        background="#ffffff",
        activeforeground="#171a18",
        activebackground="#f6f7f5",
        disabledforeground="#8b938e",
        relief="solid",
        borderwidth=1,
        padx=18,
        pady=8,
        cursor="hand2",
        takefocus=True,
    )
    cancel_button.pack(side="right")
    submit_button = tk.Button(
        actions,
        text="验证所选模型并开始使用",
        command=submit,
        font=("Microsoft YaHei UI", 10, "bold"),
        foreground="#ffffff",
        background="#2f5bff",
        activeforeground="#ffffff",
        activebackground="#2449d8",
        disabledforeground="#f6f7f5",
        relief="flat",
        borderwidth=1,
        padx=18,
        pady=8,
        cursor="hand2",
        takefocus=True,
    )
    submit_button.pack(side="right", padx=(0, 10))

    root.bind("<Return>", lambda _event: submit())
    root.bind("<Escape>", lambda _event: cancel())
    root.protocol("WM_DELETE_WINDOW", cancel)
    root.after(100, endpoint_entry.focus_set)
    root.mainloop()
    return configured


def show_error(message: str) -> None:
    import tkinter as tk
    from tkinter import messagebox

    root = tk.Tk()
    root.withdraw()
    messagebox.showerror("ArchResearch", message, parent=root)
    root.destroy()


def _open_board_when_ready(chrome_launcher: ChromeLauncher, port: int) -> None:
    for _attempt in range(80):
        if desktop_instance_ready(port):
            chrome_launcher(desktop_board_url(port))
            return
        time.sleep(0.1)


def _self_test(resource_root: Path) -> int:
    required = (
        resource_root / "board" / "index.html",
        resource_root / "alembic.ini",
        resource_root / "alembic" / "versions",
    )
    return 0 if all(path.exists() for path in required) else 1


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Start the installed ArchResearch desktop service")
    parser.add_argument("--self-test", action="store_true", help=argparse.SUPPRESS)
    arguments = parser.parse_args(argv)
    resource_root = bundled_resource_root()

    if arguments.self_test:
        return _self_test(resource_root)

    try:
        data_dir = installed_data_dir()
        data_dir.mkdir(parents=True, exist_ok=True)
        keyring_backend = get_windows_keyring()
    except (OSError, RuntimeError, ProviderConfigurationError):
        show_error("无法初始化本地数据目录或 Windows 凭据管理器。")
        return 1

    running_port = find_running_desktop_port(data_dir)
    if running_port is not None:
        if not open_board_in_chrome(desktop_board_url(running_port)):
            show_error("未找到 Google Chrome。安装 Chrome 后再打开 ArchResearch。")
            return 1
        return 0

    if load_provider_runtime(data_dir, keyring_backend) is None:
        if not prompt_for_provider_config(data_dir, keyring_backend):
            return 0

    board_dir = resource_root / "board"
    if not (board_dir / "index.html").is_file():
        show_error("安装文件不完整。请重新运行 ArchResearch 安装程序。")
        return 1

    database_path = data_dir / "archresearch.db"
    settings = Settings(
        database_url=f"sqlite:///{database_path.as_posix()}",
        data_dir=data_dir,
        provider_mode="openai",
    )
    selected_port = select_desktop_port()
    app = create_desktop_app(
        settings=settings,
        board_dir=board_dir,
        port=selected_port,
    )
    try:
        record_desktop_port(data_dir, selected_port)
    except OSError:
        show_error("无法记录本地服务端口。请检查 ArchResearch 数据目录后重试。")
        return 1
    threading.Thread(
        target=_open_board_when_ready,
        args=(open_board_in_chrome, selected_port),
        daemon=True,
    ).start()
    try:
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=selected_port,
            log_level="warning",
            access_log=False,
            log_config=None,
        )
    finally:
        clear_recorded_desktop_port(data_dir, selected_port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
