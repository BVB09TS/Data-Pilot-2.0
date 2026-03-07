"""Base integration interface — all platform integrations implement this."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import structlog

logger = structlog.get_logger()


class Integration(ABC):
    """Base class for all enterprise integrations."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Integration name."""

    @property
    @abstractmethod
    def platform(self) -> str:
        """Platform identifier (e.g., 'airflow', 'snowflake')."""

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if this integration has valid configuration."""

    @abstractmethod
    def health_check(self) -> dict[str, Any]:
        """Verify connectivity and return health status."""

    @abstractmethod
    def publish_report(self, report: dict, **kwargs: Any) -> dict[str, Any]:
        """Publish an audit report to the target platform."""

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} platform={self.platform} configured={self.is_configured()}>"


class IntegrationRegistry:
    """Registry for all available integrations."""

    def __init__(self) -> None:
        self._integrations: dict[str, Integration] = {}

    def register(self, integration: Integration) -> None:
        """Register an integration."""
        self._integrations[integration.platform] = integration
        logger.info("integration_registered", platform=integration.platform)

    def get(self, platform: str) -> Integration | None:
        """Get an integration by platform name."""
        return self._integrations.get(platform)

    def list_available(self) -> list[str]:
        """List all registered integration platforms."""
        return list(self._integrations.keys())

    def list_configured(self) -> list[str]:
        """List integrations that are properly configured."""
        return [name for name, i in self._integrations.items() if i.is_configured()]

    def publish_all(self, report: dict, **kwargs: Any) -> dict[str, dict]:
        """Publish to all configured integrations."""
        results = {}
        for name, integration in self._integrations.items():
            if integration.is_configured():
                try:
                    results[name] = integration.publish_report(report, **kwargs)
                except Exception as e:
                    logger.error("publish_failed", platform=name, error=str(e))
                    results[name] = {"status": "error", "error": str(e)}
        return results
