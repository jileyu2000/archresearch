from pathlib import Path

from fastapi.testclient import TestClient

from archresearch_api.models import AssetCandidate


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
    assert run["coverage_report"] == {
        "usable_assets": 6,
        "project_count": 3,
        "verified_or_partial": 6,
        "gaps": [],
    }

    fetched = client.get(f"/v1/runs/{run['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["checkpoint_stage"] == "composing"

    results = client.get(f"/v1/runs/{run['id']}/results")
    assert results.status_code == 200
    tiers = [item["result_tier"] for item in results.json()]
    assert tiers[:2] == ["verified", "verified"]
    assert len(results.json()) == 6
    assert all(item["evidence_claims"] for item in results.json())
    assert all(
        item["facts"] and item["observations"] and item["inferences"] and item["limitations"]
        for item in results.json()
    )


def test_workspace_runs_are_listed_newest_first(client: TestClient, workspace_id: str) -> None:
    first = _create_run(client, workspace_id, mode="quick")
    second = _create_run(client, workspace_id, mode="balanced")

    response = client.get(f"/v1/workspaces/{workspace_id}/runs")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [second["id"], first["id"]]


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
    assert len(client.get(f"/v1/runs/{run['id']}/results").json()) == 6


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

    for candidate in candidates[1:5]:
        rejected_response = client.get(f"/v1/assets/{candidate['id']}/content")
        assert rejected_response.status_code == 404
        assert str(data_dir) not in rejected_response.text
