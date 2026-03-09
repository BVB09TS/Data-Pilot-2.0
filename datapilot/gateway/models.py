"""Domain models for the AI Gateway.

All persistent objects are plain dataclasses that serialize cleanly to/from JSON.
No ORM dependency — the gateway uses a file-backed TenantStore.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


# ── Enumerations ────────────────────────────────────────────────────────


class ProviderType(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"
    AZURE_OPENAI = "azure_openai"
    OLLAMA = "ollama"
    MCP = "mcp"          # Model Context Protocol endpoint
    CUSTOM = "custom"    # Any OpenAI-compatible HTTP endpoint


class PolicyType(str, Enum):
    BLOCK_TOPIC = "block_topic"          # Refuse if prompt contains a topic
    MAX_TOKENS = "max_tokens"            # Hard cap on output tokens
    REQUIRE_SYSTEM_PROMPT = "require_system_prompt"   # Mandate a system prefix
    PII_FILTER = "pii_filter"            # Strip PII from responses
    ALLOW_MODELS = "allow_models"        # Whitelist of model names
    BLOCK_MODELS = "block_models"        # Blacklist of model names


class AuditAction(str, Enum):
    REQUEST = "request"
    RESPONSE = "response"
    BLOCKED = "blocked"
    RATE_LIMITED = "rate_limited"
    QUOTA_EXCEEDED = "quota_exceeded"
    AUTH_FAILED = "auth_failed"
    PROVIDER_ERROR = "provider_error"


# ── Core Data Models ────────────────────────────────────────────────────


@dataclass
class Policy:
    """A single guardrail rule applied to every AI call for a tenant."""

    name: str
    type: PolicyType
    config: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.type.value,
            "config": self.config,
            "enabled": self.enabled,
        }

    @classmethod
    def from_dict(cls, d: dict) -> Policy:
        return cls(
            name=d["name"],
            type=PolicyType(d["type"]),
            config=d.get("config", {}),
            enabled=d.get("enabled", True),
        )


@dataclass
class ProviderConfig:
    """An AI provider configured by a tenant.

    The client's API key is stored encrypted (AES-GCM via the KeyVault).
    The gateway never logs or returns plaintext keys.
    """

    provider: ProviderType
    model: str
    encrypted_api_key: str = ""   # base64(AES-GCM(key)) — empty for key-less providers
    base_url: str | None = None   # Required for azure_openai, ollama, mcp, custom
    max_tokens: int = 2048
    temperature: float = 0.1
    enabled: bool = True
    # Optional per-provider rate limit (overrides tenant default)
    rate_limit_rpm: int | None = None

    def to_dict(self) -> dict:
        return {
            "provider": self.provider.value,
            "model": self.model,
            "encrypted_api_key": self.encrypted_api_key,
            "base_url": self.base_url,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "enabled": self.enabled,
            "rate_limit_rpm": self.rate_limit_rpm,
        }

    @classmethod
    def from_dict(cls, d: dict) -> ProviderConfig:
        return cls(
            provider=ProviderType(d["provider"]),
            model=d["model"],
            encrypted_api_key=d.get("encrypted_api_key", ""),
            base_url=d.get("base_url"),
            max_tokens=d.get("max_tokens", 2048),
            temperature=d.get("temperature", 0.1),
            enabled=d.get("enabled", True),
            rate_limit_rpm=d.get("rate_limit_rpm"),
        )


@dataclass
class UsageRecord:
    """Rolling usage counters reset monthly."""

    month: str          # "YYYY-MM"
    input_tokens: int = 0
    output_tokens: int = 0
    requests: int = 0
    cost_usd: float = 0.0

    def to_dict(self) -> dict:
        return {
            "month": self.month,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "requests": self.requests,
            "cost_usd": round(self.cost_usd, 6),
        }

    @classmethod
    def from_dict(cls, d: dict) -> UsageRecord:
        return cls(
            month=d["month"],
            input_tokens=d.get("input_tokens", 0),
            output_tokens=d.get("output_tokens", 0),
            requests=d.get("requests", 0),
            cost_usd=d.get("cost_usd", 0.0),
        )


@dataclass
class Tenant:
    """A client account on the AI Gateway platform."""

    id: str
    name: str
    # Hashed API key (SHA-256). Never store the plaintext.
    api_key_hash: str
    providers: list[ProviderConfig] = field(default_factory=list)
    # Allowed operation scopes, e.g. ["chat", "embeddings", "audit"]
    scopes: list[str] = field(default_factory=lambda: ["chat"])
    rate_limit_rpm: int = 60
    # Monthly token quota; None = unlimited
    quota_monthly_tokens: int | None = None
    policies: list[Policy] = field(default_factory=list)
    usage: list[UsageRecord] = field(default_factory=list)
    created_at: str = field(
        default_factory=lambda: datetime.now(tz=timezone.utc).isoformat()
    )
    is_active: bool = True

    # ── Helpers ─────────────────────────────────────────────────────────

    def get_active_provider(self, model: str | None = None) -> ProviderConfig | None:
        """Return the first enabled provider, optionally matching a model name."""
        for p in self.providers:
            if not p.enabled:
                continue
            if model is None or p.model == model:
                return p
        return self.providers[0] if self.providers else None

    def current_usage(self) -> UsageRecord:
        month = datetime.now(tz=timezone.utc).strftime("%Y-%m")
        for rec in self.usage:
            if rec.month == month:
                return rec
        rec = UsageRecord(month=month)
        self.usage.append(rec)
        return rec

    def within_quota(self) -> bool:
        if self.quota_monthly_tokens is None:
            return True
        u = self.current_usage()
        return (u.input_tokens + u.output_tokens) < self.quota_monthly_tokens

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "api_key_hash": self.api_key_hash,
            "providers": [p.to_dict() for p in self.providers],
            "scopes": self.scopes,
            "rate_limit_rpm": self.rate_limit_rpm,
            "quota_monthly_tokens": self.quota_monthly_tokens,
            "policies": [p.to_dict() for p in self.policies],
            "usage": [u.to_dict() for u in self.usage],
            "created_at": self.created_at,
            "is_active": self.is_active,
        }

    @classmethod
    def from_dict(cls, d: dict) -> Tenant:
        t = cls(
            id=d["id"],
            name=d["name"],
            api_key_hash=d["api_key_hash"],
            providers=[ProviderConfig.from_dict(p) for p in d.get("providers", [])],
            scopes=d.get("scopes", ["chat"]),
            rate_limit_rpm=d.get("rate_limit_rpm", 60),
            quota_monthly_tokens=d.get("quota_monthly_tokens"),
            policies=[Policy.from_dict(p) for p in d.get("policies", [])],
            usage=[UsageRecord.from_dict(u) for u in d.get("usage", [])],
            created_at=d.get("created_at", ""),
            is_active=d.get("is_active", True),
        )
        return t


@dataclass
class AuditLogEntry:
    """Immutable audit log entry for every gateway interaction."""

    id: str
    tenant_id: str
    action: AuditAction
    provider: str
    model: str
    timestamp: str
    # Request metadata (no plaintext content logged by default)
    request_hash: str           # SHA-256 of prompt — for dedup / replay detection
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    policy_triggered: str | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "action": self.action.value,
            "provider": self.provider,
            "model": self.model,
            "timestamp": self.timestamp,
            "request_hash": self.request_hash,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "latency_ms": round(self.latency_ms, 2),
            "cost_usd": round(self.cost_usd, 6),
            "policy_triggered": self.policy_triggered,
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, d: dict) -> AuditLogEntry:
        return cls(
            id=d["id"],
            tenant_id=d["tenant_id"],
            action=AuditAction(d["action"]),
            provider=d["provider"],
            model=d["model"],
            timestamp=d["timestamp"],
            request_hash=d["request_hash"],
            input_tokens=d.get("input_tokens", 0),
            output_tokens=d.get("output_tokens", 0),
            latency_ms=d.get("latency_ms", 0.0),
            cost_usd=d.get("cost_usd", 0.0),
            policy_triggered=d.get("policy_triggered"),
            error=d.get("error"),
        )


# ── Key Utilities ────────────────────────────────────────────────────────


def generate_api_key() -> str:
    """Generate a cryptographically secure API key (dp_<32-char-hex>)."""
    return f"dp_{secrets.token_hex(32)}"


def hash_api_key(key: str) -> str:
    """Return the SHA-256 hex digest of an API key for safe storage."""
    return hashlib.sha256(key.encode()).hexdigest()


def hash_content(content: str) -> str:
    """Return a short SHA-256 prefix for audit log dedup (first 16 chars)."""
    return hashlib.sha256(content.encode()).hexdigest()[:16]
