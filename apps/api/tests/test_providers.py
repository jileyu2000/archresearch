import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import ValidationError

from archresearch_api.providers import (
    CandidateAssessment,
    CandidateReranking,
    LocalSearchCandidate,
    MockResearchProvider,
    OpenAIResearchProvider,
    ProviderAsset,
    ProviderSearchResult,
    ProviderSource,
    PublicPageAnalysis,
    PublicPageDrawing,
    PublicPageSupportedFact,
    ResearchSynthesis,
    ResearchSynthesisBranchAnalysis,
    ResearchSynthesisCase,
    ResearchSynthesisFinding,
    SearchQuery,
    SearchQueryPlan,
    _focused_public_page_text,
    deterministic_public_page_analysis,
)
from archresearch_api.schemas import (
    DEPTH_TARGETS,
    BudgetMode,
    PublicationTier,
    ResearchGoal,
    ResearchPlan,
    ResearchSubquestion,
)
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


def test_mock_provider_reviews_the_real_gengzhi_tu_brief_fixture() -> None:
    fixture_path = (
        Path(__file__).parents[3] / "fixtures" / "evaluation" / "project_brief_cases.json"
    )
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))[0]

    plan = MockResearchProvider().plan(
        fixture["question"],
        ResearchGoal.precedent_research,
        BudgetMode.balanced,
        fixture["brief_excerpt"],
    )

    assert fixture["project"] in plan.project_summary
    boundary_text = " ".join(plan.project_boundaries)
    assert all(term in boundary_text for term in fixture["expected_boundary_terms"])
    question_text = " ".join(item.question for item in plan.subquestions)
    assert all(term in question_text for term in fixture["expected_question_terms"])
    assert len(plan.subquestions) == 4


def test_mock_visual_plan_expands_a_broad_request_into_style_directions() -> None:
    plan = MockResearchProvider().plan(
        "帮我找几种剖面图风格",
        ResearchGoal.visual_reference_search,
        BudgetMode.quick,
        "",
    )

    assert [item.id for item in plan.subquestions] == [
        "linework_style",
        "collage_style",
        "rendered_style",
    ]
    assert all("剖面图" in item.question for item in plan.subquestions)
    assert all("？" not in item.question for item in plan.subquestions)
    assert len({item.question for item in plan.subquestions}) == 3


def test_mock_visual_plan_keeps_a_requested_drawing_type_across_all_styles() -> None:
    plan = MockResearchProvider().plan(
        "我想出一个轴测图，帮我找风格",
        ResearchGoal.visual_reference_search,
        BudgetMode.quick,
        "",
    )

    assert all("轴测图" in item.question for item in plan.subquestions)
    assert all(
        drawing_type not in item.question
        for item in plan.subquestions
        for drawing_type in ("平面图", "剖面图", "分析图", "效果图", "爆炸图")
    )
    assert len({item.question for item in plan.subquestions}) == 3


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
            "timeout": 45.0,
            "max_retries": 0,
        }
    ]
    assert provider.worst_case_call_seconds == 45.0
    assert provider.worst_case_page_analysis_seconds == 90.0
    assert [provider.synthesis_worst_case_seconds(mode) for mode in BudgetMode] == [
        90.0,
        120.0,
        180.0,
    ]


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
    assert request["reasoning"] == {"effort": "medium"}
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


def test_openai_provider_plans_local_browser_queries_without_web_search_tools() -> None:
    calls: list[dict[str, Any]] = []
    expected = SearchQueryPlan(
        queries=[
            SearchQuery(
                query=("community library atrium stepped reading circulation floor plan section"),
                language="en",
            ),
            SearchQuery(
                query="社区图书馆 中庭 阶梯阅读 环形流线 平面图 剖面图 项目说明",
                language="zh",
            ),
        ]
    )

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=expected)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    result = provider.plan_search_queries(
        question="社区图书馆如何组织中庭和阶梯阅读空间？",
        subquestion=ResearchSubquestion(
            id="atrium",
            question="中庭如何串联阶梯阅读与环形流线？",
            rationale="需要平剖面证据。",
        ),
        round_number=1,
        preferred_language="en",
        research_context="new-build community library",
        previous_queries=[],
        excluded_sources=[],
        failure_reasons=[],
        query_limit=2,
    )

    assert result == expected
    request = calls[0]
    assert "tools" not in request
    assert "tool_choice" not in request
    assert "include" not in request
    assert request["text_format"] is SearchQueryPlan
    assert request["max_output_tokens"] == 800
    assert "building type" in request["input"]
    assert "project condition" in request["input"]
    assert "evidence type" in request["input"]
    assert "at most 2" in request["input"]
    assert "at most one explicitly named project" in request["input"]


def test_openai_recovery_query_planning_rotates_equivalent_extension_terms() -> None:
    calls: list[dict[str, Any]] = []
    expected = SearchQueryPlan(
        queries=[
            SearchQuery(
                query=(
                    "community cultural center new wing public stair bridge circulation axonometric"
                ),
                language="en",
            )
        ]
    )

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=expected)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    result = provider.plan_search_queries(
        question="社区文化中心扩建如何通过公共楼梯与连桥连接原有建筑？",
        subquestion=ResearchSubquestion(
            id="circulation",
            question="公共楼梯与连桥如何形成连续公共流线？",
            rationale="需要轴测图证据。",
        ),
        round_number=3,
        preferred_language="en",
        research_context="community cultural center extension",
        previous_queries=[
            "community cultural center extension public stair bridge circulation floor plan"
        ],
        excluded_sources=["https://www.designboom.com/architecture/unrelated-center"],
        failure_reasons=["uncovered_subquestions", "article_analysis_incomplete"],
        query_limit=1,
    )

    assert result == expected
    prompt = calls[0]["input"]
    assert "extension, expansion, addition to an existing building, or new wing" in prompt
    assert "same project condition" in prompt
    assert "adaptive reuse" in prompt
    assert "does not appear" in prompt


def test_openai_public_query_planning_removes_xhs_source_terms_from_context() -> None:
    planned = SearchQueryPlan(
        queries=[
            SearchQuery(
                query=(
                    "社区文化中心扩建 新旧结构界面 公共楼梯 连桥 平面图 剖面图 "
                    "轴测图 项目说明 登录态小红书图纸来源"
                ),
                language="zh",
            )
        ]
    )
    calls: list[dict[str, Any]] = []

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=planned)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    result = provider.plan_search_queries(
        question="社区文化中心扩建如何连接原有建筑？",
        subquestion=ResearchSubquestion(
            id="interface",
            question="新旧结构界面如何连接公共楼梯与连桥？",
            rationale="需要平面、剖面和轴测证据。",
        ),
        round_number=5,
        preferred_language="zh",
        research_context="图纸研究保持登录态小红书来源",
        previous_queries=[],
        excluded_sources=[],
        failure_reasons=["uncovered_subquestions"],
        query_limit=1,
    )

    query = result.queries[0].query
    assert "小红书" not in query
    assert "登录态" not in query
    assert "xhs" not in query.casefold()
    for required in ("社区文化中心", "扩建", "新旧结构界面", "平面图", "剖面图", "轴测图"):
        assert required in query
    assert "Xiaohongshu" in calls[0]["input"]
    assert "public web query" in calls[0]["input"]


def test_openai_local_search_assistance_retries_transient_errors_within_one_call_budget() -> None:
    calls: list[dict[str, Any]] = []
    attempts: dict[type[object], int] = {}
    query_plan = SearchQueryPlan(
        queries=[
            SearchQuery(
                query="Daegu Gosan Park Library public library circulation section",
                language="en",
            )
        ]
    )
    reranking = CandidateReranking(
        assessments=[
            CandidateAssessment(
                candidate_id="candidate-daegu",
                relevance=4,
                typology_match=4,
                drawing_availability=3,
                source_trust=4,
                retain=True,
            )
        ]
    )

    class APIConnectionError(Exception):
        pass

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            text_format = kwargs["text_format"]
            attempts[text_format] = attempts.get(text_format, 0) + 1
            if attempts[text_format] == 1:
                raise APIConnectionError("relay connection reset")
            output = query_plan if text_format is SearchQueryPlan else reranking
            return SimpleNamespace(output_parsed=output)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    subquestion = ResearchSubquestion(
        id="circulation",
        question="公共楼梯如何连接主要阅览层？",
        rationale="需要剖面证据。",
    )

    planned = provider.plan_search_queries(
        question="比较 Daegu Gosan Park Library 的公共流线。",
        subquestion=subquestion,
        round_number=1,
        preferred_language="en",
        research_context="new public library",
        previous_queries=[],
        excluded_sources=[],
        failure_reasons=[],
        query_limit=1,
    )
    ranked = provider.rerank_search_candidates(
        question="比较 Daegu Gosan Park Library 的公共流线。",
        subquestion=subquestion,
        search_queries=[query_plan.queries[0].query],
        candidates=[
            LocalSearchCandidate(
                candidate_id="candidate-daegu",
                url="https://www.designboom.com/architecture/daegu-gosan-park-library",
                title="Daegu Gosan Park Library",
            )
        ],
    )

    assert planned == query_plan
    assert ranked == reranking
    assert len(calls) == 4
    assert all(0 < call["timeout"] <= 45.0 for call in calls)
    assert provider.worst_case_call_seconds == 45.0


@pytest.mark.parametrize(
    ("error_type_name", "expected_calls"),
    [("APIConnectionError", 2), ("ValueError", 1)],
)
def test_openai_local_search_assistance_retry_count_stays_bounded(
    error_type_name: str,
    expected_calls: int,
) -> None:
    calls: list[dict[str, Any]] = []
    error_type = type(error_type_name, (Exception,), {})

    class FailingResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            raise error_type("provider call failed")

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FailingResponses()),
    )

    with pytest.raises(error_type):
        provider.plan_search_queries(
            question="社区图书馆如何组织公共楼梯？",
            subquestion=ResearchSubquestion(
                id="circulation",
                question="公共楼梯如何连接主要阅览层？",
                rationale="需要剖面证据。",
            ),
            round_number=1,
            preferred_language="en",
            research_context="new public library",
            previous_queries=[],
            excluded_sources=[],
            failure_reasons=[],
            query_limit=1,
        )

    assert len(calls) == expected_calls
    assert all(0 < call["timeout"] <= 45.0 for call in calls)


def test_openai_query_planning_splits_multiple_named_projects_into_one_project_anchor() -> None:
    planned = SearchQueryPlan(
        queries=[
            SearchQuery(
                query=(
                    "Calgary New Central Library Daegu Gosan Park Library Hunters Point "
                    "Community Library new-build public library atrium circulation floor plan"
                ),
                language="en",
            )
        ]
    )

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            del kwargs
            return SimpleNamespace(output_parsed=planned)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    result = provider.plan_search_queries(
        question=(
            "比较 Calgary New Central Library、Daegu Gosan Park Library 和 Hunters Point "
            "Community Library 的中庭与流线。"
        ),
        subquestion=ResearchSubquestion(
            id="visible_circulation",
            question="三个案例如何组织可见的跨层流线？",
            rationale="核对平面和剖面。",
        ),
        round_number=1,
        preferred_language="en",
        research_context="new-build public library",
        previous_queries=[],
        excluded_sources=[],
        failure_reasons=[],
        query_limit=1,
    )

    query = result.queries[0].query
    named_projects = (
        "Calgary New Central Library",
        "Daegu Gosan Park Library",
        "Hunters Point Community Library",
    )
    assert sum(project in query for project in named_projects) == 1
    assert "new-build public library" in query
    assert "atrium circulation floor plan" in query


def test_openai_candidate_reranking_rejects_ids_outside_local_search_candidates() -> None:
    calls: list[dict[str, Any]] = []
    invalid = CandidateReranking(
        assessments=[
            CandidateAssessment(
                candidate_id="candidate-invented",
                relevance=4,
                typology_match=4,
                drawing_availability=4,
                source_trust=4,
                retain=True,
            )
        ]
    )

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=invalid)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    candidates = [
        LocalSearchCandidate(
            candidate_id="candidate-local",
            url="https://www.archdaily.com/123/community-library",
            title="Community Library / Studio",
            description="Atrium, stepped reading and section drawings.",
            publication_tier=PublicationTier.trusted_secondary,
        )
    ]

    with pytest.raises(ValueError, match="outside local search candidates"):
        provider.rerank_search_candidates(
            question="社区图书馆如何组织中庭？",
            subquestion=ResearchSubquestion(
                id="atrium",
                question="中庭如何串联阶梯阅读？",
                rationale="需要项目证据。",
            ),
            search_queries=["community library atrium floor plan section"],
            candidates=candidates,
        )

    assert "tools" not in calls[0]
    assert calls[0]["text_format"] is CandidateReranking


def test_openai_candidate_reranking_keeps_exact_typology_pages_readable_without_a_summary() -> None:
    calls: list[dict[str, Any]] = []
    expected = CandidateReranking(
        assessments=[
            CandidateAssessment(
                candidate_id="candidate-library",
                relevance=2,
                typology_match=4,
                drawing_availability=1,
                source_trust=4,
                retain=True,
            )
        ]
    )

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=expected)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    result = provider.rerank_search_candidates(
        question="新建社区图书馆如何组织中庭？",
        subquestion=ResearchSubquestion(
            id="atrium",
            question="中庭如何串联阶梯阅读？",
            rationale="需要项目证据。",
        ),
        search_queries=["new community library atrium floor plan"],
        candidates=[
            LocalSearchCandidate(
                candidate_id="candidate-library",
                url="https://www.archdaily.com/123/community-library",
                title="LIBRARY Community Library / Studio",
                description="",
                publication_tier=PublicationTier.trusted_secondary,
            )
        ],
    )

    assert result == expected
    assert (
        "Do not reject an exact building-type project page only because its search summary "
        "is empty" in calls[0]["input"]
    )
    assert "The full local page read is the evidence check" in calls[0]["input"]


def test_openai_provider_analyzes_a_collected_project_page_without_another_web_search() -> None:
    calls: list[dict[str, Any]] = []
    expected = PublicPageAnalysis(
        relevance=4,
        drawing_ids=["drawing_1"],
        project_context="项目将服务入口设置在东侧。",
        design_mechanism="将后勤入口与公众入口分置在建筑两侧。",
        transfer_strategy=["在总平面先标出两类入口。", "用独立服务廊道连接后台。"],
        facts=[
            PublicPageSupportedFact(
                statement="项目将服务入口设置在东侧。",
                text_excerpt="The service entrance is located on the east side.",
            ),
            PublicPageSupportedFact(
                statement="将后勤入口与公众入口分置在建筑两侧。",
                text_excerpt="Visitors enter from the public courtyard.",
            ),
        ],
        limitations=["原项目消防条件仍需单独核对。"],
    )

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=expected)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    result = provider.analyze_public_page(
        question="如何分开公众与后勤流线？",
        source_url="https://www.archdaily.com/123456/project",
        title="Courtyard Archive",
        page_text=(
            "The service entrance is located on the east side. "
            "Visitors enter from the public courtyard."
        ),
        drawings=[
            PublicPageDrawing(
                drawing_id="drawing_1",
                asset_type=ArchitectureAssetType.plan,
                image_url="https://cdn.example/floor-plan.png",
                caption="Ground floor plan",
            )
        ],
        analysis_requirements=DEPTH_TARGETS[BudgetMode.deep].analysis_requirements,
    )

    assert result == expected
    request = calls[0]
    assert request["model"] == "gpt-5.5"
    assert request["text_format"] is PublicPageAnalysis
    assert request["reasoning"] == {"effort": "medium"}
    assert request["max_output_tokens"] == 1_600
    assert request["timeout"] == 45.0
    assert "tools" not in request
    assert "逐字摘录" in request["input"]
    assert "只有 text_excerpt 必须逐字出现在 page_text 中" in request["input"]
    assert "facts.statement 是由 text_excerpt 支撑的简体中文事实转述" in request["input"]
    assert "不要求 facts.statement 逐字出现在英文 page_text 中" in request["input"]
    assert "project_context 和 design_mechanism 必须分别与某条" in request["input"]
    assert "design_mechanism 直接复制一条受支持的 facts.statement" in request["input"]
    assert "条件—设计操作—空间结果" in request["input"]
    assert "不要求单个页面覆盖子问题列出的全部策略或使用者" in request["input"]
    assert "未覆盖项写入 limitations" in request["input"]
    assert "研究强度要求是后续丰富目标，不是单页准入清单" in request["input"]
    assert "完整的 project_context、design_mechanism 和 transfer_strategy" in request["input"]
    assert "relevance 必须至少为 2" in request["input"]
    assert "direct_match 只有在案例直接回答当前研究子问题" in request["input"]
    assert "房间、家具或临时装置" in request["input"]
    assert "不得引入项目标题、来源 URL 或正文中不存在的城市或国家" in request["input"]
    assert "page_text 可能包含多个 [SOURCE n]" in request["input"]
    assert "项目事实可以分别由不同来源的逐字引文支持" in request["input"]
    assert "transfer_strategy 是研究转译" in request["input"]
    assert "relevance 只用于排序" in request["input"]
    assert "图片只用于预览和返回源网站" in request["input"]
    assert "缺少精准图片时 drawing_ids 可以留空" in request["input"]
    assert "不要因为没有平面、剖面或精准配图而清空" in request["input"]
    assert "不要求 page_text 逐张描述图片" in request["input"]
    assert "不能把未读取的图像像素写成事实" in request["input"]
    assert "证据冲突与缺口" in request["input"]
    assert "后续跨案例比较" in request["input"]
    assert provider.worst_case_page_analysis_seconds == 90.0


def test_openai_page_analysis_retries_once_when_relevant_result_lacks_evidence() -> None:
    calls: list[dict[str, Any]] = []
    invalid = PublicPageAnalysis(
        relevance=2,
        drawing_ids=["drawing_1"],
    )
    context = "该图书馆围绕中央中庭组织主要公共空间。"
    mechanism = "连续楼梯与阅读平台沿中庭串联各层。"
    expected = PublicPageAnalysis(
        relevance=3,
        drawing_ids=["drawing_1"],
        project_context=context,
        design_mechanism=mechanism,
        transfer_strategy=["用连续阅读平台连接中庭周边楼层。"],
        facts=[
            PublicPageSupportedFact(
                statement=context,
                text_excerpt="The library organizes its public spaces around a central atrium.",
            ),
            PublicPageSupportedFact(
                statement=mechanism,
                text_excerpt="Continuous stairs and reading terraces connect the floors around it.",
            ),
        ],
    )
    responses = [invalid, expected]

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=responses.pop(0))

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    result = provider.analyze_public_page(
        question="中庭和阶梯阅读如何组织连续流线？",
        source_url="https://studio.example/library",
        title="Community Library",
        page_text=(
            "The library organizes its public spaces around a central atrium. "
            "Continuous stairs and reading terraces connect the floors around it."
        ),
        drawings=[
            PublicPageDrawing(
                drawing_id="drawing_1",
                asset_type=ArchitectureAssetType.plan,
                image_url="https://cdn.example/library-plan.png",
                caption="Library floor plan",
            )
        ],
    )

    assert result == expected
    assert len(calls) == 2
    assert "上一次结构化结果把 relevance 设为 2 或更高" in calls[1]["input"]
    assert provider.worst_case_page_analysis_seconds == 90.0


def test_openai_page_analysis_retries_when_core_excerpts_are_not_verbatim() -> None:
    calls: list[dict[str, Any]] = []
    context = "该图书馆围绕中央中庭组织主要公共空间。"
    mechanism = "连续楼梯与阅读平台沿中庭串联各层。"
    invalid = PublicPageAnalysis(
        relevance=3,
        project_context=context,
        design_mechanism=mechanism,
        transfer_strategy=["用连续阅读平台连接中庭周边楼层。"],
        facts=[
            PublicPageSupportedFact(
                statement=context,
                text_excerpt="A fabricated context sentence that is absent from the page.",
            ),
            PublicPageSupportedFact(
                statement=mechanism,
                text_excerpt="A fabricated mechanism sentence that is absent from the page.",
            ),
        ],
    )
    expected = invalid.model_copy(
        update={
            "facts": [
                PublicPageSupportedFact(
                    statement=context,
                    text_excerpt=(
                        "The library organizes its public spaces around a central atrium."
                    ),
                ),
                PublicPageSupportedFact(
                    statement=mechanism,
                    text_excerpt=(
                        "Continuous stairs and reading terraces connect the floors around it."
                    ),
                ),
            ]
        }
    )
    responses = [invalid, expected]

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=responses.pop(0))

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    result = provider.analyze_public_page(
        question="中庭和阶梯阅读如何组织连续流线？",
        source_url="https://studio.example/library",
        title="Community Library",
        page_text=(
            "The library organizes its public spaces around a central atrium. "
            "Continuous stairs and reading terraces connect the floors around it."
        ),
        drawings=[],
    )

    assert result == expected
    assert len(calls) == 2
    assert "text_excerpt 必须是 page_text 中连续、逐字存在的原文" in calls[1]["input"]


def test_openai_page_analysis_keeps_a_mechanism_after_six_thousand_characters() -> None:
    calls: list[dict[str, Any]] = []
    mechanism = "TAIL_MECHANISM: the inserted volume is detached from the old frame."

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=PublicPageAnalysis(relevance=0))

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    provider.analyze_public_page(
        question="新功能如何植入旧结构？",
        source_url="https://studio.example/foundry",
        title="Foundry reuse",
        page_text=f"{'A' * 6_500}{mechanism}",
        drawings=[],
    )

    assert mechanism in calls[0]["input"]


def test_openai_page_analysis_does_not_retry_the_same_page_after_a_timeout() -> None:
    calls: list[dict[str, Any]] = []
    context = "The project reuses a former textile warehouse as a headquarters."
    mechanism = (
        "The new all-steel hanging system supports the rooftop gallery and remains "
        "completely separate from the old structure."
    )

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            raise TimeoutError("page analysis timed out")

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    with pytest.raises(TimeoutError, match="page analysis timed out"):
        provider.analyze_public_page(
            question="新介入如何与原有结构形成连接或脱开关系？",
            source_url="https://studio.example/foundry",
            title="Foundry reuse",
            page_text=f"{context}\n{'Background. ' * 700}{mechanism}",
            drawings=[],
        )

    assert len(calls) == 1
    assert provider.worst_case_page_analysis_seconds == 90.0


@pytest.mark.parametrize("error_type_name", ["APITimeoutError", "APIConnectionError"])
def test_openai_page_analysis_retries_one_transient_error_within_existing_budget(
    error_type_name: str,
) -> None:
    calls: list[dict[str, Any]] = []
    context = "The project reuses a former textile warehouse as a headquarters."
    mechanism = (
        "The new all-steel hanging system supports the rooftop gallery and remains "
        "completely separate from the old structure."
    )
    expected = PublicPageAnalysis(
        relevance=3,
        project_context=context,
        design_mechanism=mechanism,
        transfer_strategy=["Keep the new support system structurally independent."],
        facts=[
            PublicPageSupportedFact(statement=context, text_excerpt=context),
            PublicPageSupportedFact(statement=mechanism, text_excerpt=mechanism),
        ],
    )

    error_type = type(error_type_name, (Exception,), {})

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            if len(calls) == 1:
                raise error_type("page analysis request failed")
            return SimpleNamespace(output_parsed=expected)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    result = provider.analyze_public_page(
        question="新介入如何与原有结构形成连接或脱开关系？",
        source_url="https://studio.example/foundry",
        title="Foundry reuse",
        page_text=f"{context}\n{'Background. ' * 700}{mechanism}",
        drawings=[],
    )

    assert result == expected
    assert len(calls) == 2
    assert provider.worst_case_page_analysis_seconds == 90.0


def test_focused_page_analysis_keeps_a_late_section_mechanism() -> None:
    mechanism = (
        "The atriums fit into long-span structural bays, making them column-free light courtyards."
    )
    focused = _focused_public_page_text(
        "剖面中的中庭、挑空、坡道、连桥与楼梯如何组织竖向层次？",
        f"Textile warehouse conversion.\n{'Background. ' * 700}{mechanism}",
    )

    assert mechanism in focused
    assert len(focused) <= 6_000


def test_deterministic_page_analysis_reuses_only_source_sentences() -> None:
    page_text = (
        "Courtyard Archive / Studio Example\n"
        "The project retains an existing hall as the main public room. "
        "The inserted program organizes a clear route between the courtyard and the hall."
    )

    analysis = deterministic_public_page_analysis(
        question="旧建筑中如何植入新功能？",
        title="Courtyard Archive / Studio Example",
        page_text=page_text,
        drawings=[
            PublicPageDrawing(
                drawing_id="drawing_1",
                asset_type=ArchitectureAssetType.plan,
                image_url="https://cdn.example/courtyard-plan.png",
            )
        ],
    )

    assert analysis is not None
    assert analysis.relevance == 2
    assert analysis.drawing_ids == ["drawing_1"]
    assert analysis.project_context in page_text
    assert analysis.design_mechanism in page_text
    assert analysis.project_context != analysis.design_mechanism
    assert all(fact.text_excerpt in page_text for fact in analysis.facts)
    assert (
        deterministic_public_page_analysis(
            question="旧建筑中如何植入新功能？",
            title="Only a title",
            page_text="Only a title",
            drawings=[],
        )
        is None
    )


def test_openai_page_analysis_does_not_fallback_after_a_non_transient_error() -> None:
    calls = 0

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            nonlocal calls
            del kwargs
            calls += 1
            raise ValueError("invalid structured response")

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    with pytest.raises(ValueError, match="invalid structured response"):
        provider.analyze_public_page(
            question="新介入如何与原有结构形成连接或脱开关系？",
            source_url="https://studio.example/foundry",
            title="Foundry reuse",
            page_text=f"Context.\n{'Background. ' * 700}Tail mechanism.",
            drawings=[],
        )

    assert calls == 1


def test_openai_provider_changes_synthesis_work_by_research_depth() -> None:
    calls: list[dict[str, Any]] = []
    finding = ResearchSynthesisFinding(
        statement="独立盒体把新功能与旧结构脱开。",
        evidence_asset_ids=["asset-1"],
    )
    expected = ResearchSynthesis(
        answer=finding,
        causal_chains=[finding, finding],
        comparisons=[finding, finding],
        conflicts=[finding],
        applicability_boundaries=[finding, finding],
        recommendations=[finding, finding],
    )

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=expected)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    case = ResearchSynthesisCase(
        asset_id="asset-1",
        project_name="旧厂房更新",
        asset_type=ArchitectureAssetType.plan,
        source_url="https://studio.example/project",
        subquestion_ids=["program"],
        project_context="保留旧结构。",
        design_mechanism="独立盒体与旧结构脱开。",
        transfer_strategy=["先标出不可触碰的结构边界。"],
        limitations=["只适用于有足够净高的厂房。"],
        evidence=["原文：The new boxes are independent from the old frame."],
        subquestion_analysis={
            "program": ResearchSynthesisBranchAnalysis(
                project_context="保留旧结构。",
                design_mechanism="独立盒体与旧结构脱开。",
                transfer_strategy=["先标出不可触碰的结构边界。"],
                limitations=["只适用于有足够净高的厂房。"],
                evidence=["原文：The new boxes are independent from the old frame."],
            )
        },
    )
    top_level_case = ResearchSynthesisCase(
        asset_id="asset-2",
        project_name="旧仓库更新",
        asset_type=ArchitectureAssetType.section,
        source_url="https://studio.example/warehouse",
        subquestion_ids=["section"],
        project_context="保留原有屋架。",
        design_mechanism="新夹层从原屋架脱开。",
        transfer_strategy=["先核对原屋架承载边界。"],
        limitations=["只适用于原屋架可独立保留的仓库。"],
        evidence=["原文：The original roof trusses are retained."],
    )
    subquestions = [
        ResearchSubquestion(id="program", question="新功能如何植入？", rationale="核对空间机制")
    ]

    for mode in BudgetMode:
        assert (
            provider.synthesize_research(
                question="旧建筑如何植入新功能？",
                budget_mode=mode,
                subquestions=subquestions,
                cases=[case, top_level_case],
            )
            == expected
        )

    quick_prompt, balanced_prompt, deep_prompt = [call["input"] for call in calls]
    assert "只提炼最强的因果链" in quick_prompt
    assert "逐个已回答子问题形成因果链" in balanced_prompt
    assert "只输出 2 条因果链、2 条比较、1 条冲突" in balanced_prompt
    assert "2 条适用边界和 2 条建议" in balanced_prompt
    assert "每条 statement 不超过 100 个汉字" in balanced_prompt
    assert "跨案例比较机制的共性与分歧" in deep_prompt
    assert "证据冲突和不确定性" in deep_prompt
    assert all(call["text_format"] is ResearchSynthesis for call in calls)
    assert [call["timeout"] for call in calls] == [90.0, 60.0, 90.0]
    assert [call["max_output_tokens"] for call in calls] == [1_200, 1_600, 3_200]
    assert all("tools" not in call for call in calls)
    for index, call in enumerate(calls):
        case_payloads = json.loads(call["input"].split("案例证据：", 1)[1])
        assert case_payloads[0]["asset_id"] == "asset-1"
        assert case_payloads[0]["asset_type"] == "plan"
        assert case_payloads[0]["subquestion_analysis"]["program"]["evidence"]
        assert "project_context" not in case_payloads[0]
        assert "design_mechanism" not in case_payloads[0]
        assert "transfer_strategy" not in case_payloads[0]
        assert "limitations" not in case_payloads[0]
        assert "evidence" not in case_payloads[0]
        if index > 0:
            assert case_payloads[1]["project_context"] == "保留原有屋架。"
            assert case_payloads[1]["evidence"]


def test_quick_synthesis_keeps_one_ranked_case_per_planned_subquestion() -> None:
    calls: list[dict[str, Any]] = []

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            case_payloads = json.loads(kwargs["input"].split("案例证据：", 1)[1])
            finding = ResearchSynthesisFinding(
                statement="首个案例提供了可转译的正文机制。",
                evidence_asset_ids=[case_payloads[0]["asset_id"]],
            )
            return SimpleNamespace(
                output_parsed=ResearchSynthesis(
                    answer=finding,
                    causal_chains=[finding, finding],
                    comparisons=[finding, finding],
                    conflicts=[finding],
                    applicability_boundaries=[finding, finding],
                    recommendations=[finding, finding],
                )
            )

    def synthesis_case(asset_id: str, subquestion_id: str) -> ResearchSynthesisCase:
        return ResearchSynthesisCase(
            asset_id=asset_id,
            project_name=asset_id,
            asset_type=ArchitectureAssetType.plan,
            source_url=f"https://studio.example/{asset_id}",
            subquestion_ids=[subquestion_id],
            project_context="保留原有工业结构。",
            design_mechanism="新介入服从既有空间秩序。",
            transfer_strategy=["先识别既有结构和空间边界。"],
            limitations=["需要由现场勘察校核。"],
            evidence=["The intervention follows the existing structural order."],
        )

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    subquestions = [
        ResearchSubquestion(id="program", question="新功能如何植入？", rationale="核对功能机制"),
        ResearchSubquestion(id="circulation", question="流线如何组织？", rationale="核对流线机制"),
        ResearchSubquestion(id="section", question="剖面如何分层？", rationale="核对剖面机制"),
    ]
    cases = [
        synthesis_case("circulation-first", "circulation"),
        synthesis_case("program-first", "program"),
        synthesis_case("section-first", "section"),
        synthesis_case("program-second", "program"),
        synthesis_case("circulation-second", "circulation"),
        synthesis_case("section-second", "section"),
    ]

    for mode in BudgetMode:
        provider.synthesize_research(
            question="旧建筑如何植入功能并组织流线和剖面？",
            budget_mode=mode,
            subquestions=subquestions,
            cases=cases,
        )

    case_payloads_by_mode = [json.loads(call["input"].split("案例证据：", 1)[1]) for call in calls]
    assert [case["asset_id"] for case in case_payloads_by_mode[0]] == [
        "program-first",
        "circulation-first",
        "section-first",
    ]
    for case_payloads in case_payloads_by_mode[1:]:
        assert [case["asset_id"] for case in case_payloads] == [case.asset_id for case in cases]


def test_synthesis_depth_rejects_outputs_below_the_selected_research_strength() -> None:
    finding = ResearchSynthesisFinding(
        statement="独立盒体把新功能与旧结构脱开。",
        evidence_asset_ids=["asset-1"],
    )
    quick_only = ResearchSynthesis(
        answer=finding,
        causal_chains=[finding],
        recommendations=[finding],
    )
    balanced_only = quick_only.model_copy(
        update={"comparisons": [finding], "applicability_boundaries": [finding]}
    )

    class FakeResponses:
        def __init__(self, result: ResearchSynthesis) -> None:
            self.result = result

        def parse(self, **kwargs: Any) -> SimpleNamespace:
            del kwargs
            return SimpleNamespace(output_parsed=self.result)

    case = ResearchSynthesisCase(
        asset_id="asset-1",
        project_name="旧厂房更新",
        asset_type=ArchitectureAssetType.plan,
        source_url="https://studio.example/project",
        subquestion_ids=["program"],
        project_context="保留旧结构。",
        design_mechanism="独立盒体与旧结构脱开。",
        transfer_strategy=["先标出不可触碰的结构边界。"],
        evidence=["The new boxes are independent from the old frame."],
    )
    subquestions = [
        ResearchSubquestion(id="program", question="新功能如何植入？", rationale="核对空间机制")
    ]

    quick_provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses(quick_only)),
    )
    assert (
        quick_provider.synthesize_research(
            question="旧建筑如何植入新功能？",
            budget_mode=BudgetMode.quick,
            subquestions=subquestions,
            cases=[case],
        )
        == quick_only
    )

    balanced_provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses(quick_only)),
    )
    with pytest.raises(ValueError, match="balanced synthesis"):
        balanced_provider.synthesize_research(
            question="旧建筑如何植入新功能？",
            budget_mode=BudgetMode.balanced,
            subquestions=subquestions,
            cases=[case],
        )

    deep_provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses(balanced_only)),
    )
    with pytest.raises(ValueError, match="deep synthesis"):
        deep_provider.synthesize_research(
            question="旧建筑如何植入新功能？",
            budget_mode=BudgetMode.deep,
            subquestions=subquestions,
            cases=[case],
        )


def test_synthesis_retries_one_invalid_structured_output_within_its_time_budget() -> None:
    finding = ResearchSynthesisFinding(
        statement="阶梯阅读区沿中庭形成连续公共界面。",
        evidence_asset_ids=["asset-1"],
    )
    invalid = ResearchSynthesis(answer=finding)
    valid = invalid.model_copy(update={"causal_chains": [finding], "recommendations": [finding]})
    calls: list[dict[str, Any]] = []

    class SequencedResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=invalid if len(calls) == 1 else valid)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=SequencedResponses()),
    )
    case = ResearchSynthesisCase(
        asset_id="asset-1",
        project_name="社区图书馆",
        asset_type=ArchitectureAssetType.section,
        source_url="https://studio.example/library",
        subquestion_ids=["section"],
        project_context="中庭连接各层阅读空间。",
        design_mechanism="阶梯阅读区沿中庭连续布置。",
        transfer_strategy=["先校核中庭宽高比和疏散距离。"],
        evidence=["原文证据"],
    )
    subquestions = [
        ResearchSubquestion(
            id="section",
            question="中庭和阶梯阅读空间如何形成剖面联系？",
            rationale="需要核对建成案例的剖面证据。",
        )
    ]

    result = provider.synthesize_research(
        question="社区图书馆如何组织中庭和阶梯阅读空间？",
        budget_mode=BudgetMode.quick,
        subquestions=subquestions,
        cases=[case],
    )

    assert result == valid
    assert len(calls) == 2
    assert [call["reasoning"] for call in calls] == [
        {"effort": "medium"},
        {"effort": "medium"},
    ]
    assert provider.synthesis_worst_case_seconds(BudgetMode.quick) == 90.0


def test_synthesis_retries_one_api_timeout_within_its_existing_call_budget() -> None:
    finding = ResearchSynthesisFinding(
        statement="中庭把各层阅览空间连接为可见的公共核心。",
        evidence_asset_ids=["asset-1"],
    )
    valid = ResearchSynthesis(
        answer=finding,
        causal_chains=[finding],
        recommendations=[finding],
    )
    calls: list[dict[str, Any]] = []

    class APITimeoutError(Exception):
        pass

    class SequencedResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            if len(calls) == 1:
                raise APITimeoutError("relay timed out")
            return SimpleNamespace(output_parsed=valid)

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=SequencedResponses()),
    )
    case = ResearchSynthesisCase(
        asset_id="asset-1",
        project_name="社区图书馆",
        asset_type=ArchitectureAssetType.section,
        source_url="https://studio.example/library",
        subquestion_ids=["section"],
        project_context="中庭连接各层阅览空间。",
        design_mechanism="中庭把各层阅览空间连接为可见的公共核心。",
        transfer_strategy=["先校核中庭宽高比和疏散距离。"],
        evidence=["原文证据"],
    )
    subquestions = [
        ResearchSubquestion(
            id="section",
            question="中庭如何连接各层阅览空间？",
            rationale="需要核对建成案例的剖面证据。",
        )
    ]

    result = provider.synthesize_research(
        question="社区图书馆如何组织中庭？",
        budget_mode=BudgetMode.quick,
        subquestions=subquestions,
        cases=[case],
    )

    assert result == valid
    assert len(calls) == 2
    assert [call["reasoning"] for call in calls] == [
        {"effort": "medium"},
        {"effort": "low"},
    ]
    assert 89.0 <= calls[0]["timeout"] <= 90.0
    assert 0.0 < calls[1]["timeout"] <= calls[0]["timeout"]
    assert provider.synthesis_worst_case_seconds(BudgetMode.quick) == 90.0


@pytest.mark.parametrize("query", ["adaptive reuse section", "旧建筑剖面更新"])
def test_openai_search_requires_simplified_chinese_analysis_fields(query: str) -> None:
    calls: list[dict[str, Any]] = []

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(output_parsed=ProviderSearchResult(assets=[], sources=[]))

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    provider.search(query, ResearchGoal.precedent_research)

    prompt = calls[0]["input"]
    assert "Simplified Chinese" in prompt
    assert "regardless of the query or source language" in prompt
    for field in (
        "project_context",
        "design_mechanism",
        "transfer_strategy",
        "facts",
        "observations",
        "inferences",
        "limitations",
    ):
        assert field in prompt
    assert "Official project names may remain in their original language" in prompt


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
    assert request["reasoning"] == {"effort": "medium"}
    assert request["max_output_tokens"] == 1_200
    assert request["text_format"] is ResearchPlan
    assert "exactly 4" in request["input"]
    assert "untrusted" in request["input"].lower()
    assert "Simplified Chinese" in request["input"]
    assert "question and rationale" in request["input"]
    assert "Do not create a standalone source-verification subquestion" in request["input"]


def test_openai_visual_planner_requests_distinct_drawing_style_directions() -> None:
    calls: list[dict[str, Any]] = []

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(
                output_parsed={
                    "subquestions": [
                        {
                            "id": "linework_style",
                            "question": "精细线稿剖面图",
                            "rationale": "比较线宽、虚实和留白",
                        },
                        {
                            "id": "collage_style",
                            "question": "拼贴叙事剖面图",
                            "rationale": "比较色块、人物和材质层次",
                        },
                        {
                            "id": "rendered_style",
                            "question": "材质渲染剖面图",
                            "rationale": "比较光影、纹理和空间深度",
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
        "帮我找几种剖面图风格",
        ResearchGoal.visual_reference_search,
        BudgetMode.quick,
        "",
    )

    assert len(plan.subquestions) == 3
    prompt = calls[0]["input"]
    assert "mutually distinct drawing-style directions" in prompt
    assert "keep that type fixed" in prompt
    assert "vary only the visible style" in prompt
    assert "Do not decompose the request into functional design problems" in prompt
    assert "short style-direction label" in prompt
    assert "observable visual features" in prompt
    assert "design, source-verification, or visible-reference issue" not in prompt


def test_openai_visual_planner_corrects_other_types_to_the_requested_type() -> None:
    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            return SimpleNamespace(
                output_parsed={
                    "subquestions": [
                        {
                            "id": "linework_style",
                            "question": "精细线稿剖面图",
                            "rationale": "比较线宽、虚实和留白",
                        },
                        {
                            "id": "collage_style",
                            "question": "拼贴叙事平面图",
                            "rationale": "比较色块、人物和材质层次",
                        },
                        {
                            "id": "rendered_style",
                            "question": "材质渲染效果图",
                            "rationale": "比较光影、纹理和空间深度",
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
        "我想出一个轴测图，帮我找风格",
        ResearchGoal.visual_reference_search,
        BudgetMode.quick,
        "",
    )

    assert [item.question for item in plan.subquestions] == [
        "精细线稿轴测图",
        "拼贴叙事轴测图",
        "材质渲染轴测图",
    ]


def test_openai_precedent_planner_rejects_a_standalone_source_meta_branch() -> None:
    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            del kwargs
            return SimpleNamespace(
                output_parsed={
                    "subquestions": [
                        {
                            "id": "program",
                            "question": "怎样植入功能？",
                            "rationale": "核对空间机制",
                        },
                        {
                            "id": "circulation",
                            "question": "怎样组织流线？",
                            "rationale": "核对路径",
                        },
                        {
                            "id": "source_trace",
                            "question": "哪些来源可追溯？",
                            "rationale": "核对出处",
                        },
                    ]
                }
            )

    provider = OpenAIResearchProvider(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    with pytest.raises(ValueError, match="standalone source-verification"):
        provider.plan(
            "旧建筑更新中如何植入功能、组织流线与剖面层次？",
            ResearchGoal.precedent_research,
            BudgetMode.quick,
            "验证旧工业建筑更新",
        )


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
