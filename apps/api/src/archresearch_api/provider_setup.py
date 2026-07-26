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

    config = SuoxieProviderConfig()
    try:
        probe = probe_provider(api_key, config, client_factory)
    except Exception:
        print(
            "连接测试失败：请检查 Key，以及中转站对 Responses 结构化输出的支持。",
            file=error_stream,
        )
        return 1

    try:
        backend = keyring_backend or get_windows_keyring()
        commit_provider_config(arguments.data_dir, config, api_key, backend)
    except ProviderConfigurationError:
        print("安全保存失败：Windows 凭据管理器或本地配置不可用。", file=error_stream)
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
