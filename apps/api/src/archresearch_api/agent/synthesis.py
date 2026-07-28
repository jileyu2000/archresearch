from __future__ import annotations

from collections.abc import Sequence

from ..models import AssetCandidate
from ..providers import (
    ResearchSynthesis,
    ResearchSynthesisBranchAnalysis,
    ResearchSynthesisCase,
    ResearchSynthesisFinding,
)
from ..schemas import BudgetMode, ResearchSubquestion


def is_recoverable_research_synthesis_error(error: Exception) -> bool:
    error_type = type(error).__name__
    if error_type == "ValidationError":
        return True
    if isinstance(error, ValueError):
        return any(
            message in str(error)
            for message in (
                "OpenAI response did not contain a structured research synthesis",
                "Research synthesis referenced evidence outside the supplied cases",
                "quick synthesis requires a causal chain and recommendation",
                "balanced synthesis requires comparison and applicability boundary",
                "deep synthesis requires multiple causal chains",
            )
        )
    return isinstance(error, (TimeoutError, ConnectionError)) or error_type in {
        "APIConnectionError",
        "APITimeoutError",
        "ConnectError",
        "ConnectTimeout",
        "InternalServerError",
        "RateLimitError",
        "ReadError",
        "ReadTimeout",
        "RemoteProtocolError",
        "TimeoutException",
    }


def deterministic_research_synthesis(
    budget_mode: BudgetMode,
    subquestions: Sequence[ResearchSubquestion],
    cases: Sequence[ResearchSynthesisCase],
) -> ResearchSynthesis | None:
    branches: list[
        tuple[ResearchSubquestion, ResearchSynthesisCase, ResearchSynthesisBranchAnalysis]
    ] = []
    branches_by_subquestion: dict[
        str,
        list[
            tuple[
                ResearchSubquestion,
                ResearchSynthesisCase,
                ResearchSynthesisBranchAnalysis,
            ]
        ],
    ] = {}
    seen_branches: set[tuple[object, ...]] = set()
    for subquestion in subquestions:
        for case in cases:
            branch = case.subquestion_analysis.get(subquestion.id)
            if branch is None or not branch.transfer_strategy:
                continue
            supported_statements = {
                item.split("｜原文：", 1)[0].strip()
                for item in branch.evidence
                if "｜原文：" in item
            }
            if (
                not {
                    branch.project_context.strip(),
                    branch.design_mechanism.strip(),
                }
                <= supported_statements
            ):
                continue
            identity = (
                subquestion.id,
                case.project_name,
                branch.project_context,
                branch.design_mechanism,
                tuple(branch.transfer_strategy),
                tuple(branch.limitations),
            )
            if identity in seen_branches:
                continue
            seen_branches.add(identity)
            item = (subquestion, case, branch)
            branches.append(item)
            branches_by_subquestion.setdefault(subquestion.id, []).append(item)

    primary_branches = [
        branches_by_subquestion[subquestion.id][0]
        for subquestion in subquestions
        if branches_by_subquestion.get(subquestion.id)
    ]
    causal_count = 1 if budget_mode is BudgetMode.quick else 2
    if len(primary_branches) < causal_count:
        return None

    comparison_pairs: list[
        tuple[
            tuple[ResearchSubquestion, ResearchSynthesisCase, ResearchSynthesisBranchAnalysis],
            tuple[ResearchSubquestion, ResearchSynthesisCase, ResearchSynthesisBranchAnalysis],
        ]
    ] = []
    for subquestion in subquestions:
        distinct_projects: list[
            tuple[ResearchSubquestion, ResearchSynthesisCase, ResearchSynthesisBranchAnalysis]
        ] = []
        seen_projects: set[str] = set()
        for item in branches_by_subquestion.get(subquestion.id, []):
            project_name = item[1].project_name
            if project_name in seen_projects:
                continue
            seen_projects.add(project_name)
            distinct_projects.append(item)
        if len(distinct_projects) >= 2:
            comparison_pairs.append((distinct_projects[0], distinct_projects[1]))

    comparative_mode = budget_mode in {BudgetMode.balanced, BudgetMode.deep}
    if comparative_mode and len(comparison_pairs) < 2:
        return None
    limited_comparison_pairs = [
        pair for pair in comparison_pairs if pair[0][2].limitations and pair[1][2].limitations
    ]
    if comparative_mode and not limited_comparison_pairs:
        return None
    boundary_branches: list[
        tuple[ResearchSubquestion, ResearchSynthesisCase, ResearchSynthesisBranchAnalysis]
    ] = []
    for subquestion in subquestions:
        boundary_branch = next(
            (
                item
                for item in branches_by_subquestion.get(subquestion.id, [])
                if item[2].limitations
            ),
            None,
        )
        if boundary_branch is not None:
            boundary_branches.append(boundary_branch)
    if comparative_mode and len(boundary_branches) < 2:
        return None

    causal_branches = primary_branches[:causal_count]
    answer = deterministic_synthesis_finding(
        [
            "【本地证据汇总】",
            *[
                f"{case.project_name}：{branch.transfer_strategy[0]}"
                for _, case, branch in causal_branches
            ],
        ],
        [case.asset_id for _, case, _ in causal_branches],
    )
    causal_chains = [
        deterministic_synthesis_finding(
            [
                f"条件：{branch.project_context}",
                f"机制：{branch.design_mechanism}",
                f"转译：{branch.transfer_strategy[0]}",
            ],
            [case.asset_id],
        )
        for _, case, branch in causal_branches
    ]
    comparisons = (
        [
            deterministic_synthesis_finding(
                [
                    "同一子问题并列比较",
                    f"{first_case.project_name}采用“{first_branch.design_mechanism}”",
                    f"{second_case.project_name}采用“{second_branch.design_mechanism}”",
                ],
                [first_case.asset_id, second_case.asset_id],
            )
            for (
                (_, first_case, first_branch),
                (_, second_case, second_branch),
            ) in comparison_pairs[:2]
        ]
        if comparative_mode
        else []
    )
    conflicts: list[ResearchSynthesisFinding] = []
    applicability_boundaries: list[ResearchSynthesisFinding] = []
    if comparative_mode:
        (_, first_case, first_branch), (_, second_case, second_branch) = limited_comparison_pairs[0]
        conflicts = [
            deterministic_synthesis_finding(
                [
                    "证据不确定性并列",
                    f"{first_case.project_name}：{first_branch.limitations[0]}",
                    f"{second_case.project_name}：{second_branch.limitations[0]}",
                ],
                [first_case.asset_id, second_case.asset_id],
            )
        ]
        applicability_boundaries = [
            deterministic_synthesis_finding(
                [f"适用边界（{case.project_name}）：{branch.limitations[0]}"],
                [case.asset_id],
            )
            for _, case, branch in boundary_branches[:2]
        ]
    recommendations = [
        deterministic_synthesis_finding(
            [f"转译步骤（{case.project_name}）：{branch.transfer_strategy[0]}"],
            [case.asset_id],
        )
        for _, case, branch in causal_branches
    ]
    return ResearchSynthesis(
        answer=answer,
        causal_chains=causal_chains,
        comparisons=comparisons,
        conflicts=conflicts,
        applicability_boundaries=applicability_boundaries,
        recommendations=recommendations,
    )


def deterministic_synthesis_finding(
    statement_parts: Sequence[str],
    evidence_asset_ids: Sequence[str],
) -> ResearchSynthesisFinding:
    statement = "；".join(part.strip() for part in statement_parts if part.strip())[:2_000]
    return ResearchSynthesisFinding(
        statement=statement,
        evidence_asset_ids=list(dict.fromkeys(evidence_asset_ids)),
    )


def research_synthesis_case_identity(case: ResearchSynthesisCase) -> tuple[object, ...]:
    branch_analysis = tuple(
        (
            subquestion_id,
            analysis.project_context,
            analysis.design_mechanism,
            tuple(analysis.transfer_strategy),
            tuple(analysis.limitations),
            tuple(sorted(analysis.evidence)),
        )
        for subquestion_id, analysis in sorted(case.subquestion_analysis.items())
    )
    return (
        case.source_url,
        case.asset_type,
        tuple(sorted(case.subquestion_ids)),
        case.project_context,
        case.design_mechanism,
        tuple(case.transfer_strategy),
        tuple(case.limitations),
        tuple(sorted(case.evidence)),
        branch_analysis,
    )


def research_synthesis_branch_analysis(
    asset: AssetCandidate,
    evidence_by_statement: dict[tuple[str, str], list[str]],
) -> dict[str, ResearchSynthesisBranchAnalysis]:
    result: dict[str, ResearchSynthesisBranchAnalysis] = {}
    for subquestion_id, branch in (asset.subquestion_analysis or {}).items():
        if not isinstance(branch, dict):
            continue
        project_context = branch.get("project_context")
        design_mechanism = branch.get("design_mechanism")
        transfer_strategy = branch.get("transfer_strategy")
        if (
            not isinstance(project_context, str)
            or not project_context.strip()
            or not isinstance(design_mechanism, str)
            or not design_mechanism.strip()
            or not isinstance(transfer_strategy, list)
            or not transfer_strategy
        ):
            continue
        evidence: list[str] = []
        for statement in (project_context.strip(), design_mechanism.strip()):
            evidence.extend(evidence_by_statement.get((asset.id, statement), []))
        limitations = branch.get("limitations")
        result[subquestion_id] = ResearchSynthesisBranchAnalysis(
            project_context=project_context,
            design_mechanism=design_mechanism,
            transfer_strategy=transfer_strategy,
            limitations=limitations if isinstance(limitations, list) else [],
            evidence=list(dict.fromkeys(evidence))[:6],
        )
    return result
