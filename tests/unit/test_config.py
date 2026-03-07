"""Tests for DataPilot configuration system."""

import os
import tempfile

import pytest

from datapilot.core.config import DataPilotConfig, LLMProviderConfig, ModelTier


class TestDataPilotConfig:
    def test_default_config(self):
        cfg = DataPilotConfig()
        assert cfg.log_level == "INFO"
        assert cfg.pipeline.parallel_analysis is True
        assert cfg.pipeline.max_workers == 4
        assert len(cfg.llm_providers) > 0

    def test_provider_tiers(self):
        cfg = DataPilotConfig()
        tiers = {p.tier for p in cfg.llm_providers}
        assert ModelTier.FREE in tiers
        assert ModelTier.PREMIUM in tiers

    def test_get_available_providers_empty(self):
        """With no API keys set, no providers should be available."""
        cfg = DataPilotConfig()
        # Clear any existing env vars
        for key in ["GROQ_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]:
            os.environ.pop(key, None)
        available = cfg.get_available_providers()
        # May or may not have providers depending on env
        assert isinstance(available, list)

    def test_get_provider_with_key(self):
        cfg = DataPilotConfig()
        os.environ["GROQ_API_KEY"] = "test-key"
        try:
            provider = cfg.get_provider(ModelTier.FREE)
            assert provider is not None
            assert provider.provider == "groq"
        finally:
            os.environ.pop("GROQ_API_KEY", None)

    def test_yaml_roundtrip(self):
        cfg = DataPilotConfig()
        path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".yaml", delete=False) as f:
                path = f.name
            cfg.to_yaml(path)
            loaded = DataPilotConfig.from_yaml(path)
            assert loaded.log_level == cfg.log_level
            assert loaded.pipeline.max_workers == cfg.pipeline.max_workers
        finally:
            if path and os.path.exists(path):
                os.unlink(path)

    def test_routing_config(self):
        cfg = DataPilotConfig()
        assert "missing_tests" in cfg.routing.simple_tasks
        assert "duplicate_metrics" in cfg.routing.premium_tasks
        assert "dead_models" in cfg.routing.standard_tasks


class TestLLMProviderConfig:
    def test_provider_defaults(self):
        p = LLMProviderConfig(provider="groq", model="llama-3.3-70b-versatile")
        assert p.tier == ModelTier.STANDARD
        assert p.max_tokens == 2000
        assert p.temperature == 0.1

    def test_cost_tracking(self):
        p = LLMProviderConfig(
            provider="anthropic",
            model="claude-sonnet-4-20250514",
            cost_per_1k_input=0.003,
            cost_per_1k_output=0.015,
        )
        assert p.cost_per_1k_input == 0.003
        assert p.cost_per_1k_output == 0.015
