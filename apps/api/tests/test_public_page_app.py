from pathlib import Path

from archresearch_api.config import Settings
from archresearch_api.main import create_app
from archresearch_api.provider_credentials import (
    FIRECRAWL_ACCOUNT,
    FIRECRAWL_SERVICE,
    FirecrawlProviderConfig,
    write_firecrawl_config,
)


class InjectedPublicPageParser:
    name = "injected-public-page-parser"


class FakeKeyring:
    def __init__(self, key: str) -> None:
        self.key = key

    def get_password(self, service: str, account: str) -> str | None:
        if (service, account) == (FIRECRAWL_SERVICE, FIRECRAWL_ACCOUNT):
            return self.key
        return None

    def set_password(self, service: str, account: str, value: str) -> None:
        del service, account, value

    def delete_password(self, service: str, account: str) -> None:
        del service, account


def test_app_only_constructs_firecrawl_with_a_key_and_allows_injection(tmp_path: Path) -> None:
    no_key = Settings(
        _env_file=None,
        database_url=f"sqlite:///{(tmp_path / 'no-key.db').as_posix()}",
        data_dir=tmp_path / "no-key",
        firecrawl_api_key=None,
    )
    assert create_app(no_key).state.public_page_parser is None

    with_key = Settings(
        _env_file=None,
        database_url=f"sqlite:///{(tmp_path / 'key.db').as_posix()}",
        data_dir=tmp_path / "key",
        firecrawl_api_key="key",
    )
    assert create_app(with_key).state.public_page_parser.name == "firecrawl"

    injected = InjectedPublicPageParser()
    assert create_app(no_key, public_page_parser=injected).state.public_page_parser is injected


def test_app_loads_firecrawl_from_windows_credential_configuration(tmp_path: Path) -> None:
    write_firecrawl_config(tmp_path, FirecrawlProviderConfig())
    settings = Settings(
        _env_file=None,
        database_url=f"sqlite:///{(tmp_path / 'stored.db').as_posix()}",
        data_dir=tmp_path,
        provider_mode="mock",
        firecrawl_api_key=None,
    )

    app = create_app(settings, keyring_backend=FakeKeyring("fc-stored"))

    assert app.state.public_page_parser.name == "firecrawl"
    assert app.state.public_page_parser.api_key == "fc-stored"
