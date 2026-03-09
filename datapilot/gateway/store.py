"""File-backed tenant and audit-log stores.

Both stores use atomic-rename writes and exclusive file locks so concurrent
audit runs cannot corrupt data.  The TenantStore is the source of truth for
all tenant, provider, and policy configuration.
"""

from __future__ import annotations

import json
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

from datapilot.gateway.models import AuditLogEntry, Tenant

logger = structlog.get_logger()

_LOCK = threading.Lock()   # process-level guard for in-memory consistency


def _atomic_write(path: Path, data: Any) -> None:
    """Write JSON to *path* atomically via a temp file + rename."""
    tmp = path.with_suffix(".tmp")
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(tmp, "w", encoding="utf-8") as f:
        if sys.platform != "win32":
            import fcntl
            fcntl.flock(f, fcntl.LOCK_EX)
        try:
            json.dump(data, f, indent=2)
        finally:
            if sys.platform != "win32":
                import fcntl  # noqa: F811
                fcntl.flock(f, fcntl.LOCK_UN)
    tmp.replace(path)


class TenantStore:
    """Persist and retrieve Tenant objects from a single JSON file."""

    def __init__(self, store_path: str | Path | None = None) -> None:
        self.path = Path(store_path or "datapilot_tenants.json")
        self._ensure()

    def _ensure(self) -> None:
        if not self.path.exists():
            _atomic_write(self.path, {})

    def _load_raw(self) -> dict[str, dict]:
        if not self.path.exists():
            return {}
        with open(self.path, encoding="utf-8") as f:
            return json.load(f)

    # ── CRUD ──────────────────────────────────────────────────────────

    def save(self, tenant: Tenant) -> None:
        with _LOCK:
            raw = self._load_raw()
            raw[tenant.id] = tenant.to_dict()
            _atomic_write(self.path, raw)
        logger.info("tenant_saved", tenant_id=tenant.id)

    def get(self, tenant_id: str) -> Tenant | None:
        raw = self._load_raw()
        d = raw.get(tenant_id)
        return Tenant.from_dict(d) if d else None

    def get_by_key_hash(self, api_key_hash: str) -> Tenant | None:
        for d in self._load_raw().values():
            if d.get("api_key_hash") == api_key_hash:
                return Tenant.from_dict(d)
        return None

    def list_all(self) -> list[Tenant]:
        return [Tenant.from_dict(d) for d in self._load_raw().values()]

    def delete(self, tenant_id: str) -> bool:
        with _LOCK:
            raw = self._load_raw()
            if tenant_id not in raw:
                return False
            del raw[tenant_id]
            _atomic_write(self.path, raw)
        return True

    def update_usage(self, tenant_id: str, input_tokens: int, output_tokens: int, cost_usd: float) -> None:
        """Atomically increment usage counters for a tenant."""
        with _LOCK:
            raw = self._load_raw()
            if tenant_id not in raw:
                return
            tenant = Tenant.from_dict(raw[tenant_id])
            u = tenant.current_usage()
            u.input_tokens += input_tokens
            u.output_tokens += output_tokens
            u.requests += 1
            u.cost_usd += cost_usd
            raw[tenant_id] = tenant.to_dict()
            _atomic_write(self.path, raw)


class AuditLogStore:
    """Append-only store for gateway audit log entries (one file per month)."""

    def __init__(self, log_dir: str | Path | None = None) -> None:
        self.log_dir = Path(log_dir or "datapilot_gateway_logs")
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def _month_file(self) -> Path:
        month = datetime.now(tz=timezone.utc).strftime("%Y-%m")
        return self.log_dir / f"audit_{month}.jsonl"

    def append(self, entry: AuditLogEntry) -> None:
        """Append a single entry to the current month's log file (JSONL)."""
        log_file = self._month_file()
        with _LOCK:
            with open(log_file, "a", encoding="utf-8") as f:
                if sys.platform != "win32":
                    import fcntl
                    fcntl.flock(f, fcntl.LOCK_EX)
                try:
                    f.write(json.dumps(entry.to_dict()) + "\n")
                finally:
                    if sys.platform != "win32":
                        import fcntl  # noqa: F811
                        fcntl.flock(f, fcntl.LOCK_UN)

    def query(
        self,
        tenant_id: str | None = None,
        action: str | None = None,
        month: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        """Read and filter log entries from one month's file."""
        month = month or datetime.now(tz=timezone.utc).strftime("%Y-%m")
        log_file = self.log_dir / f"audit_{month}.jsonl"
        if not log_file.exists():
            return []

        results: list[dict] = []
        with open(log_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if tenant_id and entry.get("tenant_id") != tenant_id:
                    continue
                if action and entry.get("action") != action:
                    continue
                results.append(entry)
                if len(results) >= limit:
                    break
        return results
