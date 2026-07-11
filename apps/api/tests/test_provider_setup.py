from __future__ import annotations

import io
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from archresearch_api.provider_credentials import ACCOUNT, SERVICE, SuoxieProviderConfig
from archresearch_api.provider_setup import (
    ProviderCapabilityError,
    main,
    probe_provider,
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


class FakeResponses:
    def __init__(self, output: list[Any]) -> None:
        self.output = output
        self.requests: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> Any:
        self.requests.append(kwargs)
        return SimpleNamespace(output=self.output)


class FakeClient:
    def __init__(self, output: list[Any]) -> None:
        self.responses = FakeResponses(output)


def test_probe_requires_a_responses_web_search_call() -> None:
    client = FakeClient([SimpleNamespace(type="web_search_call")])
    factory_calls: list[dict[str, str]] = []

    def factory(**kwargs: str) -> FakeClient:
        factory_calls.append(kwargs)
        return client

    result = probe_provider("sk-test", SuoxieProviderConfig(), factory)

    assert result.capability == "responses.web_search"
    assert result.model == "gpt-5.5"
    assert factory_calls == [{"api_key": "sk-test", "base_url": "https://suoxie.codes/v1"}]
    request = client.responses.requests[0]
    assert request["model"] == "gpt-5.5"
    assert request["tools"] == [{"type": "web_search", "search_context_size": "low"}]
    assert request["include"] == ["web_search_call.results"]


def test_probe_rejects_a_text_only_compatible_endpoint() -> None:
    client = FakeClient([SimpleNamespace(type="message")])

    with pytest.raises(ProviderCapabilityError, match="web search"):
        probe_provider("sk-test", SuoxieProviderConfig(), lambda **_: client)


def test_cli_success_tests_before_storing_and_never_prints_the_key(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    client = FakeClient([SimpleNamespace(type="web_search_call")])
    stdout = io.StringIO()
    stderr = io.StringIO()

    exit_code = main(
        ["--data-dir", str(tmp_path)],
        stdin=io.StringIO("sk-private-value\n"),
        stdout=stdout,
        stderr=stderr,
        keyring_backend=keyring,
        client_factory=lambda **_: client,
    )

    assert exit_code == 0
    assert keyring.get_password(SERVICE, ACCOUNT) == "sk-private-value"
    assert (tmp_path / "provider.json").exists()
    combined = stdout.getvalue() + stderr.getvalue()
    assert "sk-private-value" not in combined
    assert "responses.web_search" in stdout.getvalue()


def test_cli_probe_failure_preserves_existing_credential_and_config(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    keyring.set_password(SERVICE, ACCOUNT, "sk-old")
    original = '{"provider":"suoxie","name":"old"}'
    (tmp_path / "provider.json").write_text(original, encoding="utf-8")
    stdout = io.StringIO()
    stderr = io.StringIO()

    def failing_factory(**_: str) -> FakeClient:
        raise RuntimeError("Authorization failed for sk-private-value")

    exit_code = main(
        ["--data-dir", str(tmp_path)],
        stdin=io.StringIO("sk-private-value\n"),
        stdout=stdout,
        stderr=stderr,
        keyring_backend=keyring,
        client_factory=failing_factory,
    )

    assert exit_code == 1
    assert keyring.get_password(SERVICE, ACCOUNT) == "sk-old"
    assert (tmp_path / "provider.json").read_text(encoding="utf-8") == original
    combined = stdout.getvalue() + stderr.getvalue()
    assert "sk-private-value" not in combined
    assert "Authorization failed" not in combined
    assert "连接测试失败" in stderr.getvalue()


def test_cli_rejects_empty_stdin_before_creating_a_client(tmp_path: Path) -> None:
    calls = 0

    def factory(**_: str) -> FakeClient:
        nonlocal calls
        calls += 1
        return FakeClient([])

    exit_code = main(
        ["--data-dir", str(tmp_path)],
        stdin=io.StringIO("\n"),
        stdout=io.StringIO(),
        stderr=io.StringIO(),
        keyring_backend=FakeKeyring(),
        client_factory=factory,
    )

    assert exit_code == 2
    assert calls == 0
