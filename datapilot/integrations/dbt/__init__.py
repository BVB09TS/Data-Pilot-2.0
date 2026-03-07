"""dbt Cloud integration — trigger runs and fetch metadata."""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

from datapilot.integrations.base import Integration

logger = structlog.get_logger()


class DbtCloudIntegration(Integration):
    """Connect to dbt Cloud for metadata and job triggers."""

    def __init__(
        self,
        account_id: str = "",
        api_token_env: str = "DBT_CLOUD_API_TOKEN",
        base_url: str = "https://cloud.getdbt.com",
    ):
        self._account_id = account_id
        self._api_token_env = api_token_env
        self._base_url = base_url.rstrip("/")

    @property
    def name(self) -> str:
        return "dbt Cloud"

    @property
    def platform(self) -> str:
        return "dbt_cloud"

    def is_configured(self) -> bool:
        return bool(self._account_id and os.getenv(self._api_token_env, ""))

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Token {os.getenv(self._api_token_env, '')}",
            "Content-Type": "application/json",
        }

    def _api_url(self, path: str) -> str:
        return f"{self._base_url}/api/v2/accounts/{self._account_id}{path}"

    def health_check(self) -> dict[str, Any]:
        if not self.is_configured():
            return {"status": "unconfigured"}
        try:
            import httpx

            resp = httpx.get(self._api_url("/"), headers=self._headers(), timeout=10)
            return {"status": "healthy" if resp.status_code == 200 else "unhealthy"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def fetch_models_metadata(self, job_id: str) -> list[dict]:
        """Fetch model metadata from dbt Cloud discovery API."""
        import httpx

        resp = httpx.get(
            self._api_url(f"/jobs/{job_id}/"),
            headers=self._headers(),
            timeout=30,
        )
        return resp.json().get("data", {})

    def trigger_job(self, job_id: str, cause: str = "DataPilot audit") -> dict:
        """Trigger a dbt Cloud job run."""
        import httpx

        resp = httpx.post(
            self._api_url(f"/jobs/{job_id}/run/"),
            headers=self._headers(),
            json={"cause": cause},
            timeout=30,
        )
        return resp.json()

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Log audit results (dbt Cloud has limited write API)."""
        if not self.is_configured():
            return {"status": "skipped"}
        logger.info(
            "dbt_cloud_audit_recorded",
            findings=report.get("total_findings", 0),
            waste=report.get("total_monthly_waste_usd", 0),
        )
        return {"status": "logged", "findings": report.get("total_findings", 0)}
