"""Authentication and authorization for the AI Gateway.

Every inbound request must carry a Bearer token in the Authorization header.
The token is the plaintext API key generated at tenant creation time.
We hash it on arrival and look up the tenant — the plaintext is never stored.

Authorization checks:
- Tenant must be active
- The requested scope must be in the tenant's allowed scopes
- The requested model (if any) must not be blocked by a BLOCK_MODELS policy
"""

from __future__ import annotations

from typing import Any

import structlog

from datapilot.gateway.models import PolicyType, Tenant, hash_api_key
from datapilot.gateway.store import TenantStore

logger = structlog.get_logger()


class AuthError(Exception):
    """Raised when authentication or authorization fails."""

    def __init__(self, message: str, status: int = 401) -> None:
        super().__init__(message)
        self.status = status


def extract_bearer_token(auth_header: str | None) -> str:
    """Extract the Bearer token from an Authorization header.

    Raises AuthError if the header is missing or malformed.
    """
    if not auth_header:
        raise AuthError("Missing Authorization header", status=401)
    parts = auth_header.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthError("Authorization header must be 'Bearer <token>'", status=401)
    return parts[1]


def authenticate(store: TenantStore, auth_header: str | None) -> Tenant:
    """Authenticate a request and return the resolved Tenant.

    Raises AuthError on any failure.  Never leaks internal detail to callers.
    """
    token = extract_bearer_token(auth_header)
    key_hash = hash_api_key(token)
    tenant = store.get_by_key_hash(key_hash)

    if tenant is None:
        logger.warning("auth_failed_unknown_key", key_prefix=token[:8] + "...")
        raise AuthError("Invalid API key", status=401)

    if not tenant.is_active:
        logger.warning("auth_failed_inactive_tenant", tenant_id=tenant.id)
        raise AuthError("Account is inactive", status=403)

    return tenant


def authorize(tenant: Tenant, scope: str, model: str | None = None) -> None:
    """Check that *tenant* is allowed to perform *scope* with *model*.

    Raises AuthError with HTTP 403 on any policy violation.
    """
    if scope not in tenant.scopes:
        logger.warning(
            "authz_scope_denied",
            tenant_id=tenant.id,
            scope=scope,
            allowed=tenant.scopes,
        )
        raise AuthError(f"Scope '{scope}' not permitted for this account", status=403)

    if model is None:
        return

    for policy in tenant.policies:
        if not policy.enabled:
            continue

        if policy.type == PolicyType.ALLOW_MODELS:
            allowed: list[str] = policy.config.get("models", [])
            if allowed and model not in allowed:
                raise AuthError(
                    f"Model '{model}' is not in your allowed model list", status=403
                )

        if policy.type == PolicyType.BLOCK_MODELS:
            blocked: list[str] = policy.config.get("models", [])
            if model in blocked:
                raise AuthError(f"Model '{model}' is blocked by policy", status=403)


def get_admin_key(expected_key_env: str = "GATEWAY_ADMIN_KEY") -> str | None:
    """Return the admin API key from the environment (for admin endpoints)."""
    import os
    return os.getenv(expected_key_env)


def authenticate_admin(auth_header: str | None) -> None:
    """Verify the admin API key for management endpoints.

    Raises AuthError if invalid.
    """
    import os
    token = extract_bearer_token(auth_header)
    admin_key = os.getenv("GATEWAY_ADMIN_KEY", "")
    if not admin_key:
        raise AuthError("Admin key not configured on this server", status=503)
    # Constant-time comparison to prevent timing attacks
    import hmac
    if not hmac.compare_digest(token, admin_key):
        raise AuthError("Invalid admin key", status=403)
