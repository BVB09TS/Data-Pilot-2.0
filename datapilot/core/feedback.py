"""Feedback store for continuous improvement.

Persists run results and scores so we can:
- Track score trends over time
- Identify recurring missed problems
- Support future prompt/config tuning
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _default(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class FeedbackStore:
    """Append-only store of audit run records for feedback analysis."""

    def __init__(self, store_path: str | Path | None = None):
        self.store_path = Path(store_path or "datapilot_feedback.json")
        self._ensure_file()

    def _ensure_file(self) -> None:
        """Create store file with empty list if it doesn't exist."""
        if not self.store_path.exists():
            self.store_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.store_path, "w", encoding="utf-8") as f:
                json.dump([], f)

    def append(
        self,
        *,
        score_pct: float | None = None,
        problems_found: int | None = None,
        planted_total: int | None = None,
        missed_ids: list[str] | None = None,
        findings_count: int | None = None,
        project_root: str | None = None,
        passed: bool | None = None,
    ) -> str:
        """Append a run record and return the run_id."""
        run_id = str(uuid.uuid4())[:8]
        record = {
            "run_id": run_id,
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "score_pct": score_pct,
            "problems_found": problems_found,
            "planted_total": planted_total,
            "missed_ids": missed_ids or [],
            "findings_count": findings_count,
            "project_root": project_root,
            "passed": passed,
        }

        records = self._load()
        records.append(record)
        self._save(records)
        return run_id

    def _load(self) -> list[dict]:
        """Load all records from the store."""
        if not self.store_path.exists():
            return []
        with open(self.store_path, encoding="utf-8") as f:
            return json.load(f)

    def _save(self, records: list[dict]) -> None:
        """Save records atomically with an exclusive file lock."""
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.store_path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            # Acquire exclusive lock before writing (POSIX; no-op on Windows)
            if sys.platform != "win32":
                import fcntl
                fcntl.flock(f, fcntl.LOCK_EX)
            try:
                json.dump(records, f, indent=2, default=_default)
            finally:
                if sys.platform != "win32":
                    fcntl.flock(f, fcntl.LOCK_UN)
        tmp.replace(self.store_path)  # atomic rename

    def get_last_n(self, n: int = 10) -> list[dict]:
        """Get the last N run records (most recent first)."""
        records = self._load()
        return list(reversed(records[-n:]))

    def summarize(self, last_n: int = 10) -> dict[str, Any]:
        """Compute summary statistics from recent runs."""
        runs = self.get_last_n(last_n)
        if not runs:
            return {"runs": 0, "message": "No runs recorded yet."}

        scores = [r["score_pct"] for r in runs if r.get("score_pct") is not None]
        missed_all: list[str] = []
        for r in runs:
            missed_all.extend(r.get("missed_ids") or [])

        from collections import Counter

        missed_counts = Counter(missed_all)

        return {
            "runs": len(runs),
            "last_n": last_n,
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
            "min_score": min(scores) if scores else None,
            "max_score": max(scores) if scores else None,
            "passed_count": sum(1 for r in runs if r.get("passed")),
            "most_missed": missed_counts.most_common(5),
            "recent_runs": runs,
        }
