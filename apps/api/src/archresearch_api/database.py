import sys
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
DURABLE_SCHEMA_REVISION = "a7c8d9e0f1a2"
RESEARCH_SOURCES_SCHEMA_REVISION = "b8d9e0f1a2b3"
RUN_RETENTION_SCHEMA_REVISION = "c9e0f1a2b3c4"


def _resource_root() -> Path:
    frozen_root = getattr(sys, "_MEIPASS", None)
    if isinstance(frozen_root, str) and frozen_root:
        return Path(frozen_root)
    return Path(__file__).resolve().parents[2]


class Base(DeclarativeBase):
    pass


class Database:
    def __init__(self, url: str) -> None:
        self.url = url
        self._bind()

    def _bind(self) -> None:
        connect_args: dict[str, Any] = (
            {"check_same_thread": False} if self.url.startswith("sqlite") else {}
        )
        self.engine = create_engine(self.url, connect_args=connect_args)
        if self.url.startswith("sqlite"):
            event.listen(self.engine, "connect", _enable_sqlite_foreign_keys)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)

    def reconnect(self) -> None:
        self.engine.dispose()
        self._bind()

    def create_all(self) -> None:
        Base.metadata.create_all(self.engine)

    def migrate(self) -> None:
        config = Config(_resource_root() / "alembic.ini")
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
            has_research_sources = {"research_sources"} <= {
                column["name"] for column in inspector.get_columns("research_runs")
            }
            has_run_retention = {"keep_forever", "retention_expires_at"} <= {
                column["name"] for column in inspector.get_columns("research_runs")
            }
            has_workspace_archival = {"archived_at"} <= {
                column["name"] for column in inspector.get_columns("workspaces")
            }
            if (
                has_depth_schema
                and has_resume_schema
                and has_durable_schema
                and has_research_sources
                and has_run_retention
                and has_workspace_archival
            ):
                command.stamp(config, "head")
            elif (
                has_depth_schema
                and has_resume_schema
                and has_durable_schema
                and has_research_sources
                and has_run_retention
            ):
                command.stamp(config, RUN_RETENTION_SCHEMA_REVISION)
            elif (
                has_depth_schema
                and has_resume_schema
                and has_durable_schema
                and has_research_sources
            ):
                command.stamp(config, RESEARCH_SOURCES_SCHEMA_REVISION)
            elif has_depth_schema and has_resume_schema and has_durable_schema:
                command.stamp(config, DURABLE_SCHEMA_REVISION)
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
