import archresearch_api.workflow as workflow_module
from archresearch_api.agent import verification as verification_module
from archresearch_api.agent.verification import (
    CoverageData,
    completion_satisfied,
    enrichment_satisfied,
)


def _coverage(
    *,
    gaps: list[str] | None = None,
    enrichment_gaps: list[str] | None = None,
) -> CoverageData:
    return {
        "usable_assets": 6,
        "project_count": 3,
        "verified_or_partial": 6,
        "subquestion_count": 3,
        "covered_subquestions": 3,
        "covered_subquestion_ids": ["program", "circulation", "section"],
        "multi_asset_projects": 3,
        "subquestion_passes": {
            "program": 1,
            "circulation": 1,
            "section": 1,
        },
        "gaps": gaps or [],
        "enrichment_gaps": enrichment_gaps or [],
    }


def test_completion_requires_coverage_and_enrichment() -> None:
    coverage_only = _coverage(enrichment_gaps=["insufficient_subquestion_assets"])

    assert completion_satisfied(coverage_only)
    assert not enrichment_satisfied(coverage_only)
    assert enrichment_satisfied(_coverage())


def test_workflow_uses_the_verification_boundary() -> None:
    assert workflow_module.calculate_coverage is verification_module.calculate_coverage
    assert workflow_module.enrichment_satisfied is verification_module.enrichment_satisfied
