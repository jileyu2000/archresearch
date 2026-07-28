import archresearch_api.workflow as workflow_module
from archresearch_api.agent import synthesis as synthesis_module
from archresearch_api.agent.synthesis import (
    deterministic_synthesis_finding,
    is_recoverable_research_synthesis_error,
)


def test_deterministic_finding_deduplicates_evidence_ids() -> None:
    finding = deterministic_synthesis_finding([" 条件 ", "", "机制"], ["asset-1", "asset-1"])

    assert finding.statement == "条件；机制"
    assert finding.evidence_asset_ids == ["asset-1"]


def test_recoverable_synthesis_errors_stay_bounded() -> None:
    assert is_recoverable_research_synthesis_error(TimeoutError())
    assert not is_recoverable_research_synthesis_error(ValueError("unrelated programming error"))


def test_workflow_uses_the_synthesis_boundary() -> None:
    assert (
        workflow_module.deterministic_research_synthesis
        is synthesis_module.deterministic_research_synthesis
    )
