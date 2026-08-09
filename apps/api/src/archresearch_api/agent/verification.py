from __future__ import annotations

from typing import NotRequired, TypedDict

from sqlalchemy import select

from ..database import Database
from ..models import AssetCandidate, EvidenceClaim, QueryAttempt
from ..schemas import DEPTH_TARGETS, BudgetMode, ResearchGoal, ResultTier
from .execution import get_run

NON_PRECEDENT_COVERAGE_TARGETS: dict[BudgetMode, tuple[int, int, int]] = {
    BudgetMode.quick: (4, 2, 2),
    BudgetMode.balanced: (6, 3, 4),
    BudgetMode.deep: (9, 4, 6),
}


class CoverageData(TypedDict):
    usable_assets: int
    project_count: int
    verified_or_partial: int
    subquestion_count: int
    covered_subquestions: int
    covered_subquestion_ids: list[str]
    multi_asset_projects: int
    subquestion_passes: dict[str, int]
    projects_per_subquestion: NotRequired[dict[str, int]]
    gaps: list[str]
    enrichment_gaps: list[str]
    synthesis: NotRequired[dict[str, object]]


def calculate_coverage(
    db: Database,
    run_id: str,
    *,
    require_article_analysis: bool = False,
) -> CoverageData:
    with db.session_factory() as session:
        run = get_run(session, run_id)
        assets = list(
            session.scalars(select(AssetCandidate).where(AssetCandidate.run_id == run_id))
        )
        completed_attempts = list(
            session.scalars(
                select(QueryAttempt).where(
                    QueryAttempt.run_id == run_id,
                    QueryAttempt.status == "completed",
                )
            )
        )
        evidence_rows = session.execute(
            select(
                EvidenceClaim.asset_candidate_id,
                EvidenceClaim.source_url,
                EvidenceClaim.statement,
                EvidenceClaim.text_excerpt,
            )
            .join(
                AssetCandidate,
                EvidenceClaim.asset_candidate_id == AssetCandidate.id,
            )
            .where(AssetCandidate.run_id == run_id)
        ).all()
        evidence_asset_ids = {asset_candidate_id for asset_candidate_id, _, _, _ in evidence_rows}
        article_evidence_statements: dict[str, set[str]] = {}
        for asset_candidate_id, _, statement, text_excerpt in evidence_rows:
            if text_excerpt is not None and text_excerpt.strip():
                article_evidence_statements.setdefault(asset_candidate_id, set()).add(
                    statement.strip()
                )
    usable = [
        asset
        for asset in assets
        if asset.relevance >= 2 and (asset.image_url is not None or bool(asset.storage_path))
    ]
    verified_or_partial = [
        asset
        for asset in assets
        if asset.relevance >= 2
        and asset.result_tier in {ResultTier.verified.value, ResultTier.partial.value}
    ]
    evidence_backed = [asset for asset in verified_or_partial if asset.id in evidence_asset_ids]
    article_ready = [
        asset
        for asset in verified_or_partial
        if asset.project_context.strip()
        and asset.design_mechanism.strip()
        and bool(asset.transfer_strategy)
        and {
            asset.project_context.strip(),
            asset.design_mechanism.strip(),
        }
        <= article_evidence_statements.get(asset.id, set())
    ]
    run_goal = ResearchGoal(run.goal)
    is_precedent = run_goal is ResearchGoal.precedent_research
    is_visual_reference = run_goal is ResearchGoal.visual_reference_search
    coverage_assets = (
        article_ready
        if is_precedent and require_article_analysis
        else verified_or_partial
        if is_precedent
        else usable
    )
    projects = {asset.project_name for asset in coverage_assets}
    verified_source_urls_by_project: dict[str, set[str]] = {}
    if is_precedent and require_article_analysis:
        for asset in article_ready:
            verified_source_urls_by_project.setdefault(asset.project_name, set()).add(
                asset.source_url
            )
        project_enrichment_assets = [
            asset
            for asset in verified_or_partial
            if asset.source_url in verified_source_urls_by_project.get(asset.project_name, set())
        ]
    else:
        project_enrichment_assets = coverage_assets
    project_asset_ids: dict[str, set[str]] = {}
    project_asset_types: dict[str, set[str]] = {}
    subquestion_asset_ids: dict[str, set[str]] = {}
    subquestion_project_names: dict[str, set[str]] = {}
    for asset in project_enrichment_assets:
        project_asset_ids.setdefault(asset.project_name, set()).add(asset.id)
        project_asset_types.setdefault(asset.project_name, set()).add(asset.asset_type)
    subquestions = list(run.subquestions or [])
    planned_subquestion_ids = {
        str(item.get("id")) for item in subquestions if isinstance(item, dict) and item.get("id")
    }
    if require_article_analysis:
        for asset in article_ready:
            for subquestion_id, branch in (asset.subquestion_analysis or {}).items():
                if not isinstance(branch, dict):
                    continue
                project_context = branch.get("project_context")
                design_mechanism = branch.get("design_mechanism")
                transfer_strategy = branch.get("transfer_strategy")
                if (
                    isinstance(project_context, str)
                    and project_context.strip()
                    and isinstance(design_mechanism, str)
                    and design_mechanism.strip()
                    and isinstance(transfer_strategy, list)
                    and bool(transfer_strategy)
                    and {project_context.strip(), design_mechanism.strip()}
                    <= article_evidence_statements.get(asset.id, set())
                ):
                    subquestion_asset_ids.setdefault(subquestion_id, set()).add(asset.id)
                    subquestion_project_names.setdefault(subquestion_id, set()).add(
                        asset.project_name
                    )
    else:
        relationship_assets = coverage_assets if is_visual_reference else evidence_backed
        for asset in relationship_assets:
            for subquestion_id in asset.subquestion_ids or []:
                subquestion_asset_ids.setdefault(subquestion_id, set()).add(asset.id)
                subquestion_project_names.setdefault(subquestion_id, set()).add(asset.project_name)
    depth_target = DEPTH_TARGETS[BudgetMode(run.budget_mode)] if is_precedent else None
    minimum_assets_per_subquestion = (
        depth_target.assets_per_subquestion if depth_target is not None else 1
    )
    covered_subquestions = sum(
        bool(subquestion_asset_ids.get(subquestion_id))
        for subquestion_id in planned_subquestion_ids
    )
    enriched_subquestions = sum(
        len(subquestion_asset_ids.get(subquestion_id, set())) >= minimum_assets_per_subquestion
        for subquestion_id in planned_subquestion_ids
    )
    multi_asset_projects = sum(
        len(project_asset_ids.get(project, set())) >= 2
        and len(project_asset_types.get(project, set())) >= 2
        for project in projects
    )
    pass_numbers: dict[str, set[int]] = {}
    for attempt in completed_attempts:
        if attempt.subquestion_id is not None:
            pass_numbers.setdefault(attempt.subquestion_id, set()).add(attempt.round_number)
    subquestion_passes = {
        subquestion_id: len(pass_numbers.get(subquestion_id, set()))
        for subquestion_id in planned_subquestion_ids
    }

    if is_precedent:
        assert depth_target is not None
        target = depth_target
        target_assets = target.assets
        target_projects = target.projects
        target_verified = target.verified_or_partial
        target_multi_asset_projects = target.multi_asset_projects
    else:
        target_assets, target_projects, target_verified = NON_PRECEDENT_COVERAGE_TARGETS[
            BudgetMode(run.budget_mode)
        ]
        target_multi_asset_projects = 0

    target_subquestions = len(planned_subquestion_ids)
    gaps: list[str] = []
    if covered_subquestions < target_subquestions:
        gaps.append("uncovered_subquestions")
    if require_article_analysis and covered_subquestions < target_subquestions:
        gaps.append("article_analysis_incomplete")

    enrichment_gaps: list[str] = []
    if len(usable) < target_assets:
        enrichment_gaps.append("insufficient_usable_assets")
    if len(projects) < target_projects:
        enrichment_gaps.append("insufficient_project_diversity")
    enrichment_quality_assets = usable if is_visual_reference else verified_or_partial
    if len(enrichment_quality_assets) < target_verified:
        enrichment_gaps.append("insufficient_verified_or_partial")
    if enriched_subquestions < target_subquestions:
        enrichment_gaps.append("insufficient_subquestion_assets")
    if multi_asset_projects < target_multi_asset_projects:
        enrichment_gaps.append("insufficient_multi_asset_projects")
    coverage: CoverageData = {
        "usable_assets": len(usable),
        "project_count": len(projects),
        "verified_or_partial": len(verified_or_partial),
        "subquestion_count": len(subquestions),
        "covered_subquestions": covered_subquestions,
        "covered_subquestion_ids": sorted(
            subquestion_id
            for subquestion_id in planned_subquestion_ids
            if subquestion_asset_ids.get(subquestion_id)
        ),
        "multi_asset_projects": multi_asset_projects,
        "subquestion_passes": subquestion_passes,
        "gaps": gaps,
        "enrichment_gaps": enrichment_gaps,
    }
    if is_precedent:
        coverage["projects_per_subquestion"] = {
            subquestion_id: len(subquestion_project_names.get(subquestion_id, set()))
            for subquestion_id in sorted(planned_subquestion_ids)
        }
    return coverage


def completion_satisfied(coverage: CoverageData) -> bool:
    return not coverage["gaps"]


def enrichment_satisfied(coverage: CoverageData) -> bool:
    return completion_satisfied(coverage) and not coverage["enrichment_gaps"]
