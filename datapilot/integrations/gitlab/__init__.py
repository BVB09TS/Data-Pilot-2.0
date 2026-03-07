"""GitLab integration — create issues and MR comments from findings."""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

from datapilot.integrations.base import Integration

logger = structlog.get_logger()


class GitLabIntegration(Integration):
    """Create GitLab issues and MR comments from audit findings."""

    def __init__(
        self,
        url: str = "",
        project_id: str = "",
        token_env: str = "GITLAB_TOKEN",
    ):
        self._url = url.rstrip("/")
        self._project_id = project_id
        self._token_env = token_env

    @property
    def name(self) -> str:
        return "GitLab"

    @property
    def platform(self) -> str:
        return "gitlab"

    def is_configured(self) -> bool:
        return bool(self._url and self._project_id and os.getenv(self._token_env, ""))

    def _headers(self) -> dict[str, str]:
        return {"PRIVATE-TOKEN": os.getenv(self._token_env, "")}

    def health_check(self) -> dict[str, Any]:
        if not self.is_configured():
            return {"status": "unconfigured"}
        try:
            import httpx

            resp = httpx.get(
                f"{self._url}/api/v4/projects/{self._project_id}",
                headers=self._headers(),
                timeout=10,
            )
            return {"status": "healthy" if resp.status_code == 200 else "unhealthy"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def create_issue(self, title: str, description: str, labels: list[str] | None = None) -> dict:
        """Create a GitLab issue."""
        import httpx

        resp = httpx.post(
            f"{self._url}/api/v4/projects/{self._project_id}/issues",
            headers=self._headers(),
            json={
                "title": title,
                "description": description,
                "labels": ",".join(labels or ["datapilot", "data-quality"]),
            },
            timeout=30,
        )
        return resp.json()

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Create GitLab issues for critical findings."""
        if not self.is_configured():
            return {"status": "skipped"}

        try:
            created = []
            critical = [
                f for f in report.get("findings", []) if f.get("severity") == "critical"
            ]

            if critical:
                description = "## DataPilot Critical Findings\n\n"
                for f in critical:
                    description += (
                        f"### [{f['type']}] {f['model']}\n"
                        f"- **Evidence:** {f.get('evidence', 'N/A')}\n"
                        f"- **Action:** {f.get('action', 'N/A')}\n"
                        f"- **Cost:** ${f.get('cost_usd', 0)}/mo\n\n"
                    )

                issue = self.create_issue(
                    title=f"[DataPilot] {len(critical)} Critical Findings Detected",
                    description=description,
                    labels=["datapilot", "critical", "data-quality"],
                )
                created.append(issue.get("iid", "?"))

            return {"status": "published", "issues_created": created}
        except Exception as e:
            return {"status": "error", "error": str(e)}
