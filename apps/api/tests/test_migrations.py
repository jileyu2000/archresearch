from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


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
