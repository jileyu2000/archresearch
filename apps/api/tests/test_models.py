from archresearch_api import models  # noqa: F401
from archresearch_api.database import Base


def test_database_declares_every_scoped_v21_entity() -> None:
    assert set(Base.metadata.tables) == {
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
