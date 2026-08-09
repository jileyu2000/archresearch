import archresearch_api.workflow as workflow_module
from archresearch_api.agent import planning as planning_module
from archresearch_api.agent.planning import (
    build_public_search_query,
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


def test_broad_early_inspiration_fallback_does_not_prescribe_a_design_solution() -> None:
    result = build_research_plan(
        FailingPlanningProvider(),
        question="新建海洋科研馆在概念初期有哪些案例和空间思路值得参考？",
        goal=ResearchGoal.precedent_research,
        budget_mode=BudgetMode.quick,
        research_context="",
        existing_subquestions=[],
    )

    combined = " ".join(f"{item.question} {item.rationale}" for item in result.plan.subquestions)
    assert [item.id for item in result.plan.subquestions] == [
        "spatial_options",
        "use_experience",
        "environment_system",
    ]
    assert "新建海洋科研馆" in result.plan.subquestions[0].question
    assert all("新建海洋科研馆" not in item.question for item in result.plan.subquestions[1:])
    for prescribed_term in (
        "新旧功能",
        "消防流线",
        "核心筒",
        "空间高潮",
        "依附",
        "脱开",
        "穿越原有结构",
    ):
        assert prescribed_term not in combined


def test_concept_stage_is_the_default_fallback_without_a_magic_phrase() -> None:
    result = build_research_plan(
        FailingPlanningProvider(),
        question=(
            "一处面向住区的公共运动与邻里休憩场所，可以从哪些空间关系、"
            "日常体验和场地回应中获得参考？"
        ),
        goal=ResearchGoal.precedent_research,
        budget_mode=BudgetMode.quick,
        research_context="",
        existing_subquestions=[],
    )

    combined = " ".join(f"{item.question} {item.rationale}" for item in result.plan.subquestions)
    assert [item.id for item in result.plan.subquestions] == [
        "spatial_options",
        "use_experience",
        "environment_system",
    ]
    for unrequested_term in ("消防", "核心筒", "夹层", "屋盖", "结构体系"):
        assert unrequested_term not in combined


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


def test_every_subquestion_uses_the_two_reliable_architecture_sites_first() -> None:
    for subquestion_slot in (1, 2, 3):
        first_two = {
            select_public_search_domains(
                ResearchGoal.precedent_research,
                [],
                round_number=round_number,
                round_query_index=subquestion_slot,
            )[0]
            for round_number in (1, 2)
        }

        assert first_two == {"archdaily.com", "designboom.com"}


def test_first_recovery_round_returns_to_reliable_sites_before_broader_domains() -> None:
    first_recovery = [
        select_public_search_domains(
            ResearchGoal.precedent_research,
            [],
            round_number=3,
            round_query_index=subquestion_slot,
        )[0]
        for subquestion_slot in (1, 2, 3)
    ]

    assert first_recovery == ["designboom.com", "archdaily.com", "designboom.com"]


def test_later_recovery_rounds_rotate_across_broader_architecture_sites() -> None:
    expected = {
        4: {"dezeen.com", "divisare.com", "archdaily.cn"},
        5: {"dezeen.com", "divisare.com", "archdaily.cn"},
    }
    for round_number, expected_domains in expected.items():
        actual = {
            select_public_search_domains(
                ResearchGoal.precedent_research,
                [],
                round_number=round_number,
                round_query_index=subquestion_slot,
            )[0]
            for subquestion_slot in (1, 2, 3)
        }
        assert actual == expected_domains


def test_low_yield_sites_are_not_repeated_before_other_supported_sites() -> None:
    low_yield_domains: set[str] = set()
    selected: list[str] = []

    for round_number in range(1, 6):
        domain = select_public_search_domains(
            ResearchGoal.precedent_research,
            [],
            round_number=round_number,
            round_query_index=1,
            low_yield_domains=low_yield_domains,
        )[0]
        selected.append(domain)
        low_yield_domains.add(domain)

    assert selected[:2] == ["archdaily.com", "designboom.com"]
    assert set(selected) == {
        "archdaily.com",
        "designboom.com",
        "dezeen.com",
        "divisare.com",
        "archdaily.cn",
    }


def test_new_community_library_queries_keep_the_real_typology_and_design_issue() -> None:
    research_question = "社区图书馆如何围绕中庭组织阶梯式阅读空间、环形流线、自然采光与结构体系？"
    program_query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        (
            "哪些空间分区与剖面策略能让中庭公共活动、阶梯阅读和安静阅览共享视觉联系"
            "与日常流线，同时降低噪声和人流干扰？"
        ),
        1,
        research_question=research_question,
        trusted_domain="archdaily.com",
    )
    circulation_query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "中庭周边的环形流线如何整合无障碍路径、疏散和阶梯阅读席位？",
        1,
        research_question=research_question,
        trusted_domain="archdaily.com",
    )
    daylight_query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        (
            "中央中庭上方的天窗、侧高窗与屋顶结构可采用哪些组合，使自然光深入阶梯"
            "阅读区和环形流线，同时控制眩光、阴影与结构遮挡？"
        ),
        1,
        research_question=research_question,
        trusted_domain="archdaily.com",
    )

    assert "public library community library" in program_query
    assert "community cultural center" not in program_query
    assert "adaptive reuse" not in program_query
    assert "atrium" in program_query
    assert "stepped reading" in program_query
    assert "quiet reading" in program_query
    assert "public activity" in program_query
    assert "visual connections" in program_query
    assert "quiet active spaces" not in program_query
    assert "continuous circulation loop" not in program_query
    assert "atrium" in circulation_query
    assert "circulation" in circulation_query
    assert "accessible route" in circulation_query
    assert "egress" in circulation_query
    assert "back-of-house" not in circulation_query
    assert "skylight" in daylight_query
    assert "clerestory" in daylight_query
    assert "daylight" in daylight_query
    assert "roof structure" in daylight_query
    assert "glare" in daylight_query
    assert "column grid" not in daylight_query
    assert "truss" not in daylight_query
    assert "continuous circulation loop" not in daylight_query
    assert len({program_query, circulation_query, daylight_query}) == 3


def test_new_library_fallback_query_keeps_condition_from_the_research_question() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "天窗、侧高窗与结构体系如何形成均匀自然采光？",
        5,
        research_question="请研究新建社区图书馆的采光与结构案例",
        trusted_domain="archdaily.com",
    )

    assert "new-build" in query
    assert "public library community library" in query
    assert "adaptive reuse" not in query


def test_entry_operations_fallback_expands_explicit_activities_safely() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "在客流与后勤活动随时段变化的案例中，入口空间如何容纳不同流线的动态使用需求？",
        4,
        research_question="入口人车冲突时，落客、步行和后勤流线怎样重组？",
        trusted_domain="dezeen.com",
    )

    explicit_dimensions = (
        "passenger drop-off",
        "pedestrian access",
        "back-of-house",
        "operating periods",
    )
    assert 2 <= sum(term in query for term in explicit_dimensions) <= 3
    assert "project description" in query
    assert "circulation circulation" not in query
    assert "loading dock" not in query
    assert "service court" not in query


def test_public_fallback_extracts_user_dimensions_and_rotates_generic_lanes() -> None:
    subquestion = (
        "How can visitors, staff, deliveries, and changing operating periods "
        "relate across shared public spaces?"
    )
    queries = [
        build_public_search_query(
            ResearchGoal.precedent_research,
            "en",
            subquestion,
            round_number,
            research_question="Public building precedent research",
            trusted_domain="archdaily.com",
        )
        for round_number in range(1, 8)
    ]

    assert len(set(queries)) == 7
    assert "visitor" in queries[0]
    assert "spatial relationships" in queries[0]
    assert "spatial organization" in queries[1]
    assert "operational evidence" in queries[2]
    assert "project description" in queries[3]
    assert "spatial organization" in queries[4]
    assert "operational evidence" in queries[5]
    assert "project description" in queries[6]
    assert all(subquestion not in query for query in queries)
    assert "management rules" not in queries[0]
    assert "post-occupancy evaluation" not in queries[0]


def test_drawing_fallback_query_does_not_inherit_precedent_flow_keywords() -> None:
    query = build_public_search_query(
        ResearchGoal.visual_reference_search,
        "en",
        "剖面图的线型、构图和留白怎样形成清晰表达？",
        1,
        research_question="帮我找几种剖面图风格",
    )

    assert "architecture drawing visual reference" in query
    assert "service entrance" not in query
    assert "flexible circulation" not in query


def test_broad_early_inspiration_fallback_search_uses_neutral_research_dimensions() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "新建海洋科研馆有哪些空间组织思路值得参考？",
        1,
        research_question="新建海洋科研馆概念初期案例研究",
        trusted_domain="archdaily.com",
    )

    assert "program relationships" in query
    assert "spatial organization" in query
    assert "quiet active spaces" not in query
    assert "atrium" not in query
    assert "ring circulation" not in query


def test_explicit_spaces_drive_fallback_search_without_invented_typology_templates() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "互动展厅与教育空间如何围绕中庭形成空间联系？",
        1,
        research_question="儿童科学馆互动展厅、教育空间与中庭案例研究",
        trusted_domain="archdaily.com",
    )

    assert "interactive exhibition space" in query
    assert "education space" in query
    assert "atrium" in query
    assert "spatial relationships" in query
    for invented_term in (
        "quiet active spaces",
        "continuous circulation loop",
        "workshop",
        "column grid",
        "truss",
        "core",
    ):
        assert invented_term not in query


def test_unknown_typology_fallback_preserves_the_question_without_inventing_a_type() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "How does a planetarium organize acoustic zoning and visitor circulation?",
        4,
        research_question="Planetarium precedent research",
        trusted_domain="archdaily.com",
    )

    assert "planetarium" in query.casefold()
    assert "adaptive reuse" not in query.casefold()
    assert "public building" not in query.casefold()
    assert "service space" not in query.casefold()


def test_unknown_chinese_typology_fallback_preserves_the_declared_scope() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "样本物流如何与访客流线分离？",
        3,
        research_question="新建滨海珊瑚保育实验站如何组织样本物流？",
        trusted_domain="divisare.com",
    )

    assert "滨海珊瑚保育实验站" in query
    assert "新建" in query
    assert "public building" not in query.casefold()
    assert "adaptive reuse" not in query.casefold()


def test_adaptive_reuse_factory_query_keeps_project_condition_and_retained_structure() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "旧工业厂房改造成文化中心时，保留结构与新增公共空间如何形成清晰界面？",
        1,
        research_question="旧工业厂房改造成社区文化中心",
        trusted_domain="archdaily.com",
    )

    assert "adaptive reuse" in query
    assert "industrial building" in query
    assert "community cultural center" in query
    assert "retained structure" in query
    assert "section" in query


def test_adaptive_reuse_fallback_does_not_invent_unrequested_template_mechanisms() -> None:
    circulation_query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "公众与后勤流线如何通过独立入口分开，并由公共楼梯和连桥连接主要楼层？",
        2,
        research_question="旧工业厂房改造成社区文化中心",
        trusted_domain="archdaily.com",
    )
    program_query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "新增展览和工作坊空间如何与保留结构形成清晰关系？",
        2,
        research_question="旧工业厂房改造成社区文化中心",
        trusted_domain="archdaily.com",
    )

    for query in (circulation_query, program_query):
        assert "adaptive reuse" in query
        assert "industrial building" in query
        assert "community cultural center" in query
    assert "loading dock" not in circulation_query
    assert "box-in-box" not in program_query


def test_cultural_center_extension_query_keeps_the_project_condition() -> None:
    query = build_public_search_query(
        ResearchGoal.precedent_research,
        "en",
        "扩建部分的公共楼梯和连桥如何连接既有文化中心？",
        1,
        research_question="社区文化中心扩建",
        trusted_domain="archdaily.com",
    )

    assert "extension" in query
    assert "community cultural center" in query
    assert "public stair" in query
    assert "bridge" in query
    assert "spatial relationships" in query
    assert "continuous circulation loop" not in query
    assert "adaptive reuse" not in query
