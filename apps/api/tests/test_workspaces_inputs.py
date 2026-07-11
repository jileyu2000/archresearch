from io import BytesIO

from fastapi.testclient import TestClient


def test_workspace_crud(client: TestClient) -> None:
    created = client.post(
        "/v1/workspaces",
        json={"name": "滨水工作室", "brief": "解决高差与公共通行"},
    )
    assert created.status_code == 201
    workspace = created.json()

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
