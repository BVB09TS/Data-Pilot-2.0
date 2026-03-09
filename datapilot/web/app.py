"""DataPilot v2.0 — Professional Web Dashboard.

dbt-docs inspired interface with:
- Model tree browser (grouped by layer)
- Interactive D3.js lineage graph
- Model detail panel (SQL, YAML, columns, findings)
- Global search
- Findings/audit dashboard with charts
- Light/dark mode
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import yaml
from flask import Flask, jsonify, request, send_from_directory

from datapilot.api.routes import api_bp
from datapilot.agents.router import AgentRouter
from datapilot.core.config import DataPilotConfig


def create_app(report_path: str | None = None, graph_path: str | None = None,
               project_path: str | None = None) -> Flask:
    """Create the web dashboard application."""
    base = os.path.dirname(os.path.abspath(__file__))

    # Prefer the React/Vite build output; fall back to the legacy single-file UI.
    repo_root = Path(base).parent.parent
    dist_dir = repo_root / "frontend" / "dist"
    static_dir = str(dist_dir) if dist_dir.exists() else os.path.join(base, "static")

    report_path = report_path or os.path.join(base, "..", "..", "datapilot_report.json")
    graph_path = graph_path or os.path.join(base, "..", "..", "datapilot_graph.json")
    project_path = project_path or os.path.join(base, "..", "..", "shopmesh_dbt")

    app = Flask(__name__, static_folder=static_dir, static_url_path="/static")

    # Store paths for API routes (report_path, graph_path resolved to absolute)
    app.config["DATAPILOT_REPORT_PATH"] = os.path.abspath(report_path)
    app.config["DATAPILOT_GRAPH_PATH"] = os.path.abspath(graph_path)
    app.config["DATAPILOT_PROJECT_PATH"] = os.path.abspath(project_path)

    # Load config for AI copilot (optional)
    config_path = os.environ.get("DATAPILOT_CONFIG", os.path.join(base, "..", "..", "datapilot.yaml"))
    if os.path.exists(config_path):
        config = DataPilotConfig.from_yaml(config_path)
    else:
        config = DataPilotConfig()
    router = AgentRouter(config=config) if config.get_available_providers() else None
    app.config["DATAPILOT_CONFIG"] = config
    app.config["DATAPILOT_ROUTER"] = router

    # Mount REST API v1 (trigger audit, metrics, integrations)
    app.register_blueprint(api_bp)

    # Mount AI Gateway (multi-tenant proxy)
    from datapilot.gateway.routes import gateway_bp
    output_dir = str(Path(report_path).parent)
    app.config["DATAPILOT_OUTPUT_DIR"] = output_dir
    app.config["GATEWAY_TENANT_STORE"] = os.path.join(output_dir, "datapilot_tenants.json")
    app.config["GATEWAY_LOG_DIR"] = os.path.join(output_dir, "gateway_logs")
    app.register_blueprint(gateway_bp)

    def _load_json(path: str) -> dict:
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _get_models_dir() -> Path:
        return Path(project_path) / "models"

    def _guess_layer(name: str, fallback: str = "core") -> str:
        lowered = name.lower()
        if lowered.startswith("raw"):
            return "raw"
        if lowered.startswith("src") or lowered.startswith("source"):
            return "source"
        if lowered.startswith("analytics"):
            return "analytics"
        if lowered.startswith("core"):
            return "core"
        return fallback

    def _models_from_graph(graph_data: dict, findings_by_model: dict[str, list[dict]]) -> dict[str, list[dict]]:
        fallback: dict[str, list[dict]] = {}
        for node in graph_data.get("nodes", []):
            name = node.get("id")
            if not name:
                continue
            layer = node.get("layer") or _guess_layer(name)
            fallback.setdefault(layer, []).append(
                {
                    "name": name,
                    "layer": layer,
                    "description": node.get("description", "Auto-imported from lineage graph."),
                    "tags": node.get("tags", []),
                    "columns": node.get("columns", []),
                    "q30": node.get("q30"),
                    "q90": node.get("q90"),
                    "has_problem": node.get("has_problem", False),
                    "findings_count": len(findings_by_model.get(name, [])),
                    "findings": findings_by_model.get(name, []),
                }
            )
        for layer in fallback:
            fallback[layer].sort(key=lambda m: m["name"])
        return fallback

    # ---------- Static pages ----------

    @app.route("/")
    def index():
        return send_from_directory(static_dir, "index.html")

    # ---------- Data APIs ----------

    @app.route("/api/report")
    def api_report():
        return jsonify(_load_json(report_path))

    @app.route("/api/graph")
    def api_graph():
        return jsonify(_load_json(graph_path))

    @app.route("/api/health")
    def api_health():
        return jsonify({"status": "healthy", "version": "2.0.0"})

    @app.route("/api/findings")
    def api_findings():
        data = _load_json(report_path)
        report = data.get("report", data)
        findings = report.get("findings", [])
        severity = request.args.get("severity")
        ftype = request.args.get("type")
        if severity:
            findings = [f for f in findings if f.get("severity") == severity]
        if ftype:
            findings = [f for f in findings if f.get("type") == ftype]
        return jsonify({"total": len(findings), "findings": findings})

    @app.route("/api/suggestions")
    def api_suggestions():
        """Return improvement suggestions from the audit report."""
        data = _load_json(report_path)
        report = data.get("report", data)
        suggestions = report.get("suggestions", [])
        priority = request.args.get("priority")
        if priority:
            suggestions = [s for s in suggestions if s.get("priority") == priority]
        return jsonify({"total": len(suggestions), "suggestions": suggestions})

    @app.route("/api/models")
    def api_models():
        """Return all models grouped by layer with metadata."""
        models_dir = _get_models_dir()
        graph_data = _load_json(graph_path)
        report_data = _load_json(report_path)
        report = report_data.get("report", report_data)
        findings = report.get("findings", [])

        # Index findings by model
        findings_by_model = {}
        for f in findings:
            m = f.get("model", "")
            findings_by_model.setdefault(m, []).append(f)

        # Index graph nodes
        nodes_by_id = {}
        for n in graph_data.get("nodes", []):
            nodes_by_id[n["id"]] = n

        result: dict[str, list[dict]] = {}
        if models_dir.exists():
            for layer_dir in sorted(models_dir.iterdir()):
                if not layer_dir.is_dir():
                    continue
                layer = layer_dir.name
                models = []
                for sql_file in sorted(layer_dir.glob("*.sql")):
                    name = sql_file.stem
                    yml_file = sql_file.with_suffix(".yml")

                    # Parse YAML
                    columns = []
                    description = ""
                    tags = []
                    if yml_file.exists():
                        try:
                            with open(yml_file, encoding="utf-8") as f:
                                yml_data = yaml.safe_load(f) or {}
                            model_defs = yml_data.get("models", [])
                            if model_defs:
                                md = model_defs[0]
                                description = md.get("description", "")
                                tags = md.get("config", {}).get("tags", [])
                                columns = md.get("columns", [])
                        except Exception:
                            pass

                    node = nodes_by_id.get(name, {})
                    model_findings = findings_by_model.get(name, [])

                    models.append({
                        "name": name,
                        "layer": layer,
                        "description": description,
                        "tags": tags,
                        "columns": columns,
                        "q30": node.get("q30"),
                        "q90": node.get("q90"),
                        "has_problem": node.get("has_problem", False),
                        "findings_count": len(model_findings),
                        "findings": model_findings,
                    })

                if models:
                    result[layer] = models

        fallback = _models_from_graph(graph_data, findings_by_model)
        if not result:
            result = fallback
        else:
            for layer, models in fallback.items():
                existing = {m["name"] for m in result.get(layer, [])}
                for model in models:
                    if model["name"] not in existing:
                        result.setdefault(layer, []).append(model)
                result[layer].sort(key=lambda m: m["name"])

        return jsonify(result)

    @app.route("/api/models/<model_name>/sql")
    def api_model_sql(model_name: str):
        """Return the SQL source for a model."""
        models_dir = _get_models_dir()
        for layer_dir in models_dir.iterdir():
            if not layer_dir.is_dir():
                continue
            sql_file = layer_dir / f"{model_name}.sql"
            if sql_file.exists():
                return jsonify({"sql": sql_file.read_text(encoding="utf-8")})
        return jsonify({"sql": "-- Model not found"}), 404

    @app.route("/api/models/<model_name>/lineage")
    def api_model_lineage(model_name: str):
        """Return upstream/downstream for a specific model."""
        graph_data = _load_json(graph_path)
        edges = graph_data.get("edges", [])
        upstream = [e["source"] for e in edges if e["target"] == model_name]
        downstream = [e["target"] for e in edges if e["source"] == model_name]
        return jsonify({"model": model_name, "upstream": upstream, "downstream": downstream})

    @app.route("/api/chat", methods=["POST"])
    def api_chat():
        payload = request.get_json(silent=True) or {}
        message = (payload.get("message") or "").strip()
        if not message:
            return jsonify({"error": "Message is required."}), 400

        router: AgentRouter | None = app.config.get("DATAPILOT_ROUTER")
        if router is None:
            return jsonify({"error": "LLM provider not configured. Set GROQ_API_KEY in .env"}), 503

        model_name = payload.get("model")
        context = payload.get("context", "").strip()
        max_tokens = payload.get("max_tokens")
        system_prompt = payload.get("system") or (
            "You are DataPilot, an AI co-pilot for dbt projects. Provide concise, actionable answers "
            "grounded in the supplied metadata and always highlight lineage or quality context where relevant."
        )

        user_prompt = message
        if context:
            user_prompt = f"Context:\n{context}\n\nUser Question:\n{message}"
        if model_name:
            user_prompt = f"Model: {model_name}\n\n" + user_prompt

        response = router.call(
            task_type="chat_assist",
            system=system_prompt,
            user=user_prompt,
            max_tokens=max_tokens,
        )

        if not response.content:
            return jsonify({"error": "Unable to generate response."}), 502

        return jsonify(
            {
                "reply": response.content,
                "model": response.model,
                "provider": response.provider,
                "latency_ms": response.latency_ms,
                "cost_usd": response.cost_usd,
            }
        )

    # Serve Vite-built JS/CSS chunks (lives in dist/assets/)
    @app.route("/assets/<path:filename>")
    def serve_vite_assets(filename: str):
        return send_from_directory(os.path.join(static_dir, "assets"), filename)

    # SPA catch-all — any non-API path returns index.html so React Router works
    @app.route("/<path:path>")
    def spa_fallback(path: str):
        return send_from_directory(static_dir, "index.html")

    return app


def main():
    """Standalone entry point."""
    import argparse

    p = argparse.ArgumentParser(description="DataPilot Web Dashboard")
    p.add_argument("--port", type=int, default=5000)
    p.add_argument("--report", default=None)
    p.add_argument("--graph", default=None)
    p.add_argument("--project", default=None)
    args = p.parse_args()

    app = create_app(args.report, args.graph, args.project)
    print(f"\n  DataPilot Dashboard: http://localhost:{args.port}\n")
    app.run(host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
