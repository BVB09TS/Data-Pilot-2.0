"""Tests for improvement suggestor."""

import pytest

from datapilot.agents.suggestor import suggest_improvements, suggestions_to_dict


def test_suggest_improvements():
    """Test suggestion generation from findings."""
    findings = [
        {"type": "dead_model", "model": "analytics_legacy", "evidence": "Zero queries", "severity": "high", "cost_usd": 15},
        {"type": "missing_tests", "model": "core_orders", "evidence": "No tests", "severity": "critical"},
    ]
    suggestions = suggest_improvements(findings)
    assert len(suggestions) == 2
    assert suggestions[0].priority == "critical"  # missing_tests first
    assert suggestions[0].model == "core_orders"
    assert "unique and not_null" in suggestions[0].action


def test_suggestions_to_dict():
    """Test conversion to JSON-serializable dicts."""
    findings = [{"type": "dead_model", "model": "x", "severity": "high"}]
    suggestions = suggest_improvements(findings)
    data = suggestions_to_dict(suggestions)
    assert len(data) == 1
    assert data[0]["model"] == "x"
    assert data[0]["priority"] == "high"
    assert "action" in data[0]
