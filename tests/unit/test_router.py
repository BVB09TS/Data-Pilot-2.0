"""Tests for the multi-agent router."""

import os

import pytest

from datapilot.agents.router import AgentRouter, LLMResponse, TaskComplexity
from datapilot.core.config import DataPilotConfig, ModelTier


class TestAgentRouter:
    def setup_method(self):
        self.config = DataPilotConfig()
        self.router = AgentRouter(config=self.config)

    def test_classify_deterministic(self):
        assert self.router.classify_task("missing_tests") == TaskComplexity.DETERMINISTIC

    def test_classify_simple(self):
        assert self.router.classify_task("broken_refs") == TaskComplexity.SIMPLE

    def test_classify_standard(self):
        assert self.router.classify_task("dead_models") == TaskComplexity.STANDARD

    def test_classify_complex(self):
        assert self.router.classify_task("duplicate_metrics") == TaskComplexity.COMPLEX

    def test_classify_unknown_defaults_standard(self):
        assert self.router.classify_task("unknown_task") == TaskComplexity.STANDARD

    def test_deterministic_returns_empty(self):
        response = self.router.call("missing_tests", "system", "user")
        assert response.content == ""
        assert response.model == "deterministic"
        assert response.tier == ModelTier.FREE

    def test_tier_mapping(self):
        assert self.router._get_tier_for_complexity(TaskComplexity.SIMPLE) == ModelTier.FREE
        assert self.router._get_tier_for_complexity(TaskComplexity.STANDARD) == ModelTier.STANDARD
        assert self.router._get_tier_for_complexity(TaskComplexity.COMPLEX) == ModelTier.PREMIUM

    def test_cache_key_consistency(self):
        key1 = self.router._cache_key("sys", "usr")
        key2 = self.router._cache_key("sys", "usr")
        assert key1 == key2

    def test_cache_key_uniqueness(self):
        key1 = self.router._cache_key("sys1", "usr")
        key2 = self.router._cache_key("sys2", "usr")
        assert key1 != key2

    def test_stats_tracking(self):
        # Call deterministic task
        self.router.call("missing_tests", "sys", "usr")
        stats = self.router.get_stats()
        # Deterministic tasks are not tracked (no actual LLM call)
        assert isinstance(stats, dict)

    def test_no_provider_returns_empty(self):
        """When no providers have keys, should return empty gracefully."""
        for key in ["GROQ_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]:
            os.environ.pop(key, None)

        response = self.router.call("dead_models", "system", "user")
        assert isinstance(response, LLMResponse)


class TestLLMResponse:
    def test_response_fields(self):
        resp = LLMResponse(
            content="test",
            model="test-model",
            provider="test-provider",
            tier=ModelTier.FREE,
            input_tokens=10,
            output_tokens=20,
        )
        assert resp.content == "test"
        assert resp.cost_usd == 0
        assert resp.cached is False
