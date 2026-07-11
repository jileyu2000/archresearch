from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from archresearch_api.config import Settings
from archresearch_api.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        data_dir=tmp_path / "data",
        provider_mode="mock",
        run_inline=True,
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def workspace_id(client: TestClient) -> str:
    response = client.post(
        "/v1/workspaces",
        json={
            "name": "旧厂房更新",
            "brief": "在保留结构中植入展览与社区功能",
            "constraints": ["保留主桁架", "首层人车分流"],
        },
    )
    assert response.status_code == 201
    return str(response.json()["id"])
