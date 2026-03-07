"""Enterprise configuration management with Pydantic validation."""

from __future__ import annotations

import os
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class ModelTier(str, Enum):
    """LLM tier for cost-aware routing."""

    FREE = "free"
    STANDARD = "standard"
    PREMIUM = "premium"


class LLMProviderConfig(BaseModel):
    """Configuration for a single LLM provider."""

    provider: str = Field(description="Provider name: groq, openai, anthropic, ollama")
    model: str = Field(description="Model identifier")
    api_key_env: str = Field(default="", description="Environment variable holding the API key")
    base_url: str | None = Field(default=None, description="Custom base URL for API")
    tier: ModelTier = Field(default=ModelTier.STANDARD, description="Cost tier for routing")
    max_tokens: int = Field(default=2000)
    temperature: float = Field(default=0.1)
    cost_per_1k_input: float = Field(default=0.0, description="Cost per 1K input tokens")
    cost_per_1k_output: float = Field(default=0.0, description="Cost per 1K output tokens")
    rate_limit_rpm: int = Field(default=60, description="Rate limit: requests per minute")


class AgentRoutingConfig(BaseModel):
    """Rules for routing tasks to LLM tiers."""

    simple_tasks: list[str] = Field(
        default=[
            "missing_tests",
            "broken_refs",
        ],
        description="Tasks routed to free/cheap models (deterministic or simple)",
    )
    standard_tasks: list[str] = Field(
        default=[
            "dead_models",
            "orphans",
            "deprecated_sources",
        ],
        description="Tasks routed to standard models",
    )
    premium_tasks: list[str] = Field(
        default=[
            "duplicate_metrics",
            "grain_joins",
            "logic_drift",
            "cross_model_analysis",
        ],
        description="Tasks routed to premium models (complex reasoning)",
    )


class PipelineConfig(BaseModel):
    """Pipeline execution configuration."""

    parallel_analysis: bool = Field(default=True, description="Run analysis tasks in parallel")
    max_workers: int = Field(default=4)
    retry_attempts: int = Field(default=3)
    retry_delay: float = Field(default=2.0, description="Base delay between retries in seconds")
    cache_ttl: int = Field(default=3600, description="Cache TTL in seconds")
    enable_cache: bool = Field(default=True)


class IntegrationConfig(BaseModel):
    """Enterprise integration settings."""

    # Airflow
    airflow_base_url: str = Field(default="")
    airflow_dag_folder: str = Field(default="")

    # Snowflake
    snowflake_account: str = Field(default="")
    snowflake_warehouse: str = Field(default="")
    snowflake_database: str = Field(default="")
    snowflake_schema: str = Field(default="")

    # Cloud
    aws_region: str = Field(default="us-east-1")
    aws_s3_bucket: str = Field(default="")
    azure_storage_account: str = Field(default="")
    azure_container: str = Field(default="")

    # GitLab
    gitlab_url: str = Field(default="")
    gitlab_project_id: str = Field(default="")

    # Messaging
    kafka_bootstrap_servers: str = Field(default="")
    kafka_topic: str = Field(default="datapilot-events")

    # Power BI
    powerbi_workspace_id: str = Field(default="")
    powerbi_dataset_id: str = Field(default="")

    # dbt Cloud
    dbt_cloud_account_id: str = Field(default="")
    dbt_cloud_api_token_env: str = Field(default="DBT_CLOUD_API_TOKEN")


class WebConfig(BaseModel):
    """Web dashboard configuration."""

    host: str = Field(default="0.0.0.0")
    port: int = Field(default=5000)
    debug: bool = Field(default=False)
    secret_key: str = Field(default="change-me-in-production")
    cors_origins: list[str] = Field(default=["*"])


class DataPilotConfig(BaseSettings):
    """Root configuration for DataPilot."""

    model_config = {"env_prefix": "DATAPILOT_", "env_nested_delimiter": "__"}

    # Project
    project_root: str = Field(default=".", description="Path to dbt project root")
    output_dir: str = Field(default="./output", description="Output directory for reports")
    log_level: str = Field(default="INFO")

    # LLM Providers — multi-model setup
    llm_providers: list[LLMProviderConfig] = Field(
        default=[
            LLMProviderConfig(
                provider="groq",
                model="llama-3.3-70b-versatile",
                api_key_env="GROQ_API_KEY",
                tier=ModelTier.FREE,
                cost_per_1k_input=0.0,
                cost_per_1k_output=0.0,
                rate_limit_rpm=30,
            ),
            LLMProviderConfig(
                provider="groq",
                model="llama-3.1-8b-instant",
                api_key_env="GROQ_API_KEY",
                tier=ModelTier.STANDARD,
                cost_per_1k_input=0.0,
                cost_per_1k_output=0.0,
                rate_limit_rpm=30,
            ),
            LLMProviderConfig(
                provider="groq",
                model="llama-3.3-70b-versatile",
                api_key_env="GROQ_API_KEY",
                tier=ModelTier.PREMIUM,
                cost_per_1k_input=0.0,
                cost_per_1k_output=0.0,
                rate_limit_rpm=30,
            ),
            LLMProviderConfig(
                provider="ollama",
                model="llama3",
                api_key_env="OLLAMA_API_KEY", # Set dummy to prevent auto-selection unless explicitly requested
                base_url="http://localhost:11434/v1",
                tier=ModelTier.PREMIUM,
                cost_per_1k_input=0.0,
                cost_per_1k_output=0.0,
                rate_limit_rpm=1000,
            ),
        ],
    )

    # Agent routing
    routing: AgentRoutingConfig = Field(default_factory=AgentRoutingConfig)

    # Pipeline
    pipeline: PipelineConfig = Field(default_factory=PipelineConfig)

    # Integrations
    integrations: IntegrationConfig = Field(default_factory=IntegrationConfig)

    # Web
    web: WebConfig = Field(default_factory=WebConfig)

    def get_provider(self, tier: ModelTier) -> LLMProviderConfig | None:
        """Get the first available provider for a given tier."""
        for p in self.llm_providers:
            if p.tier == tier:
                api_key = os.getenv(p.api_key_env, "") if p.api_key_env else ""
                if api_key or p.provider == "ollama":
                    return p
        return None

    def get_available_providers(self) -> list[LLMProviderConfig]:
        """Get all providers with valid API keys."""
        available = []
        for p in self.llm_providers:
            api_key = os.getenv(p.api_key_env, "") if p.api_key_env else ""
            if api_key or p.provider == "ollama":
                available.append(p)
        return available

    @classmethod
    def from_yaml(cls, path: str | Path) -> DataPilotConfig:
        """Load config from a YAML file, merged with environment variables."""
        import yaml

        path = Path(path)
        if path.exists():
            with open(path) as f:
                data = yaml.safe_load(f) or {}
            return cls(**data)
        return cls()

    def to_yaml(self, path: str | Path) -> None:
        """Export current config to YAML."""
        import yaml

        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            yaml.dump(
                self.model_dump(mode="json"),
                f,
                default_flow_style=False,
                sort_keys=False,
            )
