import pytest
from pydantic import ValidationError

from archresearch_api.schemas import (
    BUDGETS,
    DEPTH_TARGETS,
    BudgetMode,
    CoverageReport,
    EvidenceClaimCreate,
    ResearchGoal,
    ResearchPlan,
    ResearchSource,
    ResearchSpec,
    ResearchSubquestion,
    RunStatus,
    UrlInputCreate,
    research_record_title,
)


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        (
            "人车在入口冲突，如何重组落客和步行路径？",
            "人车在入口冲突：重组落客和步行路径",
        ),
        (
            "新增构件怎样与旧结构脱开，并保留未来调整的可能？",
            "新增构件：与旧结构脱开，并保留未来调整的可能",
        ),
        (
            "请问  采光不足怎么通过中庭和高侧窗改善？",
            "采光不足：通过中庭和高侧窗改善",
        ),
        ("旧厂房改造：如何植入公共功能？", "旧厂房改造：植入公共功能"),
        ("旧厂房社区文化中心", "旧厂房社区文化中心"),
        (
            "这是一个没有问句标记而且明显超过历史记录标题长度限制的建筑研究描述文本",
            "这是一个没有问句标记而且明显超过历史记录标题长度限制…",
        ),
        (
            "旧厂房改造成社区文化中心，原有的混凝土排架和大跨屋架要保留，新功能怎么放进去？"
            "旧厂房改造为社区文化中心，如何在大跨空间里植入多功能厅、书吧等新体量？"
            "新植入的结构和旧结构应该脱开还是连接？",
            "新植入的结构和旧结构应该脱开还是连接",
        ),
        (
            "社区文化中心场地南北有3米高差，主入口在高处沿街，低处是社区广场："
            "如何用剖面和流线把两个标高的人流自然连接起来，而不是只靠一部大台阶？",
            "社区文化中心场地南北有3米高差：用剖面和流线把两个标高…",
        ),
    ],
)
def test_research_record_title_handles_future_question_shapes(question: str, expected: str) -> None:
    assert research_record_title(question) == expected


def test_research_modes_bound_fair_per_subquestion_passes() -> None:
    assert BUDGETS[BudgetMode.quick].model_dump() == {
        "max_rounds": 2,
        "max_queries": 8,
        "completion_recovery_rounds": 5,
        "completion_recovery_pages_per_subquestion": 4,
        "max_pages": 20,
        "max_seconds": 2880,
    }
    assert BUDGETS[BudgetMode.balanced].model_dump() == {
        "max_rounds": 3,
        "max_queries": 15,
        "completion_recovery_rounds": 5,
        "completion_recovery_pages_per_subquestion": 4,
        "max_pages": 48,
        "max_seconds": 4320,
    }
    assert BUDGETS[BudgetMode.deep].model_dump() == {
        "max_rounds": 4,
        "max_queries": 30,
        "completion_recovery_rounds": 5,
        "completion_recovery_pages_per_subquestion": 4,
        "max_pages": 90,
        "max_seconds": 6480,
    }


def test_current_product_contract_excludes_source_lookup() -> None:
    assert {goal.value for goal in ResearchGoal} == {
        "precedent_research",
        "visual_reference_search",
    }
    with pytest.raises(ValidationError):
        ResearchSpec(question="这张图来自哪里？", goal="source_lookup")


def test_research_modes_have_distinct_evidence_obligations() -> None:
    assert DEPTH_TARGETS[BudgetMode.quick].model_dump() == {
        "subquestions": 3,
        "research_passes": 2,
        "assets_per_subquestion": 2,
        "analysis_requirements": ["visible_observation", "design_mechanism"],
        "projects": 2,
        "assets": 6,
        "multi_asset_projects": 0,
        "verified_or_partial": 4,
    }
    assert DEPTH_TARGETS[BudgetMode.balanced].model_dump() == {
        "subquestions": 4,
        "research_passes": 3,
        "assets_per_subquestion": 3,
        "analysis_requirements": [
            "visible_observation",
            "design_mechanism",
            "transfer_strategy",
            "applicability_boundary",
        ],
        "projects": 4,
        "assets": 12,
        "multi_asset_projects": 2,
        "verified_or_partial": 6,
    }
    assert DEPTH_TARGETS[BudgetMode.deep].model_dump() == {
        "subquestions": 6,
        "research_passes": 4,
        "assets_per_subquestion": 3,
        "analysis_requirements": [
            "visible_observation",
            "design_mechanism",
            "transfer_strategy",
            "applicability_boundary",
            "source_verification",
            "cross_case_comparison",
        ],
        "projects": 6,
        "assets": 18,
        "multi_asset_projects": 3,
        "verified_or_partial": 9,
    }


def test_coverage_report_keeps_legacy_payloads_compatible_with_enrichment_gaps() -> None:
    report = CoverageReport(gaps=["uncovered_subquestions"])

    assert report.gaps == ["uncovered_subquestions"]
    assert report.enrichment_gaps == []


def test_research_plan_requires_unique_bounded_subquestions() -> None:
    plan = ResearchPlan(
        subquestions=[
            ResearchSubquestion(
                id="program", question="新功能放在哪里？", rationale="定位植入关系"
            ),
            ResearchSubquestion(
                id="circulation", question="流线怎样分开？", rationale="检查冲突节点"
            ),
            ResearchSubquestion(
                id="section", question="剖面怎样形成层次？", rationale="检查竖向联系"
            ),
        ]
    )
    assert [item.id for item in plan.subquestions] == ["program", "circulation", "section"]

    with pytest.raises(ValidationError):
        ResearchPlan(
            subquestions=[plan.subquestions[0], plan.subquestions[0], plan.subquestions[2]]
        )


def test_research_spec_accepts_only_the_three_routing_goals() -> None:
    spec = ResearchSpec(
        question="如何让新旧交通系统互不干扰？",
        goal=ResearchGoal.precedent_research,
    )
    assert spec.budget_mode is BudgetMode.balanced

    with pytest.raises(ValidationError):
        ResearchSpec(question="提取风格", goal="style_extraction")


def test_research_spec_accepts_only_a_complete_confirmed_question_directory() -> None:
    confirmed = [
        ResearchSubquestion(
            id=f"brief_question_{index}",
            question=f"任务书问题 {index} 如何转化为空间？",
            rationale="由用户确认后作为本次研究目录。",
        )
        for index in range(1, 5)
    ]

    spec = ResearchSpec(
        question="二维叙事如何转译为三维空间？",
        budget_mode=BudgetMode.balanced,
        subquestions=confirmed,
    )

    assert spec.subquestions == confirmed
    with pytest.raises(ValidationError, match="exactly 4"):
        ResearchSpec(
            question="二维叙事如何转译为三维空间？",
            budget_mode=BudgetMode.balanced,
            subquestions=confirmed[:3],
        )


def test_research_spec_accepts_only_explicit_supported_research_sources() -> None:
    default_spec = ResearchSpec(question="旧建筑改造如何组织新功能？")
    assert default_spec.research_sources == []
    assert [source.value for source in ResearchSource] == ["xiaohongshu"]

    spec = ResearchSpec(
        question="从小红书寻找旧建筑改造的剖面表达灵感",
        goal=ResearchGoal.visual_reference_search,
        research_sources=[ResearchSource.xiaohongshu],
    )

    assert spec.research_sources == [ResearchSource.xiaohongshu]

    disabled = ResearchSpec(
        question="只研究指定公开建筑网站",
        research_sources=[],
    )
    assert disabled.research_sources == []

    with pytest.raises(ValidationError, match="Precedent research"):
        ResearchSpec(
            question="建筑案例研究不应进入视觉平台",
            goal=ResearchGoal.precedent_research,
            research_sources=[ResearchSource.xiaohongshu],
        )

    with pytest.raises(ValidationError):
        ResearchSpec(
            question="从已移除的平台寻找灵感",
            research_sources=["pinterest"],
        )


def test_run_statuses_match_the_checkpoint_state_machine() -> None:
    assert [status.value for status in RunStatus] == [
        "created",
        "planning",
        "searching",
        "inspecting",
        "analyzing",
        "verifying",
        "gap_check",
        "composing",
        "completed",
        "partial",
        "blocked",
        "cancelled",
        "failed",
    ]


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://localhost:8000",
        "http://169.254.169.254/latest/meta-data",
        "http://10.0.0.2/private",
        "file:///C:/secrets.txt",
        "javascript:alert(1)",
    ],
)
def test_url_inputs_reject_local_or_non_http_targets(url: str) -> None:
    with pytest.raises(ValidationError):
        UrlInputCreate(url=url)


def test_formal_evidence_requires_a_source_locator() -> None:
    with pytest.raises(ValidationError):
        EvidenceClaimCreate(
            claim_type="fact",
            statement="建筑于 2021 年完工",
        )
