from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import AnyHttpUrl, ValidationError

from archresearch_api.provider_credentials import (
    ACCOUNT,
    SERVICE,
    ProviderConfig,
    ProviderConfigurationError,
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


def test_provider_config_requires_a_user_supplied_endpoint() -> None:
    with pytest.raises(ValidationError):
        ProviderConfig()


@pytest.mark.parametrize(
    "base_url",
    [
        "https://relay.example/v1",
        "https://api.deepseek.com/v1",
        "https://api.moonshot.cn/v1",
        "http://127.0.0.1:11434/v1",
    ],
)
def test_provider_config_accepts_any_http_compatible_endpoint(base_url: str) -> None:
    config = ProviderConfig(base_url=base_url)

    assert isinstance(config.base_url, AnyHttpUrl)
    assert str(config.base_url) == base_url
    assert config.research_model == "gpt-5.6-sol"
    assert config.vision_model == "gpt-5.6-sol"


@pytest.mark.parametrize(
    "base_url",
    [
        "api.deepseek.com/v1",
        "ftp://relay.example/v1",
        "https://user:secret@relay.example/v1",
    ],
)
def test_provider_config_rejects_malformed_or_credential_bearing_urls(
    base_url: str,
) -> None:
    with pytest.raises(ValidationError):
        ProviderConfig(base_url=base_url)


def test_successful_commit_stores_key_only_in_keyring(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    config = ProviderConfig(base_url="https://api.deepseek.com/v1")

    commit_provider_config(tmp_path, config, "sk-private-test", keyring)

    assert keyring.get_password(SERVICE, ACCOUNT) == "sk-private-test"
    raw = (tmp_path / "provider.json").read_text(encoding="utf-8")
    assert "sk-private-test" not in raw
    payload = json.loads(raw)
    assert payload == {
        "provider": "openai-compatible",
        "name": "OpenAI 兼容 API",
        "base_url": "https://api.deepseek.com/v1",
        "research_model": "gpt-5.6-sol",
        "vision_model": "gpt-5.6-sol",
    }


def test_failed_config_write_restores_previous_credential(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    keyring.set_password(SERVICE, ACCOUNT, "sk-old")

    def fail_write(_data_dir: Path, _config: ProviderConfig) -> None:
        raise OSError("disk full")

    with pytest.raises(ProviderConfigurationError, match="not saved"):
        commit_provider_config(
            tmp_path,
            ProviderConfig(base_url="https://api.moonshot.cn/v1"),
            "sk-new",
            keyring,
            config_writer=fail_write,
        )

    assert keyring.get_password(SERVICE, ACCOUNT) == "sk-old"
    assert not (tmp_path / "provider.json").exists()


def test_runtime_load_requires_both_json_and_credential(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    commit_provider_config(
        tmp_path,
        ProviderConfig(base_url="http://127.0.0.1:11434/v1"),
        "sk-live",
        keyring,
    )

    runtime = load_provider_runtime(tmp_path, keyring)

    assert runtime is not None
    assert runtime.config == load_provider_config(tmp_path)
    assert runtime.api_key == "sk-live"

    keyring.delete_password(SERVICE, ACCOUNT)
    assert load_provider_runtime(tmp_path, keyring) is None


def test_existing_provider_config_remains_loadable_after_endpoint_generalization(
    tmp_path: Path,
) -> None:
    (tmp_path / "provider.json").write_text(
        json.dumps(
            {
                "provider": "suoxie",
                "name": "梭子蟹 API",
                "base_url": "https://suoxie.codes/v1",
                "research_model": "gpt-5.6-sol",
                "vision_model": "gpt-5.6-sol",
            }
        ),
        encoding="utf-8",
    )

    config = load_provider_config(tmp_path)

    assert config is not None
    assert config.provider == "suoxie"
    assert str(config.base_url) == "https://suoxie.codes/v1"
