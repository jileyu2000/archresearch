import archresearch_api.workflow as workflow_module
from archresearch_api.agent import execution as execution_module
from archresearch_api.agent.execution import is_timeout_error, page_budget_available


class APITimeoutError(Exception):
    pass


def test_page_budget_keeps_normal_and_recovery_limits_separate() -> None:
    assert page_budget_available(
        round_number=2,
        normal_rounds=2,
        normal_attempts=1,
        normal_limit=2,
        subquestion_id="program",
        recovery_attempts={"program": 4},
        recovery_limit=1,
    )
    assert page_budget_available(
        round_number=3,
        normal_rounds=2,
        normal_attempts=99,
        normal_limit=2,
        subquestion_id="program",
        recovery_attempts={"program": 0},
        recovery_limit=1,
    )
    assert not page_budget_available(
        round_number=3,
        normal_rounds=2,
        normal_attempts=0,
        normal_limit=2,
        subquestion_id="program",
        recovery_attempts={"program": 1},
        recovery_limit=1,
    )


def test_timeout_classification_stays_bounded() -> None:
    assert is_timeout_error(TimeoutError())
    assert is_timeout_error(APITimeoutError())
    assert not is_timeout_error(RuntimeError("provider failed"))


def test_workflow_uses_the_execution_boundary() -> None:
    assert workflow_module.checkpoint is execution_module.checkpoint
    assert workflow_module.page_budget_available is execution_module.page_budget_available
