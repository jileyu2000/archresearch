from collections.abc import Iterator
from pathlib import Path
from typing import Any

from alembic.config import Config
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from alembic import command

INITIAL_SCHEMA_REVISION = "ff58c6bc93c7"
DEPTH_SCHEMA_REVISION = "8f3b1c2d4e5f"
RESUME_SCHEMA_REVISION = "9b4c5d6e7f80"


class Base(DeclarativeBase):
    pass


class Database:
    def __init__(self, url: str) -> None:
        self.url = url
        connect_args: dict[str, Any] = (
            {"check_same_thread": False} if url.startswith("sqlite") else {}
        )
        self.engine = create_engine(url, connect_args=connect_args)
        if url.startswith("sqlite"):
            event.listen(self.engine, "connect", _enable_sqlite_foreign_keys)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)

    def create_all(self) -> None:
        Base.metadata.create_all(self.engine)

    def migrate(self) -> None:
        config = Config(Path(__file__).resolve().parents[2] / "alembic.ini")
        config.set_main_option("sqlalchemy.url", self.url.replace("%", "%%"))

        inspector = inspect(self.engine)
        tables = set(inspector.get_table_names())
        if "research_runs" in tables and "alembic_version" not in tables:
            has_depth_schema = (
                {"subquestions"}
                <= {column["name"] for column in inspector.get_columns("research_runs")}
                and {"subquestion_id"}
                <= {column["name"] for column in inspector.get_columns("query_attempts")}
                and {
                    "subquestion_ids",
                    "project_context",
                    "design_mechanism",
                    "transfer_strategy",
                }
                <= {column["name"] for column in inspector.get_columns("asset_candidates")}
            )
            has_resume_schema = {"status"} <= {
                column["name"] for column in inspector.get_columns("query_attempts")
            } and {"subquestion_analysis"} <= {
                column["name"] for column in inspector.get_columns("asset_candidates")
            }
            has_durable_schema = {
                "visual_calls_used",
                "visual_bytes_used",
                "visual_byte_limit_reached",
                "browser_pages_attempted",
            } <= {column["name"] for column in inspector.get_columns("research_runs")} and {
                "run_attempt"
            } <= {column["name"] for column in inspector.get_columns("query_attempts")}
            if has_depth_schema and has_resume_schema and has_durable_schema:
                command.stamp(config, "head")
            elif has_depth_schema and has_resume_schema:
                command.stamp(config, RESUME_SCHEMA_REVISION)
            elif has_depth_schema:
                command.stamp(config, DEPTH_SCHEMA_REVISION)
            else:
                command.stamp(config, INITIAL_SCHEMA_REVISION)

        command.upgrade(config, "head")

    def sessions(self) -> Iterator[Session]:
        with self.session_factory() as session:
            yield session


def _enable_sqlite_foreign_keys(dbapi_connection: Any, _connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
