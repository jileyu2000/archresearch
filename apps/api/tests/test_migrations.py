from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

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
        "subquestions",
        "visual_calls_used",
        "visual_bytes_used",
        "visual_byte_limit_reached",
        "browser_pages_attempted",
    }
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
