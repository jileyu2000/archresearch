import pytest
from pydantic import ValidationError

from archresearch_api.schemas import (
    BUDGETS,
    BudgetMode,
    EvidenceClaimCreate,
    ResearchGoal,
    ResearchSpec,
    RunStatus,
    UrlInputCreate,
)


def test_research_modes_have_the_approved_fixed_budgets() -> None:
    assert BUDGETS[BudgetMode.quick].model_dump() == {
        "max_rounds": 2,
        "max_queries": 4,
        "max_pages": 12,
        "max_seconds": 240,
    }
    assert BUDGETS[BudgetMode.balanced].model_dump() == {
        "max_rounds": 3,
        "max_queries": 8,
        "max_pages": 30,
        "max_seconds": 720,
    }
    assert BUDGETS[BudgetMode.deep].model_dump() == {
        "max_rounds": 5,
        "max_queries": 16,
        "max_pages": 60,
        "max_seconds": 1800,
    }


def test_research_spec_accepts_only_the_three_routing_goals() -> None:
    spec = ResearchSpec(
        question="如何让新旧交通系统互不干扰？",
        goal=ResearchGoal.precedent_research,
    )
    assert spec.budget_mode is BudgetMode.balanced

    with pytest.raises(ValidationError):
        ResearchSpec(question="提取风格", goal="style_extraction")


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
