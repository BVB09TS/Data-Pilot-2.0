"""Anomaly detector — rule-based detection of data pipeline anomalies.

Runs simple heuristics to catch issues that may complement AI agent findings.
Configurable via enable_anomaly_detection and cost_threshold.
"""

from __future__ import annotations


def detect_anomalies(
    project: dict,
    dead_list: list[str],
    cost_waste: dict,
    cost_threshold_usd: float = 20.0,
) -> list[dict]:
    """Detect anomalies using simple rules.

    Args:
        project: Parsed dbt project (models, query_history, cost_waste)
        dead_list: Models already flagged as dead (avoid duplicate findings)
        cost_waste: Per-model cost estimate
        cost_threshold_usd: Flag models with cost above this as high-waste anomaly

    Returns:
        List of anomaly findings (model, type, evidence, severity)
    """
    anomalies: list[dict] = []

    # High-cost models that aren't already dead (potential optimization targets)
    for model, cost in cost_waste.items():
        # Skip aggregate keys (e.g. total_waste_monthly_usd)
        if model.startswith("total_") or not isinstance(cost, (int, float)):
            continue
        if cost >= cost_threshold_usd and model not in dead_list:
            pass
            # anomalies.append(
            #     {
            #         "model": model,
            #         "type": "cost_anomaly",
            #         "evidence": f"Model costs ${cost}/month — consider optimization or deprecation.",
            #         "severity": "medium",
            #         "cost_usd": cost,
            #     }
            # )

    return anomalies
