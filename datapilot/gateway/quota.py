"""Rate limiting and quota enforcement for the AI Gateway.

Two controls:
  1. Rate limiter  — sliding-window RPM counter (in-memory, per tenant)
  2. Quota checker — monthly token budget (persisted in TenantStore)

Both are checked before forwarding to the AI provider.
"""

from __future__ import annotations

import threading
import time
from collections import deque

import structlog

logger = structlog.get_logger()


class RateLimitExceeded(Exception):
    """Raised when a tenant exceeds their requests-per-minute limit."""

    def __init__(self, tenant_id: str, rpm: int) -> None:
        super().__init__(f"Rate limit exceeded: {rpm} req/min for tenant {tenant_id}")
        self.tenant_id = tenant_id
        self.rpm = rpm


class QuotaExceeded(Exception):
    """Raised when a tenant exceeds their monthly token quota."""

    def __init__(self, tenant_id: str, quota: int) -> None:
        super().__init__(f"Monthly token quota ({quota:,}) exceeded for tenant {tenant_id}")
        self.tenant_id = tenant_id
        self.quota = quota


class RateLimiter:
    """Thread-safe sliding-window rate limiter.

    Maintains a per-tenant deque of request timestamps.
    Requests older than 60 seconds are evicted on each check.
    """

    def __init__(self) -> None:
        self._windows: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, tenant_id: str, limit_rpm: int) -> None:
        """Raise RateLimitExceeded if the tenant is over their RPM limit.

        Otherwise records the current request timestamp.
        """
        now = time.monotonic()
        window_start = now - 60.0

        with self._lock:
            if tenant_id not in self._windows:
                self._windows[tenant_id] = deque()
            window = self._windows[tenant_id]

            # Evict old timestamps
            while window and window[0] < window_start:
                window.popleft()

            if len(window) >= limit_rpm:
                logger.warning(
                    "rate_limit_exceeded",
                    tenant_id=tenant_id,
                    rpm=limit_rpm,
                    current=len(window),
                )
                raise RateLimitExceeded(tenant_id, limit_rpm)

            window.append(now)

    def reset(self, tenant_id: str) -> None:
        """Clear the rate-limit window for a tenant (e.g. after quota refill)."""
        with self._lock:
            self._windows.pop(tenant_id, None)


def check_quota(tenant_id: str, quota: int | None, used_tokens: int) -> None:
    """Raise QuotaExceeded if *used_tokens* is at or above the tenant's *quota*.

    *quota* of None means unlimited.
    """
    if quota is None:
        return
    if used_tokens >= quota:
        logger.warning(
            "quota_exceeded",
            tenant_id=tenant_id,
            quota=quota,
            used=used_tokens,
        )
        raise QuotaExceeded(tenant_id, quota)


# Module-level shared rate limiter — one instance for the entire gateway process
_global_rate_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    return _global_rate_limiter
