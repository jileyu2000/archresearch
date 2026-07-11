from pathlib import Path
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from pydantic import ValidationError

from archresearch_api.providers import (
    MockResearchProvider,
    OpenAIResearchProvider,
    ProviderAsset,
    ProviderSearchResult,
    ProviderSource,
    TinEyeProvider,
)
from archresearch_api.schemas import ResearchGoal
from archresearch_api.visual import ArchitectureAssetType


@pytest.mark.parametrize(
    "unsafe_url",
    [
        "javascript:alert(1)",
        "file:///C:/secret.txt",
        "http://127.0.0.1/admin",
        "https://user:password@example.com/project",
    ],
)
def test_provider_results_reject_unsafe_source_and_image_urls(unsafe_url: str) -> None:
    with pytest.raises(ValueError):
        ProviderSource(url=unsafe_url)
    with pytest.raises(ValueError):
        ProviderAsset(
            project_name="unsafe",
            asset_type="plan",
            source_url="https://studio.example/project",
            image_url=unsafe_url,
        )


def test_mock_provider_is_deterministic() -> None:
    provider = MockResearchProvider()
    first = provider.search("旧建筑 剖面 更新", ResearchGoal.precedent_research)
    second = provider.search("旧建筑 剖面 更新", ResearchGoal.precedent_research)
    assert first == second
    assert len(first.assets) == 6


def test_live_openai_provider_requires_an_explicit_key() -> None:
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        OpenAIResearchProvider(api_key=None, model="gpt-5.5")


def test_provider_asset_reuses_the_strict_nine_type_visual_contract() -> None:
    asset = ProviderAsset(
        project_name="Factory",
        asset_type="section",
        source_url="https://studio.example/factory",
    )

    assert asset.asset_type is ArchitectureAssetType.section
    with pytest.raises(ValidationError):
        ProviderAsset(
            project_name="Factory",
            asset_type="a longitudinal section showing layered public space",
            source_url="https://studio.example/factory",
        )


def test_openai_provider_constructs_a_bounded_retry_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []
    client = SimpleNamespace(responses=SimpleNamespace())

    def factory(**kwargs: object) -> object:
        calls.append(kwargs)
        return client

    monkeypatch.setattr("openai.OpenAI", factory)

    provider = OpenAIResearchProvider(
        api_key="sk-test",
        model="gpt-5.5",
        base_url="https://relay.example/v1",
    )

    assert calls == [
        {
            "api_key": "sk-test",
            "base_url": "https://relay.example/v1",
            "timeout": 60.0,
            "max_retries": 1,
        }
    ]
    assert provider.worst_case_call_seconds == 120.0


def test_openai_provider_uses_relay_compatible_web_search_and_domain_fields() -> None:
    calls: list[dict[str, Any]] = []

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=ProviderSearchResult(assets=[], sources=[]))

    fake_client = SimpleNamespace(responses=FakeResponses())
    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=fake_client,
    )

    result = provider.search(
        "adaptive reuse section",
        ResearchGoal.precedent_research,
        allowed_domains=["archdaily.com"],
    )

    assert result.assets == []
    request = calls[0]
    assert request["model"] == "gpt-5.5"
    assert request["include"] == ["web_search_call.results"]
    assert request["tool_choice"] == "required"
    assert request["reasoning"] == {"effort": "low"}
    assert request["max_output_tokens"] == 2_400
    assert request["tools"] == [
        {
            "type": "web_search",
            "search_context_size": "low",
            "filters": {"allowed_domains": ["archdaily.com"]},
        }
    ]
    assert "at most 4" in request["input"]
    assert request["text_format"] is ProviderSearchResult


def test_openai_provider_rejects_a_missing_structured_result() -> None:
    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            del kwargs
            return SimpleNamespace(output_parsed=None)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    with pytest.raises(ValueError, match="structured result"):
        provider.search("adaptive reuse section", ResearchGoal.precedent_research)


def test_openai_search_never_self_certifies_provenance_or_image_rights() -> None:
    claimed = ProviderSearchResult(
        assets=[
            ProviderAsset(
                project_name="Factory",
                asset_type="section",
                source_url="https://studio.example/factory",
                image_url="https://studio.example/factory-section.jpg",
                publication_tier="primary",
                project_identity="confirmed",
                asset_association="confirmed",
                primary_source="confirmed",
                rights_status="open_license",
                result_tier="verified",
                relevance=4,
                facts=["The page identifies this as the Factory section."],
            )
        ]
    )

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            del kwargs
            return SimpleNamespace(output_parsed=claimed)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    result = provider.search("factory section", ResearchGoal.precedent_research)

    asset = result.assets[0]
    assert asset.project_identity == "probable"
    assert asset.asset_association == "probable"
    assert asset.primary_source == "candidate"
    assert asset.rights_status == "unknown"
    assert asset.result_tier == "partial"


def test_tineye_provider_maps_matches_without_live_requests() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["x-api-key"] == "test-key"
        assert request.url.path == "/rest/search/"
        assert request.url.params["url"] == "https://images.example/section.jpg"
        assert request.url.params["sort"] == "score"
        return httpx.Response(
            200,
            json={
                "results": {
                    "matches": [
                        {
                            "image_url": "https://studio.example/original.jpg",
                            "domain": "studio.example",
                            "score": 91.5,
                            "tags": ["stock"],
                            "backlinks": [
                                {
                                    "backlink": "https://studio.example/project",
                                    "url": "https://studio.example/original.jpg",
                                    "crawl_date": "2026-06-01",
                                }
                            ],
                        }
                    ]
                }
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = TinEyeProvider(
        api_key="test-key", base_url="https://api.tineye.com/rest/", client=client
    )

    matches = provider.search_url("https://images.example/section.jpg")

    assert matches[0].domain == "studio.example"
    assert matches[0].score == 91.5
    assert matches[0].backlinks[0].page_url == "https://studio.example/project"


def test_tineye_provider_posts_a_local_image_without_exposing_the_path(
    tmp_path: Path,
) -> None:
    image_path = tmp_path / "uploaded-section.png"
    image_path.write_bytes(b"\x89PNG\r\n\x1a\nfixture")

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.read()
        assert request.method == "POST"
        assert request.url.path == "/rest/search/"
        assert request.headers["x-api-key"] == "test-key"
        assert request.url.params["sort"] == "score"
        assert b'name="image"; filename="uploaded-section.png"' in body
        assert str(tmp_path).encode() not in body
        return httpx.Response(200, json={"results": {"matches": []}})

    provider = TinEyeProvider(
        api_key="test-key",
        base_url="https://api.tineye.com/rest/",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert provider.search_file(image_path) == []
