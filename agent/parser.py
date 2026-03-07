# parser.py  --  reads all dbt SQL + YML files into structured dicts
import os, re, glob
import yaml


def parse_project(dbt_root: str) -> dict:
    models = {}
    sql_files = glob.glob(os.path.join(dbt_root, "models", "**", "*.sql"), recursive=True)

    for sql_path in sorted(sql_files):
        name  = os.path.splitext(os.path.basename(sql_path))[0]
        rel   = os.path.relpath(sql_path, dbt_root).replace("\\", "/")
        parts = rel.split("/")
        layer = parts[1] if len(parts) > 1 else "unknown"

        with open(sql_path, encoding="utf-8") as f:
            sql = f.read()

        refs    = re.findall(r"\{\{\s*ref\(['\"](\w+)['\"]\)\s*\}\}", sql)
        sources = re.findall(r"\{\{\s*source\(['\"](\w+)['\"],\s*['\"](\w+)['\"]\)\s*\}\}", sql)

        yml_path = sql_path.replace(".sql", ".yml")
        yml_data = {}
        if os.path.exists(yml_path):
            with open(yml_path, encoding="utf-8") as f:
                try:
                    yml_data = yaml.safe_load(f) or {}
                except Exception:
                    yml_data = {}

        columns = []
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
            "name":    name,
            "layer":   layer,
            "path":    rel,
            "sql":     sql,
            "refs":    list(set(refs)),
            "sources": sources,
            "columns": columns,
            "yml":     yml_data,
            "planted": planted,
        }

    # load query history
    import json
    qh_path = os.path.join(dbt_root, "query_history.json")
    query_history, cost_waste = {}, {}
    if os.path.exists(qh_path):
        with open(qh_path, encoding="utf-8") as f:
            raw = json.load(f)
        for entry in raw.get("model_query_history", []):
            query_history[entry["model"]] = entry
        cost_waste = raw.get("cost_estimate_monthly_usd", {})

    return {"models": models, "query_history": query_history, "cost_waste": cost_waste}


def summary(project: dict) -> str:
    models = project["models"]
    layers = {}
    for m in models.values():
        layers[m["layer"]] = layers.get(m["layer"], 0) + 1
    lines = [f"  Parsed {len(models)} models:"]
    for layer, count in sorted(layers.items()):
        lines.append(f"    {layer:12s} {count}")
    return "\n".join(lines)
