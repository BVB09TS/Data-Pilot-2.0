"""Report builder with scoring, export, and formatting.

Enhanced from v1 with:
- Structured report model
- Multiple export formats
- Integration-ready output
"""

from __future__ import annotations

import importlib.util
import json
from datetime import datetime, timezone
from typing import Any

import structlog

logger = structlog.get_logger()


RECOMMENDED_ACTIONS = {
    "dead_model": "Drop this model and remove from the dbt project. Verify no hidden consumers first.",
    "orphaned_model": "Either connect to a downstream consumer or remove if no longer needed.",
    "broken_lineage": "Fix the broken ref or remove the model if the upstream will not be created.",
    "wrong_grain_join": "Fix the join to match grains — aggregate the finer grain before joining.",
    "deprecated_source": "Migrate to the replacement source and decommission this model.",
    "missing_tests": "Add unique and not_null tests on the primary key column.",
    "logic_drift": "Consolidate with the canonical model and deprecate the duplicate.",
    "duplicate_metric": "Standardize the metric definition across all models using a single source of truth.",
    "redundant_model": "Remove this model and migrate consumers to the canonical version.",
    "cost_anomaly": "Review model usage and consider optimization or deprecation.",
}

SEVERITY_MAP = {
    "dead_model": "high",
    "broken_lineage": "critical",
    "wrong_grain_join": "critical",
    "missing_tests": "high",
    "deprecated_source": "medium",
    "orphaned_model": "low",
    "logic_drift": "medium",
    "duplicate_metric": "high",
    "redundant_model": "medium",
    "cost_anomaly": "medium",
}


def build_report(
    findings: dict[str, list[dict]],
    cost_waste: dict,
    models: dict,
    agent_stats: dict[str, Any] | None = None,
) -> dict:
    """Build a structured audit report from findings."""
    all_findings: list[dict] = []

    def _add(items: list[dict] | None, ftype: str) -> None:
        for item in items or []:
            if not isinstance(item, dict):
                continue
            model = item.get("model") or str(item.get("models", "?"))
            cost_usd = item.get("cost_usd") or cost_waste.get(model, 0)
            issue_type = ftype or item.get("issue", ftype)
            all_findings.append(
                {
                    "type": issue_type,
                    "model": model,
                    "evidence": item.get("evidence", ""),
                    "cost_usd": cost_usd,
                    "severity": item.get("severity") or SEVERITY_MAP.get(issue_type, "medium"),
                    "action": RECOMMENDED_ACTIONS.get(issue_type, "Review and address."),
                    "_raw": item,
                }
            )

    _add(findings.get("dead_models"), "dead_model")
    _add(findings.get("orphans"), "orphaned_model")
    _add(findings.get("broken_refs"), "broken_lineage")
    _add(findings.get("grain_joins"), "wrong_grain_join")
    _add(findings.get("deprecated"), "deprecated_source")
    _add(findings.get("missing_tests"), "missing_tests")
    _add(findings.get("logic_drift"), "logic_drift")
    _add(findings.get("anomalies"), "cost_anomaly")

    for item in findings.get("duplicate_metrics") or []:
        if not isinstance(item, dict):
            continue
        issue = item.get("issue", "duplicate_metric")
        model = item.get("model") or str(item.get("models", "?"))
        all_findings.append(
            {
                "type": issue,
                "model": model,
                "evidence": item.get("evidence", ""),
                "cost_usd": item.get("cost_usd") or cost_waste.get(model, 0),
                "severity": SEVERITY_MAP.get(issue, "medium"),
                "action": RECOMMENDED_ACTIONS.get(issue, "Review and address."),
                "_raw": item,
            }
        )

    # Deduplicate
    seen: set[tuple[str, str]] = set()
    deduped = []
    for f in all_findings:
        key = (f["type"], f["model"])
        if key not in seen:
            seen.add(key)
            deduped.append(f)
    all_findings = deduped

    total_waste = sum(f["cost_usd"] for f in all_findings)
    by_type: dict[str, int] = {}
    for f in all_findings:
        by_type[f["type"]] = by_type.get(f["type"], 0) + 1

    by_severity: dict[str, int] = {}
    for f in all_findings:
        by_severity[f["severity"]] = by_severity.get(f["severity"], 0) + 1

    # Improvement suggestions
    from datapilot.agents.suggestor import suggest_improvements, suggestions_to_dict

    suggestions = suggest_improvements(all_findings)
    suggestions_data = suggestions_to_dict(suggestions)

    report = {
        "version": "2.0.0",
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "total_findings": len(all_findings),
        "by_type": by_type,
        "by_severity": by_severity,
        "total_monthly_waste_usd": total_waste,
        "total_models": len(models),
        "findings": all_findings,
        "suggestions": suggestions_data,
    }

    if agent_stats:
        report["agent_stats"] = agent_stats

    return report


def score_against_answer_key(report: dict, answer_key_path: str) -> dict:
    """Score findings against planted problems answer key."""
    spec = importlib.util.spec_from_file_location("answer_key", answer_key_path)
    ak = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ak)

    planted = ak.PLANTED_PROBLEMS
    total = len(planted)
    threshold = int(total * ak.PASS_THRESHOLD)

    found_ids: set[str] = set()
    for finding in report["findings"]:
        f_model = finding["model"].lower()
        f_type = finding["type"].lower().replace("_", "")

        for p in planted:
            pid = p["id"]
            if pid in found_ids:
                continue

            p_models: set[str] = set()
            if "model" in p:
                pm = p["model"]
                if isinstance(pm, list):
                    p_models.update(m.lower() for m in pm)
                else:
                    p_models.add(pm.lower())
            if "models" in p:
                p_models.update(m.lower() for m in p["models"])

            p_type = p["type"].lower().replace("_", "")

            TYPE_ALIASES = {
                "redundantmodel": {"redundantmodel", "duplicatemetric", "logicdrif", "logicdrift"},
                "logicdrift": {"logicdrift", "redundantmodel"},
                "duplicatemetric": {"duplicatemetric", "redundantmodel"},
                "missingtests": {"missingtests"},
                "deadmodel": {"deadmodel"},
                "brokenlineage": {"brokenlineage"},
                "deprecatedsource": {"deprecatedsource", "deprecatedchain"},
                "deprecatedchain": {"deprecatedchain", "deprecatedsource"},
                "wronggrainjoin": {"wronggrainjoin"},
                "orphanedmodel": {"orphanedmodel"},
            }
            allowed = TYPE_ALIASES.get(p_type, {p_type})
            type_ok = f_type in allowed or p_type in TYPE_ALIASES.get(f_type, {f_type})

            model_ok = any(pm in f_model or f_model in pm for pm in p_models)

            if type_ok and model_ok:
                found_ids.add(pid)

    found = len(found_ids)
    passed = found >= threshold

    return {
        "planted_total": total,
        "pass_threshold": threshold,
        "problems_found": found,
        "problems_missed": total - found,
        "score_pct": round(found / total * 100, 1),
        "passed": passed,
        "found_ids": sorted(found_ids),
        "missed_ids": sorted({p["id"] for p in planted} - found_ids),
    }


def print_report(report: dict, score: dict | None = None) -> None:
    """Print a formatted report to stdout."""
    SEP = "=" * 58
    print(f"\n{SEP}")
    print("  DataPilot v2.0  --  Audit Report")
    print(SEP)
    print(f"  Generated : {report['generated_at'][:19]}")
    print(f"  Models    : {report.get('total_models', '?')}")
    print(f"  Findings  : {report['total_findings']}")
    print(f"  Est. waste: ${report['total_monthly_waste_usd']}/month")

    if report.get("by_severity"):
        print("\n  By severity:")
        for sev in ["critical", "high", "medium", "low"]:
            if sev in report["by_severity"]:
                print(f"    {sev:12s} {report['by_severity'][sev]}")

    print("\n  By type:")
    for t, c in sorted(report["by_type"].items()):
        print(f"    {t:28s} {c}")

    if report.get("agent_stats"):
        print(f"\n  Agent stats:")
        total_cost = sum(
            s.get("total_cost_usd", 0) for s in report["agent_stats"].values()
        )
        print(f"    Total LLM cost: ${total_cost:.4f}")

    if score:
        print(f"\n{SEP}")
        print("  Score vs planted problems")
        print(SEP)
        pct = int(score["pass_threshold"] / score["planted_total"] * 100)
        result = "[PASS]" if score["passed"] else "[FAIL]"
        print(f"  Planted    : {score['planted_total']}")
        print(f"  Threshold  : {score['pass_threshold']} ({pct}%)")
        print(f"  Found      : {score['problems_found']}")
        print(f"  Score      : {score['score_pct']}%")
        print(f"  Result     : {result}")
        if score.get("missed_ids"):
            print(f"  Missed     : {', '.join(score['missed_ids'])}")

    print(SEP)
    print()
    for f in report["findings"]:
        cost = f"  ${f['cost_usd']}/mo" if f.get("cost_usd") else ""
        sev = f"[{f['severity']}]" if f.get("severity") else ""
        print(f"  {sev} [{f['type']}]  {f['model']}{cost}")
        if f.get("evidence"):
            print(f"    -> {f['evidence']}")
        if f.get("action"):
            print(f"    >> {f['action']}")
    print()
