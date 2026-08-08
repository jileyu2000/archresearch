from ..schemas import ResearchGoal
from . import drawing, precedent
from .types import ResearchPathPolicy, SearchAvailability


def policy_for_goal(goal: ResearchGoal) -> ResearchPathPolicy:
    if goal is ResearchGoal.precedent_research:
        return precedent.POLICY
    if goal is ResearchGoal.visual_reference_search:
        return drawing.POLICY
    raise ValueError(f"Unsupported research goal: {goal}")


__all__ = [
    "ResearchPathPolicy",
    "SearchAvailability",
    "drawing",
    "policy_for_goal",
    "precedent",
]
