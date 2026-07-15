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
)


def test_research_modes_bound_fair_per_subquestion_passes() -> None:
    assert BUDGETS[BudgetMode.quick].model_dump() == {
        "max_rounds": 2,
        "max_queries": 6,
        "completion_recovery_rounds": 3,
        "completion_recovery_pages_per_subquestion": 2,
        "max_pages": 12,
        "max_seconds": 1800,
    }
    assert BUDGETS[BudgetMode.balanced].model_dump() == {
        "max_rounds": 3,
        "max_queries": 12,
        "completion_recovery_rounds": 3,
        "completion_recovery_pages_per_subquestion": 2,
        "max_pages": 30,
        "max_seconds": 1800,
    }
    assert BUDGETS[BudgetMode.deep].model_dump() == {
        "max_rounds": 4,
        "max_queries": 24,
        "completion_recovery_rounds": 3,
        "completion_recovery_pages_per_subquestion": 2,
        "max_pages": 60,
        "max_seconds": 1800,
    }


def test_research_modes_have_distinct_evidence_obligations() -> None:
    assert DEPTH_TARGETS[BudgetMode.quick].model_dump() == {
        "subquestions": 3,
        "research_passes": 2,
        "assets_per_subquestion": 2,
        "analysis_requirements": ["visible_observation", "design_mechanism"],
        "projects": 2,
        "assets": 6,
        "multi_asset_projects": 1,
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


def test_research_spec_accepts_only_explicit_supported_research_sources() -> None:
    spec = ResearchSpec(
        question="从小红书寻找旧建筑改造的剖面表达灵感",
        research_sources=[ResearchSource.xiaohongshu, ResearchSource.pinterest],
    )

    assert spec.research_sources == [
        ResearchSource.xiaohongshu,
        ResearchSource.pinterest,
    ]

    with pytest.raises(ValidationError):
        ResearchSpec(
            question="从未知平台寻找灵感",
            research_sources=["unknown_platform"],
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
