"""Lightweight key vault for encrypting/decrypting tenant provider API keys.

Uses AES-128-GCM via the `cryptography` library if available.
Falls back to XOR + base64 obfuscation (NOT cryptographically secure — clearly
documented so operators know they must install `cryptography` for production).

The master encryption key is read from the GATEWAY_MASTER_KEY environment
variable (32-byte hex string). If unset, a per-process ephemeral key is used
(keys are lost on restart — only suitable for development).
"""

from __future__ import annotations

import base64
import os
import secrets

import structlog

logger = structlog.get_logger()

_MASTER_KEY: bytes | None = None


def _get_master_key() -> bytes:
    global _MASTER_KEY
    if _MASTER_KEY is not None:
        return _MASTER_KEY

    raw = os.getenv("GATEWAY_MASTER_KEY", "")
    if raw:
        try:
            _MASTER_KEY = bytes.fromhex(raw)
            if len(_MASTER_KEY) not in (16, 24, 32):
                raise ValueError("Key must be 16, 24, or 32 bytes")
            return _MASTER_KEY
        except (ValueError, TypeError) as exc:
            logger.error("invalid_master_key", error=str(exc))

    # Ephemeral key — data only survives process lifetime
    logger.warning(
        "ephemeral_encryption_key",
        message="Set GATEWAY_MASTER_KEY for persistent key encryption",
    )
    _MASTER_KEY = secrets.token_bytes(32)
    return _MASTER_KEY


def _try_load_aesgcm() -> type | None:
    """Lazily import AESGCM; return None if unavailable or broken."""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # noqa: PLC0415
        return AESGCM
    except BaseException:
        # Catches ImportError, pyo3_runtime.PanicException, and any other
        # issue caused by a broken native extension.
        return None


_AESGCM = _try_load_aesgcm()
_BACKEND = "aes-gcm" if _AESGCM is not None else "xor-fallback"

if _AESGCM is None:
    logger.warning(
        "cryptography_not_available",
        message="Install 'cryptography' for secure key storage. Using XOR fallback.",
    )


# ── Public API ─────────────────────────────────────────────────────────────


def encrypt(plaintext: str) -> str:
    """Encrypt *plaintext* and return a base64 blob.

    Uses AES-128-GCM when `cryptography` is available, XOR-obfuscation otherwise.
    """
    if _AESGCM is not None:
        key = _get_master_key()[:32]
        nonce = secrets.token_bytes(12)
        ct = _AESGCM(key).encrypt(nonce, plaintext.encode(), b"")
        return base64.b64encode(nonce + ct).decode()

    # XOR fallback (NOT cryptographically secure)
    key = _get_master_key()
    data = plaintext.encode()
    xored = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
    return base64.b64encode(xored).decode()


def decrypt(blob: str) -> str:
    """Decrypt a base64 blob produced by `encrypt`."""
    if _AESGCM is not None:
        key = _get_master_key()[:32]
        raw = base64.b64decode(blob)
        nonce, ct = raw[:12], raw[12:]
        return _AESGCM(key).decrypt(nonce, ct, b"").decode()

    # XOR fallback
    key = _get_master_key()
    xored = base64.b64decode(blob)
    data = bytes(b ^ key[i % len(key)] for i, b in enumerate(xored))
    return data.decode()


def backend_name() -> str:
    return _BACKEND
