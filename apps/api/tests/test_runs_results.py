from datetime import UTC, datetime, timedelta
from pathlib import Path

import fitz  # type: ignore[import-untyped]
from fastapi.testclient import TestClient
from sqlalchemy import select

from archresearch_api.models import AssetCandidate, InputArtifact, ResearchRun, SavedReference
from archresearch_api.schemas import RunStatus
from archresearch_api.workflow import _checkpoint


def _create_run(client: TestClient, workspace_id: str, mode: str = "balanced") -> dict[str, object]:
    response = client.post(
        f"/v1/workspaces/{workspace_id}/runs",
        json={
            "question": "旧建筑中如何植入新功能并形成有层次的剖面？",
            "goal": "precedent_research",
            "budget_mode": mode,
        },
    )
    assert response.status_code == 201
    return dict(response.json())


def test_mock_run_persists_stage_checkpoints_and_results(
    client: TestClient, workspace_id: str
) -> None:
    run = _create_run(client, workspace_id)
    assert run["status"] == "completed"
    assert run["stop_reason"] == "coverage_satisfied"
    assert len(run["subquestions"]) == 4
    assert run["coverage_report"]["usable_assets"] >= 12
    assert run["coverage_report"]["project_count"] >= 4
    assert run["coverage_report"]["covered_subquestions"] == 4
    assert run["coverage_report"]["multi_asset_projects"] >= 2
    assert run["coverage_report"]["gaps"] == []

    fetched = client.get(f"/v1/runs/{run['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["checkpoint_stage"] == "composing"

    results = client.get(f"/v1/runs/{run['id']}/results")
    assert results.status_code == 200
    tiers = [item["result_tier"] for item in results.json()]
    assert tiers[:2] == ["verified", "verified"]
    assert len(results.json()) >= 12
    assert all(item["evidence_claims"] for item in results.json())
    assert all(
        item["facts"] and item["observations"] and item["inferences"] and item["limitations"]
        for item in results.json()
    )
    assert all(item["subquestion_ids"] for item in results.json())
    assert all(len(item["subquestion_ids"]) == 1 for item in results.json())
    assert all(item["project_context"] for item in results.json())
    assert all(item["design_mechanism"] for item in results.json())
    assert all(len(item["transfer_strategy"]) >= 2 for item in results.json())
    assert all(
        any(
            claim["claim_type"] == "fact"
            and claim["statement"] == item["project_context"]
            and claim["source_url"] == item["source_url"]
            and claim["text_excerpt"]
            for claim in item["evidence_claims"]
        )
        for item in results.json()
    )
    assert all(
        any(
            claim["claim_type"] == "fact"
            and claim["statement"] == item["design_mechanism"]
            and claim["source_url"] == item["source_url"]
            and claim["text_excerpt"]
            for claim in item["evidence_claims"]
        )
        for item in results.json()
    )


def test_gap_check_exposes_live_coverage_while_run_is_active(
    client: TestClient,
    workspace_id: str,
) -> None:
    with client.app.state.database.session_factory() as session:
        run = ResearchRun(
            workspace_id=workspace_id,
            question="旧建筑中如何植入新功能？",
            goal="precedent_research",
            budget_mode="quick",
            budget={},
            research_sources=[],
            subquestions=[],
            status=RunStatus.verifying.value,
            coverage_report={},
        )
        session.add(run)
        session.commit()
        run_id = run.id

    coverage = {
        "usable_assets": 3,
        "project_count": 2,
        "verified_or_partial": 2,
        "subquestion_count": 3,
        "covered_subquestions": 1,
        "covered_subquestion_ids": ["program"],
        "multi_asset_projects": 1,
        "subquestion_passes": {"program": 1},
        "gaps": ["uncovered_subquestions"],
        "enrichment_gaps": ["insufficient_usable_assets"],
    }
    _checkpoint(
        client.app.state.database,
        run_id,
        RunStatus.gap_check,
        coverage,
    )

    response = client.get(f"/v1/runs/{run_id}")

    assert response.status_code == 200
    assert response.json()["status"] == "gap_check"
    assert response.json()["coverage_report"]["usable_assets"] == 3


def test_project_brief_review_precedes_run_creation_and_confirmed_questions_are_used(
    client: TestClient,
    workspace_id: str,
) -> None:
    document = fitz.open()
    page = document.new_page()
    page.insert_text(
        (72, 72),
        "Smart museum brief: serial gallery, work process, virtual and physical experience.",
    )
    pdf_bytes = document.tobytes()
    document.close()
    question = "耕织图是一份图案画作，建筑是立体的三维的，该如何转译提取元素呢。"

    response = client.post(
        f"/v1/workspaces/{workspace_id}/brief-review",
        data={"question": question, "budget_mode": "balanced"},
        files={
            "file": (
                "2024 研一概念设计-窦平平.pdf",
                pdf_bytes,
                "application/pdf",
            )
        },
    )

    assert response.status_code == 200
    review = response.json()
    assert review["filename"] == "2024 研一概念设计-窦平平.pdf"
    assert review["page_count"] == 1
    assert "苏州科技馆蚕桑丝织文化智慧博物馆概念设计" in review["project_summary"]
    assert len(review["project_boundaries"]) >= 3
    assert len(review["subquestions"]) == 4
    with client.app.state.database.session_factory() as session:
        assert list(session.scalars(select(ResearchRun))) == []
        assert list(session.scalars(select(InputArtifact))) == []

    review["subquestions"][0]["question"] = "长卷的连续叙事如何成为可行走的空间序列？"
    run_response = client.post(
        f"/v1/workspaces/{workspace_id}/runs",
        json={
            "question": question,
            "goal": "precedent_research",
            "budget_mode": "balanced",
            "research_sources": [],
            "subquestions": review["subquestions"],
        },
    )

    assert run_response.status_code == 201
    assert run_response.json()["subquestions"] == review["subquestions"]


def test_workspace_runs_are_listed_newest_first(client: TestClient, workspace_id: str) -> None:
    first = _create_run(client, workspace_id, mode="quick")
    second = _create_run(client, workspace_id, mode="balanced")

    response = client.get(f"/v1/workspaces/{workspace_id}/runs")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [second["id"], first["id"]]


def test_run_defaults_to_one_semester_and_can_be_kept_permanently(
    client: TestClient,
    workspace_id: str,
) -> None:
    before = datetime.now(UTC)
    run = _create_run(client, workspace_id, mode="quick")
    expiry = datetime.fromisoformat(str(run["retention_expires_at"]))

    assert run["keep_forever"] is False
    earliest_expiry = before + timedelta(days=179, hours=23)
    latest_expiry = before + timedelta(days=180, minutes=1)
    assert earliest_expiry <= expiry <= latest_expiry

    permanent = client.patch(
        f"/v1/runs/{run['id']}/retention",
        json={"permanent": True},
    )
    assert permanent.status_code == 200
    assert permanent.json()["keep_forever"] is True
    assert permanent.json()["retention_expires_at"] is None

    reset_at = datetime.now(UTC)
    temporary = client.patch(
        f"/v1/runs/{run['id']}/retention",
        json={"permanent": False},
    )
    reset_expiry = datetime.fromisoformat(temporary.json()["retention_expires_at"])
    assert temporary.status_code == 200
    assert temporary.json()["keep_forever"] is False
    assert (
        reset_at + timedelta(days=179, hours=23)
        <= reset_expiry
        <= reset_at + timedelta(days=180, minutes=1)
    )


def test_new_run_is_rejected_while_another_research_is_active(
    client: TestClient,
    workspace_id: str,
) -> None:
    active = _create_run(client, workspace_id, mode="quick")
    with client.app.state.database.session_factory() as session:
        run = session.get(ResearchRun, active["id"])
        assert run is not None
        run.status = "searching"
        run.finished_at = None
        session.commit()

    response = client.post(
        f"/v1/workspaces/{workspace_id}/runs",
        json={
            "question": "同时发起的第二个研究不应抢占浏览器",
            "goal": "precedent_research",
            "budget_mode": "quick",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "已有研究正在进行，请先等待完成或取消。"


def test_retry_is_rejected_while_a_different_research_is_active(
    client: TestClient,
    workspace_id: str,
) -> None:
    active = _create_run(client, workspace_id, mode="quick")
    retryable = _create_run(client, workspace_id, mode="quick")
    with client.app.state.database.session_factory() as session:
        active_run = session.get(ResearchRun, active["id"])
        retry_run = session.get(ResearchRun, retryable["id"])
        assert active_run is not None
        assert retry_run is not None
        active_run.status = "searching"
        active_run.finished_at = None
        retry_run.status = "blocked"
        retry_run.stop_reason = "fixture_blocked"
        session.commit()

    response = client.post(f"/v1/runs/{retryable['id']}/retry")

    assert response.status_code == 409
    assert response.json()["detail"] == "已有研究正在进行，请先等待完成或取消。"


def test_run_rejects_removed_pinterest_source(
    client: TestClient,
    workspace_id: str,
) -> None:
    response = client.post(
        f"/v1/workspaces/{workspace_id}/runs",
        json={
            "question": "从已移除的平台寻找建筑分析图表达灵感",
            "goal": "visual_reference_search",
            "budget_mode": "quick",
            "research_sources": ["pinterest"],
        },
    )

    assert response.status_code == 422


def test_result_contract_normalizes_legacy_types_and_reports_local_content(
    client: TestClient,
    workspace_id: str,
    tmp_path: Path,
) -> None:
    run = _create_run(client, workspace_id, mode="quick")
    result = client.get(f"/v1/runs/{run['id']}/results").json()[0]
    local_crop = tmp_path / "crop.png"
    local_crop.write_bytes(b"fixture")
    with client.app.state.database.session_factory() as session:
        candidate = session.get(AssetCandidate, result["id"])
        assert candidate is not None
        candidate.asset_type = "project page with plan, section, analysis diagram, and photos"
        candidate.storage_path = str(local_crop)
        session.commit()

    normalized = client.get(f"/v1/runs/{run['id']}/results").json()[0]

    assert normalized["asset_type"] == "analysis_diagram"
    assert normalized["has_local_content"] is True


def test_sse_event_history_is_ordered_and_redacted(client: TestClient, workspace_id: str) -> None:
    run = _create_run(client, workspace_id, mode="quick")
    response = client.get(f"/v1/runs/{run['id']}/events")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: trace" in response.text
    assert "planning" in response.text
    assert "composing" in response.text
    assert "cookie" not in response.text.lower()


def test_cancel_and_idempotent_retry_preserve_existing_results(
    client: TestClient, workspace_id: str
) -> None:
    run = _create_run(client, workspace_id)
    cancelled = client.post(f"/v1/runs/{run['id']}/cancel")
    assert cancelled.status_code == 409

    first_retry = client.post(f"/v1/runs/{run['id']}/retry")
    assert first_retry.status_code == 200
    second_retry = client.post(f"/v1/runs/{run['id']}/retry")
    assert second_retry.status_code == 200
    assert second_retry.json()["attempt"] == first_retry.json()["attempt"]
    assert len(client.get(f"/v1/runs/{run['id']}/results").json()) == 12


def test_save_and_reject_are_workspace_scoped(client: TestClient, workspace_id: str) -> None:
    run = _create_run(client, workspace_id)
    candidate = client.get(f"/v1/runs/{run['id']}/results").json()[0]

    saved = client.post(f"/v1/results/{candidate['id']}/save", json={"note": "剖面策略"})
    assert saved.status_code == 201
    assert saved.json()["workspace_id"] == workspace_id

    rejected = client.post(
        f"/v1/results/{candidate['id']}/reject",
        json={"reason": "项目尺度不匹配"},
    )
    assert rejected.status_code == 201
    assert rejected.json()["source_url"] == candidate["source_url"]
    assert "storage_path" not in rejected.json()


def test_personal_collections_keep_question_mode_and_local_content(
    client: TestClient, workspace_id: str
) -> None:
    run = _create_run(client, workspace_id)
    candidate = client.get(f"/v1/runs/{run['id']}/results").json()[0]
    data_dir = Path(client.app.state.settings.data_dir)
    candidate_dir = data_dir / "runs" / str(run["id"]) / "candidates"
    candidate_dir.mkdir(parents=True, exist_ok=True)
    image_bytes = b"\x89PNG\r\n\x1a\ncollection-copy"
    candidate_path = candidate_dir / "collection-source.png"
    candidate_path.write_bytes(image_bytes)
    with client.app.state.database.session_factory() as session:
        asset = session.get(AssetCandidate, candidate["id"])
        assert asset is not None
        sibling_assets = list(
            session.scalars(
                select(AssetCandidate)
                .where(
                    AssetCandidate.run_id == run["id"],
                    AssetCandidate.id != candidate["id"],
                )
                .order_by(AssetCandidate.rank_index, AssetCandidate.id)
                .limit(2)
            )
        )
        assert len(sibling_assets) == 2
        asset.asset_type = "section"
        asset.image_url = "https://example.com/saved-section.jpg"
        asset.rank_index = 0
        sibling_image_specs = [
            (sibling_assets[0], "elevation", "https://example.com/project-elevation.jpg"),
            (sibling_assets[1], "site_plan", "https://example.com/project-site-plan.jpg"),
        ]
        for index, (sibling, asset_type, image_url) in enumerate(sibling_image_specs, start=1):
            sibling.project_name = asset.project_name
            sibling.asset_type = asset_type
            sibling.image_url = image_url
            sibling.source_url = asset.source_url
            sibling.rank_index = index
        asset.storage_path = str(candidate_path)
        assert asset.evidence_claims
        first_subquestion_id = candidate["subquestion_ids"][0]
        first_analysis = candidate["subquestion_analysis"][first_subquestion_id]
        matching_claim = asset.evidence_claims[0]
        matching_claim.statement = first_analysis["design_mechanism"]
        matching_claim.source_url = candidate["source_url"]
        matching_claim.text_excerpt = "A retained structure supports the saved case mechanism."
        session.commit()

    saved = client.post(f"/v1/results/{candidate['id']}/save", json={"note": "可用于剖面"})

    assert saved.status_code == 201
    snapshot = saved.json()["snapshot"]
    assert snapshot["question"] == run["question"]
    assert snapshot["goal"] == "precedent_research"
    assert snapshot["collection_file"].endswith(".png")
    case_images = snapshot["case_images"]
    assert case_images == [
        {
            "asset_id": candidate["id"],
            "asset_type": "section",
            "image_url": "https://example.com/saved-section.jpg",
            "source_url": candidate["source_url"],
        },
        {
            "asset_id": sibling_assets[0].id,
            "asset_type": "elevation",
            "image_url": "https://example.com/project-elevation.jpg",
            "source_url": candidate["source_url"],
        },
        {
            "asset_id": sibling_assets[1].id,
            "asset_type": "site_plan",
            "image_url": "https://example.com/project-site-plan.jpg",
            "source_url": candidate["source_url"],
        },
    ]
    subquestions_by_id = {item["id"]: item for item in run["subquestions"]}
    expected_ids = candidate["subquestion_ids"]
    case_subquestions = snapshot["case_subquestions"]
    assert [item["id"] for item in case_subquestions] == expected_ids
    for item in case_subquestions:
        analysis = candidate["subquestion_analysis"][item["id"]]
        assert item["question"] == subquestions_by_id[item["id"]]["question"]
        assert item["project_context"] == analysis["project_context"]
        assert item["design_mechanism"] == analysis["design_mechanism"]
        assert item["transfer_strategy"] == analysis["transfer_strategy"]
        assert item["limitations"] == analysis["limitations"]
        if item["id"] == first_subquestion_id:
            assert item["evidence"]["source_url"] == candidate["source_url"]
            assert item["evidence"]["statement"] in {
                analysis["project_context"],
                analysis["design_mechanism"],
            }
            assert item["evidence"]["text_excerpt"]

    with client.app.state.database.session_factory() as session:
        saved_record = session.get(SavedReference, saved.json()["id"])
        assert saved_record is not None
        legacy_snapshot = dict(saved_record.snapshot)
        legacy_snapshot.pop("case_subquestions")
        legacy_snapshot.pop("case_images")
        saved_record.snapshot = legacy_snapshot
        session.commit()

    collections = client.get(f"/v1/workspaces/{workspace_id}/collections")
    assert collections.status_code == 200
    assert [item["id"] for item in collections.json()] == [saved.json()["id"]]
    assert collections.json()[0]["snapshot"]["case_subquestions"] == case_subquestions
    assert collections.json()[0]["snapshot"]["case_images"] == case_images
    with client.app.state.database.session_factory() as session:
        upgraded_record = session.get(SavedReference, saved.json()["id"])
        assert upgraded_record is not None
        assert upgraded_record.snapshot["case_subquestions"] == case_subquestions
        assert upgraded_record.snapshot["case_images"] == case_images
    content = client.get(f"/v1/collections/{saved.json()['id']}/content")
    assert content.status_code == 200
    assert content.content == image_bytes

    deleted = client.delete(f"/v1/collections/{saved.json()['id']}")

    assert deleted.status_code == 204
    assert client.get(f"/v1/workspaces/{workspace_id}/collections").json() == []
    assert not (data_dir / "collections" / snapshot["collection_file"]).exists()


def test_visual_collection_keeps_and_backfills_its_research_direction(
    client: TestClient, workspace_id: str
) -> None:
    with client.app.state.database.session_factory() as session:
        run = ResearchRun(
            workspace_id=workspace_id,
            question="旧厂房竞赛轴测图怎样比较线稿与拼贴表达？",
            goal="visual_reference_search",
            budget_mode="balanced",
            budget={},
            subquestions=[
                {
                    "id": "linework-style",
                    "question": "精细线稿轴测图",
                    "rationale": "比较线宽、虚实和留白。",
                }
            ],
            status="completed",
        )
        session.add(run)
        session.flush()
        asset = AssetCandidate(
            run_id=run.id,
            project_name="轴测表达参考",
            asset_type="axonometric",
            source_url="https://example.com/visual-note",
            image_url="https://example.com/visual-note.jpg",
            result_tier="visual_lead",
            relevance=3,
            subquestion_ids=["linework-style"],
        )
        session.add(asset)
        session.commit()
        asset_id = asset.id

    saved = client.post(f"/v1/results/{asset_id}/save", json={"note": ""})

    assert saved.status_code == 201
    snapshot = saved.json()["snapshot"]
    assert snapshot["question"] == "旧厂房竞赛轴测图怎样比较线稿与拼贴表达？"
    assert snapshot["visual_directions"] == ["精细线稿轴测图"]

    with client.app.state.database.session_factory() as session:
        saved_record = session.get(SavedReference, saved.json()["id"])
        assert saved_record is not None
        legacy_snapshot = dict(saved_record.snapshot)
        legacy_snapshot.pop("visual_directions")
        saved_record.snapshot = legacy_snapshot
        session.commit()

    collections = client.get(f"/v1/workspaces/{workspace_id}/collections")
    assert collections.status_code == 200
    assert collections.json()[0]["snapshot"]["visual_directions"] == ["精细线稿轴测图"]


def test_saved_case_subquestions_follow_explicit_selection_and_note_updates_preserve_it(
    client: TestClient, workspace_id: str
) -> None:
    run = _create_run(client, workspace_id)
    candidates = client.get(f"/v1/runs/{run['id']}/results").json()
    candidate = candidates[0]
    first_id = candidate["subquestion_ids"][0]
    second_id = next(item["id"] for item in run["subquestions"] if item["id"] != first_id)
    with client.app.state.database.session_factory() as session:
        asset = session.get(AssetCandidate, candidate["id"])
        assert asset is not None
        first_analysis = dict(asset.subquestion_analysis[first_id])
        asset.subquestion_ids = [first_id, second_id]
        asset.subquestion_analysis = {
            **asset.subquestion_analysis,
            second_id: {
                **first_analysis,
                "design_mechanism": "第二个子问题的独立空间机制。",
            },
        }
        session.commit()

    selected_one = client.post(
        f"/v1/results/{candidate['id']}/save",
        json={"note": "先收藏一个子问题", "subquestion_ids": [first_id]},
    )
    assert selected_one.status_code == 201
    assert [item["id"] for item in selected_one.json()["snapshot"]["case_subquestions"]] == [
        first_id
    ]

    note_only = client.post(
        f"/v1/results/{candidate['id']}/save",
        json={"note": "只更新备注"},
    )
    assert note_only.status_code == 201
    assert [item["id"] for item in note_only.json()["snapshot"]["case_subquestions"]] == [first_id]

    selected_two = client.post(
        f"/v1/results/{candidate['id']}/save",
        json={"note": "收藏两个子问题", "subquestion_ids": [first_id, second_id]},
    )
    assert selected_two.status_code == 201
    assert [item["id"] for item in selected_two.json()["snapshot"]["case_subquestions"]] == [
        first_id,
        second_id,
    ]

    invalid = client.post(
        f"/v1/results/{candidate['id']}/save",
        json={"note": "非法关联", "subquestion_ids": ["not-on-this-case"]},
    )
    assert invalid.status_code == 422


def test_user_state_upserts_notes_and_supports_idempotent_undo(
    client: TestClient, workspace_id: str
) -> None:
    run = _create_run(client, workspace_id)
    candidates = client.get(f"/v1/runs/{run['id']}/results").json()
    saved_candidate = candidates[0]
    rejected_candidate = candidates[1]

    created = client.post(
        f"/v1/results/{saved_candidate['id']}/save",
        json={"note": "初始备注"},
    )
    updated = client.post(
        f"/v1/results/{saved_candidate['id']}/save",
        json={"note": "刷新后仍需保留的备注"},
    )
    rejected = client.post(
        f"/v1/results/{rejected_candidate['id']}/reject",
        json={"reason": "尺度不适用"},
    )

    assert created.status_code == 201
    assert updated.status_code == 201
    assert updated.json()["id"] == created.json()["id"]
    assert updated.json()["note"] == "刷新后仍需保留的备注"
    assert rejected.status_code == 201
    assert client.get(f"/v1/runs/{run['id']}/user-state").json() == {
        "saved": [
            {
                "asset_candidate_id": saved_candidate["id"],
                "note": "刷新后仍需保留的备注",
            }
        ],
        "rejected": [
            {
                "asset_candidate_id": rejected_candidate["id"],
                "reason": "尺度不适用",
            }
        ],
    }

    for _ in range(2):
        assert client.delete(f"/v1/results/{saved_candidate['id']}/save").status_code == 204
        assert client.delete(f"/v1/results/{rejected_candidate['id']}/reject").status_code == 204

    assert client.get(f"/v1/runs/{run['id']}/user-state").json() == {
        "saved": [],
        "rejected": [],
    }


def test_asset_content_serves_only_existing_files_inside_the_run_storage_root(
    client: TestClient, workspace_id: str
) -> None:
    run = _create_run(client, workspace_id)
    candidates = client.get(f"/v1/runs/{run['id']}/results").json()
    data_dir = Path(client.app.state.settings.data_dir)
    candidate_dir = data_dir / "runs" / str(run["id"]) / "candidates"
    candidate_dir.mkdir(parents=True, exist_ok=True)
    image_bytes = b"\x89PNG\r\n\x1a\nlocal-candidate"
    valid_path = candidate_dir / "valid.png"
    valid_path.write_bytes(image_bytes)

    missing_path = candidate_dir / "missing.png"
    outside_path = data_dir / "private.png"
    outside_path.write_bytes(b"private")
    traversal_path = candidate_dir / ".." / ".." / ".." / outside_path.name
    paths = {
        candidates[0]["id"]: str(valid_path),
        candidates[1]["id"]: str(missing_path),
        candidates[2]["id"]: str(traversal_path),
        candidates[3]["id"]: "https://images.example/remote.png",
        candidates[4]["id"]: None,
    }
    database = client.app.state.database
    with database.session_factory() as session:
        for asset_id, storage_path in paths.items():
            asset = session.get(AssetCandidate, asset_id)
            assert asset is not None
            asset.storage_path = storage_path
        session.commit()

    response = client.get(f"/v1/assets/{candidates[0]['id']}/content")
    assert response.status_code == 200
    assert response.content == image_bytes
    assert response.headers["content-type"] == "image/png"

    legacy_export_response = client.get(f"/v1/results/{candidates[0]['id']}/content")
    assert legacy_export_response.status_code == 200
    assert legacy_export_response.content == image_bytes

    for candidate in candidates[1:5]:
        rejected_response = client.get(f"/v1/assets/{candidate['id']}/content")
        assert rejected_response.status_code == 404
        assert str(data_dir) not in rejected_response.text
