from __future__ import annotations

import io
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from archresearch_api.provider_credentials import ACCOUNT, SERVICE, ProviderConfig
from archresearch_api.provider_setup import (
    ProviderCapabilityError,
    configure_provider,
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

    def parse(self, **kwargs: Any) -> Any:
        self.requests.append(kwargs)
        parsed = {"status": "ok"} if any(item.type == "message" for item in self.output) else None
        return SimpleNamespace(output=self.output, output_parsed=parsed)


class FakeClient:
    def __init__(self, output: list[Any]) -> None:
        self.responses = FakeResponses(output)


def test_probe_requires_medium_structured_responses_without_web_search() -> None:
    client = FakeClient([SimpleNamespace(type="message")])
    factory_calls: list[dict[str, str]] = []

    def factory(**kwargs: str) -> FakeClient:
        factory_calls.append(kwargs)
        return client

    result = probe_provider(
        "sk-test",
        ProviderConfig(base_url="https://api.deepseek.com/v1"),
        factory,
    )

    assert result.capability == "responses.structured_output"
    assert result.model == "gpt-5.6-sol"
    assert factory_calls == [{"api_key": "sk-test", "base_url": "https://api.deepseek.com/v1"}]
    request = client.responses.requests[0]
    assert request["model"] == "gpt-5.6-sol"
    assert request["reasoning"] == {"effort": "medium"}
    assert "tools" not in request
    assert request["text_format"].__name__ == "ProviderProbePayload"


def test_probe_rejects_a_response_without_a_message() -> None:
    client = FakeClient([SimpleNamespace(type="reasoning")])

    with pytest.raises(ProviderCapabilityError, match="structured output"):
        probe_provider(
            "sk-test",
            ProviderConfig(base_url="https://api.moonshot.cn/v1"),
            lambda **_: client,
        )


def test_shared_provider_setup_validates_before_saving_for_the_desktop(
    tmp_path: Path,
) -> None:
    keyring = FakeKeyring()
    client = FakeClient([SimpleNamespace(type="message")])

    result = configure_provider(
        "https://relay.example/v1",
        "  sk-private-value  ",
        data_dir=tmp_path,
        keyring_backend=keyring,
        client_factory=lambda **_: client,
    )

    assert result.capability == "responses.structured_output"
    assert keyring.get_password(SERVICE, ACCOUNT) == "sk-private-value"
    stored = (tmp_path / "provider.json").read_text(encoding="utf-8")
    assert "sk-private-value" not in stored
    assert "https://relay.example/v1" in stored


def test_cli_success_tests_before_storing_and_never_prints_the_key(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    client = FakeClient([SimpleNamespace(type="message")])
    stdout = io.StringIO()
    stderr = io.StringIO()

    exit_code = main(
        [
            "--data-dir",
            str(tmp_path),
            "--base-url",
            "https://api.deepseek.com/v1",
        ],
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
    assert "responses.structured_output" in stdout.getvalue()
    assert "https://api.deepseek.com/v1" not in stdout.getvalue()


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
        [
            "--data-dir",
            str(tmp_path),
            "--base-url",
            "https://api.moonshot.cn/v1",
        ],
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


@pytest.mark.parametrize(
    ("argv", "stdin_value"),
    [
        (["--data-dir", "{data_dir}"], "sk-private-value\n"),
        (
            ["--data-dir", "{data_dir}", "--base-url", "https://relay.example/v1"],
            "\n",
        ),
    ],
)
def test_cli_requires_endpoint_and_key_before_creating_a_client(
    tmp_path: Path,
    argv: list[str],
    stdin_value: str,
) -> None:
    calls = 0

    def factory(**_: str) -> FakeClient:
        nonlocal calls
        calls += 1
        return FakeClient([])

    exit_code = main(
        [value.format(data_dir=tmp_path) for value in argv],
        stdin=io.StringIO(stdin_value),
        stdout=io.StringIO(),
        stderr=io.StringIO(),
        keyring_backend=FakeKeyring(),
        client_factory=factory,
    )

    assert exit_code == 2
    assert calls == 0
