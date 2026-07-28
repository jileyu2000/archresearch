from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from threading import Barrier

from fastapi.testclient import TestClient

from archresearch_api.models import ResearchRun


def test_workspace_crud(client: TestClient) -> None:
    created = client.post(
        "/v1/workspaces",
        json={"name": "滨水工作室", "brief": "解决高差与公共通行"},
    )
    assert created.status_code == 201
    workspace = created.json()
    assert workspace["archived_at"] is None

    listed = client.get("/v1/workspaces")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [workspace["id"]]

    updated = client.patch(
        f"/v1/workspaces/{workspace['id']}",
        json={"name": "滨水工作室 A", "constraints": ["保留公众岸线"]},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "滨水工作室 A"
    assert updated.json()["constraints"] == ["保留公众岸线"]

    assert client.delete(f"/v1/workspaces/{workspace['id']}").status_code == 204
    assert client.get(f"/v1/workspaces/{workspace['id']}").status_code == 404


def test_ensure_default_workspace_is_idempotent_under_concurrent_first_load(
    client: TestClient,
) -> None:
    barrier = Barrier(2)

    def ensure_default() -> object:
        barrier.wait()
        return client.post("/v1/workspaces/default")

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: ensure_default(), range(2)))

    assert [response.status_code for response in responses] == [200, 200]
    assert len({response.json()["id"] for response in responses}) == 1
    assert responses[0].json()["name"] == "建筑研究工作区"
    assert len(client.get("/v1/workspaces").json()) == 1

    first_duplicate = client.post("/v1/workspaces", json={"name": "同名项目"})
    second_duplicate = client.post("/v1/workspaces", json={"name": "同名项目"})
    assert first_duplicate.status_code == 201
    assert second_duplicate.status_code == 201
    assert first_duplicate.json()["id"] != second_duplicate.json()["id"]


def test_history_record_name_is_derived_from_question_content(
    client: TestClient, workspace_id: str
) -> None:
    question = "我想问的问题是：耕织图是一份图案画作，建筑是立体的三维的，该如何转译提取元素呢。"
    with client.app.state.database.session_factory() as session:
        session.add(
            ResearchRun(
                workspace_id=workspace_id,
                question=question,
                goal="precedent_research",
                budget_mode="balanced",
                budget={},
                status="completed",
            )
        )
        session.commit()

    response = client.get(f"/v1/workspaces/{workspace_id}/runs")

    assert response.status_code == 200
    assert response.json()[0]["title"] == "耕织图：转译提取元素"
    assert response.json()[0]["question"] == question


def test_add_url_and_upload_pdf_with_page_metadata(client: TestClient, workspace_id: str) -> None:
    url_response = client.post(
        f"/v1/workspaces/{workspace_id}/inputs",
        json={"url": "https://example.com/project/warehouse"},
    )
    assert url_response.status_code == 201
    assert url_response.json()["kind"] == "url"

    # A minimal valid one-page PDF is enough to exercise local page extraction.
    pdf = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n"
        b"trailer<</Root 1 0 R>>\n%%EOF"
    )
    upload = client.post(
        f"/v1/workspaces/{workspace_id}/inputs",
        files={"file": ("brief.pdf", BytesIO(pdf), "application/pdf")},
    )
    assert upload.status_code == 201
    body = upload.json()
    assert body["kind"] == "pdf"
    assert body["filename"] == "brief.pdf"
    assert body["sha256"]
    assert body["storage_path"]


def test_upload_rejects_unsupported_files(client: TestClient, workspace_id: str) -> None:
    response = client.post(
        f"/v1/workspaces/{workspace_id}/inputs",
        files={"file": ("notes.txt", b"not an accepted artifact", "text/plain")},
    )
    assert response.status_code == 415


def test_delete_input_removes_its_local_file(client: TestClient, workspace_id: str) -> None:
    uploaded = client.post(
        f"/v1/workspaces/{workspace_id}/inputs",
        files={"file": ("section.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    ).json()
    response = client.delete(f"/v1/workspaces/{workspace_id}/inputs/{uploaded['id']}")
    assert response.status_code == 204
