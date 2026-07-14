from __future__ import annotations

import io
from pathlib import Path

import pytest

from archresearch_api.firecrawl_setup import main
from archresearch_api.provider_credentials import (
    FIRECRAWL_ACCOUNT,
    FIRECRAWL_SERVICE,
    FirecrawlProviderConfig,
    ProviderConfigurationError,
    commit_firecrawl_config,
    load_firecrawl_runtime,
)


class FakeKeyring:
    def __init__(self) -> None:
        self.values: dict[tuple[str, str], str] = {}

    def get_password(self, service: str, account: str) -> str | None:
        return self.values.get((service, account))

    def set_password(self, service: str, account: str, value: str) -> None:
        self.values[(service, account)] = value

    def delete_password(self, service: str, account: str) -> None:
        self.values.pop((service, account), None)


@pytest.mark.parametrize(
    "url",
    [
        "http://api.firecrawl.dev/v2",
        "https://user:secret@api.firecrawl.dev/v2",
        "https://127.0.0.1/v2",
        "https://192.168.1.10/v2",
    ],
)
def test_firecrawl_config_requires_public_https(url: str) -> None:
    with pytest.raises(ValueError):
        FirecrawlProviderConfig(base_url=url)


def test_firecrawl_config_round_trips_through_credential_manager_contract(
    tmp_path: Path,
) -> None:
    keyring = FakeKeyring()
    config = FirecrawlProviderConfig()

    commit_firecrawl_config(tmp_path, config, "fc-private", keyring)
    runtime = load_firecrawl_runtime(tmp_path, keyring)

    assert runtime is not None
    assert runtime.config == config
    assert runtime.api_key == "fc-private"
    assert "fc-private" not in (tmp_path / "firecrawl.json").read_text(encoding="utf-8")


def test_firecrawl_config_rolls_back_the_secret_when_file_write_fails(
    tmp_path: Path,
) -> None:
    keyring = FakeKeyring()
    keyring.set_password(FIRECRAWL_SERVICE, FIRECRAWL_ACCOUNT, "fc-old")

    with pytest.raises(ProviderConfigurationError, match="not saved"):
        commit_firecrawl_config(
            tmp_path,
            FirecrawlProviderConfig(),
            "fc-new",
            keyring,
            config_writer=lambda *_: (_ for _ in ()).throw(OSError("disk full")),
        )

    assert keyring.get_password(FIRECRAWL_SERVICE, FIRECRAWL_ACCOUNT) == "fc-old"


def test_firecrawl_setup_cli_stores_stdin_secret_without_echoing_it(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    stdout = io.StringIO()
    stderr = io.StringIO()

    exit_code = main(
        ["--data-dir", str(tmp_path)],
        stdin=io.StringIO("fc-private\n"),
        stdout=stdout,
        stderr=stderr,
        keyring_backend=keyring,
    )

    assert exit_code == 0
    assert keyring.get_password(FIRECRAWL_SERVICE, FIRECRAWL_ACCOUNT) == "fc-private"
    assert (tmp_path / "firecrawl.json").exists()
    assert "fc-private" not in stdout.getvalue() + stderr.getvalue()
    assert "Windows 凭据管理器" in stdout.getvalue()


def test_firecrawl_setup_cli_rejects_empty_stdin(tmp_path: Path) -> None:
    exit_code = main(
        ["--data-dir", str(tmp_path)],
        stdin=io.StringIO("\n"),
        stdout=io.StringIO(),
        stderr=io.StringIO(),
        keyring_backend=FakeKeyring(),
    )

    assert exit_code == 2
