from __future__ import annotations

import argparse
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, TextIO

from pydantic import BaseModel, ConfigDict

from .provider_credentials import (
    DEFAULT_PROVIDER_MODEL,
    KeyringBackend,
    ProviderConfig,
    ProviderConfigurationError,
    commit_provider_config,
    get_windows_keyring,
)

ClientFactory = Callable[..., Any]
MAX_PROVIDER_MODEL_PROBES = 6
NON_CHAT_MODEL_MARKERS = (
    "embedding",
    "rerank",
    "moderation",
    "whisper",
    "dall-e",
    "image-1",
    "tts",
    "speech",
    "transcription",
)


class ProviderCapabilityError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProbeResult:
    provider: str
    model: str
    capability: str
    api_protocol: Literal["responses", "chat_completions"]


class ProviderProbePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"]


def probe_provider(
    api_key: str,
    config: ProviderConfig,
    client_factory: ClientFactory | None = None,
) -> ProbeResult:
    factory = client_factory or _create_openai_client
    client = factory(api_key=api_key, base_url=str(config.base_url))
    return _probe_provider_client(client, config)


def _probe_provider_client(client: Any, config: ProviderConfig) -> ProbeResult:
    try:
        response = client.responses.parse(
            model=config.research_model,
            reasoning={"effort": "medium"},
            input="Return status=ok in the required structured format.",
            text_format=ProviderProbePayload,
            max_output_tokens=64,
        )
        if response.output_parsed is None:
            raise ProviderCapabilityError("Responses structured output was not returned")
        ProviderProbePayload.model_validate(response.output_parsed)
    except Exception:
        try:
            completion = client.chat.completions.parse(
                model=config.research_model,
                messages=[
                    {
                        "role": "user",
                        "content": "Return status=ok in the required structured format.",
                    }
                ],
                response_format=ProviderProbePayload,
                max_tokens=64,
            )
            choices = getattr(completion, "choices", [])
            parsed = choices[0].message.parsed if choices else None
            if parsed is None:
                raise ProviderCapabilityError("Chat Completions structured output was not returned")
            ProviderProbePayload.model_validate(parsed)
        except Exception as chat_error:
            raise ProviderCapabilityError(
                "No supported structured output protocol was found"
            ) from chat_error
        return ProbeResult(
            provider=config.name,
            model=config.research_model,
            capability="chat_completions.structured_output",
            api_protocol="chat_completions",
        )
    return ProbeResult(
        provider=config.name,
        model=config.research_model,
        capability="responses.structured_output",
        api_protocol="responses",
    )


def provider_model_ids(client: Any) -> list[str]:
    response = client.models.list()
    data = getattr(response, "data", [])
    model_ids: list[str] = []
    for item in data:
        model_id = getattr(item, "id", None)
        if (
            isinstance(model_id, str)
            and model_id.strip()
            and len(model_id.strip()) <= 100
            and not any(marker in model_id.casefold() for marker in NON_CHAT_MODEL_MARKERS)
            and model_id.strip() not in model_ids
        ):
            model_ids.append(model_id.strip())
    if DEFAULT_PROVIDER_MODEL in model_ids:
        model_ids.remove(DEFAULT_PROVIDER_MODEL)
        model_ids.insert(0, DEFAULT_PROVIDER_MODEL)
    if not model_ids:
        raise ProviderCapabilityError("The upstream API did not list a usable text model")
    return model_ids


def configure_provider(
    base_url: str,
    api_key: str,
    *,
    data_dir: Path,
    keyring_backend: KeyringBackend,
    client_factory: ClientFactory | None = None,
) -> ProbeResult:
    normalized_key = api_key.strip()
    if not normalized_key:
        raise ProviderConfigurationError("API key is required")
    validated_url = ProviderConfig.model_validate({"base_url": base_url.strip()}).base_url
    factory = client_factory or _create_openai_client
    client = factory(api_key=normalized_key, base_url=str(validated_url))
    for model_id in provider_model_ids(client)[:MAX_PROVIDER_MODEL_PROBES]:
        config = ProviderConfig(
            base_url=validated_url,
            research_model=model_id,
            vision_model=model_id,
        )
        try:
            probe = _probe_provider_client(client, config)
        except ProviderCapabilityError:
            continue
        negotiated_config = config.model_copy(update={"api_protocol": probe.api_protocol})
        commit_provider_config(
            data_dir,
            negotiated_config,
            normalized_key,
            keyring_backend,
        )
        return probe
    raise ProviderCapabilityError("No listed model passed the structured output probe")


def main(
    argv: Sequence[str] | None = None,
    *,
    stdin: TextIO | None = None,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
    keyring_backend: KeyringBackend | None = None,
    client_factory: ClientFactory | None = None,
) -> int:
    parser = argparse.ArgumentParser(description="Configure the ArchResearch relay provider")
    parser.add_argument("--data-dir", type=Path, default=Path(".archresearch"))
    parser.add_argument("--base-url", default="")
    arguments = parser.parse_args(argv)
    input_stream = stdin or sys.stdin
    output_stream = stdout or sys.stdout
    error_stream = stderr or sys.stderr

    base_url = arguments.base_url.strip()
    if not base_url:
        print("API 接口地址不能为空。", file=error_stream)
        return 2

    api_key = input_stream.readline().strip()
    if not api_key:
        print("API Key 不能为空。", file=error_stream)
        return 2

    try:
        backend = keyring_backend or get_windows_keyring()
        probe = configure_provider(
            base_url,
            api_key,
            data_dir=arguments.data_dir,
            keyring_backend=backend,
            client_factory=client_factory,
        )
    except ProviderConfigurationError:
        print("安全保存失败：Windows 凭据管理器或本地配置不可用。", file=error_stream)
        return 1
    except Exception:
        print(
            "连接测试失败：无法从上游模型列表找到支持 Responses 或 Chat Completions "
            "结构化输出的模型。",
            file=error_stream,
        )
        return 1

    print(
        f"配置成功：{probe.provider} / {probe.model} / {probe.capability}",
        file=output_stream,
    )
    return 0


def _create_openai_client(**kwargs: str) -> Any:
    from openai import OpenAI

    return OpenAI(api_key=kwargs["api_key"], base_url=kwargs["base_url"])


if __name__ == "__main__":
    raise SystemExit(main())
