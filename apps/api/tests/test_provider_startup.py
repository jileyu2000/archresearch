from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from archresearch_api.config import Settings
from archresearch_api.main import create_app
from archresearch_api.provider_credentials import (
    ACCOUNT,
    SERVICE,
    SuoxieProviderConfig,
    write_provider_config,
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


class FakeOpenAIClient:
    pass


def test_startup_uses_stored_suoxie_config_for_both_model_clients(tmp_path: Path) -> None:
    write_provider_config(tmp_path, SuoxieProviderConfig())
    keyring = FakeKeyring()
    keyring.set_password(SERVICE, ACCOUNT, "sk-stored")
    factory_calls: list[dict[str, object]] = []
    client = FakeOpenAIClient()

    def factory(**kwargs: object) -> Any:
        factory_calls.append(kwargs)
        return client

    app = create_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
            data_dir=tmp_path,
            provider_mode="mock",
        ),
        keyring_backend=keyring,
        openai_client_factory=factory,
    )

    assert app.state.research_provider.name == "openai"
    assert app.state.research_provider.model == "gpt-5.5"
    assert app.state.visual_classifier.name == "openai-vision"
    assert app.state.visual_classifier.model == "gpt-5.5"
    assert factory_calls == [
        {
            "api_key": "sk-stored",
            "base_url": "https://suoxie.codes/v1",
            "timeout": 60.0,
            "max_retries": 1,
        }
    ]
    with TestClient(app) as test_client:
        health = test_client.get("/health").json()
    assert health == {
        "status": "ok",
        "provider_mode": "openai",
        "provider": "梭子蟹 API",
        "model": "gpt-5.5",
    }
    assert "sk-stored" not in str(health)


def test_missing_stored_credential_keeps_deterministic_mock_mode(tmp_path: Path) -> None:
    write_provider_config(tmp_path, SuoxieProviderConfig())
    calls = 0

    def factory(**_: str) -> Any:
        nonlocal calls
        calls += 1
        return FakeOpenAIClient()

    app = create_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite:///{(tmp_path / 'mock.db').as_posix()}",
            data_dir=tmp_path,
            provider_mode="mock",
        ),
        keyring_backend=FakeKeyring(),
        openai_client_factory=factory,
    )

    assert app.state.research_provider.name == "mock"
    assert app.state.visual_classifier.name == "mock-vision"
    assert calls == 0
