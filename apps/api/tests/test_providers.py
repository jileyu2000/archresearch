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
from archresearch_api.schemas import BudgetMode, ResearchGoal, ResearchPlan
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
    assert len(first.assets) == 12
    plan = provider.plan(
        "旧建筑中如何植入新功能？",
        ResearchGoal.precedent_research,
        BudgetMode.balanced,
        "保留主结构",
    )
    assert isinstance(plan, ResearchPlan)
    assert len(plan.subquestions) == 4
    assert all(asset.project_context for asset in first.assets)
    assert all(asset.design_mechanism for asset in first.assets)
    assert all(len(asset.transfer_strategy) >= 2 for asset in first.assets)


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


def test_openai_provider_plans_bounded_subquestions_before_searching() -> None:
    calls: list[dict[str, Any]] = []

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(
                output_parsed={
                    "subquestions": [
                        {"id": "structure", "question": "保留什么？", "rationale": "识别结构边界"},
                        {"id": "program", "question": "植入什么？", "rationale": "明确功能关系"},
                        {"id": "circulation", "question": "怎样分流？", "rationale": "检查冲突"},
                        {
                            "id": "section",
                            "question": "怎样形成层次？",
                            "rationale": "检查竖向空间",
                        },
                    ]
                }
            )

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    plan = provider.plan(
        "旧建筑如何植入新功能？",
        ResearchGoal.precedent_research,
        BudgetMode.balanced,
        "保留主桁架",
    )

    assert len(plan.subquestions) == 4
    request = calls[0]
    assert request["model"] == "gpt-5.5"
    assert request["reasoning"] == {"effort": "low"}
    assert request["max_output_tokens"] == 1_200
    assert request["text_format"] is ResearchPlan
    assert "exactly 4" in request["input"]
    assert "untrusted" in request["input"].lower()


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


def test_openai_search_caps_assets_and_keeps_only_sources_for_retained_assets() -> None:
    assets = [
        ProviderAsset(
            project_name=f"Project {index}",
            asset_type="plan",
            source_url=f"https://studio.example/project-{index}",
        )
        for index in range(1, 7)
    ]
    claimed = ProviderSearchResult(
        assets=assets,
        sources=[
            ProviderSource(url="https://publisher.example/unrelated"),
            *[ProviderSource(url=asset.source_url, title=asset.project_name) for asset in assets],
        ],
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

    result = provider.search("adaptive reuse plans", ResearchGoal.precedent_research)

    assert [asset.project_name for asset in result.assets] == [
        "Project 1",
        "Project 2",
        "Project 3",
        "Project 4",
    ]
    retained_urls = {asset.source_url for asset in result.assets}
    assert len(result.sources) == 4
    assert all(source.url in retained_urls for source in result.sources)


def test_openai_search_clears_project_context_without_an_exact_fact_match() -> None:
    claimed = ProviderSearchResult(
        assets=[
            ProviderAsset(
                project_name="Supported",
                asset_type="section",
                source_url="https://studio.example/supported",
                project_context="  The hall retains its original steel frame.  ",
                facts=["The hall retains its original steel frame."],
            ),
            ProviderAsset(
                project_name="Unsupported",
                asset_type="plan",
                source_url="https://studio.example/unsupported",
                project_context="The warehouse was built in 1912.",
                facts=["The project page describes an early twentieth-century warehouse."],
            ),
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

    result = provider.search("warehouse reuse", ResearchGoal.precedent_research)

    assert result.assets[0].project_context.strip() == (
        "The hall retains its original steel frame."
    )
    assert result.assets[1].project_context == ""


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
