from pathlib import Path

from archresearch_api.config import Settings
from archresearch_api.main import create_app


class InjectedPublicPageParser:
    name = "injected-public-page-parser"


class InjectedXiaohongshuSearch:
    name = "injected-xiaohongshu-search"


def test_app_uses_local_browser_for_live_research_and_allows_injection(tmp_path: Path) -> None:
    mock_settings = Settings(
        _env_file=None,
        database_url=f"sqlite:///{(tmp_path / 'mock.db').as_posix()}",
        data_dir=tmp_path / "mock",
        provider_mode="mock",
    )
    assert create_app(mock_settings).state.public_page_parser is None
    assert create_app(mock_settings).state.xiaohongshu_search is None

    live_settings = Settings(
        _env_file=None,
        database_url=f"sqlite:///{(tmp_path / 'live.db').as_posix()}",
        data_dir=tmp_path / "live",
        provider_mode="openai",
        openai_api_key="test-key",
    )
    assert create_app(live_settings).state.public_page_parser.name == "local_browser"

    injected = InjectedPublicPageParser()
    assert (
        create_app(mock_settings, public_page_parser=injected).state.public_page_parser is injected
    )

    xiaohongshu = InjectedXiaohongshuSearch()
    assert (
        create_app(mock_settings, xiaohongshu_search=xiaohongshu).state.xiaohongshu_search
        is xiaohongshu
    )
