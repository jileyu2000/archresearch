from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

import archresearch_api.database as database_module
from alembic import command
from archresearch_api.database import Database


def test_alembic_upgrade_head_creates_the_v21_schema(tmp_path: Path) -> None:
    api_root = Path(__file__).parents[1]
    config = Config(api_root / "alembic.ini")
    database_path = tmp_path / "migration.db"
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path.as_posix()}")

    command.upgrade(config, "head")

    tables = set(inspect(create_engine(f"sqlite:///{database_path.as_posix()}")).get_table_names())
    assert tables == {
        "alembic_version",
        "workspaces",
        "input_artifacts",
        "research_runs",
        "query_attempts",
        "source_pages",
        "asset_candidates",
        "evidence_claims",
        "saved_references",
        "rejected_feedback",
        "reference_boards",
        "style_profiles",
        "trace_events",
    }
    inspector = inspect(create_engine(f"sqlite:///{database_path.as_posix()}"))
    assert {column["name"] for column in inspector.get_columns("research_runs")} >= {
        "keep_forever",
        "retention_expires_at",
        "research_sources",
        "subquestions",
        "visual_calls_used",
        "visual_bytes_used",
        "visual_byte_limit_reached",
        "browser_pages_attempted",
    }
    assert "archived_at" in {column["name"] for column in inspector.get_columns("workspaces")}
    assert {column["name"] for column in inspector.get_columns("query_attempts")} >= {
        "subquestion_id",
        "status",
        "run_attempt",
    }
    assert {column["name"] for column in inspector.get_columns("asset_candidates")} >= {
        "subquestion_ids",
        "project_context",
        "design_mechanism",
        "transfer_strategy",
        "subquestion_analysis",
    }


def test_unversioned_resume_schema_is_upgraded_to_durable_run_budgets(
    tmp_path: Path,
) -> None:
    api_root = Path(__file__).parents[1]
    config = Config(api_root / "alembic.ini")
    database_path = tmp_path / "legacy-resume.db"
    url = f"sqlite:///{database_path.as_posix()}"
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "9b4c5d6e7f80")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE alembic_version"))

    Database(url).migrate()

    inspector = inspect(engine)
    assert {column["name"] for column in inspector.get_columns("research_runs")} >= {
        "visual_calls_used",
        "visual_bytes_used",
        "visual_byte_limit_reached",
        "browser_pages_attempted",
    }
    assert {column["name"] for column in inspector.get_columns("query_attempts")} >= {"run_attempt"}


def test_unversioned_durable_schema_is_upgraded_with_research_sources(
    tmp_path: Path,
) -> None:
    api_root = Path(__file__).parents[1]
    config = Config(api_root / "alembic.ini")
    database_path = tmp_path / "legacy-durable.db"
    url = f"sqlite:///{database_path.as_posix()}"
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "a7c8d9e0f1a2")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE alembic_version"))

    Database(url).migrate()

    assert "research_sources" in {
        column["name"] for column in inspect(engine).get_columns("research_runs")
    }


def test_unversioned_research_source_schema_is_upgraded_with_run_retention(
    tmp_path: Path,
) -> None:
    api_root = Path(__file__).parents[1]
    config = Config(api_root / "alembic.ini")
    database_path = tmp_path / "legacy-research-sources.db"
    url = f"sqlite:///{database_path.as_posix()}"
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "b8d9e0f1a2b3")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE alembic_version"))

    Database(url).migrate()

    assert {"keep_forever", "retention_expires_at"} <= {
        column["name"] for column in inspect(engine).get_columns("research_runs")
    }


def test_unversioned_retention_schema_is_upgraded_with_workspace_archival(
    tmp_path: Path,
) -> None:
    api_root = Path(__file__).parents[1]
    config = Config(api_root / "alembic.ini")
    database_path = tmp_path / "legacy-retention.db"
    url = f"sqlite:///{database_path.as_posix()}"
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "c9e0f1a2b3c4")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE alembic_version"))

    Database(url).migrate()

    assert "archived_at" in {column["name"] for column in inspect(engine).get_columns("workspaces")}


def test_database_migrate_reads_alembic_config_from_frozen_resource_root(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    resource_root = tmp_path / "bundle"
    resource_root.mkdir()
    (resource_root / "alembic.ini").write_text(
        "[alembic]\nscript_location = %(here)s/alembic\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(database_module.sys, "_MEIPASS", str(resource_root), raising=False)
    monkeypatch.setattr(
        database_module,
        "__file__",
        str(resource_root / "base_library.zip" / "archresearch_api" / "database.py"),
    )
    captured: dict[str, object] = {}

    def capture_upgrade(config: Config, revision: str) -> None:
        captured["config"] = config
        captured["revision"] = revision

    monkeypatch.setattr(database_module.command, "upgrade", capture_upgrade)

    Database("sqlite:///:memory:").migrate()

    config = captured["config"]
    assert isinstance(config, Config)
    assert Path(config.get_main_option("script_location")).resolve() == resource_root / "alembic"
    assert captured["revision"] == "head"
