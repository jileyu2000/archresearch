from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="ARCHRESEARCH_",
        extra="ignore",
        populate_by_name=True,
    )

    database_url: str = "sqlite:///./.archresearch/archresearch.db"
    data_dir: Path = Path(".archresearch")
    provider_mode: Literal["mock", "openai"] = "mock"
    run_inline: bool = False
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "ARCHRESEARCH_OPENAI_API_KEY"),
    )
    openai_model: str = Field(
        default="gpt-5.5",
        validation_alias=AliasChoices(
            "OPENAI_RESEARCH_MODEL",
            "ARCHRESEARCH_OPENAI_MODEL",
            "ARCHRESEARCH_OPENAI_RESEARCH_MODEL",
        ),
    )
    vision_model: str = Field(
        default="gpt-5.5",
        validation_alias=AliasChoices(
            "OPENAI_VISION_MODEL",
            "ARCHRESEARCH_VISION_MODEL",
            "ARCHRESEARCH_OPENAI_VISION_MODEL",
        ),
    )
    tineye_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TINEYE_API_KEY", "ARCHRESEARCH_TINEYE_API_KEY"),
    )
    tineye_api_url: str = Field(
        default="https://api.tineye.com/rest/",
        validation_alias=AliasChoices("TINEYE_API_URL", "ARCHRESEARCH_TINEYE_API_URL"),
    )
    max_upload_bytes: int = 30 * 1024 * 1024
    temp_asset_ttl_days: int = 7
    run_metadata_ttl_days: int = 30
