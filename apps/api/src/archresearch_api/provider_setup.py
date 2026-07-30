from __future__ import annotations

import argparse
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, TextIO

from pydantic import BaseModel, ConfigDict

from .provider_credentials import (
    KeyringBackend,
    ProviderConfigurationError,
    SuoxieProviderConfig,
    commit_provider_config,
    get_windows_keyring,
)

ClientFactory = Callable[..., Any]


class ProviderCapabilityError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProbeResult:
    provider: str
    model: str
    capability: str


class ProviderProbePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"]


def probe_provider(
    api_key: str,
    config: SuoxieProviderConfig,
    client_factory: ClientFactory | None = None,
) -> ProbeResult:
    factory = client_factory or _create_openai_client
    client = factory(api_key=api_key, base_url=str(config.base_url))
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
    return ProbeResult(
        provider=config.name,
        model=config.research_model,
        capability="responses.structured_output",
    )


def configure_provider(
    api_key: str,
    *,
    data_dir: Path,
    keyring_backend: KeyringBackend,
    client_factory: ClientFactory | None = None,
) -> ProbeResult:
    normalized_key = api_key.strip()
    if not normalized_key:
        raise ProviderConfigurationError("API key is required")
    config = SuoxieProviderConfig()
    probe = probe_provider(normalized_key, config, client_factory)
    commit_provider_config(data_dir, config, normalized_key, keyring_backend)
    return probe


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
    arguments = parser.parse_args(argv)
    input_stream = stdin or sys.stdin
    output_stream = stdout or sys.stdout
    error_stream = stderr or sys.stderr

    api_key = input_stream.readline().strip()
    if not api_key:
        print("API Key 不能为空。", file=error_stream)
        return 2

    try:
        backend = keyring_backend or get_windows_keyring()
        probe = configure_provider(
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
            "连接测试失败：请检查 Key，以及中转站对 Responses 结构化输出的支持。",
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
