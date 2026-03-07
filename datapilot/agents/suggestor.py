"""Improvement suggestor — maps findings to concrete recommended actions.

Provides prioritized suggestions for engineers to act on.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Suggestion:
    """A single improvement suggestion."""

    action: str
    priority: str  # critical, high, medium, low
    model: str
    finding_type: str
    description: str
    cost_usd: float | None = None


def suggest_improvements(findings: list[dict]) -> list[Suggestion]:
    """Generate improvement suggestions from audit findings.

    Maps each finding to a concrete action with priority.
    """
    suggestions: list[Suggestion] = []

    for f in findings:
        ftype = f.get("type", "unknown")
        model = f.get("model", "?")
        if isinstance(model, list):
            model = ", ".join(str(m) for m in model)
        severity = f.get("severity", "medium")
        action = f.get("action", _default_action(ftype))
        evidence = f.get("evidence", "")

        suggestions.append(
            Suggestion(
                action=action,
                priority=severity,
                model=model,
                finding_type=ftype,
                description=evidence or f"[{ftype}] {model}",
                cost_usd=f.get("cost_usd"),
            )
        )

    # Sort by priority (critical first)
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    suggestions.sort(key=lambda s: priority_order.get(s.priority, 2))

    return suggestions


def _default_action(ftype: str) -> str:
    """Default action for a finding type."""
    actions = {
        "dead_model": "Drop this model and remove from dbt project. Verify no hidden consumers first.",
        "orphaned_model": "Either connect to a downstream consumer or remove if no longer needed.",
        "broken_lineage": "Fix the broken ref or remove the model if the upstream will not be created.",
        "wrong_grain_join": "Fix the join to match grains — aggregate the finer grain before joining.",
        "deprecated_source": "Migrate to the replacement source and decommission this model.",
        "deprecated_chain": "Decommission the entire chain from analytics down to the deprecated source.",
        "missing_tests": "Add unique and not_null tests on the primary key column.",
        "logic_drift": "Consolidate with the canonical model and deprecate the duplicate.",
        "duplicate_metric": "Standardize the metric definition across all models using a single source of truth.",
        "redundant_model": "Remove this model and migrate consumers to the canonical version.",
    }
    return actions.get(ftype, "Review and address.")


def suggestions_to_dict(suggestions: list[Suggestion]) -> list[dict]:
    """Convert suggestions to JSON-serializable dicts."""
    return [
        {
            "action": s.action,
            "priority": s.priority,
            "model": s.model,
            "finding_type": s.finding_type,
            "description": s.description,
            "cost_usd": s.cost_usd,
        }
        for s in suggestions
    ]
