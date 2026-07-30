from __future__ import annotations

import json
import os
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Protocol

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator

SERVICE = "ArchResearch/suoxie"
ACCOUNT = "api-key"
CONFIG_FILENAME = "provider.json"
DEFAULT_PROVIDER_MODEL = "gpt-5.6-sol"


class ProviderConfigurationError(RuntimeError):
    pass


class CredentialStoreUnavailable(ProviderConfigurationError):
    pass


class KeyringBackend(Protocol):
    def get_password(self, service: str, account: str) -> str | None: ...

    def set_password(self, service: str, account: str, value: str) -> None: ...

    def delete_password(self, service: str, account: str) -> None: ...


class ProviderConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_default=True)

    provider: str = Field(default="openai-compatible", min_length=1, max_length=100)
    name: str = Field(default="OpenAI 兼容 API", min_length=1, max_length=100)
    base_url: AnyHttpUrl
    research_model: str = Field(default=DEFAULT_PROVIDER_MODEL, min_length=1, max_length=100)
    vision_model: str = Field(default=DEFAULT_PROVIDER_MODEL, min_length=1, max_length=100)
    api_protocol: Literal["responses", "chat_completions"] = "responses"

    @field_validator("base_url")
    @classmethod
    def reject_embedded_credentials(cls, value: AnyHttpUrl) -> AnyHttpUrl:
        if value.username or value.password:
            raise ValueError("Provider base URL must not contain credentials")
        return value


@dataclass(frozen=True)
class ProviderRuntime:
    config: ProviderConfig
    api_key: str


ConfigWriter = Callable[[Path, ProviderConfig], None]


def write_provider_config(data_dir: Path, config: ProviderConfig) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    target = data_dir / CONFIG_FILENAME
    temporary = target.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(config.model_dump(mode="json"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.chmod(temporary, 0o600)
    temporary.replace(target)


def load_provider_config(data_dir: Path) -> ProviderConfig | None:
    try:
        payload: Any = json.loads((data_dir / CONFIG_FILENAME).read_text(encoding="utf-8"))
        return ProviderConfig.model_validate(payload)
    except (FileNotFoundError, OSError, ValueError):
        return None


def commit_provider_config(
    data_dir: Path,
    config: ProviderConfig,
    api_key: str,
    keyring_backend: KeyringBackend,
    *,
    config_writer: ConfigWriter = write_provider_config,
) -> None:
    normalized_key = api_key.strip()
    if not normalized_key:
        raise ProviderConfigurationError("API key is required")
    previous = keyring_backend.get_password(SERVICE, ACCOUNT)
    try:
        keyring_backend.set_password(SERVICE, ACCOUNT, normalized_key)
        config_writer(data_dir, config)
    except Exception as exc:
        try:
            if previous is None:
                keyring_backend.delete_password(SERVICE, ACCOUNT)
            else:
                keyring_backend.set_password(SERVICE, ACCOUNT, previous)
        except Exception:
            pass
        raise ProviderConfigurationError("Provider configuration was not saved") from exc


def load_provider_runtime(
    data_dir: Path,
    keyring_backend: KeyringBackend,
) -> ProviderRuntime | None:
    config = load_provider_config(data_dir)
    if config is None:
        return None
    try:
        api_key = keyring_backend.get_password(SERVICE, ACCOUNT)
    except Exception:
        return None
    if not api_key:
        return None
    return ProviderRuntime(config=config, api_key=api_key)


def get_windows_keyring() -> KeyringBackend:
    if os.name != "nt":
        raise CredentialStoreUnavailable("Windows Credential Manager is required")
    try:
        import keyring

        backend = keyring.get_keyring()
    except Exception as exc:
        raise CredentialStoreUnavailable("Windows Credential Manager is unavailable") from exc
    if "windows" not in type(backend).__module__.lower():
        raise CredentialStoreUnavailable("Windows Credential Manager backend is unavailable")
    return keyring
