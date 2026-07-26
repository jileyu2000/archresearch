import json
from pathlib import Path
from urllib.parse import urlparse

from fastapi.testclient import TestClient
from sqlalchemy import select

from archresearch_api.models import AssetCandidate


def _run_with_results(
    client: TestClient,
    workspace_id: str,
    *,
    goal: str = "visual_reference_search",
) -> tuple[str, list[dict[str, object]]]:
    run = client.post(
        f"/v1/workspaces/{workspace_id}/runs",
        json={
            "question": "寻找人车分流分析图与清晰平面",
            "goal": goal,
            "budget_mode": "balanced",
            "research_sources": [],
        },
    ).json()
    results = client.get(f"/v1/runs/{run['id']}/results").json()
    return str(run["id"]), list(results)


def _ids_from_distinct_projects(
    results: list[dict[str, object]],
    count: int = 2,
) -> list[str]:
    selected: list[str] = []
    projects: set[str] = set()
    for result in results:
        project_name = str(result["project_name"])
        if project_name in projects:
            continue
        projects.add(project_name)
        selected.append(str(result["id"]))
        if len(selected) == count:
            break
    assert len(selected) == count
    return selected


def test_architectural_case_export_has_strategy_and_evidence_sections(
    client: TestClient, workspace_id: str
) -> None:
    run_id, results = _run_with_results(
        client,
        workspace_id,
        goal="precedent_research",
    )
    board = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": _ids_from_distinct_projects(results)},
    ).json()

    export = client.post(f"/v1/boards/{board['id']}/exports", json={"mode": "private"}).json()
    manifest = json.loads(Path(export["manifest_path"]).read_text(encoding="utf-8"))
    html = Path(export["path"]).read_text(encoding="utf-8")

    assert manifest["artifact_kind"] == "case_strategy_matrix"
    assert "案例策略矩阵" in html
    assert "跨案例策略矩阵" in html
    assert "设计问题" in html
    assert "可迁移动作" in html
    assert "适用边界" in html
    assert "证据来源" in html
    assert "设计动作清单" in html
    assert "<img" not in html
    assert "帖子组" not in html
    assert "视觉表达" not in html


def test_private_strategy_matrix_requires_two_distinct_projects(
    client: TestClient, workspace_id: str
) -> None:
    run_id, results = _run_with_results(
        client,
        workspace_id,
        goal="precedent_research",
    )
    project_name = results[0]["project_name"]
    same_project_ids = [
        result["id"] for result in results if result["project_name"] == project_name
    ][:2]
    board = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": same_project_ids},
    ).json()

    response = client.post(f"/v1/boards/{board['id']}/exports", json={"mode": "private"})

    assert response.status_code == 422
    assert response.json()["detail"] == "策略矩阵至少需要两个不同案例"


def test_visual_inspiration_export_groups_posts_and_avoids_case_analysis(
    client: TestClient, workspace_id: str
) -> None:
    run_id, results = _run_with_results(client, workspace_id)
    board = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": [result["id"] for result in results[:4]]},
    ).json()

    export = client.post(f"/v1/boards/{board['id']}/exports", json={"mode": "private"}).json()
    manifest = json.loads(Path(export["manifest_path"]).read_text(encoding="utf-8"))
    html = Path(export["path"]).read_text(encoding="utf-8")

    assert manifest["artifact_kind"] == "visual_inspiration_board"
    assert "图纸灵感板" in html
    assert "帖子组" in html
    assert "视觉表达" in html
    assert "项目条件" not in html
    assert "设计机制" not in html
    assert "适用边界" not in html


def test_visual_inspiration_export_carries_saved_expression_spec(
    client: TestClient, workspace_id: str
) -> None:
    run_id, results = _run_with_results(client, workspace_id)
    board = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": [results[0]["id"]]},
    ).json()
    profile = client.post(
        f"/v1/boards/{board['id']}/style-profile",
        json={
            "palette": ["#2D846B", "#171B19"],
            "line_weights": {"primary": 1.2, "secondary": 0.25},
            "texture": "vellum",
            "font_category": "serif",
            "layout_notes": "证据栏保持在图纸侧边",
        },
    )
    assert profile.status_code == 201

    export = client.post(f"/v1/boards/{board['id']}/exports", json={"mode": "private"}).json()
    manifest = json.loads(Path(export["manifest_path"]).read_text(encoding="utf-8"))
    html = Path(export["path"]).read_text(encoding="utf-8")

    assert manifest["style_profile"]["texture"] == "vellum"
    assert "表达规范" in html
    assert "#2D846B" in html
    assert "证据栏保持在图纸侧边" in html


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
    html_path = Path(export["path"])
    manifest_path = Path(export["manifest_path"])
    assert html_path.suffix == ".html"
    assert html_path.exists()
    assert manifest_path.exists()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    html = html_path.read_text(encoding="utf-8")
    asset_labels = {
        "plan": "平面图",
        "section": "剖面图",
        "elevation": "立面图",
        "site_plan": "总平面图",
        "axonometric": "轴测图",
        "circulation": "流线图",
        "analysis_diagram": "分析图",
        "render": "效果图",
        "photograph": "项目照片",
    }
    rights_labels = {
        "user_owned": "用户自有",
        "open_license": "开放许可",
        "permissioned": "已获授权",
        "unknown": "权利未知",
        "restricted": "受限",
    }
    assert manifest["mode"] == "share"
    assert all(
        item["embed_full_image"]
        == (item["rights_status"] in {"user_owned", "open_license", "permissioned"})
        for item in manifest["items"]
    )
    assert all(item["source_url"] for item in manifest["items"])
    for item in manifest["items"]:
        image_url = item["image_url"]
        if item["embed_full_image"] and image_url:
            assert image_url in html
        elif image_url:
            assert image_url not in html
        assert item["source_url"] in html
        assert asset_labels[item["asset_type"]] in html
        assert f"权利状态：{rights_labels[item['rights_status']]}" in html

    browser_response = client.get(urlparse(export["browser_url"]).path)
    assert browser_response.status_code == 200
    assert browser_response.headers["content-type"].startswith("text/html")
    assert "default-src 'none'" in browser_response.headers["content-security-policy"]
    assert browser_response.text.replace("\r\n", "\n") == html


def test_private_export_renders_every_selected_image_and_a_separate_source_manifest(
    client: TestClient, workspace_id: str
) -> None:
    run_id, results = _run_with_results(client, workspace_id)
    selected = results[:6]
    board = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": [result["id"] for result in selected]},
    ).json()

    export = client.post(f"/v1/boards/{board['id']}/exports", json={"mode": "private"}).json()

    html = Path(export["path"]).read_text(encoding="utf-8")
    manifest = json.loads(Path(export["manifest_path"]).read_text(encoding="utf-8"))
    assert all(item["embed_full_image"] for item in manifest["items"])
    assert all(result["image_url"] in html for result in selected)
    assert "/v1/results/" not in html
    assert all(
        item["image_url"] is not None or f"/v1/assets/{item['asset_id']}/content" in html
        for item in manifest["items"]
    )
    assert export["path"] != export["manifest_path"]


def test_export_html_escapes_untrusted_copy_and_omits_non_http_urls(
    client: TestClient, workspace_id: str
) -> None:
    run_id, results = _run_with_results(client, workspace_id)
    asset_id = str(results[0]["id"])
    with client.app.state.database.session_factory() as session:
        asset = session.scalar(select(AssetCandidate).where(AssetCandidate.id == asset_id))
        assert asset is not None
        asset.project_name = '<script>alert("project")</script>'
        asset.source_url = "javascript:alert('source')"
        asset.image_url = 'https://images.example/plan.png?label="><img src=x onerror=alert(1)>'
        session.commit()
    board = client.patch(
        f"/v1/runs/{run_id}/board",
        json={"selected_asset_ids": [asset_id]},
    ).json()

    export = client.post(f"/v1/boards/{board['id']}/exports", json={"mode": "private"}).json()
    html = Path(export["path"]).read_text(encoding="utf-8")

    assert '<script>alert("project")</script>' not in html
    assert "&lt;script&gt;alert(&quot;project&quot;)&lt;/script&gt;" in html
    assert "javascript:alert" not in html
    assert "<img src=x onerror=alert(1)>" not in html
    assert "&gt;&lt;img src=x onerror=alert(1)&gt;" in html


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
