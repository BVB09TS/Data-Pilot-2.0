"""Power BI integration — push datasets and refresh reports."""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

from datapilot.integrations.base import Integration

logger = structlog.get_logger()


class PowerBIIntegration(Integration):
    """Push DataPilot findings to Power BI datasets."""

    def __init__(
        self,
        workspace_id: str = "",
        dataset_id: str = "",
        client_id_env: str = "POWERBI_CLIENT_ID",
        client_secret_env: str = "POWERBI_CLIENT_SECRET",
        tenant_id_env: str = "POWERBI_TENANT_ID",
    ):
        self._workspace_id = workspace_id
        self._dataset_id = dataset_id
        self._client_id_env = client_id_env
        self._client_secret_env = client_secret_env
        self._tenant_id_env = tenant_id_env

    @property
    def name(self) -> str:
        return "Power BI"

    @property
    def platform(self) -> str:
        return "powerbi"

    def is_configured(self) -> bool:
        return bool(
            self._workspace_id
            and self._dataset_id
            and os.getenv(self._client_id_env, "")
        )

    def _get_token(self) -> str:
        """Get Azure AD token for Power BI API."""
        import msal

        app = msal.ConfidentialClientApplication(
            client_id=os.getenv(self._client_id_env, ""),
            client_credential=os.getenv(self._client_secret_env, ""),
            authority=f"https://login.microsoftonline.com/{os.getenv(self._tenant_id_env, '')}",
        )
        result = app.acquire_token_for_client(
            scopes=["https://analysis.windows.net/powerbi/api/.default"]
        )
        if "access_token" not in result:
            raise ValueError(f"Failed to get token: {result.get('error_description', 'unknown')}")
        return result["access_token"]

    def health_check(self) -> dict[str, Any]:
        if not self.is_configured():
            return {"status": "unconfigured"}
        try:
            token = self._get_token()
            return {"status": "healthy", "token_acquired": True}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Push findings to Power BI push dataset."""
        if not self.is_configured():
            return {"status": "skipped"}

        try:
            import httpx

            token = self._get_token()
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

            rows = []
            for f in report.get("findings", []):
                rows.append(
                    {
                        "model": f["model"],
                        "type": f["type"],
                        "severity": f.get("severity", "medium"),
                        "evidence": f.get("evidence", ""),
                        "cost_usd": f.get("cost_usd", 0),
                        "action": f.get("action", ""),
                        "generated_at": report.get("generated_at", ""),
                    }
                )

            url = (
                f"https://api.powerbi.com/v1.0/myorg/groups/{self._workspace_id}"
                f"/datasets/{self._dataset_id}/tables/DataPilotFindings/rows"
            )

            resp = httpx.post(url, headers=headers, json={"rows": rows}, timeout=30)
            return {"status": "published", "rows": len(rows), "response_code": resp.status_code}
        except Exception as e:
            return {"status": "error", "error": str(e)}
