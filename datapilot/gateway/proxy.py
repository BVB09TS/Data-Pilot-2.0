"""Core AI Gateway proxy — routes client requests to the chosen AI provider.

Flow:
  1. Authenticate request (Bearer token → Tenant)
  2. Authorize scope + model
  3. Rate-limit check
  4. Quota check
  5. Guardrails pre-check (topic blocks, system prompt injection, model allow/block)
  6. Decrypt provider API key from KeyVault
  7. Forward to AI provider (OpenAI-compatible or Anthropic native)
  8. Guardrails post-check (PII scrubbing)
  9. Update usage counters
 10. Write audit log entry
 11. Return response to client

Supported providers: openai, groq, anthropic, azure_openai, ollama, mcp, custom
(azure_openai, mcp, and custom use the OpenAI-compatible SDK with a custom base_url)
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog

from datapilot.gateway import keyvault
from datapilot.gateway.auth import AuthError, authenticate, authorize
from datapilot.gateway.guardrails import GuardrailViolation, post_check, pre_check
from datapilot.gateway.models import (
    AuditAction,
    AuditLogEntry,
    ProviderConfig,
    ProviderType,
    Tenant,
    hash_content,
)
from datapilot.gateway.quota import (
    QuotaExceeded,
    RateLimitExceeded,
    check_quota,
    get_rate_limiter,
)
from datapilot.gateway.store import AuditLogStore, TenantStore

logger = structlog.get_logger()


class GatewayError(Exception):
    """Wraps provider-level errors for uniform HTTP response handling."""

    def __init__(self, message: str, status: int = 502) -> None:
        super().__init__(message)
        self.status = status


# ── Provider call helpers ─────────────────────────────────────────────────


def _openai_compat_call(
    provider: ProviderConfig,
    api_key: str,
    messages: list[dict],
    max_tokens: int,
) -> tuple[str, int, int, float]:
    """Make an OpenAI-compatible chat completion call.

    Returns (content, input_tokens, output_tokens, cost_usd).
    Compatible with: openai, groq, azure_openai, ollama, mcp, custom.
    """
    from openai import OpenAI  # soft dependency — gateway extras

    kwargs: dict[str, Any] = {"api_key": api_key}
    if provider.base_url:
        kwargs["base_url"] = provider.base_url

    client = OpenAI(**kwargs)
    resp = client.chat.completions.create(
        model=provider.model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=provider.temperature,
    )
    content = resp.choices[0].message.content or ""
    usage = resp.usage
    input_tok = usage.prompt_tokens if usage else 0
    output_tok = usage.completion_tokens if usage else 0
    # Cost calculation: most proxied providers charge differently; default 0
    cost = 0.0
    return content, input_tok, output_tok, cost


def _anthropic_call(
    provider: ProviderConfig,
    api_key: str,
    messages: list[dict],
    max_tokens: int,
) -> tuple[str, int, int, float]:
    """Make an Anthropic Messages API call.

    Returns (content, input_tokens, output_tokens, cost_usd).
    """
    import anthropic  # soft dependency

    client = anthropic.Anthropic(api_key=api_key)

    # Extract system prompt from messages list (Anthropic uses separate param)
    system = ""
    user_messages = []
    for msg in messages:
        if msg.get("role") == "system":
            system = msg.get("content", "")
        else:
            user_messages.append(msg)

    kwargs: dict[str, Any] = dict(
        model=provider.model,
        max_tokens=max_tokens,
        messages=user_messages,
    )
    if system:
        kwargs["system"] = system

    resp = client.messages.create(**kwargs)
    content = resp.content[0].text if resp.content else ""
    input_tok = resp.usage.input_tokens
    output_tok = resp.usage.output_tokens
    cost = 0.0
    return content, input_tok, output_tok, cost


def _call_provider(
    provider: ProviderConfig,
    messages: list[dict],
    max_tokens: int | None,
) -> tuple[str, int, int, float]:
    """Route to the correct backend and return (content, in_tok, out_tok, cost)."""
    api_key = keyvault.decrypt(provider.encrypted_api_key) if provider.encrypted_api_key else ""
    tokens = max_tokens or provider.max_tokens

    if provider.provider == ProviderType.ANTHROPIC:
        return _anthropic_call(provider, api_key, messages, tokens)
    else:
        # openai / groq / azure_openai / ollama / mcp / custom — all OAI-compat
        return _openai_compat_call(provider, api_key, messages, tokens)


# ── Main gateway entry point ──────────────────────────────────────────────


class Gateway:
    """Stateless gateway that mediates between clients and AI providers."""

    def __init__(
        self,
        tenant_store: TenantStore,
        audit_store: AuditLogStore,
        rate_limiter=None,
    ) -> None:
        self.tenants = tenant_store
        self.audit = audit_store
        # Injectable for testing; falls back to the shared process-level instance
        self.rate_limiter = rate_limiter if rate_limiter is not None else get_rate_limiter()

    def _log(
        self,
        tenant: Tenant,
        action: AuditAction,
        provider: ProviderConfig | None,
        request_hash: str,
        *,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float = 0.0,
        cost_usd: float = 0.0,
        policy_triggered: str | None = None,
        error: str | None = None,
    ) -> None:
        entry = AuditLogEntry(
            id=str(uuid.uuid4())[:8],
            tenant_id=tenant.id,
            action=action,
            provider=provider.provider.value if provider else "none",
            model=provider.model if provider else "none",
            timestamp=datetime.now(tz=timezone.utc).isoformat(),
            request_hash=request_hash,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            cost_usd=cost_usd,
            policy_triggered=policy_triggered,
            error=error,
        )
        self.audit.append(entry)

    def chat(
        self,
        auth_header: str | None,
        messages: list[dict[str, str]],
        model: str | None = None,
        max_tokens: int | None = None,
    ) -> dict[str, Any]:
        """Process a chat completion request through the full security stack.

        Returns an OpenAI-compatible response dict.
        Raises AuthError, RateLimitExceeded, QuotaExceeded, GuardrailViolation,
        or GatewayError on failure.
        """
        # ── 1. Authenticate ──────────────────────────────────────────────
        tenant = authenticate(self.tenants, auth_header)

        # ── 2. Authorize ─────────────────────────────────────────────────
        authorize(tenant, "chat", model)

        # ── 3. Rate limit ────────────────────────────────────────────────
        try:
            self.rate_limiter.check(tenant.id, tenant.rate_limit_rpm)
        except RateLimitExceeded:
            req_hash = hash_content(str(messages))
            provider = tenant.get_active_provider(model)
            self._log(tenant, AuditAction.RATE_LIMITED, provider, req_hash)
            raise

        # ── 4. Quota check ───────────────────────────────────────────────
        usage = tenant.current_usage()
        used = usage.input_tokens + usage.output_tokens
        try:
            check_quota(tenant.id, tenant.quota_monthly_tokens, used)
        except QuotaExceeded:
            req_hash = hash_content(str(messages))
            provider = tenant.get_active_provider(model)
            self._log(tenant, AuditAction.QUOTA_EXCEEDED, provider, req_hash)
            raise

        # ── 5. Resolve provider ──────────────────────────────────────────
        provider = tenant.get_active_provider(model)
        if provider is None:
            raise GatewayError("No AI provider configured for this account", status=503)

        effective_model = model or provider.model
        req_hash = hash_content(str(messages))

        # ── 6. Guardrails pre-check ──────────────────────────────────────
        try:
            messages = pre_check(tenant, messages, effective_model)
        except GuardrailViolation as exc:
            self._log(
                tenant, AuditAction.BLOCKED, provider, req_hash,
                policy_triggered=exc.policy_name,
            )
            raise

        # ── 7. Forward to AI provider ────────────────────────────────────
        start = time.monotonic()
        try:
            content, input_tok, output_tok, cost = _call_provider(
                provider, messages, max_tokens
            )
        except Exception as exc:
            latency = (time.monotonic() - start) * 1000
            self._log(
                tenant, AuditAction.PROVIDER_ERROR, provider, req_hash,
                latency_ms=latency, error=str(exc),
            )
            raise GatewayError(f"Provider error: {exc}", status=502) from exc
        latency = (time.monotonic() - start) * 1000

        # ── 8. Guardrails post-check ─────────────────────────────────────
        try:
            content = post_check(tenant, content)
        except GuardrailViolation as exc:
            self._log(
                tenant, AuditAction.BLOCKED, provider, req_hash,
                input_tokens=input_tok, output_tokens=output_tok,
                latency_ms=latency, cost_usd=cost,
                policy_triggered=exc.policy_name,
            )
            raise

        # ── 9. Update usage ──────────────────────────────────────────────
        self.tenants.update_usage(tenant.id, input_tok, output_tok, cost)

        # ── 10. Audit log ────────────────────────────────────────────────
        self._log(
            tenant, AuditAction.RESPONSE, provider, req_hash,
            input_tokens=input_tok, output_tokens=output_tok,
            latency_ms=latency, cost_usd=cost,
        )

        logger.info(
            "gateway_chat_ok",
            tenant_id=tenant.id,
            model=effective_model,
            provider=provider.provider.value,
            latency_ms=round(latency),
            input_tokens=input_tok,
            output_tokens=output_tok,
        )

        # ── 11. Return OpenAI-compatible response ────────────────────────
        return {
            "id": f"chatcmpl-gw-{uuid.uuid4().hex[:8]}",
            "object": "chat.completion",
            "model": effective_model,
            "provider": provider.provider.value,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": input_tok,
                "completion_tokens": output_tok,
                "total_tokens": input_tok + output_tok,
            },
        }
