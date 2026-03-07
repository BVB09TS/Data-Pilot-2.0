"""Tests for analyst agents."""

import pytest

from datapilot.agents.analyst import (
    analyze_missing_tests,
    parse_json_response,
    dedupe,
    RECOMMENDED_ACTIONS,
)


class TestParseJsonResponse:
    def test_parse_valid_json_array(self):
        result = parse_json_response('[{"model": "test"}]')
        assert result == [{"model": "test"}]

    def test_parse_json_with_markdown(self):
        result = parse_json_response('```json\n[{"model": "test"}]\n```')
        assert result == [{"model": "test"}]

    def test_parse_empty_returns_default(self):
        result = parse_json_response("")
        assert result == []

    def test_parse_invalid_returns_default(self):
        result = parse_json_response("not json at all")
        assert result == []

    def test_parse_partial_json(self):
        result = parse_json_response('[{"model": "test"}')
        # Should attempt to parse partial
        assert isinstance(result, list)

    def test_custom_default(self):
        result = parse_json_response("bad", default={"error": True})
        assert result == {"error": True}


class TestDedupe:
    def test_dedupe_by_key(self):
        items = [{"model": "a"}, {"model": "b"}, {"model": "a"}]
        result = dedupe(items, "model")
        assert len(result) == 2

    def test_dedupe_skips_non_dicts(self):
        items = [{"model": "a"}, "not a dict", {"model": "b"}]
        result = dedupe(items, "model")
        assert len(result) == 2

    def test_dedupe_empty(self):
        assert dedupe([], "model") == []


class TestAnalyzeMissingTests:
    def test_detects_missing_tests(self):
        models = {
            "core_orders": {
                "yml": {
                    "models": [
                        {
                            "name": "core_orders",
                            "columns": [
                                {"name": "order_id", "tests": []},
                            ],
                        }
                    ]
                }
            }
        }
        findings = analyze_missing_tests(models)
        assert len(findings) == 1
        assert findings[0]["model"] == "core_orders"
        assert findings[0]["issue"] == "missing_tests"
        assert findings[0]["severity"] == "critical"

    def test_passes_when_tests_present(self):
        models = {
            "core_orders": {
                "yml": {
                    "models": [
                        {
                            "name": "core_orders",
                            "columns": [
                                {"name": "order_id", "tests": ["unique", "not_null"]},
                            ],
                        }
                    ]
                }
            }
        }
        findings = analyze_missing_tests(models)
        assert len(findings) == 0

    def test_skips_unknown_models(self):
        models = {"unknown_model": {"yml": {}}}
        findings = analyze_missing_tests(models)
        assert len(findings) == 0

    def test_detects_partial_tests(self):
        models = {
            "core_orders": {
                "yml": {
                    "models": [
                        {
                            "name": "core_orders",
                            "columns": [
                                {"name": "order_id", "tests": ["unique"]},
                            ],
                        }
                    ]
                }
            }
        }
        findings = analyze_missing_tests(models)
        assert len(findings) == 1
        assert "not_null" in findings[0]["evidence"]


class TestRecommendedActions:
    def test_all_issue_types_have_actions(self):
        expected_types = [
            "dead_model",
            "orphaned_model",
            "broken_lineage",
            "wrong_grain_join",
            "deprecated_source",
            "missing_tests",
            "logic_drift",
            "duplicate_metric",
            "redundant_model",
        ]
        for t in expected_types:
            assert t in RECOMMENDED_ACTIONS, f"Missing action for {t}"
