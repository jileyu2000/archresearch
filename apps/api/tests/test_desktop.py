import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from archresearch_api.config import Settings
from archresearch_api.desktop import (
    DESKTOP_PORT,
    bundled_resource_root,
    create_desktop_app,
    installed_data_dir,
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

    app = create_desktop_app(
        settings=settings,
        board_dir=board_dir,
        version="9.8.7",
    )

    with TestClient(app) as client:
        assert client.get("/desktop-health").json() == {
            "app": "ArchResearch",
            "version": "9.8.7",
            "port": DESKTOP_PORT,
        }
        assert client.get("/health").json()["status"] == "ok"
        assert "ArchResearch installed board" in client.get("/").text
