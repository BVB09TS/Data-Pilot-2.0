"""Tests for report builder."""

import pytest

from datapilot.core.reporter import build_report, SEVERITY_MAP, RECOMMENDED_ACTIONS


SAMPLE_FINDINGS = {
    "dead_models": [
        {"model": "old_model", "issue": "dead_model", "evidence": "No queries", "cost_usd": 100}
    ],
    "orphans": [
        {"model": "orphan_model", "issue": "orphaned_model", "evidence": "No consumers"}
    ],
    "broken_refs": [],
    "duplicate_metrics": [
        {"models": ["a", "b"], "metric": "total_revenue", "issue": "duplicate_metric", "evidence": "Defined 2 ways"}
    ],
    "grain_joins": [],
    "deprecated": [],
    "missing_tests": [
        {"model": "core_orders", "issue": "missing_tests", "severity": "critical", "evidence": "Zero tests"}
    ],
    "logic_drift": [],
}


class TestBuildReport:
    def test_report_structure(self):
        report = build_report(SAMPLE_FINDINGS, {}, {})
        assert "version" in report
        assert "generated_at" in report
        assert "total_findings" in report
        assert "findings" in report
        assert "by_type" in report
        assert "by_severity" in report

    def test_finding_count(self):
        report = build_report(SAMPLE_FINDINGS, {}, {})
        assert report["total_findings"] == 4  # 1 dead + 1 orphan + 1 dup + 1 test

    def test_cost_aggregation(self):
        report = build_report(SAMPLE_FINDINGS, {"old_model": 100}, {})
        assert report["total_monthly_waste_usd"] >= 100

    def test_deduplication(self):
        findings = {
            "dead_models": [
                {"model": "x", "issue": "dead_model", "evidence": "a"},
                {"model": "x", "issue": "dead_model", "evidence": "b"},
            ],
            "orphans": [],
            "broken_refs": [],
            "duplicate_metrics": [],
            "grain_joins": [],
            "deprecated": [],
            "missing_tests": [],
            "logic_drift": [],
        }
        report = build_report(findings, {}, {})
        assert report["total_findings"] == 1

    def test_agent_stats_included(self):
        report = build_report(SAMPLE_FINDINGS, {}, {}, agent_stats={"test": {"calls": 1}})
        assert "agent_stats" in report
        assert report["agent_stats"]["test"]["calls"] == 1


class TestSeverityMap:
    def test_critical_types(self):
        assert SEVERITY_MAP["broken_lineage"] == "critical"
        assert SEVERITY_MAP["wrong_grain_join"] == "critical"

    def test_all_types_mapped(self):
        for key in RECOMMENDED_ACTIONS:
            assert key in SEVERITY_MAP, f"{key} missing from SEVERITY_MAP"
