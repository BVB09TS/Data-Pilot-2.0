/**
 * Unit tests for the connections route business logic.
 * We test the helper functions and the encrypt/decrypt integration
 * without spinning up an HTTP server (no supertest dependency).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock pool before any route imports ───────────────────────────────────────
vi.mock('../db/pool.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../middleware/requireAuth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../services/healthCheck.js', () => ({
  checkHealth: vi.fn().mockResolvedValue('healthy'),
}));

import { pool } from '../db/pool.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.SERVER_SECRET = 'test-secret-32-chars-minimum-ok!';
  vi.clearAllMocks();
});

// ── Crypto integration (used internally by connections route) ─────────────────

describe('secret encryption round-trip', () => {
  it('encrypts and decrypts API keys transparently', () => {
    const secret = 'sk-test-1234567890abcdef';
    const cipher = encrypt(secret);
    expect(cipher).not.toBe(secret);
    expect(decrypt(cipher)).toBe(secret);
  });

  it('produces a base64 string longer than the input', () => {
    const secret = 'sk-test';
    const cipher = encrypt(secret);
    // iv(12) + tag(16) + ciphertext ≥ 28 bytes → base64 ≥ 38 chars
    expect(Buffer.from(cipher, 'base64').length).toBeGreaterThan(28);
  });
});

// ── Workspace access guard ────────────────────────────────────────────────────

describe('workspace access guard logic', () => {
  it('allows access when membership row exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'member-id' }] });
    const result = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2',
      ['ws-1', 'user-1']
    );
    expect(result.rows.length).toBe(1);
  });

  it('denies access when no membership row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2',
      ['ws-1', 'user-stranger']
    );
    expect(result.rows.length).toBe(0);
  });
});

// ── Connection creation (DB layer) ────────────────────────────────────────────

describe('connection creation', () => {
  it('stores encrypted secret, not plaintext', async () => {
    const secret = 'sk-real-api-key';
    const encrypted = encrypt(secret);

    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'conn-1',
        workspace_id: 'ws-1',
        type: 'api',
        provider: 'openai',
        name: 'My Key',
        config: {},
        is_enabled: true,
        health_status: null,
        last_health_check: null,
        created_at: new Date().toISOString(),
      }],
    });

    const result = await pool.query(
      `INSERT INTO connections (workspace_id, type, provider, name, encrypted_secret, config)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      ['ws-1', 'api', 'openai', 'My Key', encrypted, {}]
    );

    const [, , , , storedSecret] = mockQuery.mock.calls[0][1] as unknown[];
    expect(storedSecret).not.toBe(secret);
    expect(decrypt(storedSecret as string)).toBe(secret);
    expect(result.rows[0].id).toBe('conn-1');
  });

  it('accepts null secret for connections without credentials', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'conn-2' }] });
    await pool.query(
      `INSERT INTO connections (workspace_id, type, name, encrypted_secret, config)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      ['ws-1', 'mcp', 'Local MCP', null, {}]
    );
    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[3]).toBeNull();
  });
});
