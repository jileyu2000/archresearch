from __future__ import annotations

import argparse
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TextIO

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


def probe_provider(
    api_key: str,
    config: SuoxieProviderConfig,
    client_factory: ClientFactory | None = None,
) -> ProbeResult:
    factory = client_factory or _create_openai_client
    client = factory(api_key=api_key, base_url=str(config.base_url))
    response = client.responses.create(
        model=config.research_model,
        tools=[{"type": "web_search", "search_context_size": "low"}],
        include=["web_search_call.results"],
        input="Find the official OpenAI API documentation homepage and cite it.",
        max_output_tokens=96,
    )
    if not any(_output_type(item) == "web_search_call" for item in response.output):
        raise ProviderCapabilityError("Responses web search was not executed")
    return ProbeResult(
        provider=config.name,
        model=config.research_model,
        capability="responses.web_search",
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
            "连接测试失败：请检查 Key，以及中转站对 Responses API 和 web_search 的支持。",
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


def _output_type(item: Any) -> str | None:
    if isinstance(item, dict):
        value = item.get("type")
    else:
        value = getattr(item, "type", None)
    return value if isinstance(value, str) else None


if __name__ == "__main__":
    raise SystemExit(main())
