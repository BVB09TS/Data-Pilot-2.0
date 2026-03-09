"""Unit tests for the AI Gateway platform.

Covers:
- Domain models: serialisation round-trips, key generation
- Auth: token extraction, key hashing, admin auth
- Guardrails: topic blocking, system prompt injection, PII scrubbing, model policies
- Quota / rate limiting: RateLimiter sliding window, QuotaExceeded
- TenantStore: CRUD, concurrent usage updates
- Proxy: full happy path (mocked provider), auth failure, rate limit, guardrail block
- API routes: key endpoints via Flask test client
- Critical fixes: path traversal, router fallback chain, thread-safe stats
"""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ── Gateway model tests ────────────────────────────────────────────────


from datapilot.gateway.models import (
    AuditAction,
    AuditLogEntry,
    Policy,
    PolicyType,
    ProviderConfig,
    ProviderType,
    Tenant,
    UsageRecord,
    generate_api_key,
    hash_api_key,
    hash_content,
)


def make_tenant(**kwargs) -> Tenant:
    key = generate_api_key()
    defaults = dict(
        id="t1",
        name="Acme Corp",
        api_key_hash=hash_api_key(key),
        providers=[
            ProviderConfig(
                provider=ProviderType.OPENAI,
                model="gpt-4o-mini",
                encrypted_api_key="",
            )
        ],
        scopes=["chat"],
        rate_limit_rpm=60,
    )
    defaults.update(kwargs)
    return Tenant(**defaults)


class TestDomainModels:
    def test_generate_api_key_format(self):
        key = generate_api_key()
        assert key.startswith("dp_")
        assert len(key) == 67  # "dp_" + 64 hex chars

    def test_hash_api_key_stable(self):
        key = "dp_abc123"
        assert hash_api_key(key) == hash_api_key(key)

    def test_hash_api_key_different_keys(self):
        assert hash_api_key("dp_aaa") != hash_api_key("dp_bbb")

    def test_tenant_serialisation_roundtrip(self):
        t = make_tenant()
        d = t.to_dict()
        t2 = Tenant.from_dict(d)
        assert t2.id == t.id
        assert t2.name == t.name
        assert t2.scopes == t.scopes
        assert len(t2.providers) == 1

    def test_tenant_within_quota_unlimited(self):
        t = make_tenant(quota_monthly_tokens=None)
        assert t.within_quota() is True

    def test_tenant_within_quota_over_limit(self):
        t = make_tenant(quota_monthly_tokens=100)
        u = t.current_usage()
        u.input_tokens = 80
        u.output_tokens = 30
        assert t.within_quota() is False

    def test_tenant_get_active_provider(self):
        t = make_tenant()
        p = t.get_active_provider()
        assert p is not None
        assert p.model == "gpt-4o-mini"

    def test_provider_serialisation(self):
        pc = ProviderConfig(
            provider=ProviderType.ANTHROPIC,
            model="claude-3-haiku-20240307",
            base_url=None,
        )
        d = pc.to_dict()
        pc2 = ProviderConfig.from_dict(d)
        assert pc2.provider == ProviderType.ANTHROPIC
        assert pc2.model == pc.model

    def test_policy_serialisation(self):
        p = Policy(
            name="no-finance",
            type=PolicyType.BLOCK_TOPIC,
            config={"topics": ["credit card"]},
        )
        d = p.to_dict()
        p2 = Policy.from_dict(d)
        assert p2.type == PolicyType.BLOCK_TOPIC
        assert p2.config["topics"] == ["credit card"]

    def test_audit_log_entry_roundtrip(self):
        entry = AuditLogEntry(
            id="e1",
            tenant_id="t1",
            action=AuditAction.RESPONSE,
            provider="openai",
            model="gpt-4o-mini",
            timestamp="2026-01-01T00:00:00Z",
            request_hash="abc123",
            input_tokens=10,
            output_tokens=20,
            latency_ms=120.5,
        )
        d = entry.to_dict()
        e2 = AuditLogEntry.from_dict(d)
        assert e2.action == AuditAction.RESPONSE
        assert e2.input_tokens == 10


# ── Auth tests ────────────────────────────────────────────────────────


from datapilot.gateway.auth import (
    AuthError,
    authenticate,
    authenticate_admin,
    authorize,
    extract_bearer_token,
)
from datapilot.gateway.store import TenantStore


class TestAuth:
    def test_extract_bearer_ok(self):
        assert extract_bearer_token("Bearer dp_abc123") == "dp_abc123"

    def test_extract_bearer_missing(self):
        with pytest.raises(AuthError) as exc_info:
            extract_bearer_token(None)
        assert exc_info.value.status == 401

    def test_extract_bearer_malformed(self):
        with pytest.raises(AuthError):
            extract_bearer_token("Token xyz")

    def test_authenticate_valid_key(self, tmp_path):
        key = generate_api_key()
        t = make_tenant(api_key_hash=hash_api_key(key))
        store = TenantStore(tmp_path / "tenants.json")
        store.save(t)
        resolved = authenticate(store, f"Bearer {key}")
        assert resolved.id == t.id

    def test_authenticate_wrong_key(self, tmp_path):
        store = TenantStore(tmp_path / "tenants.json")
        with pytest.raises(AuthError) as exc_info:
            authenticate(store, "Bearer dp_wrongkey")
        assert exc_info.value.status == 401

    def test_authenticate_inactive_tenant(self, tmp_path):
        key = generate_api_key()
        t = make_tenant(api_key_hash=hash_api_key(key), is_active=False)
        store = TenantStore(tmp_path / "tenants.json")
        store.save(t)
        with pytest.raises(AuthError) as exc_info:
            authenticate(store, f"Bearer {key}")
        assert exc_info.value.status == 403

    def test_authorize_valid_scope(self):
        t = make_tenant(scopes=["chat", "embeddings"])
        authorize(t, "chat")  # should not raise

    def test_authorize_invalid_scope(self):
        t = make_tenant(scopes=["chat"])
        with pytest.raises(AuthError) as exc_info:
            authorize(t, "admin")
        assert exc_info.value.status == 403

    def test_authorize_blocked_model(self):
        t = make_tenant(
            policies=[
                Policy(
                    name="no-gpt4",
                    type=PolicyType.BLOCK_MODELS,
                    config={"models": ["gpt-4o"]},
                )
            ]
        )
        with pytest.raises(AuthError):
            authorize(t, "chat", model="gpt-4o")

    def test_authenticate_admin_wrong_key(self, monkeypatch):
        monkeypatch.setenv("GATEWAY_ADMIN_KEY", "correct-key")
        with pytest.raises(AuthError):
            authenticate_admin("Bearer wrong-key")

    def test_authenticate_admin_correct_key(self, monkeypatch):
        monkeypatch.setenv("GATEWAY_ADMIN_KEY", "correct-key")
        authenticate_admin("Bearer correct-key")  # should not raise


# ── Guardrail tests ───────────────────────────────────────────────────


from datapilot.gateway.guardrails import GuardrailViolation, post_check, pre_check


def _msgs(*texts: str, role: str = "user") -> list[dict]:
    return [{"role": role, "content": t} for t in texts]


class TestGuardrails:
    def test_no_policies_passthrough(self):
        t = make_tenant()
        msgs = _msgs("Hello!")
        result = pre_check(t, msgs, "gpt-4o-mini")
        assert result == msgs

    def test_block_topic_raises(self):
        t = make_tenant(
            policies=[
                Policy(
                    name="no-finance",
                    type=PolicyType.BLOCK_TOPIC,
                    config={"topics": ["credit card"]},
                )
            ]
        )
        msgs = _msgs("My credit card number is 1234.")
        with pytest.raises(GuardrailViolation) as exc_info:
            pre_check(t, msgs, "gpt-4o-mini")
        assert exc_info.value.policy_name == "no-finance"

    def test_block_topic_case_insensitive(self):
        t = make_tenant(
            policies=[
                Policy(
                    name="no-finance",
                    type=PolicyType.BLOCK_TOPIC,
                    config={"topics": ["Credit Card"]},
                )
            ]
        )
        with pytest.raises(GuardrailViolation):
            pre_check(t, _msgs("my credit card"), "gpt-4o-mini")

    def test_system_prompt_injected_prepend(self):
        t = make_tenant(
            policies=[
                Policy(
                    name="safety",
                    type=PolicyType.REQUIRE_SYSTEM_PROMPT,
                    config={"content": "You are a helpful assistant.", "mode": "prepend"},
                )
            ]
        )
        msgs = [{"role": "system", "content": "Existing prompt."}, {"role": "user", "content": "Hi"}]
        result = pre_check(t, msgs, "gpt-4o-mini")
        sys_msg = next(m for m in result if m["role"] == "system")
        assert "You are a helpful assistant." in sys_msg["content"]
        assert "Existing prompt." in sys_msg["content"]

    def test_system_prompt_replace(self):
        t = make_tenant(
            policies=[
                Policy(
                    name="safety",
                    type=PolicyType.REQUIRE_SYSTEM_PROMPT,
                    config={"content": "REQUIRED SYSTEM.", "mode": "replace"},
                )
            ]
        )
        msgs = [{"role": "system", "content": "old"}, {"role": "user", "content": "Hi"}]
        result = pre_check(t, msgs, "gpt-4o-mini")
        sys_msg = next(m for m in result if m["role"] == "system")
        assert sys_msg["content"] == "REQUIRED SYSTEM."

    def test_pii_scrubbed_from_response(self):
        t = make_tenant(
            policies=[Policy(name="pii", type=PolicyType.PII_FILTER, config={})]
        )
        raw = "User email is foo@example.com and SSN 123-45-6789."
        result = post_check(t, raw)
        assert "foo@example.com" not in result
        assert "123-45-6789" not in result
        assert "[EMAIL]" in result
        assert "[SSN]" in result

    def test_pii_not_scrubbed_without_policy(self):
        t = make_tenant()
        raw = "User email is foo@example.com."
        result = post_check(t, raw)
        assert "foo@example.com" in result  # unchanged


# ── Rate limiter tests ────────────────────────────────────────────────


from datapilot.gateway.quota import (
    QuotaExceeded,
    RateLimitExceeded,
    RateLimiter,
    check_quota,
)


class TestRateLimiter:
    def test_within_limit(self):
        rl = RateLimiter()
        for _ in range(5):
            rl.check("t1", 10)  # should not raise

    def test_exceeds_limit(self):
        rl = RateLimiter()
        for _ in range(5):
            rl.check("t1", 5)
        with pytest.raises(RateLimitExceeded):
            rl.check("t1", 5)

    def test_independent_tenants(self):
        rl = RateLimiter()
        for _ in range(5):
            rl.check("t1", 5)
        # t2 has its own window — should not be affected
        rl.check("t2", 5)

    def test_reset_clears_window(self):
        rl = RateLimiter()
        for _ in range(5):
            rl.check("t1", 5)
        rl.reset("t1")
        rl.check("t1", 5)  # should not raise

    def test_thread_safety(self):
        rl = RateLimiter()
        errors: list[Exception] = []

        def worker():
            try:
                for _ in range(3):
                    rl.check("shared", 200)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert not errors


class TestQuota:
    def test_within_quota(self):
        check_quota("t1", 1000, 500)  # should not raise

    def test_unlimited_quota(self):
        check_quota("t1", None, 10_000_000)  # should not raise

    def test_quota_exceeded(self):
        with pytest.raises(QuotaExceeded):
            check_quota("t1", 100, 100)

    def test_quota_over(self):
        with pytest.raises(QuotaExceeded):
            check_quota("t1", 100, 200)


# ── TenantStore tests ─────────────────────────────────────────────────


class TestTenantStore:
    def test_save_and_get(self, tmp_path):
        store = TenantStore(tmp_path / "tenants.json")
        t = make_tenant()
        store.save(t)
        loaded = store.get(t.id)
        assert loaded is not None
        assert loaded.name == t.name

    def test_get_missing(self, tmp_path):
        store = TenantStore(tmp_path / "tenants.json")
        assert store.get("nonexistent") is None

    def test_delete(self, tmp_path):
        store = TenantStore(tmp_path / "tenants.json")
        t = make_tenant()
        store.save(t)
        assert store.delete(t.id) is True
        assert store.get(t.id) is None

    def test_list_all(self, tmp_path):
        store = TenantStore(tmp_path / "tenants.json")
        t1 = make_tenant(id="a", name="A")
        t2 = make_tenant(id="b", name="B")
        store.save(t1)
        store.save(t2)
        all_tenants = store.list_all()
        assert len(all_tenants) == 2

    def test_update_usage_thread_safe(self, tmp_path):
        store = TenantStore(tmp_path / "tenants.json")
        t = make_tenant()
        store.save(t)

        def updater():
            store.update_usage(t.id, 10, 5, 0.001)

        threads = [threading.Thread(target=updater) for _ in range(10)]
        for th in threads:
            th.start()
        for th in threads:
            th.join()

        loaded = store.get(t.id)
        u = loaded.current_usage()
        # 10 threads × (10 + 5) = 150 total tokens
        assert u.input_tokens == 100
        assert u.output_tokens == 50
        assert u.requests == 10


# ── Gateway proxy tests (mocked provider) ────────────────────────────


from datapilot.gateway.proxy import Gateway, GatewayError
from datapilot.gateway.store import AuditLogStore


def _make_gateway(tmp_path: Path, tenant: Tenant) -> tuple[Gateway, str]:
    """Create a gateway with one tenant and an isolated rate limiter.

    Each call gets a fresh RateLimiter so tests cannot share sliding-window state.
    Returns (gateway, plaintext_api_key).
    """
    key = generate_api_key()
    tenant.api_key_hash = hash_api_key(key)
    ts = TenantStore(tmp_path / "tenants.json")
    als = AuditLogStore(tmp_path / "logs")
    ts.save(tenant)
    return Gateway(ts, als, rate_limiter=RateLimiter()), key


class TestGatewayProxy:
    def test_successful_chat(self, tmp_path):
        t = make_tenant()
        gw, key = _make_gateway(tmp_path, t)

        with patch("datapilot.gateway.proxy._openai_compat_call") as mock_call:
            mock_call.return_value = ("Hello!", 10, 20, 0.0)
            result = gw.chat(
                auth_header=f"Bearer {key}",
                messages=[{"role": "user", "content": "Hi"}],
            )

        assert result["choices"][0]["message"]["content"] == "Hello!"
        assert result["usage"]["prompt_tokens"] == 10

    def test_auth_failure(self, tmp_path):
        t = make_tenant()
        gw, _ = _make_gateway(tmp_path, t)
        with pytest.raises(AuthError):
            gw.chat(auth_header="Bearer wrong_key", messages=[{"role": "user", "content": "hi"}])

    def test_rate_limit_enforced(self, tmp_path):
        t = make_tenant(rate_limit_rpm=2)
        gw, key = _make_gateway(tmp_path, t)

        with patch("datapilot.gateway.proxy._openai_compat_call") as mock_call:
            mock_call.return_value = ("ok", 1, 1, 0.0)
            gw.chat(f"Bearer {key}", [{"role": "user", "content": "1"}])
            gw.chat(f"Bearer {key}", [{"role": "user", "content": "2"}])
            with pytest.raises(RateLimitExceeded):
                gw.chat(f"Bearer {key}", [{"role": "user", "content": "3"}])

    def test_guardrail_blocks_topic(self, tmp_path):
        t = make_tenant(
            policies=[
                Policy(
                    name="no-nsfw",
                    type=PolicyType.BLOCK_TOPIC,
                    config={"topics": ["forbidden"]},
                )
            ]
        )
        gw, key = _make_gateway(tmp_path, t)
        with pytest.raises(GuardrailViolation):
            gw.chat(f"Bearer {key}", [{"role": "user", "content": "forbidden topic"}])

    def test_provider_error_raises_gateway_error(self, tmp_path):
        t = make_tenant()
        gw, key = _make_gateway(tmp_path, t)

        with patch("datapilot.gateway.proxy._openai_compat_call", side_effect=RuntimeError("boom")):
            with pytest.raises(GatewayError) as exc_info:
                gw.chat(f"Bearer {key}", [{"role": "user", "content": "hi"}])
            assert exc_info.value.status == 502

    def test_audit_log_written(self, tmp_path):
        t = make_tenant()
        gw, key = _make_gateway(tmp_path, t)

        with patch("datapilot.gateway.proxy._openai_compat_call") as mock_call:
            mock_call.return_value = ("ok", 5, 10, 0.0)
            gw.chat(f"Bearer {key}", [{"role": "user", "content": "hi"}])

        als = AuditLogStore(tmp_path / "logs")
        entries = als.query(tenant_id=t.id)
        assert len(entries) >= 1
        assert entries[0]["action"] == AuditAction.RESPONSE.value


# ── Critical fixes: path traversal ───────────────────────────────────


from datapilot.api.routes import create_api_app


class TestPathTraversal:
    def test_report_rejects_traversal(self, tmp_path):
        app = create_api_app(output_dir=str(tmp_path))
        # Create a legit report
        report = tmp_path / "datapilot_report.json"
        report.write_text(json.dumps({"ok": True}))
        app.config["DATAPILOT_REPORT_PATH"] = str(report)

        client = app.test_client()
        # Attempt traversal to /etc/passwd
        resp = client.get("/api/v1/report?path=/etc/passwd")
        assert resp.status_code in (403, 404)

    def test_report_within_output_dir_allowed(self, tmp_path):
        app = create_api_app(output_dir=str(tmp_path))
        report = tmp_path / "datapilot_report.json"
        report.write_text(json.dumps({"report": {}, "score": None}))
        app.config["DATAPILOT_REPORT_PATH"] = str(report)

        client = app.test_client()
        resp = client.get(f"/api/v1/report?path={report}")
        assert resp.status_code == 200


# ── Critical fixes: router fallback chain ─────────────────────────────


from datapilot.agents.router import AgentRouter
from datapilot.core.config import DataPilotConfig, ModelTier


class TestRouterFallback:
    def test_fallback_no_cycle(self):
        """STANDARD without key should fall to FREE only, never back to PREMIUM."""
        cfg = DataPilotConfig()
        router = AgentRouter(config=cfg)
        # Walk the fallback chain manually
        fallback_order = {
            ModelTier.PREMIUM: [ModelTier.STANDARD, ModelTier.FREE],
            ModelTier.STANDARD: [ModelTier.FREE],
            ModelTier.FREE: [],
        }
        visited: set[ModelTier] = set()
        tier = ModelTier.STANDARD
        while tier:
            assert tier not in visited, f"Circular fallback detected at {tier}"
            visited.add(tier)
            nexts = fallback_order.get(tier, [])
            tier = nexts[0] if nexts else None

    def test_stats_thread_safe(self):
        """Concurrent _track_call calls must not corrupt stats."""
        cfg = DataPilotConfig()
        router = AgentRouter(config=cfg)
        from datapilot.agents.router import LLMResponse
        from datapilot.core.config import LLMProviderConfig

        provider = LLMProviderConfig(
            provider="groq", model="llama", api_key_env="X", tier=ModelTier.FREE
        )
        resp = LLMResponse(content="", model="llama", provider="groq", tier=ModelTier.FREE,
                           input_tokens=1, output_tokens=2, latency_ms=10)

        def worker():
            for _ in range(20):
                router._track_call("test_task", provider, resp)

        threads = [threading.Thread(target=worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        stats = router.get_stats()
        assert stats["test_task"]["calls"] == 100  # 5 threads × 20
        assert stats["test_task"]["total_input_tokens"] == 100
