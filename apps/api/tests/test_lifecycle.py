from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import sleep

import pytest
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


def test_cleanup_removes_expired_runs_and_files_but_keeps_permanent_runs(
    tmp_path: Path,
) -> None:
    data_dir = tmp_path / "runtime"
    database = Database(f"sqlite:///{(tmp_path / 'run-retention.db').as_posix()}")
    database.create_all()
    now = datetime.now(UTC)
    with database.session_factory() as session:
        workspace = Workspace(name="Run retention")
        session.add(workspace)
        session.flush()
        expired_run = ResearchRun(
            workspace_id=workspace.id,
            question="expire this run",
            goal=ResearchGoal.precedent_research.value,
            budget_mode=BudgetMode.quick.value,
            budget=BUDGETS[BudgetMode.quick].model_dump(),
            allowed_domains=[],
            status=RunStatus.completed.value,
            coverage_report={},
            keep_forever=False,
            retention_expires_at=now - timedelta(seconds=1),
        )
        permanent_run = ResearchRun(
            workspace_id=workspace.id,
            question="keep this run",
            goal=ResearchGoal.precedent_research.value,
            budget_mode=BudgetMode.quick.value,
            budget=BUDGETS[BudgetMode.quick].model_dump(),
            allowed_domains=[],
            status=RunStatus.completed.value,
            coverage_report={},
            keep_forever=True,
            retention_expires_at=None,
        )
        session.add_all([expired_run, permanent_run])
        session.flush()
        expired_board = ReferenceBoard(run_id=expired_run.id)
        permanent_board = ReferenceBoard(run_id=permanent_run.id)
        session.add_all([expired_board, permanent_board])
        session.flush()
        expired_file = data_dir / "runs" / expired_run.id / "candidates" / "expired.png"
        expired_file.parent.mkdir(parents=True)
        expired_file.write_bytes(b"expired")
        expired_asset = AssetCandidate(
            run_id=expired_run.id,
            project_name="Expired",
            asset_type="section",
            source_url="https://example.com/expired-run",
            storage_path=str(expired_file),
        )
        session.add(expired_asset)
        session.flush()
        session.add(
            SavedReference(
                workspace_id=workspace.id,
                asset_candidate_id=expired_asset.id,
                source_url=expired_asset.source_url,
                snapshot={
                    "project_name": "Expired",
                    "question": expired_run.question,
                    "goal": expired_run.goal,
                    "collection_file": "saved-expired.png",
                },
            )
        )
        session.commit()
        expired_run_id = expired_run.id
        permanent_run_id = permanent_run.id
        expired_board_id = expired_board.id

    expired_export = data_dir / "exports" / expired_board_id / "old.html"
    expired_export.parent.mkdir(parents=True)
    expired_export.write_text("expired", encoding="utf-8")
    collection_file = data_dir / "collections" / "saved-expired.png"
    collection_file.parent.mkdir(parents=True)
    collection_file.write_bytes(b"saved")

    report = cleanup_expired_data(database, data_dir=data_dir, now=now)

    assert report.runs == 1
    assert not expired_file.exists()
    assert not expired_export.exists()
    assert collection_file.exists()
    with database.session_factory() as session:
        assert session.get(ResearchRun, expired_run_id) is None
        assert session.get(ResearchRun, permanent_run_id) is not None
        saved_questions = [
            saved.snapshot["question"] for saved in session.scalars(select(SavedReference))
        ]
        assert saved_questions == ["expire this run"]


def test_cleanup_removes_only_unreferenced_pngs_from_run_candidate_directories(
    tmp_path: Path,
) -> None:
    runtime_dir = tmp_path / "runtime"
    database = Database(f"sqlite:///{(tmp_path / 'orphan-crops.db').as_posix()}")
    database.create_all()
    with database.session_factory() as session:
        workspace = Workspace(name="Orphan crop cleanup")
        session.add(workspace)
        session.flush()
        run = ResearchRun(
            workspace_id=workspace.id,
            question="cleanup orphan crops",
            goal=ResearchGoal.precedent_research.value,
            budget_mode=BudgetMode.quick.value,
            budget=BUDGETS[BudgetMode.quick].model_dump(),
            allowed_domains=[],
            status=RunStatus.completed.value,
            coverage_report={},
        )
        session.add(run)
        session.flush()

        candidate_dir = runtime_dir / "runs" / run.id / "candidates"
        candidate_dir.mkdir(parents=True)
        referenced_file = candidate_dir / "referenced.png"
        referenced_file.write_bytes(b"referenced")
        orphan_file = candidate_dir / "orphan.png"
        orphan_file.write_bytes(b"orphan")
        non_png_file = candidate_dir / "notes.txt"
        non_png_file.write_text("keep", encoding="utf-8")
        outside_file = tmp_path / "outside.png"
        outside_file.write_bytes(b"outside")
        unrelated_runtime_file = runtime_dir / "exports" / "unreferenced.png"
        unrelated_runtime_file.parent.mkdir(parents=True)
        unrelated_runtime_file.write_bytes(b"export")

        session.add(
            AssetCandidate(
                run_id=run.id,
                project_name="Referenced",
                asset_type="section",
                source_url="https://example.com/referenced",
                storage_path=str(referenced_file),
            )
        )
        session.commit()

    report = cleanup_expired_data(database, data_dir=runtime_dir)

    assert report.orphan_files == 1
    assert referenced_file.is_file()
    assert not orphan_file.exists()
    assert non_png_file.is_file()
    assert outside_file.is_file()
    assert unrelated_runtime_file.is_file()


def test_cleanup_preserves_default_relative_candidate_storage_paths(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.chdir(tmp_path)
    data_dir = Path(".archresearch")
    database = Database(f"sqlite:///{(tmp_path / 'relative-paths.db').as_posix()}")
    database.create_all()
    with database.session_factory() as session:
        workspace = Workspace(name="Relative path cleanup")
        session.add(workspace)
        session.flush()
        run = ResearchRun(
            workspace_id=workspace.id,
            question="preserve referenced relative crop",
            goal=ResearchGoal.precedent_research.value,
            budget_mode=BudgetMode.quick.value,
            budget=BUDGETS[BudgetMode.quick].model_dump(),
            allowed_domains=[],
            status=RunStatus.completed.value,
            coverage_report={},
        )
        session.add(run)
        session.flush()
        candidate_dir = data_dir / "runs" / run.id / "candidates"
        candidate_dir.mkdir(parents=True)
        referenced_file = candidate_dir / "referenced.png"
        referenced_file.write_bytes(b"referenced")
        orphan_file = candidate_dir / "orphan.png"
        orphan_file.write_bytes(b"orphan")
        session.add(
            AssetCandidate(
                run_id=run.id,
                project_name="Referenced",
                asset_type="section",
                source_url="https://example.com/relative",
                storage_path=str(referenced_file),
            )
        )
        session.commit()

    report = cleanup_expired_data(database, data_dir=data_dir)

    assert report.orphan_files == 1
    assert referenced_file.is_file()
    assert not orphan_file.exists()


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
