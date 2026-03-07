"""Azure integration — Blob Storage and Azure DevOps."""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

from datapilot.integrations.base import Integration

logger = structlog.get_logger()


class AzureIntegration(Integration):
    """Publish reports to Azure Blob Storage."""

    def __init__(
        self,
        storage_account: str = "",
        container: str = "datapilot",
        connection_string_env: str = "AZURE_STORAGE_CONNECTION_STRING",
    ):
        self._storage_account = storage_account
        self._container = container
        self._connection_string_env = connection_string_env

    @property
    def name(self) -> str:
        return "Azure Blob Storage"

    @property
    def platform(self) -> str:
        return "azure"

    def is_configured(self) -> bool:
        return bool(os.getenv(self._connection_string_env, ""))

    def health_check(self) -> dict[str, Any]:
        if not self.is_configured():
            return {"status": "unconfigured"}
        try:
            from azure.storage.blob import BlobServiceClient

            client = BlobServiceClient.from_connection_string(
                os.getenv(self._connection_string_env, "")
            )
            props = client.get_account_information()
            return {"status": "healthy", "sku": props.get("sku_name", "unknown")}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Upload report JSON to Azure Blob Storage."""
        if not self.is_configured():
            return {"status": "skipped"}

        try:
            from azure.storage.blob import BlobServiceClient
            from datetime import datetime

            client = BlobServiceClient.from_connection_string(
                os.getenv(self._connection_string_env, "")
            )
            container_client = client.get_container_client(self._container)

            try:
                container_client.create_container()
            except Exception:
                pass  # Already exists

            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            blob_name = f"audits/datapilot_report_{ts}.json"

            blob_client = container_client.get_blob_client(blob_name)
            blob_client.upload_blob(json.dumps(report, indent=2, default=str))

            return {"status": "published", "blob": blob_name, "container": self._container}
        except Exception as e:
            return {"status": "error", "error": str(e)}
