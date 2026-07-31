from __future__ import annotations

import io
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from archresearch_api.provider_credentials import (
    ACCOUNT,
    SERVICE,
    ProviderConfig,
    ProviderConfigurationError,
)
from archresearch_api.provider_setup import (
    ProviderCapabilityError,
    ProviderProbePayload,
    configure_provider,
    list_provider_models,
    main,
    probe_provider,
    provider_base_url_candidates,
    provider_model_ids,
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
    def __init__(
        self,
        output: list[Any],
        model_ids: list[str] | None = None,
    ) -> None:
        self.responses = FakeResponses(output)
        self.models = SimpleNamespace(
            list=lambda: SimpleNamespace(
                data=[SimpleNamespace(id=model_id) for model_id in (model_ids or ["gpt-5.6-sol"])]
            )
        )


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
        "gpt-5.6-sol",
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
    assert "gpt-5.6-sol" in stored


def test_setup_validates_the_explicit_model_name_against_the_upstream_model_list(
    tmp_path: Path,
) -> None:
    keyring = FakeKeyring()
    client = FakeClient(
        [SimpleNamespace(type="message")],
        model_ids=["text-embedding-3-large", "deepseek-chat"],
    )

    result = configure_provider(
        "https://api.deepseek.com/v1",
        "deepseek-chat",
        "sk-private-value",
        data_dir=tmp_path,
        keyring_backend=keyring,
        client_factory=lambda **_: client,
    )

    assert result.model == "deepseek-chat"
    stored = (tmp_path / "provider.json").read_text(encoding="utf-8")
    assert "deepseek-chat" in stored
    assert "text-embedding-3-large" not in stored


def test_setup_probes_only_the_explicitly_selected_upstream_model(
    tmp_path: Path,
) -> None:
    response_models: list[str] = []

    class ModelResponses:
        def parse(self, **kwargs: Any) -> Any:
            response_models.append(kwargs["model"])
            if kwargs["model"] == "broken-model":
                raise RuntimeError("unsupported")
            return SimpleNamespace(output_parsed={"status": "ok"})

    class FailingChatCompletions:
        def parse(self, **_: Any) -> Any:
            raise RuntimeError("unsupported")

    client = SimpleNamespace(
        models=SimpleNamespace(
            list=lambda: SimpleNamespace(
                data=[
                    SimpleNamespace(id="broken-model"),
                    SimpleNamespace(id="deepseek-chat"),
                ]
            )
        ),
        responses=ModelResponses(),
        chat=SimpleNamespace(completions=FailingChatCompletions()),
    )

    result = configure_provider(
        "https://api.deepseek.com/v1",
        "deepseek-chat",
        "sk-private-value",
        data_dir=tmp_path,
        keyring_backend=FakeKeyring(),
        client_factory=lambda **_: client,
    )

    assert response_models == ["deepseek-chat"]
    assert result.model == "deepseek-chat"
    assert "deepseek-chat" in (tmp_path / "provider.json").read_text(encoding="utf-8")


def test_setup_rejects_a_model_that_is_not_listed_upstream(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    client = FakeClient(
        [SimpleNamespace(type="message")],
        model_ids=["deepseek-chat"],
    )

    with pytest.raises(ProviderCapabilityError, match="not listed"):
        configure_provider(
            "https://api.deepseek.com/v1",
            "gpt-5.6-sol",
            "sk-private-value",
            data_dir=tmp_path,
            keyring_backend=keyring,
            client_factory=lambda **_: client,
        )

    assert not (tmp_path / "provider.json").exists()
    assert keyring.get_password(SERVICE, ACCOUNT) is None


def test_setup_requires_a_model_name_without_using_the_legacy_default(
    tmp_path: Path,
) -> None:
    calls = 0

    def factory(**_: str) -> FakeClient:
        nonlocal calls
        calls += 1
        return FakeClient([])

    with pytest.raises(ProviderConfigurationError, match="Model name is required"):
        configure_provider(
            "https://api.deepseek.com/v1",
            "",
            "sk-private-value",
            data_dir=tmp_path,
            keyring_backend=FakeKeyring(),
            client_factory=factory,
        )

    assert calls == 0


def test_probe_falls_back_to_chat_completions_structured_output() -> None:
    responses_requests: list[dict[str, Any]] = []
    chat_requests: list[dict[str, Any]] = []

    class FailingResponses:
        def parse(self, **kwargs: Any) -> Any:
            responses_requests.append(kwargs)
            raise RuntimeError("responses endpoint is not supported")

    class ChatCompletions:
        def parse(self, **kwargs: Any) -> Any:
            chat_requests.append(kwargs)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            parsed=ProviderProbePayload(status="ok"),
                        )
                    )
                ]
            )

    client = SimpleNamespace(
        responses=FailingResponses(),
        chat=SimpleNamespace(completions=ChatCompletions()),
    )

    result = probe_provider(
        "sk-test",
        ProviderConfig(
            base_url="https://api.deepseek.com/v1",
            research_model="deepseek-chat",
            vision_model="deepseek-chat",
        ),
        lambda **_: client,
    )

    assert result.model == "deepseek-chat"
    assert result.api_protocol == "chat_completions"
    assert result.capability == "chat_completions.structured_output"
    assert len(responses_requests) == 1
    assert chat_requests[0]["model"] == "deepseek-chat"
    assert chat_requests[0]["response_format"] is ProviderProbePayload
    assert "reasoning_effort" not in chat_requests[0]


def test_cli_success_tests_before_storing_and_never_prints_the_key(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    client = FakeClient(
        [SimpleNamespace(type="message")],
        model_ids=["unsupported-model", "deepseek-chat"],
    )
    stdout = io.StringIO()
    stderr = io.StringIO()

    exit_code = main(
        [
            "--data-dir",
            str(tmp_path),
            "--base-url",
            "https://api.deepseek.com/v1",
            "--model-index",
            "1",
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
            "--model-index",
            "0",
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
            [
                "--data-dir",
                "{data_dir}",
                "--base-url",
                "https://relay.example/v1",
            ],
            "\n",
        ),
        (
            [
                "--data-dir",
                "{data_dir}",
                "--base-url",
                "https://relay.example/v1",
                "--model-index",
                "0",
            ],
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


def test_cli_lists_upstream_models_without_saving_configuration(tmp_path: Path) -> None:
    keyring = FakeKeyring()
    client = FakeClient(
        [],
        model_ids=["deepseek-chat", "qwen-plus"],
    )
    stdout = io.StringIO()
    stderr = io.StringIO()

    exit_code = main(
        [
            "--data-dir",
            str(tmp_path),
            "--base-url",
            "https://api.deepseek.com/v1",
            "--list-models",
        ],
        stdin=io.StringIO("sk-private-value\n"),
        stdout=stdout,
        stderr=stderr,
        keyring_backend=keyring,
        client_factory=lambda **_: client,
    )

    assert exit_code == 0
    assert stdout.getvalue().splitlines() == ["0\tdeepseek-chat", "1\tqwen-plus"]
    assert stderr.getvalue() == ""
    assert not (tmp_path / "provider.json").exists()
    assert keyring.get_password(SERVICE, ACCOUNT) is None


def test_cli_can_read_a_model_index_after_printing_the_upstream_list(
    tmp_path: Path,
) -> None:
    keyring = FakeKeyring()
    client = FakeClient(
        [SimpleNamespace(type="message")],
        model_ids=["unsupported-model", "deepseek-chat"],
    )
    stdout = io.StringIO()

    exit_code = main(
        [
            "--data-dir",
            str(tmp_path),
            "--base-url",
            "https://api.deepseek.com/v1",
        ],
        stdin=io.StringIO("sk-private-value\n1\n"),
        stdout=stdout,
        stderr=io.StringIO(),
        keyring_backend=keyring,
        client_factory=lambda **_: client,
    )

    assert exit_code == 0
    assert "0\tunsupported-model" in stdout.getvalue()
    assert "1\tdeepseek-chat" in stdout.getvalue()
    assert "配置成功" in stdout.getvalue()
    assert keyring.get_password(SERVICE, ACCOUNT) == "sk-private-value"


def test_provider_model_ids_do_not_reorder_the_upstream_list() -> None:
    client = FakeClient(
        [],
        model_ids=["qwen-plus", "gpt-5.6-sol", "deepseek-chat"],
    )

    assert provider_model_ids(client) == ["qwen-plus", "gpt-5.6-sol", "deepseek-chat"]


@pytest.mark.parametrize(
    ("base_url", "expected"),
    [
        (
            "https://relay.example",
            [
                "https://relay.example",
                "https://relay.example/v1",
                "https://relay.example/api/v1",
            ],
        ),
        ("https://relay.example/v1", ["https://relay.example/v1"]),
        (
            "https://relay.example/api",
            ["https://relay.example/api", "https://relay.example/api/v1"],
        ),
        ("https://relay.example/api/v1/", ["https://relay.example/api/v1"]),
    ],
)
def test_provider_base_url_candidates_cover_common_prefixes(
    base_url: str,
    expected: list[str],
) -> None:
    assert provider_base_url_candidates(base_url) == expected


def test_list_provider_models_merges_model_lists_across_same_host_candidates() -> None:
    clients = {
        "https://relay.example": FakeClient([], model_ids=["root-model", "shared-model"]),
        "https://relay.example/v1": FakeClient([], model_ids=["shared-model", "v1-model"]),
        "https://relay.example/api/v1": FakeClient([], model_ids=["api-model"]),
    }

    def factory(**kwargs: str) -> FakeClient:
        return clients[kwargs["base_url"]]

    assert list_provider_models(
        "https://relay.example",
        "sk-test",
        client_factory=factory,
    ) == ["root-model", "shared-model", "v1-model", "api-model"]


def test_configure_provider_saves_the_first_candidate_with_working_capability(
    tmp_path: Path,
) -> None:
    class FailingProtocol:
        def parse(self, **_: Any) -> Any:
            raise RuntimeError("protocol unavailable")

    class WorkingResponses:
        def parse(self, **_: Any) -> Any:
            return SimpleNamespace(output_parsed={"status": "ok"})

    broken = SimpleNamespace(
        models=SimpleNamespace(
            list=lambda: SimpleNamespace(data=[SimpleNamespace(id="deepseek-chat")])
        ),
        responses=FailingProtocol(),
        chat=SimpleNamespace(completions=FailingProtocol()),
    )
    working = SimpleNamespace(
        models=SimpleNamespace(
            list=lambda: SimpleNamespace(data=[SimpleNamespace(id="deepseek-chat")])
        ),
        responses=WorkingResponses(),
    )
    clients = {
        "https://relay.example": broken,
        "https://relay.example/v1": working,
    }
    factory_calls: list[dict[str, str]] = []

    def factory(**kwargs: str) -> Any:
        factory_calls.append(kwargs)
        return clients[kwargs["base_url"]]

    result = configure_provider(
        "https://relay.example",
        "deepseek-chat",
        "sk-private-value",
        data_dir=tmp_path,
        keyring_backend=FakeKeyring(),
        client_factory=factory,
    )

    assert result.capability == "responses.structured_output"
    assert any("https://relay.example/v1" in call.values() for call in factory_calls)
    assert '"base_url": "https://relay.example/v1"' in (tmp_path / "provider.json").read_text(
        encoding="utf-8"
    )
