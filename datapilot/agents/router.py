"""Intelligent multi-model agent router.

The Ouroboros principle: route each task to the optimal model.
Simple/deterministic tasks → free models (Groq/Llama, Ollama)
Standard analysis tasks   → standard models (GPT-4o-mini)
Complex reasoning tasks   → premium models (Claude, GPT-4o)

Falls back gracefully: if premium unavailable, try standard, then free.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import structlog

from datapilot.core.config import DataPilotConfig, LLMProviderConfig, ModelTier

logger = structlog.get_logger()


class TaskComplexity(str, Enum):
    """Task complexity classification."""

    DETERMINISTIC = "deterministic"  # No LLM needed
    SIMPLE = "simple"  # Pattern matching, confirmation
    STANDARD = "standard"  # Analysis with context
    COMPLEX = "complex"  # Multi-step reasoning, cross-model analysis


@dataclass
class LLMResponse:
    """Structured response from an LLM call."""

    content: str
    model: str
    provider: str
    tier: ModelTier
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0
    cost_usd: float = 0
    cached: bool = False


@dataclass
class AgentRouter:
    """Routes tasks to the optimal LLM based on complexity and availability."""

    config: DataPilotConfig
    _cache: dict[str, LLMResponse] = field(default_factory=dict)
    _call_stats: dict[str, dict[str, Any]] = field(default_factory=dict)

    def classify_task(self, task_type: str) -> TaskComplexity:
        """Classify a task's complexity for routing."""
        if task_type in ("missing_tests",):
            return TaskComplexity.DETERMINISTIC

        if task_type in self.config.routing.simple_tasks:
            return TaskComplexity.SIMPLE

        if task_type in self.config.routing.standard_tasks:
            return TaskComplexity.STANDARD

        if task_type in self.config.routing.premium_tasks:
            return TaskComplexity.COMPLEX

        return TaskComplexity.STANDARD

    def _get_tier_for_complexity(self, complexity: TaskComplexity) -> ModelTier:
        """Map task complexity to model tier."""
        mapping = {
            TaskComplexity.DETERMINISTIC: ModelTier.FREE,
            TaskComplexity.SIMPLE: ModelTier.FREE,
            TaskComplexity.STANDARD: ModelTier.STANDARD,
            TaskComplexity.COMPLEX: ModelTier.PREMIUM,
        }
        return mapping[complexity]

    def _resolve_provider(self, target_tier: ModelTier) -> LLMProviderConfig | None:
        """Resolve the best available provider, with fallback chain."""
        # Try target tier first
        provider = self.config.get_provider(target_tier)
        if provider:
            return provider

        # Fallback chain: premium → standard → free
        fallback_order = {
            ModelTier.PREMIUM: [ModelTier.STANDARD, ModelTier.FREE],
            ModelTier.STANDARD: [ModelTier.FREE, ModelTier.PREMIUM],
            ModelTier.FREE: [ModelTier.STANDARD, ModelTier.PREMIUM],
        }

        for fallback_tier in fallback_order.get(target_tier, []):
            provider = self.config.get_provider(fallback_tier)
            if provider:
                logger.info(
                    "provider_fallback",
                    target=target_tier.value,
                    actual=fallback_tier.value,
                    model=provider.model,
                )
                return provider

        return None

    def _create_client(self, provider: LLMProviderConfig) -> Any:
        """Create an LLM client for the given provider."""
        api_key = os.getenv(provider.api_key_env, "") if provider.api_key_env else ""

        if provider.provider == "groq":
            from groq import Groq

            return Groq(api_key=api_key)
        elif provider.provider == "anthropic":
            import anthropic

            return anthropic.Anthropic(api_key=api_key)
        elif provider.provider == "openai":
            from openai import OpenAI

            kwargs: dict[str, Any] = {"api_key": api_key}
            if provider.base_url:
                kwargs["base_url"] = provider.base_url
            return OpenAI(**kwargs)
        elif provider.provider == "ollama":
            from openai import OpenAI

            return OpenAI(base_url=provider.base_url or "http://localhost:11434/v1", api_key="ollama")
        else:
            raise ValueError(f"Unknown provider: {provider.provider}")

    def _call_provider(
        self,
        provider: LLMProviderConfig,
        system: str,
        user: str,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """Make an LLM call to a specific provider."""
        client = self._create_client(provider)
        tokens = max_tokens or provider.max_tokens
        start = time.monotonic()

        if provider.provider == "anthropic":
            resp = client.messages.create(
                model=provider.model,
                max_tokens=tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            content = resp.content[0].text
            input_tok = resp.usage.input_tokens
            output_tok = resp.usage.output_tokens
        else:
            # OpenAI-compatible API (Groq, OpenAI, Ollama)
            resp = client.chat.completions.create(
                model=provider.model,
                max_tokens=tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            content = resp.choices[0].message.content.strip()
            usage = resp.usage
            input_tok = usage.prompt_tokens if usage else 0
            output_tok = usage.completion_tokens if usage else 0

        latency = (time.monotonic() - start) * 1000
        cost = (
            (input_tok / 1000) * provider.cost_per_1k_input
            + (output_tok / 1000) * provider.cost_per_1k_output
        )

        return LLMResponse(
            content=content,
            model=provider.model,
            provider=provider.provider,
            tier=provider.tier,
            input_tokens=input_tok,
            output_tokens=output_tok,
            latency_ms=latency,
            cost_usd=cost,
        )

    def _cache_key(self, system: str, user: str) -> str:
        """Generate a cache key for deduplication."""
        raw = f"{system}||{user}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def call(
        self,
        task_type: str,
        system: str,
        user: str,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """Route a task to the optimal model and make the call.

        This is the main entry point. It:
        1. Classifies the task complexity
        2. Resolves the best available provider
        3. Checks cache
        4. Makes the call with retries
        5. Tracks stats
        """
        complexity = self.classify_task(task_type)

        if complexity == TaskComplexity.DETERMINISTIC:
            return LLMResponse(
                content="",
                model="deterministic",
                provider="local",
                tier=ModelTier.FREE,
            )

        target_tier = self._get_tier_for_complexity(complexity)
        provider = self._resolve_provider(target_tier)

        if not provider:
            logger.error("no_provider_available", target_tier=target_tier.value)
            return LLMResponse(
                content="[]",
                model="none",
                provider="none",
                tier=target_tier,
            )

        # Check cache
        if self.config.pipeline.enable_cache:
            key = self._cache_key(system, user)
            if key in self._cache:
                cached = self._cache[key]
                cached.cached = True
                return cached

        # Call with retries
        last_error = None
        for attempt in range(self.config.pipeline.retry_attempts):
            try:
                response = self._call_provider(provider, system, user, max_tokens)

                # Cache result
                if self.config.pipeline.enable_cache:
                    self._cache[self._cache_key(system, user)] = response

                # Track stats
                self._track_call(task_type, provider, response)

                logger.info(
                    "llm_call",
                    task=task_type,
                    model=provider.model,
                    tier=provider.tier.value,
                    latency_ms=round(response.latency_ms),
                    cost=round(response.cost_usd, 5),
                )

                return response
            except Exception as e:
                last_error = e
                wait = self.config.pipeline.retry_delay * (2**attempt)
                logger.warning(
                    "llm_retry",
                    attempt=attempt + 1,
                    error=str(e),
                    wait_s=wait,
                )
                time.sleep(wait)

        logger.error("llm_call_failed", task=task_type, error=str(last_error))
        return LLMResponse(
            content="[]",
            model=provider.model,
            provider=provider.provider,
            tier=provider.tier,
        )

    def _track_call(
        self, task_type: str, provider: LLMProviderConfig, response: LLMResponse
    ) -> None:
        """Track call statistics for observability."""
        if task_type not in self._call_stats:
            self._call_stats[task_type] = {
                "calls": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_cost_usd": 0,
                "total_latency_ms": 0,
                "models_used": set(),
            }
        stats = self._call_stats[task_type]
        stats["calls"] += 1
        stats["total_input_tokens"] += response.input_tokens
        stats["total_output_tokens"] += response.output_tokens
        stats["total_cost_usd"] += response.cost_usd
        stats["total_latency_ms"] += response.latency_ms
        stats["models_used"].add(f"{provider.provider}/{provider.model}")

    def get_stats(self) -> dict[str, Any]:
        """Return call statistics for reporting."""
        stats = {}
        for task, data in self._call_stats.items():
            stats[task] = {
                **data,
                "models_used": list(data["models_used"]),
                "avg_latency_ms": (
                    round(data["total_latency_ms"] / data["calls"])
                    if data["calls"]
                    else 0
                ),
            }
        return stats
