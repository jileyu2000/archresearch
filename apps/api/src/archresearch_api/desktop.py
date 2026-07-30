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
from .browser import INSTALLED_CHROME_BOARD_URL, open_board_in_chrome
from .config import Settings
from .main import create_app
from .provider_credentials import (
    KeyringBackend,
    ProviderConfigurationError,
    get_windows_keyring,
    load_provider_runtime,
)
from .provider_setup import configure_provider

DESKTOP_PORT = 8000
DESKTOP_HEALTH_URL = f"http://127.0.0.1:{DESKTOP_PORT}/desktop-health"
CREDENTIAL_DESTINATION = "Windows Credential Manager"

ChromeLauncher = Callable[[str], bool]


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
    chrome_launcher: ChromeLauncher | None = None,
) -> FastAPI:
    resolved_chrome_launcher = chrome_launcher or open_board_in_chrome
    app = create_app(
        settings,
        chrome_launcher=lambda _development_url: resolved_chrome_launcher(
            INSTALLED_CHROME_BOARD_URL
        ),
    )

    @app.get("/desktop-health")
    def desktop_health() -> dict[str, str | int]:
        return {
            "app": "ArchResearch",
            "version": version,
            "port": DESKTOP_PORT,
        }

    app.mount("/", StaticFiles(directory=board_dir, html=True), name="board")
    return app


def desktop_instance_ready(timeout_seconds: float = 0.5) -> bool:
    try:
        with urlopen(DESKTOP_HEALTH_URL, timeout=timeout_seconds) as response:
            if response.status != 200:
                return False
            payload: Any = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError):
        return False
    return (
        isinstance(payload, dict)
        and payload.get("app") == "ArchResearch"
        and payload.get("port") == DESKTOP_PORT
    )


def desktop_port_available() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
        try:
            candidate.bind(("127.0.0.1", DESKTOP_PORT))
        except OSError:
            return False
    return True


def prompt_for_provider_key(
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
    root.geometry("520x390")
    root.minsize(520, 390)
    root.maxsize(520, 390)
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
    style.configure(
        "Primary.TButton",
        font=("Microsoft YaHei UI", 10, "bold"),
        padding=(18, 10),
    )
    style.configure("Secondary.TButton", padding=(14, 10))

    surface = ttk.Frame(root, style="Surface.TFrame", padding=(34, 30))
    surface.pack(fill="both", expand=True, padx=24, pady=24)
    ttk.Label(surface, text="配置你的研究 Key", style="Title.TLabel").pack(anchor="w")
    ttk.Label(
        surface,
        text="首次只需填写这一项。验证成功后会自动打开 ArchResearch。",
        style="Body.TLabel",
        wraplength=430,
        justify="left",
    ).pack(anchor="w", fill="x", pady=(10, 22))

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

    status_value = tk.StringVar(
        value="Key 会安全保存到 Windows 凭据管理器，不会写入日志或普通配置文件。"
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

    def cancel() -> None:
        root.destroy()

    def submit() -> None:
        nonlocal configured
        api_key = key_value.get().strip()
        if not api_key:
            status_label.configure(foreground="#a63827")
            status_value.set("请输入 Key 后再继续。")
            key_entry.focus_set()
            return
        submit_button.state(["disabled"])
        cancel_button.state(["disabled"])
        key_entry.state(["disabled"])
        status_label.configure(foreground="#5e6661")
        status_value.set("正在验证 Key，请稍候…")
        root.update_idletasks()
        try:
            configure_provider(
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
            status_value.set("连接验证失败。请检查 Key 和网络后重试。")
        else:
            configured = True
            key_value.set("")
            root.destroy()
            return
        submit_button.state(["!disabled"])
        cancel_button.state(["!disabled"])
        key_entry.state(["!disabled"])
        key_entry.focus_set()

    cancel_button = ttk.Button(
        actions,
        text="取消",
        command=cancel,
        style="Secondary.TButton",
    )
    cancel_button.pack(side="right")
    submit_button = ttk.Button(
        actions,
        text="验证并开始使用",
        command=submit,
        style="Primary.TButton",
    )
    submit_button.pack(side="right", padx=(0, 10))

    root.bind("<Return>", lambda _event: submit())
    root.bind("<Escape>", lambda _event: cancel())
    root.protocol("WM_DELETE_WINDOW", cancel)
    root.after(100, key_entry.focus_set)
    root.mainloop()
    return configured


def show_error(message: str) -> None:
    import tkinter as tk
    from tkinter import messagebox

    root = tk.Tk()
    root.withdraw()
    messagebox.showerror("ArchResearch", message, parent=root)
    root.destroy()


def _open_board_when_ready(chrome_launcher: ChromeLauncher) -> None:
    for _attempt in range(80):
        if desktop_instance_ready():
            chrome_launcher(INSTALLED_CHROME_BOARD_URL)
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

    if desktop_instance_ready():
        if not open_board_in_chrome(INSTALLED_CHROME_BOARD_URL):
            show_error("未找到 Google Chrome。安装 Chrome 后再打开 ArchResearch。")
            return 1
        return 0
    if not desktop_port_available():
        show_error("本机端口 8000 已被其他程序占用。关闭占用程序后再打开 ArchResearch。")
        return 1

    try:
        data_dir = installed_data_dir()
        data_dir.mkdir(parents=True, exist_ok=True)
        keyring_backend = get_windows_keyring()
    except (OSError, RuntimeError, ProviderConfigurationError):
        show_error("无法初始化本地数据目录或 Windows 凭据管理器。")
        return 1

    if load_provider_runtime(data_dir, keyring_backend) is None:
        if not prompt_for_provider_key(data_dir, keyring_backend):
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
    app = create_desktop_app(settings=settings, board_dir=board_dir)
    threading.Thread(
        target=_open_board_when_ready,
        args=(open_board_in_chrome,),
        daemon=True,
    ).start()
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=DESKTOP_PORT,
        log_level="warning",
        access_log=False,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
