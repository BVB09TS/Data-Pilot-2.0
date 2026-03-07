"""dbt project parser — reads SQL + YML files into structured dicts.

Enhanced from v1 with:
- Better error handling
- Support for dbt project configs
- Structured logging
"""

from __future__ import annotations

import json
import os
import re
from glob import glob
from pathlib import Path

import structlog
import yaml

logger = structlog.get_logger()


def parse_project(dbt_root: str) -> dict:
    """Parse a dbt project into a structured dictionary."""
    models: dict[str, dict] = {}
    sql_files = sorted(glob(os.path.join(dbt_root, "models", "**", "*.sql"), recursive=True))

    for sql_path in sql_files:
        name = os.path.splitext(os.path.basename(sql_path))[0]
        rel = os.path.relpath(sql_path, dbt_root).replace("\\", "/")
        parts = rel.split("/")
        layer = parts[1] if len(parts) > 1 else "unknown"

        with open(sql_path, encoding="utf-8") as f:
            sql = f.read()

        refs = re.findall(r"\{\{\s*ref\(['\"](\w+)['\"]\)\s*\}\}", sql)
        sources = re.findall(
            r"\{\{\s*source\(['\"](\w+)['\"],\s*['\"](\w+)['\"]\)\s*\}\}", sql
        )

        yml_path = sql_path.replace(".sql", ".yml")
        yml_data: dict = {}
        if os.path.exists(yml_path):
            with open(yml_path, encoding="utf-8") as f:
                try:
                    yml_data = yaml.safe_load(f) or {}
                except yaml.YAMLError:
                    yml_data = {}

        columns: list[str] = []
        if yml_data.get("models"):
            for m in yml_data["models"]:
                if m.get("name") == name:
                    columns = [c["name"] for c in m.get("columns", [])]
                    break

        planted = None
        m = re.search(r"--\s*PLANTED PROBLEM:\s*(.+)", sql)
        if m:
            planted = m.group(1).strip()

        models[name] = {
            "name": name,
            "layer": layer,
            "path": rel,
            "sql": sql,
            "refs": list(set(refs)),
            "sources": sources,
            "columns": columns,
            "yml": yml_data,
            "planted": planted,
        }

    # Load query history
    qh_path = os.path.join(dbt_root, "query_history.json")
    query_history: dict = {}
    cost_waste: dict = {}
    if os.path.exists(qh_path):
        with open(qh_path, encoding="utf-8") as f:
            raw = json.load(f)
        for entry in raw.get("model_query_history", []):
            query_history[entry["model"]] = entry
        cost_waste = raw.get("cost_estimate_monthly_usd", {})

    logger.info("project_parsed", models=len(models), layers=_count_layers(models))
    return {"models": models, "query_history": query_history, "cost_waste": cost_waste}


def _count_layers(models: dict) -> dict[str, int]:
    layers: dict[str, int] = {}
    for m in models.values():
        layers[m["layer"]] = layers.get(m["layer"], 0) + 1
    return layers


def summary(project: dict) -> str:
    """Return a human-readable summary of parsed project."""
    models = project["models"]
    layers = _count_layers(models)
    lines = [f"  Parsed {len(models)} models:"]
    for layer, count in sorted(layers.items()):
        lines.append(f"    {layer:12s} {count}")
    return "\n".join(lines)
