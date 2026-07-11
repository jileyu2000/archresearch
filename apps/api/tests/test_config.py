from pathlib import Path

from archresearch_api.config import Settings


def test_live_provider_settings_accept_standard_secret_environment_names(
    monkeypatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "openai-test-key")
    monkeypatch.setenv("OPENAI_RESEARCH_MODEL", "gpt-5.5")
    monkeypatch.setenv("OPENAI_VISION_MODEL", "gpt-5.5")
    monkeypatch.setenv("TINEYE_API_KEY", "tineye-test-key")
    monkeypatch.setenv("TINEYE_API_URL", "https://api.tineye.com/rest/")

    settings = Settings(_env_file=None)

    assert settings.openai_api_key == "openai-test-key"
    assert settings.openai_model == "gpt-5.5"
    assert settings.vision_model == "gpt-5.5"
    assert settings.tineye_api_key == "tineye-test-key"
    assert settings.tineye_api_url == "https://api.tineye.com/rest/"


def test_default_models_and_local_retention_match_the_v2_1_plan() -> None:
    settings = Settings(_env_file=None)

    assert settings.openai_model == "gpt-5.5"
    assert settings.vision_model == "gpt-5.5"
    assert settings.data_dir == Path(".archresearch")
    assert settings.temp_asset_ttl_days == 7
    assert settings.run_metadata_ttl_days == 30
