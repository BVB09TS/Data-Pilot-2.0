"""Guardrails / policy engine for the AI Gateway.

Policies run in two phases:
  pre_check(messages)   → before the AI call (topic blocks, system prompt injection)
  post_check(response)  → after the AI call  (PII scrubbing, token cap enforcement)

Each check raises GuardrailViolation on block, or returns a (possibly modified)
value on pass.  The proxy treats GuardrailViolation as HTTP 422 Unprocessable.
"""

from __future__ import annotations

import re
from typing import Any

import structlog

from datapilot.gateway.models import Policy, PolicyType, Tenant

logger = structlog.get_logger()

# ── Simple PII patterns (extend as needed) ───────────────────────────────
_PII_PATTERNS: list[tuple[str, str]] = [
    (r"\b\d{3}-\d{2}-\d{4}\b", "[SSN]"),                              # US SSN
    (r"\b4[0-9]{12}(?:[0-9]{3})?\b", "[CC]"),                         # Visa card
    (r"\b5[1-5][0-9]{14}\b", "[CC]"),                                  # Mastercard
    (r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", "[EMAIL]"),
    (r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", "[PHONE]"),
]


class GuardrailViolation(Exception):
    """Raised when a policy blocks a request or response."""

    def __init__(self, message: str, policy_name: str) -> None:
        super().__init__(message)
        self.policy_name = policy_name


def _active_policies(tenant: Tenant, policy_type: PolicyType) -> list[Policy]:
    return [p for p in tenant.policies if p.enabled and p.type == policy_type]


# ── Pre-call checks ───────────────────────────────────────────────────────


def pre_check(tenant: Tenant, messages: list[dict[str, str]], model: str) -> list[dict[str, str]]:
    """Validate and possibly mutate messages before forwarding to AI provider.

    Returns the (possibly modified) messages list.
    Raises GuardrailViolation if any blocking policy is triggered.
    """
    messages = _enforce_max_tokens_prompt(tenant, messages)
    messages = _inject_system_prompt(tenant, messages)
    _check_blocked_topics(tenant, messages)
    _check_allowed_models(tenant, model)
    return messages


def _enforce_max_tokens_prompt(tenant: Tenant, messages: list[dict]) -> list[dict]:
    """Truncate the user message if the MAX_TOKENS policy sets a prompt limit."""
    for policy in _active_policies(tenant, PolicyType.MAX_TOKENS):
        max_prompt_chars: int = policy.config.get("max_prompt_chars", 0)
        if max_prompt_chars <= 0:
            continue
        truncated = []
        for msg in messages:
            if msg.get("role") == "user" and len(msg.get("content", "")) > max_prompt_chars:
                msg = {**msg, "content": msg["content"][:max_prompt_chars] + " [truncated]"}
            truncated.append(msg)
        messages = truncated
    return messages


def _inject_system_prompt(tenant: Tenant, messages: list[dict]) -> list[dict]:
    """Prepend or replace the system prompt if REQUIRE_SYSTEM_PROMPT is active."""
    for policy in _active_policies(tenant, PolicyType.REQUIRE_SYSTEM_PROMPT):
        required: str = policy.config.get("content", "")
        if not required:
            continue
        mode: str = policy.config.get("mode", "prepend")  # prepend | replace
        existing_system = next((m for m in messages if m.get("role") == "system"), None)
        if mode == "replace" or existing_system is None:
            messages = [m for m in messages if m.get("role") != "system"]
            messages = [{"role": "system", "content": required}] + messages
        elif mode == "prepend" and existing_system:
            new_content = required + "\n\n" + existing_system["content"]
            messages = [
                {"role": "system", "content": new_content}
                if m.get("role") == "system"
                else m
                for m in messages
            ]
        logger.info("system_prompt_injected", tenant_id=tenant.id, policy=policy.name)
    return messages


def _check_blocked_topics(tenant: Tenant, messages: list[dict]) -> None:
    """Raise GuardrailViolation if any message matches a blocked topic."""
    for policy in _active_policies(tenant, PolicyType.BLOCK_TOPIC):
        topics: list[str] = policy.config.get("topics", [])
        for topic in topics:
            pattern = re.compile(re.escape(topic), re.IGNORECASE)
            for msg in messages:
                content = msg.get("content", "")
                if pattern.search(content):
                    logger.warning(
                        "topic_blocked",
                        tenant_id=tenant.id,
                        policy=policy.name,
                        topic=topic,
                    )
                    raise GuardrailViolation(
                        f"Request blocked: topic '{topic}' is not permitted",
                        policy_name=policy.name,
                    )


def _check_allowed_models(tenant: Tenant, model: str) -> None:
    """Check ALLOW_MODELS / BLOCK_MODELS policies (pre-flight)."""
    for policy in _active_policies(tenant, PolicyType.ALLOW_MODELS):
        allowed: list[str] = policy.config.get("models", [])
        if allowed and model not in allowed:
            raise GuardrailViolation(
                f"Model '{model}' is not in your allowed model list",
                policy_name=policy.name,
            )
    for policy in _active_policies(tenant, PolicyType.BLOCK_MODELS):
        blocked: list[str] = policy.config.get("models", [])
        if model in blocked:
            raise GuardrailViolation(
                f"Model '{model}' is blocked by policy",
                policy_name=policy.name,
            )


# ── Post-call checks ──────────────────────────────────────────────────────


def post_check(tenant: Tenant, response_text: str) -> str:
    """Validate and possibly redact AI response before returning to client.

    Returns the (possibly scrubbed) response text.
    """
    response_text = _scrub_pii(tenant, response_text)
    return response_text


def _scrub_pii(tenant: Tenant, text: str) -> str:
    """Replace PII patterns in the response if PII_FILTER policy is active."""
    if not _active_policies(tenant, PolicyType.PII_FILTER):
        return text
    for pattern, replacement in _PII_PATTERNS:
        text = re.sub(pattern, replacement, text)
    return text
