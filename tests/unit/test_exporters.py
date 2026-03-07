"""Tests for export formats."""

import json
import os
import tempfile

import pytest

from datapilot.exporters.formats import (
    export_json,
    export_csv,
    export_sarif,
    export_jira,
    export_all,
)


SAMPLE_REPORT = {
    "version": "2.0.0",
    "generated_at": "2024-01-01T00:00:00",
    "total_findings": 3,
    "by_type": {"dead_model": 1, "broken_lineage": 1, "missing_tests": 1},
    "by_severity": {"critical": 1, "high": 1, "medium": 1},
    "total_monthly_waste_usd": 500,
    "findings": [
        {
            "type": "dead_model",
            "model": "old_model",
            "severity": "high",
            "evidence": "Not queried in 90 days",
            "cost_usd": 200,
            "action": "Drop this model",
        },
        {
            "type": "broken_lineage",
            "model": "broken_model",
            "severity": "critical",
            "evidence": "References missing model",
            "cost_usd": 0,
            "action": "Fix the reference",
        },
        {
            "type": "missing_tests",
            "model": "core_orders",
            "severity": "high",
            "evidence": "No tests defined",
            "cost_usd": 0,
            "action": "Add tests",
        },
    ],
}


class TestExportJSON:
    def test_export_creates_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_json(SAMPLE_REPORT, tmpdir)
            assert os.path.exists(path)
            with open(path) as f:
                data = json.load(f)
            assert data["total_findings"] == 3


class TestExportCSV:
    def test_export_creates_csv(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_csv(SAMPLE_REPORT, tmpdir)
            assert os.path.exists(path)
            with open(path) as f:
                lines = f.readlines()
            assert len(lines) == 4  # header + 3 findings


class TestExportSARIF:
    def test_valid_sarif_structure(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_sarif(SAMPLE_REPORT, tmpdir)
            with open(path) as f:
                sarif = json.load(f)
            assert sarif["version"] == "2.1.0"
            assert len(sarif["runs"]) == 1
            assert sarif["runs"][0]["tool"]["driver"]["name"] == "DataPilot"
            assert len(sarif["runs"][0]["results"]) == 3

    def test_sarif_rules(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_sarif(SAMPLE_REPORT, tmpdir)
            with open(path) as f:
                sarif = json.load(f)
            rules = sarif["runs"][0]["tool"]["driver"]["rules"]
            rule_ids = {r["id"] for r in rules}
            assert "dead_model" in rule_ids
            assert "broken_lineage" in rule_ids


class TestExportJira:
    def test_jira_issues(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_jira(SAMPLE_REPORT, tmpdir)
            with open(path) as f:
                data = json.load(f)
            issues = data["issues"]
            assert len(issues) == 3
            assert issues[1]["priority"] == "Highest"  # critical → Highest


class TestExportAll:
    def test_multiple_formats(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            results = export_all(SAMPLE_REPORT, tmpdir, ["json", "csv", "sarif"])
            assert "json" in results
            assert "csv" in results
            assert "sarif" in results
            for path in results.values():
                assert os.path.exists(path)

    def test_unknown_format(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            results = export_all(SAMPLE_REPORT, tmpdir, ["unknown"])
            assert "Unknown format" in results["unknown"]
