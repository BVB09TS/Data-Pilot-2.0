"""Tests for feedback store."""

import json
import tempfile
from pathlib import Path

import pytest

from datapilot.core.feedback import FeedbackStore


def test_feedback_store_append_and_summarize():
    """Test appending records and summarizing."""
    with tempfile.TemporaryDirectory() as tmp:
        store_path = Path(tmp) / "feedback.json"
        store = FeedbackStore(store_path=store_path)

        store.append(
            score_pct=80.0,
            problems_found=20,
            planted_total=26,
            missed_ids=["DEAD-001", "ORPHAN-002"],
            findings_count=25,
            project_root="/test/project",
            passed=True,
        )
        store.append(
            score_pct=70.0,
            problems_found=18,
            planted_total=26,
            missed_ids=["DEAD-001", "DEAD-002", "ORPHAN-001"],
            findings_count=22,
            passed=False,
        )

        summary = store.summarize(last_n=5)
        assert summary["runs"] == 2
        assert summary["avg_score"] == 75.0
        assert summary["passed_count"] == 1
        assert summary["most_missed"][0][0] == "DEAD-001"
        assert summary["most_missed"][0][1] == 2


def test_feedback_store_empty():
    """Test summarize with no runs."""
    with tempfile.TemporaryDirectory() as tmp:
        store = FeedbackStore(store_path=Path(tmp) / "empty.json")
        summary = store.summarize()
        assert summary["runs"] == 0
        assert "No runs recorded" in summary["message"]
