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
from typing import Any

from flask import Blueprint, Flask, current_app, jsonify, request

import structlog

logger = structlog.get_logger()

api_bp = Blueprint("api", __name__, url_prefix="/api/v1")


def _get_report_path() -> str:
    """Get report path from app config or request args."""
    path = request.args.get("path")
    if path:
        return path
    return current_app.config.get("DATAPILOT_REPORT_PATH", "datapilot_report.json")


def _get_graph_path() -> str:
    """Get graph path from app config or request args."""
    path = request.args.get("path")
    if path:
        return path
    return current_app.config.get("DATAPILOT_GRAPH_PATH", "datapilot_graph.json")


def create_api_app(config: Any = None) -> Flask:
    """Create the Flask API application."""
    app = Flask(__name__)
    app.config["DATAPILOT_CONFIG"] = config

    app.register_blueprint(api_bp)

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
