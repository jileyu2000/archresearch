from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import AnyHttpUrl, ValidationError

from archresearch_api.provider_credentials import (
    ACCOUNT,
    SERVICE,
    ProviderConfigurationError,
    SuoxieProviderConfig,
    commit_provider_config,
    load_provider_config,
    load_provider_runtime,
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


def test_suoxie_defaults_use_the_api_model_without_the_opencode_prefix() -> None:
    config = SuoxieProviderConfig()

    assert isinstance(config.base_url, AnyHttpUrl)
    assert str(config.base_url) == "https://suoxie.codes/v1"
    assert config.research_model == "gpt-5.6-sol"
    assert config.vision_model == "gpt-5.6-sol"
    assert "suoxie/" not in config.research_model


@pytest.mark.parametrize(
    "base_url",
    [
        "http://suoxie.codes/v1",
        "https://user:secret@suoxie.codes/v1",
        "https://127.0.0.1/v1",
        "https://192.168.1.10/v1",
    ],
)
def test_provider_config_rejects_non_public_https_urls(base_url: str) -> None:
    with pytest.raises(ValidationError):
        SuoxieProviderConfig(base_url=base_url)


def test_successful_commit_stores_key_only_in_keyring(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    config = SuoxieProviderConfig()

    commit_provider_config(tmp_path, config, "sk-private-test", keyring)

    assert keyring.get_password(SERVICE, ACCOUNT) == "sk-private-test"
    raw = (tmp_path / "provider.json").read_text(encoding="utf-8")
    assert "sk-private-test" not in raw
    payload = json.loads(raw)
    assert payload == {
        "provider": "suoxie",
        "name": "梭子蟹 API",
        "base_url": "https://suoxie.codes/v1",
        "research_model": "gpt-5.6-sol",
        "vision_model": "gpt-5.6-sol",
    }


def test_failed_config_write_restores_previous_credential(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    keyring.set_password(SERVICE, ACCOUNT, "sk-old")

    def fail_write(_data_dir: Path, _config: SuoxieProviderConfig) -> None:
        raise OSError("disk full")

    with pytest.raises(ProviderConfigurationError, match="not saved"):
        commit_provider_config(
            tmp_path,
            SuoxieProviderConfig(),
            "sk-new",
            keyring,
            config_writer=fail_write,
        )

    assert keyring.get_password(SERVICE, ACCOUNT) == "sk-old"
    assert not (tmp_path / "provider.json").exists()


def test_runtime_load_requires_both_json_and_credential(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    commit_provider_config(tmp_path, SuoxieProviderConfig(), "sk-live", keyring)

    runtime = load_provider_runtime(tmp_path, keyring)

    assert runtime is not None
    assert runtime.config == load_provider_config(tmp_path)
    assert runtime.api_key == "sk-live"

    keyring.delete_password(SERVICE, ACCOUNT)
    assert load_provider_runtime(tmp_path, keyring) is None
