from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import sleep

from fastapi.testclient import TestClient
from sqlalchemy import select

from archresearch_api.config import Settings
from archresearch_api.database import Database
from archresearch_api.lifecycle import cleanup_expired_data
from archresearch_api.main import create_app
from archresearch_api.models import (
    AssetCandidate,
    QueryAttempt,
    ReferenceBoard,
    ResearchRun,
    SavedReference,
    SourcePage,
    TraceEvent,
    Workspace,
)
from archresearch_api.schemas import BUDGETS, BudgetMode, ResearchGoal, RunStatus


def test_cleanup_removes_expired_temporary_data_but_keeps_saved_snapshots(
    tmp_path: Path,
) -> None:
    database = Database(f"sqlite:///{(tmp_path / 'cleanup.db').as_posix()}")
    database.create_all()
    now = datetime.now(UTC)
    expired_file = tmp_path / "runtime" / "runs" / "expired.png"
    expired_file.parent.mkdir(parents=True)
    expired_file.write_bytes(b"expired")
    with database.session_factory() as session:
        workspace = Workspace(name="Cleanup")
        session.add(workspace)
        session.flush()
        run = ResearchRun(
            workspace_id=workspace.id,
            question="cleanup",
            goal=ResearchGoal.precedent_research.value,
            budget_mode=BudgetMode.quick.value,
            budget=BUDGETS[BudgetMode.quick].model_dump(),
            allowed_domains=[],
            status=RunStatus.completed.value,
            coverage_report={},
        )
        session.add(run)
        session.flush()
        expired_page = SourcePage(
            run_id=run.id,
            url="https://example.com/expired",
            expires_at=now - timedelta(seconds=1),
        )
        fresh_page = SourcePage(
            run_id=run.id,
            url="https://example.com/fresh",
            expires_at=now + timedelta(days=1),
        )
        session.add_all([expired_page, fresh_page])
        session.flush()
        expired_asset = AssetCandidate(
            run_id=run.id,
            source_page_id=expired_page.id,
            project_name="Expired",
            asset_type="section",
            source_url=expired_page.url,
            image_url="https://images.example/expired.png",
            storage_path=str(expired_file),
            expires_at=now - timedelta(seconds=1),
        )
        session.add(expired_asset)
        session.flush()
        session.add(
            SavedReference(
                workspace_id=workspace.id,
                asset_candidate_id=expired_asset.id,
                source_url=expired_asset.source_url,
                note="keep",
                snapshot={"project_name": "Expired"},
            )
        )
        session.add_all(
            [
                TraceEvent(
                    run_id=run.id,
                    sequence=1,
                    stage="searching",
                    created_at=now - timedelta(days=31),
                ),
                TraceEvent(
                    run_id=run.id,
                    sequence=2,
                    stage="composing",
                    created_at=now,
                ),
                QueryAttempt(
                    run_id=run.id,
                    round_number=1,
                    query="old",
                    language="en",
                    purpose="test",
                    provider="mock",
                    created_at=now - timedelta(days=31),
                ),
                QueryAttempt(
                    run_id=run.id,
                    round_number=1,
                    query="fresh",
                    language="en",
                    purpose="test",
                    provider="mock",
                    created_at=now,
                ),
            ]
        )
        session.commit()

    report = cleanup_expired_data(
        database,
        data_dir=tmp_path / "runtime",
        now=now,
        metadata_ttl_days=30,
    )

    assert report.assets == 1
    assert report.sources == 1
    assert report.trace_events == 1
    assert report.queries == 1
    assert not expired_file.exists()
    with database.session_factory() as session:
        assert session.scalars(select(AssetCandidate)).all() == []
        assert [page.url for page in session.scalars(select(SourcePage))] == [fresh_page.url]
        assert [saved.note for saved in session.scalars(select(SavedReference))] == ["keep"]
        assert [event.sequence for event in session.scalars(select(TraceEvent))] == [2]
        assert [query.query for query in session.scalars(select(QueryAttempt))] == ["fresh"]


def test_lifespan_resumes_an_incomplete_run_from_sqlite(tmp_path: Path) -> None:
    database_url = f"sqlite:///{(tmp_path / 'resume.db').as_posix()}"
    database = Database(database_url)
    database.create_all()
    with database.session_factory() as session:
        workspace = Workspace(name="Resume")
        session.add(workspace)
        session.flush()
        run = ResearchRun(
            workspace_id=workspace.id,
            question="旧建筑剖面层次",
            goal=ResearchGoal.precedent_research.value,
            budget_mode=BudgetMode.balanced.value,
            budget=BUDGETS[BudgetMode.balanced].model_dump(),
            allowed_domains=[],
            status=RunStatus.searching.value,
            checkpoint_stage=RunStatus.searching.value,
            coverage_report={},
        )
        session.add(run)
        session.flush()
        session.add(ReferenceBoard(run_id=run.id))
        session.commit()
        run_id = run.id
    database.engine.dispose()

    settings = Settings(
        _env_file=None,
        database_url=database_url,
        data_dir=tmp_path / "runtime",
        provider_mode="mock",
        run_inline=True,
    )
    with TestClient(create_app(settings)) as client:
        for _ in range(40):
            response = client.get(f"/v1/runs/{run_id}")
            if response.json()["status"] in {"completed", "partial", "blocked", "failed"}:
                break
            sleep(0.05)

        assert response.status_code == 200
        assert response.json()["status"] == "completed"
        assert client.get(f"/v1/runs/{run_id}/results").json()
