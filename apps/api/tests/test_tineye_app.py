from pathlib import Path

from archresearch_api.config import Settings
from archresearch_api.main import create_app


class InjectedTinEyeProvider:
    name = "injected-tineye"


def test_settings_accepts_the_documented_tineye_api_key_alias(monkeypatch: object) -> None:
    monkeypatch.setenv("TINEYE_API_KEY", "documented-key")  # type: ignore[attr-defined]

    settings = Settings(_env_file=None)

    assert settings.tineye_api_key == "documented-key"


def test_app_only_constructs_tineye_with_a_key_and_allows_injection(tmp_path: Path) -> None:
    no_key = Settings(
        database_url=f"sqlite:///{(tmp_path / 'no-key.db').as_posix()}",
        data_dir=tmp_path / "no-key",
        tineye_api_key=None,
    )
    assert create_app(no_key).state.tineye_provider is None

    with_key = Settings(
        database_url=f"sqlite:///{(tmp_path / 'key.db').as_posix()}",
        data_dir=tmp_path / "key",
        tineye_api_key="key",
    )
    assert create_app(with_key).state.tineye_provider is not None

    injected = InjectedTinEyeProvider()
    assert create_app(no_key, tineye_provider=injected).state.tineye_provider is injected
