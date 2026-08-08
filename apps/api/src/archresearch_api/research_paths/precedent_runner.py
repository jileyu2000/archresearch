from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from time import monotonic

from ..database import Database
from ..inspection import BrowserCommandClient
from ..providers import ResearchProvider
from ..public_pages import PublicPageParser
from ..visual import VisualClassifier
from .precedent import POLICY


def execute_precedent_run(
    db: Database,
    run_id: str,
    provider: ResearchProvider,
    on_terminal: Callable[[str], None] | None = None,
    *,
    browser_client: BrowserCommandClient | None = None,
    visual_classifier: VisualClassifier | None = None,
    candidate_root: Path | None = None,
    public_page_parser: PublicPageParser | None = None,
    clock: Callable[[], float] = monotonic,
) -> None:
    """Run the precedent path with its public-source contract only."""
    from ..workflow import _execute_run_with_policy

    _execute_run_with_policy(
        db,
        run_id,
        provider,
        on_terminal,
        path=POLICY,
        browser_client=browser_client,
        visual_classifier=visual_classifier,
        candidate_root=candidate_root,
        public_page_parser=public_page_parser,
        xiaohongshu_search=None,
        clock=clock,
    )
