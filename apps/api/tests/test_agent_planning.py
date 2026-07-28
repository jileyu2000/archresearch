import archresearch_api.workflow as workflow_module
from archresearch_api.agent import planning as planning_module
from archresearch_api.agent.planning import (
    build_queries,
    build_research_plan,
    select_public_search_domains,
)
from archresearch_api.schemas import (
    BudgetMode,
    ResearchGoal,
    ResearchPlan,
    ResearchSubquestion,
)


def test_workflow_uses_the_planning_boundary() -> None:
    assert workflow_module.build_research_plan is planning_module.build_research_plan
    assert workflow_module.build_queries is planning_module.build_queries


class FailingPlanningProvider:
    name = "failing-planner"

    def plan(
        self,
        question: str,
        goal: ResearchGoal,
        budget_mode: BudgetMode,
        research_context: str,
    ) -> ResearchPlan:
        del question, goal, budget_mode, research_context
        raise RuntimeError("planner failed")

    def search(
        self,
        query: str,
        goal: ResearchGoal,
        allowed_domains: list[str] | None = None,
    ) -> object:
        del query, goal, allowed_domains
        raise AssertionError("planning must not search")


def test_planning_boundary_falls_back_without_running_tools() -> None:
    result = build_research_plan(
        FailingPlanningProvider(),
        question="旧厂房如何植入社区功能？",
        goal=ResearchGoal.precedent_research,
        budget_mode=BudgetMode.quick,
        research_context="",
        existing_subquestions=[],
    )

    assert result.source == "deterministic_fallback"
    assert result.error_type == "RuntimeError"
    assert len(result.plan.subquestions) == 3
    assert len({item.id for item in result.plan.subquestions}) == 3


def test_query_planning_is_bounded_and_keeps_untrusted_context() -> None:
    subquestions = [
        ResearchSubquestion(id="program", question="功能怎样植入？", rationale="功能边界"),
        ResearchSubquestion(id="section", question="剖面怎样组织？", rationale="竖向关系"),
    ]

    queries = build_queries(
        "旧厂房改造",
        ResearchGoal.precedent_research,
        subquestions,
        max_rounds=2,
        max_queries=3,
        analysis_requirements=["design_mechanism"],
        research_context="保留北侧桁架",
    )

    assert len(queries) == 3
    assert queries[0][:3] == (1, "zh", "program")
    assert "Untrusted user design context" in queries[0][3]


def test_public_search_domain_rotation_stays_deterministic() -> None:
    assert select_public_search_domains(
        ResearchGoal.precedent_research,
        [],
        round_number=1,
        round_query_index=1,
    ) == ["archdaily.com"]
    assert select_public_search_domains(
        ResearchGoal.precedent_research,
        ["example.com"],
        round_number=4,
        round_query_index=8,
    ) == ["example.com"]
