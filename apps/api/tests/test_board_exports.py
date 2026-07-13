import json
from pathlib import Path

from fastapi.testclient import TestClient


def _run_with_results(client: TestClient, workspace_id: str) -> tuple[str, list[dict[str, object]]]:
    run = client.post(
        f"/v1/workspaces/{workspace_id}/runs",
        json={
            "question": "寻找人车分流分析图与清晰平面",
            "goal": "visual_reference_search",
            "budget_mode": "balanced",
        },
    ).json()
    results = client.get(f"/v1/runs/{run['id']}/results").json()
    return str(run["id"]), list(results)


def test_board_patch_allows_zero_through_six_draft_items(
    client: TestClient, workspace_id: str
) -> None:
    run_id, results = _run_with_results(client, workspace_id)
    initial = client.get(f"/v1/runs/{run_id}/board")
    assert initial.status_code == 200

    empty = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": []},
    )
    assert empty.status_code == 200

    one = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": [results[0]["id"]]},
    )
    assert one.status_code == 200

    six = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": [result["id"] for result in results[:6]], "layout": "grid"},
    )
    assert six.status_code == 200
    assert len(six.json()["selected_asset_ids"]) == 6

    seven = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": [result["id"] for result in results[:6]] + ["extra"]},
    )
    assert seven.status_code == 422


def test_share_export_embeds_only_assets_with_allowed_rights(
    client: TestClient, workspace_id: str
) -> None:
    run_id, results = _run_with_results(client, workspace_id)
    board = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": [result["id"] for result in results[:6]]},
    ).json()

    response = client.post(f"/v1/boards/{board['id']}/exports", json={"mode": "share"})
    assert response.status_code == 201
    export = response.json()
    manifest_path = Path(export["path"])
    assert manifest_path.exists()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["mode"] == "share"
    assert all(
        item["embed_full_image"]
        == (item["rights_status"] in {"user_owned", "open_license", "permissioned"})
        for item in manifest["items"]
    )
    assert all(item["source_url"] for item in manifest["items"])


def test_style_profile_can_be_created_read_and_patched(
    client: TestClient, workspace_id: str
) -> None:
    run_id, _ = _run_with_results(client, workspace_id)
    board = client.get(f"/v1/runs/{run_id}/board").json()
    created = client.post(
        f"/v1/boards/{board['id']}/style-profile",
        json={
            "palette": ["#171B19", "#315CF4"],
            "line_weights": {"primary": 1.0, "secondary": 0.35},
            "texture": "vellum",
            "font_category": "sans",
            "layout_notes": "证据栏固定在图纸右侧",
        },
    )
    assert created.status_code == 201

    fetched = client.get(f"/v1/boards/{board['id']}/style-profile")
    assert fetched.status_code == 200
    assert fetched.json()["palette"] == ["#171B19", "#315CF4"]

    patched = client.patch(
        f"/v1/boards/{board['id']}/style-profile",
        json={"texture": "none"},
    )
    assert patched.status_code == 200
    assert patched.json()["texture"] == "none"
