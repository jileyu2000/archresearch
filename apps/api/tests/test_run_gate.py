from archresearch_api.run_gate import ResearchRunGate


def test_single_run_gate_rejects_overlap_until_the_owner_releases() -> None:
    gate = ResearchRunGate()

    assert gate.reserve("run-one") is True
    assert gate.reserve("run-two") is False

    gate.release("run-two")
    assert gate.reserve("run-two") is False

    gate.release("run-one")
    assert gate.reserve("run-two") is True
