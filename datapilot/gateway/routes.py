"""Flask Blueprint for the AI Gateway API.

Two sub-groups of endpoints:
  /gateway/v1/...        — client-facing (authenticated via tenant API key)
  /gateway/admin/...     — management plane (authenticated via GATEWAY_ADMIN_KEY)

Client endpoints mirror the OpenAI API shape so clients can point existing
SDKs at this gateway with minimal changes.

Admin endpoints cover full tenant lifecycle:
  POST   /gateway/admin/tenants               create tenant + generate API key
  GET    /gateway/admin/tenants               list all tenants
  GET    /gateway/admin/tenants/<id>          get tenant detail
  PATCH  /gateway/admin/tenants/<id>          update name / scopes / rate_limit / quota
  DELETE /gateway/admin/tenants/<id>          deactivate tenant
  POST   /gateway/admin/tenants/<id>/providers  add AI provider
  DELETE /gateway/admin/tenants/<id>/providers/<idx>  remove provider
  POST   /gateway/admin/tenants/<id>/policies  add guardrail policy
  DELETE /gateway/admin/tenants/<id>/policies/<idx>  remove policy
  GET    /gateway/admin/tenants/<id>/usage    usage stats
  GET    /gateway/admin/tenants/<id>/logs     audit log entries
  GET    /gateway/admin/health                gateway health + config summary
"""

from __future__ import annotations

import os
import uuid
from typing import Any

from flask import Blueprint, current_app, jsonify, request

import structlog

from datapilot.gateway import keyvault
from datapilot.gateway.auth import AuthError, authenticate_admin
from datapilot.gateway.guardrails import GuardrailViolation
from datapilot.gateway.models import (
    Policy,
    PolicyType,
    ProviderConfig,
    ProviderType,
    Tenant,
    generate_api_key,
    hash_api_key,
)
from datapilot.gateway.proxy import Gateway, GatewayError
from datapilot.gateway.quota import QuotaExceeded, RateLimitExceeded
from datapilot.gateway.store import AuditLogStore, TenantStore

logger = structlog.get_logger()

gateway_bp = Blueprint("gateway", __name__, url_prefix="/gateway")


# ── Helpers ───────────────────────────────────────────────────────────────


def _get_stores() -> tuple[TenantStore, AuditLogStore]:
    tenant_path = current_app.config.get("GATEWAY_TENANT_STORE")
    log_dir = current_app.config.get("GATEWAY_LOG_DIR")
    return TenantStore(tenant_path), AuditLogStore(log_dir)


def _get_gateway() -> Gateway:
    ts, als = _get_stores()
    return Gateway(ts, als)


def _err(msg: str, status: int) -> Any:
    return jsonify({"error": msg}), status


# ── Client endpoints ──────────────────────────────────────────────────────


@gateway_bp.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    """OpenAI-compatible chat completion proxy."""
    body = request.get_json(silent=True) or {}
    messages = body.get("messages", [])
    model = body.get("model")
    max_tokens = body.get("max_tokens")

    if not messages:
        return _err("'messages' field is required", 400)

    gw = _get_gateway()
    try:
        result = gw.chat(
            auth_header=request.headers.get("Authorization"),
            messages=messages,
            model=model,
            max_tokens=max_tokens,
        )
        return jsonify(result), 200
    except AuthError as exc:
        return _err(str(exc), exc.status)
    except RateLimitExceeded as exc:
        return _err(str(exc), 429)
    except QuotaExceeded as exc:
        return _err(str(exc), 429)
    except GuardrailViolation as exc:
        return _err(str(exc), 422)
    except GatewayError as exc:
        return _err(str(exc), exc.status)


@gateway_bp.route("/v1/models", methods=["GET"])
def list_models():
    """Return the models available to the authenticated tenant."""
    ts, _ = _get_stores()
    try:
        from datapilot.gateway.auth import authenticate
        tenant = authenticate(ts, request.headers.get("Authorization"))
    except AuthError as exc:
        return _err(str(exc), exc.status)

    models = [
        {
            "id": p.model,
            "object": "model",
            "provider": p.provider.value,
            "enabled": p.enabled,
        }
        for p in tenant.providers
    ]
    return jsonify({"object": "list", "data": models})


# ── Admin endpoints ───────────────────────────────────────────────────────


def _require_admin():
    """Raise AuthError if the request is not from a valid admin."""
    authenticate_admin(request.headers.get("Authorization"))


@gateway_bp.route("/admin/health", methods=["GET"])
def admin_health():
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenants = ts.list_all()
    return jsonify(
        {
            "status": "healthy",
            "encryption_backend": keyvault.backend_name(),
            "tenant_count": len(tenants),
            "active_tenants": sum(1 for t in tenants if t.is_active),
        }
    )


@gateway_bp.route("/admin/tenants", methods=["POST"])
def create_tenant():
    """Create a new tenant and return the plaintext API key (shown once)."""
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    body = request.get_json(silent=True) or {}
    name = body.get("name", "").strip()
    if not name:
        return _err("'name' is required", 400)

    api_key = generate_api_key()
    tenant = Tenant(
        id=str(uuid.uuid4())[:8],
        name=name,
        api_key_hash=hash_api_key(api_key),
        scopes=body.get("scopes", ["chat"]),
        rate_limit_rpm=int(body.get("rate_limit_rpm", 60)),
        quota_monthly_tokens=body.get("quota_monthly_tokens"),
    )

    ts, _ = _get_stores()
    ts.save(tenant)
    logger.info("tenant_created", tenant_id=tenant.id, name=name)

    resp = tenant.to_dict()
    resp.pop("api_key_hash")  # never expose the hash
    resp["api_key"] = api_key  # plaintext — shown only at creation
    resp["warning"] = "Save this API key — it will not be shown again."
    return jsonify(resp), 201


@gateway_bp.route("/admin/tenants", methods=["GET"])
def list_tenants():
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenants = ts.list_all()
    result = []
    for t in tenants:
        d = t.to_dict()
        d.pop("api_key_hash")
        result.append(d)
    return jsonify({"tenants": result, "total": len(result)})


@gateway_bp.route("/admin/tenants/<tenant_id>", methods=["GET"])
def get_tenant(tenant_id: str):
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenant = ts.get(tenant_id)
    if not tenant:
        return _err("Tenant not found", 404)

    d = tenant.to_dict()
    d.pop("api_key_hash")
    # Mask encrypted keys from output
    for p in d.get("providers", []):
        if p.get("encrypted_api_key"):
            p["encrypted_api_key"] = "***"
    return jsonify(d)


@gateway_bp.route("/admin/tenants/<tenant_id>", methods=["PATCH"])
def update_tenant(tenant_id: str):
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenant = ts.get(tenant_id)
    if not tenant:
        return _err("Tenant not found", 404)

    body = request.get_json(silent=True) or {}
    if "name" in body:
        tenant.name = str(body["name"])
    if "scopes" in body:
        tenant.scopes = list(body["scopes"])
    if "rate_limit_rpm" in body:
        tenant.rate_limit_rpm = int(body["rate_limit_rpm"])
    if "quota_monthly_tokens" in body:
        tenant.quota_monthly_tokens = body["quota_monthly_tokens"]
    if "is_active" in body:
        tenant.is_active = bool(body["is_active"])

    ts.save(tenant)
    return jsonify({"updated": True, "tenant_id": tenant_id})


@gateway_bp.route("/admin/tenants/<tenant_id>", methods=["DELETE"])
def deactivate_tenant(tenant_id: str):
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenant = ts.get(tenant_id)
    if not tenant:
        return _err("Tenant not found", 404)

    tenant.is_active = False
    ts.save(tenant)
    logger.info("tenant_deactivated", tenant_id=tenant_id)
    return jsonify({"deactivated": True, "tenant_id": tenant_id})


@gateway_bp.route("/admin/tenants/<tenant_id>/providers", methods=["POST"])
def add_provider(tenant_id: str):
    """Add or replace an AI provider for a tenant."""
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenant = ts.get(tenant_id)
    if not tenant:
        return _err("Tenant not found", 404)

    body = request.get_json(silent=True) or {}
    try:
        provider_type = ProviderType(body.get("provider", ""))
    except ValueError:
        valid = [p.value for p in ProviderType]
        return _err(f"Invalid provider. Choose from: {valid}", 400)

    model = body.get("model", "").strip()
    if not model:
        return _err("'model' is required", 400)

    # Encrypt the client's API key before storing
    raw_key = body.get("api_key", "")
    encrypted = keyvault.encrypt(raw_key) if raw_key else ""

    pc = ProviderConfig(
        provider=provider_type,
        model=model,
        encrypted_api_key=encrypted,
        base_url=body.get("base_url"),
        max_tokens=int(body.get("max_tokens", 2048)),
        temperature=float(body.get("temperature", 0.1)),
        rate_limit_rpm=body.get("rate_limit_rpm"),
    )
    tenant.providers.append(pc)
    ts.save(tenant)
    logger.info("provider_added", tenant_id=tenant_id, provider=provider_type.value, model=model)
    return jsonify({"added": True, "provider": provider_type.value, "model": model}), 201


@gateway_bp.route("/admin/tenants/<tenant_id>/providers/<int:index>", methods=["DELETE"])
def remove_provider(tenant_id: str, index: int):
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenant = ts.get(tenant_id)
    if not tenant:
        return _err("Tenant not found", 404)
    if index < 0 or index >= len(tenant.providers):
        return _err("Provider index out of range", 404)

    removed = tenant.providers.pop(index)
    ts.save(tenant)
    return jsonify({"removed": True, "provider": removed.provider.value, "model": removed.model})


@gateway_bp.route("/admin/tenants/<tenant_id>/policies", methods=["POST"])
def add_policy(tenant_id: str):
    """Add a guardrail policy to a tenant."""
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenant = ts.get(tenant_id)
    if not tenant:
        return _err("Tenant not found", 404)

    body = request.get_json(silent=True) or {}
    try:
        policy_type = PolicyType(body.get("type", ""))
    except ValueError:
        valid = [p.value for p in PolicyType]
        return _err(f"Invalid policy type. Choose from: {valid}", 400)

    name = body.get("name", policy_type.value).strip()
    policy = Policy(
        name=name,
        type=policy_type,
        config=body.get("config", {}),
        enabled=bool(body.get("enabled", True)),
    )
    tenant.policies.append(policy)
    ts.save(tenant)
    logger.info("policy_added", tenant_id=tenant_id, policy=name, type=policy_type.value)
    return jsonify({"added": True, "policy": name, "type": policy_type.value}), 201


@gateway_bp.route("/admin/tenants/<tenant_id>/policies/<int:index>", methods=["DELETE"])
def remove_policy(tenant_id: str, index: int):
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenant = ts.get(tenant_id)
    if not tenant:
        return _err("Tenant not found", 404)
    if index < 0 or index >= len(tenant.policies):
        return _err("Policy index out of range", 404)

    removed = tenant.policies.pop(index)
    ts.save(tenant)
    return jsonify({"removed": True, "policy": removed.name})


@gateway_bp.route("/admin/tenants/<tenant_id>/usage", methods=["GET"])
def tenant_usage(tenant_id: str):
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, _ = _get_stores()
    tenant = ts.get(tenant_id)
    if not tenant:
        return _err("Tenant not found", 404)

    return jsonify(
        {
            "tenant_id": tenant_id,
            "quota_monthly_tokens": tenant.quota_monthly_tokens,
            "usage": [u.to_dict() for u in tenant.usage],
            "current_month": tenant.current_usage().to_dict(),
        }
    )


@gateway_bp.route("/admin/tenants/<tenant_id>/logs", methods=["GET"])
def tenant_logs(tenant_id: str):
    try:
        _require_admin()
    except AuthError as exc:
        return _err(str(exc), exc.status)

    ts, als = _get_stores()
    tenant = ts.get(tenant_id)
    if not tenant:
        return _err("Tenant not found", 404)

    month = request.args.get("month")
    action = request.args.get("action")
    limit = int(request.args.get("limit", 100))

    entries = als.query(tenant_id=tenant_id, action=action, month=month, limit=limit)
    return jsonify({"tenant_id": tenant_id, "entries": entries, "total": len(entries)})
