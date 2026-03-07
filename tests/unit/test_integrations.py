"""Tests for enterprise integrations."""

import pytest

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


class TestIntegrationRegistry:
    def test_register_and_list(self):
        registry = IntegrationRegistry()
        registry.register(AirflowIntegration(dag_folder="/tmp"))
        assert "airflow" in registry.list_available()

    def test_get_integration(self):
        registry = IntegrationRegistry()
        airflow = AirflowIntegration(dag_folder="/tmp")
        registry.register(airflow)
        assert registry.get("airflow") is airflow
        assert registry.get("nonexistent") is None

    def test_list_configured(self):
        registry = IntegrationRegistry()
        registry.register(AirflowIntegration())  # Not configured
        registry.register(AirflowIntegration(dag_folder="/tmp"))  # Configured
        # The second registration overwrites the first
        configured = registry.list_configured()
        assert "airflow" in configured


class TestAirflowIntegration:
    def test_not_configured_by_default(self):
        integration = AirflowIntegration()
        assert not integration.is_configured()

    def test_configured_with_dag_folder(self):
        integration = AirflowIntegration(dag_folder="/dags")
        assert integration.is_configured()

    def test_generate_dag(self):
        integration = AirflowIntegration(dag_folder="")
        dag_content = integration.generate_dag()
        assert "datapilot_dbt_audit" in dag_content
        assert "PythonOperator" in dag_content

    def test_properties(self):
        integration = AirflowIntegration()
        assert integration.name == "Apache Airflow"
        assert integration.platform == "airflow"


class TestSnowflakeIntegration:
    def test_not_configured_by_default(self):
        assert not SnowflakeIntegration().is_configured()

    def test_configured(self):
        integration = SnowflakeIntegration(
            account="test", warehouse="wh", database="db"
        )
        assert integration.is_configured()


class TestAWSIntegration:
    def test_not_configured_by_default(self):
        assert not AWSIntegration().is_configured()

    def test_configured(self):
        assert AWSIntegration(s3_bucket="my-bucket").is_configured()

    def test_publish_skips_when_unconfigured(self):
        result = AWSIntegration().publish_report({})
        assert result["status"] == "skipped"


class TestGitLabIntegration:
    def test_not_configured_by_default(self):
        assert not GitLabIntegration().is_configured()


class TestKafkaIntegration:
    def test_not_configured_by_default(self):
        assert not KafkaIntegration().is_configured()

    def test_configured(self):
        assert KafkaIntegration(bootstrap_servers="localhost:9092").is_configured()


class TestWebhookIntegration:
    def test_not_configured_by_default(self):
        assert not WebhookIntegration().is_configured()

    def test_configured(self):
        assert WebhookIntegration(webhook_url="https://example.com/hook").is_configured()


class TestAllIntegrationsHaveRequiredMethods:
    """Ensure all integrations implement the base interface."""

    @pytest.mark.parametrize(
        "cls,kwargs",
        [
            (AirflowIntegration, {}),
            (SnowflakeIntegration, {}),
            (AzureIntegration, {}),
            (AWSIntegration, {}),
            (GitLabIntegration, {}),
            (KafkaIntegration, {}),
            (WebhookIntegration, {}),
            (PowerBIIntegration, {}),
            (DbtCloudIntegration, {}),
            (KubernetesIntegration, {}),
        ],
    )
    def test_interface(self, cls, kwargs):
        integration = cls(**kwargs)
        assert hasattr(integration, "name")
        assert hasattr(integration, "platform")
        assert hasattr(integration, "is_configured")
        assert hasattr(integration, "health_check")
        assert hasattr(integration, "publish_report")
        assert isinstance(integration.name, str)
        assert isinstance(integration.platform, str)
