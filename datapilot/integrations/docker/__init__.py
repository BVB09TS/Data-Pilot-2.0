"""Docker integration — build and manage DataPilot containers."""

from __future__ import annotations

from typing import Any

import structlog

from datapilot.integrations.base import Integration

logger = structlog.get_logger()


class DockerIntegration(Integration):
    """Build and manage DataPilot Docker images."""

    def __init__(self, registry: str = "", image_name: str = "datapilot"):
        self._registry = registry
        self._image_name = image_name

    @property
    def name(self) -> str:
        return "Docker"

    @property
    def platform(self) -> str:
        return "docker"

    def is_configured(self) -> bool:
        try:
            import subprocess
            result = subprocess.run(
                ["docker", "version", "--format", "{{.Server.Version}}"],
                capture_output=True, text=True, timeout=5
            )
            return result.returncode == 0
        except Exception:
            return False

    def health_check(self) -> dict[str, Any]:
        if not self.is_configured():
            return {"status": "unconfigured", "message": "Docker not available"}
        return {"status": "healthy"}

    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Docker doesn't directly publish reports."""
        return {"status": "skipped", "reason": "Use S3/Azure/GCS for report storage"}

    def get_image_tag(self, version: str = "2.0.0") -> str:
        """Get the full image tag."""
        if self._registry:
            return f"{self._registry}/{self._image_name}:{version}"
        return f"{self._image_name}:{version}"
