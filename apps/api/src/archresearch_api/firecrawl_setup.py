from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import TextIO

from .provider_credentials import (
    FirecrawlProviderConfig,
    KeyringBackend,
    ProviderConfigurationError,
    commit_firecrawl_config,
    get_windows_keyring,
)


def main(
    argv: Sequence[str] | None = None,
    *,
    stdin: TextIO | None = None,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
    keyring_backend: KeyringBackend | None = None,
) -> int:
    parser = argparse.ArgumentParser(description="Configure the Firecrawl fallback parser")
    parser.add_argument("--data-dir", type=Path, default=Path(".archresearch"))
    parser.add_argument("--base-url", default="https://api.firecrawl.dev/v2")
    arguments = parser.parse_args(argv)
    input_stream = stdin or sys.stdin
    output_stream = stdout or sys.stdout
    error_stream = stderr or sys.stderr

    api_key = input_stream.readline().strip()
    if not api_key:
        print("API Key 不能为空。", file=error_stream)
        return 2

    try:
        config = FirecrawlProviderConfig(base_url=arguments.base_url)
        backend = keyring_backend or get_windows_keyring()
        commit_firecrawl_config(arguments.data_dir, config, api_key, backend)
    except (ProviderConfigurationError, ValueError):
        print("安全保存失败：请检查 Firecrawl 地址和 Windows 凭据管理器。", file=error_stream)
        return 1

    print(
        "Firecrawl 配置已保存到 Windows 凭据管理器；首次公开网页兜底解析可能消耗额度。",
        file=output_stream,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
