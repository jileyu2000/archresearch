from __future__ import annotations

from threading import Lock


class ResearchRunGate:
    """Process-local single-run lease for the local desktop application."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._active_run_id: str | None = None

    def reserve(self, run_id: str) -> bool:
        with self._lock:
            if self._active_run_id is not None:
                return False
            self._active_run_id = run_id
            return True

    def release(self, run_id: str) -> None:
        with self._lock:
            if self._active_run_id == run_id:
                self._active_run_id = None
