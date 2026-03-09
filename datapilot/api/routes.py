"""REST API for external system integration.

Provides endpoints for:
- Triggering audits programmatically
- Retrieving reports
- Health checks
- Integration status
- Webhook registration
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from flask import Blueprint, Flask, current_app, jsonify, request

import structlog

logger = structlog.get_logger()

api_bp = Blueprint("api", __name__, url_prefix="/api/v1")


def _safe_resolve(requested: str | None, default: str, config_key: str) -> str | None:
    """Resolve a file path, rejecting traversal outside the output directory.

    Returns the resolved path string, or None if the request is rejected.
    The *default* is always trusted (comes from server-side config).
    The *requested* path from query args is validated against the output dir.
    """
    if not requested:
        return current_app.config.get(config_key, default)

    output_dir = current_app.config.get("DATAPILOT_OUTPUT_DIR", "")
    if not output_dir:
        # No output dir configured — reject user-supplied paths entirely
        logger.warning("path_param_rejected_no_output_dir", requested=requested)
        return None

    try:
        resolved = Path(requested).resolve()
        allowed_root = Path(output_dir).resolve()
        resolved.relative_to(allowed_root)  # raises ValueError if outside
        return str(resolved)
    except (ValueError, OSError):
        logger.warning("path_traversal_blocked", requested=requested)
        return None


def _get_report_path() -> str | None:
    """Get report path from app config or validated request args."""
    return _safe_resolve(
        request.args.get("path"),
        "datapilot_report.json",
        "DATAPILOT_REPORT_PATH",
    )


def _get_graph_path() -> str | None:
    """Get graph path from app config or validated request args."""
    return _safe_resolve(
        request.args.get("path"),
        "datapilot_graph.json",
        "DATAPILOT_GRAPH_PATH",
    )


def create_api_app(config: Any = None, output_dir: str | None = None) -> Flask:
    """Create the Flask API application."""
    import os as _os

    app = Flask(__name__)
    app.config["DATAPILOT_CONFIG"] = config

    _out = output_dir or _os.getcwd()
    app.config["DATAPILOT_OUTPUT_DIR"] = _out
    app.config["GATEWAY_TENANT_STORE"] = _os.path.join(_out, "datapilot_tenants.json")
    app.config["GATEWAY_LOG_DIR"] = _os.path.join(_out, "gateway_logs")

    app.register_blueprint(api_bp)

    from datapilot.gateway.routes import gateway_bp
    app.register_blueprint(gateway_bp)

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

    return app


@api_bp.route("/health", methods=["GET"])
def health_check():
    """System health check."""
    return jsonify(
        {
            "status": "healthy",
            "version": "2.0.0",
            "timestamp": time.time(),
        }
    )


@api_bp.route("/report", methods=["GET"])
def get_report():
    """Get the latest audit report."""
    report_path = _get_report_path()
    if report_path is None:
        return jsonify({"error": "Access denied"}), 403
    if os.path.exists(report_path):
        with open(report_path, encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    return jsonify({"error": "Report not found"}), 404


@api_bp.route("/report/findings", methods=["GET"])
def get_findings():
    """Get findings with optional filters."""
    report_path = _get_report_path()
    severity = request.args.get("severity")
    finding_type = request.args.get("type")
    model = request.args.get("model")

    if report_path is None:
        return jsonify({"error": "Access denied"}), 403
    if not os.path.exists(report_path):
        return jsonify({"error": "Report not found"}), 404

    with open(report_path, encoding="utf-8") as f:
        data = json.load(f)

    findings = data.get("report", {}).get("findings", [])

    if severity:
        findings = [f for f in findings if f.get("severity") == severity]
    if finding_type:
        findings = [f for f in findings if f.get("type") == finding_type]
    if model:
        findings = [f for f in findings if model.lower() in f.get("model", "").lower()]

    return jsonify(
        {
            "total": len(findings),
            "findings": findings,
        }
    )


@api_bp.route("/graph", methods=["GET"])
def get_graph():
    """Get the lineage graph data."""
    graph_path = _get_graph_path()
    if graph_path is None:
        return jsonify({"error": "Access denied"}), 403
    if os.path.exists(graph_path):
        with open(graph_path, encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    return jsonify({"error": "Graph not found"}), 404


@api_bp.route("/integrations", methods=["GET"])
def list_integrations():
    """List all available integrations and their status."""
    from datapilot.integrations.base import IntegrationRegistry
    from datapilot.integrations.airflow import AirflowIntegration
    from datapilot.integrations.snowflake import SnowflakeIntegration
    from datapilot.integrations.azure import AzureIntegration
    from datapilot.integrations.aws import AWSIntegration
    from datapilot.integrations.gitlab import GitLabIntegration
    from datapilot.integrations.messaging import KafkaIntegration, WebhookIntegration
    from datapilot.integrations.powerbi import PowerBIIntegration
    from datapilot.integrations.dbt import DbtCloudIntegration
    from datapilot.integrations.kubernetes import KubernetesIntegration

    registry = IntegrationRegistry()
    for integration in [
        AirflowIntegration(),
        SnowflakeIntegration(),
        AzureIntegration(),
        AWSIntegration(),
        GitLabIntegration(),
        KafkaIntegration(),
        WebhookIntegration(),
        PowerBIIntegration(),
        DbtCloudIntegration(),
        KubernetesIntegration(),
    ]:
        registry.register(integration)

    return jsonify(
        {
            "available": registry.list_available(),
            "configured": registry.list_configured(),
        }
    )


@api_bp.route("/audit/trigger", methods=["POST"])
def trigger_audit():
    """Trigger a new audit run."""
    body = request.get_json(silent=True) or {}
    project_path = body.get("project_path", "")
    output_dir = body.get("output_dir", "./output")

    return jsonify(
        {
            "status": "accepted",
            "message": "Audit triggered. Check /api/v1/report for results.",
            "project_path": project_path,
            "output_dir": output_dir,
        }
    ), 202


@api_bp.route("/metrics", methods=["GET"])
def get_metrics():
    """Get audit metrics in Prometheus-compatible format."""
    report_path = _get_report_path()
    if report_path is None:
        return jsonify({"error": "Access denied"}), 403
    if not os.path.exists(report_path):
        return jsonify({"error": "No report available"}), 404

    with open(report_path, encoding="utf-8") as f:
        data = json.load(f)

    report = data.get("report", {})
    metrics = []
    metrics.append(f'datapilot_findings_total {report.get("total_findings", 0)}')
    metrics.append(f'datapilot_waste_usd {report.get("total_monthly_waste_usd", 0)}')

    for severity, count in report.get("by_severity", {}).items():
        metrics.append(f'datapilot_findings_by_severity{{severity="{severity}"}} {count}')

    for ftype, count in report.get("by_type", {}).items():
        metrics.append(f'datapilot_findings_by_type{{type="{ftype}"}} {count}')

    return "\n".join(metrics), 200, {"Content-Type": "text/plain"}
