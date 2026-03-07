"""Message bus integration — Kafka, webhooks, and event publishing."""

from __future__ import annotations

import json
import os
import time
from typing import Any

import structlog

from datapilot.integrations.base import Integration

logger = structlog.get_logger()


class KafkaIntegration(Integration):
    """Publish audit events to Apache Kafka."""

    def __init__(
        self,
        bootstrap_servers: str = "",
        topic: str = "datapilot-events",
        security_protocol: str = "PLAINTEXT",
    ):
        self._bootstrap_servers = bootstrap_servers
        self._topic = topic
        self._security_protocol = security_protocol

    @property
    def name(self) -> str:
        return "Apache Kafka"

    @property
    def platform(self) -> str:
        return "kafka"

    def is_configured(self) -> bool:
        return bool(self._bootstrap_servers)

    def health_check(self) -> dict[str, Any]:
        if not self.is_configured():
            return {"status": "unconfigured"}
        try:
            from confluent_kafka.admin import AdminClient

            admin = AdminClient({"bootstrap.servers": self._bootstrap_servers})
            metadata = admin.list_topics(timeout=10)
            return {"status": "healthy", "topics": len(metadata.topics)}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Publish audit findings as Kafka events."""
        if not self.is_configured():
            return {"status": "skipped"}

        try:
            from confluent_kafka import Producer

            producer = Producer({"bootstrap.servers": self._bootstrap_servers})
            events_published = 0

            # Publish summary event
            summary_event = {
                "event_type": "audit_complete",
                "timestamp": time.time(),
                "total_findings": report.get("total_findings", 0),
                "by_severity": report.get("by_severity", {}),
                "waste_usd": report.get("total_monthly_waste_usd", 0),
            }
            producer.produce(
                self._topic,
                key="audit_summary",
                value=json.dumps(summary_event),
            )
            events_published += 1

            # Publish individual critical findings
            for finding in report.get("findings", []):
                if finding.get("severity") == "critical":
                    event = {
                        "event_type": "critical_finding",
                        "timestamp": time.time(),
                        "finding": {
                            "type": finding["type"],
                            "model": finding["model"],
                            "evidence": finding.get("evidence", ""),
                            "action": finding.get("action", ""),
                        },
                    }
                    producer.produce(
                        self._topic,
                        key=f"finding_{finding['model']}",
                        value=json.dumps(event),
                    )
                    events_published += 1

            producer.flush(timeout=30)
            return {"status": "published", "events": events_published}
        except Exception as e:
            return {"status": "error", "error": str(e)}


class WebhookIntegration(Integration):
    """Publish audit results via webhooks (Slack, Teams, custom)."""

    def __init__(self, webhook_url: str = "", webhook_type: str = "generic"):
        self._webhook_url = webhook_url
        self._webhook_type = webhook_type  # "slack", "teams", "generic"

    @property
    def name(self) -> str:
        return f"Webhook ({self._webhook_type})"

    @property
    def platform(self) -> str:
        return "webhook"

    def is_configured(self) -> bool:
        return bool(self._webhook_url)

    def health_check(self) -> dict[str, Any]:
        return {"status": "configured" if self.is_configured() else "unconfigured"}

    def _format_slack(self, report: dict) -> dict:
        """Format report for Slack webhook."""
        findings = report.get("total_findings", 0)
        critical = report.get("by_severity", {}).get("critical", 0)
        waste = report.get("total_monthly_waste_usd", 0)

        color = "#ff0000" if critical else "#ffaa00" if findings > 10 else "#00ff00"
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "DataPilot Audit Report"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Findings:* {findings}"},
                    {"type": "mrkdwn", "text": f"*Critical:* {critical}"},
                    {"type": "mrkdwn", "text": f"*Waste:* ${waste}/mo"},
                ],
            },
        ]

        return {"blocks": blocks, "attachments": [{"color": color, "text": ""}]}

    def _format_teams(self, report: dict) -> dict:
        """Format report for Microsoft Teams webhook."""
        findings = report.get("total_findings", 0)
        critical = report.get("by_severity", {}).get("critical", 0)
        waste = report.get("total_monthly_waste_usd", 0)

        return {
            "@type": "MessageCard",
            "summary": f"DataPilot: {findings} findings",
            "themeColor": "FF0000" if critical else "FFAA00",
            "title": "DataPilot Audit Report",
            "sections": [
                {
                    "facts": [
                        {"name": "Findings", "value": str(findings)},
                        {"name": "Critical", "value": str(critical)},
                        {"name": "Monthly Waste", "value": f"${waste}"},
                    ]
                }
            ],
        }

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Send report via webhook."""
        if not self.is_configured():
            return {"status": "skipped"}

        try:
            import httpx

            if self._webhook_type == "slack":
                payload = self._format_slack(report)
            elif self._webhook_type == "teams":
                payload = self._format_teams(report)
            else:
                payload = {
                    "event": "datapilot_audit",
                    "report": {
                        "total_findings": report.get("total_findings", 0),
                        "by_severity": report.get("by_severity", {}),
                        "waste_usd": report.get("total_monthly_waste_usd", 0),
                    },
                }

            resp = httpx.post(self._webhook_url, json=payload, timeout=30)
            return {"status": "published", "response_code": resp.status_code}
        except Exception as e:
            return {"status": "error", "error": str(e)}
