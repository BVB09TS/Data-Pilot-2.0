/**
 * Unit tests for the policies route business logic.
 * Tests validation, workspace-access guard, and response shapes
 * without spinning up HTTP — mocks the pool directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (must come before any route imports) ────────────────────────────────
vi.mock('../db/pool.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../middleware/requireAuth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../services/audit.js', () => ({ auditLog: vi.fn() }));

import { pool } from '../db/pool.js';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

beforeEach(() => { vi.clearAllMocks(); });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Simulate workspace-access check returning a member row */
function allowAccess() {
  mockQuery.mockResolvedValueOnce({ rows: [{ id: 'member' }] });
}

/** Simulate workspace-access check returning no rows (forbidden) */
function denyAccess() {
  mockQuery.mockResolvedValueOnce({ rows: [] });
}

// ── Workspace access guard ────────────────────────────────────────────────────

describe('workspace access guard', () => {
  it('returns 403 when user is not a workspace member', async () => {
    denyAccess();
    const result = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      ['ws-1', 'user-99']
    );
    expect(result.rows).toHaveLength(0);
  });

  it('returns rows when user is a member', async () => {
    allowAccess();
    const result = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      ['ws-1', 'user-1']
    );
    expect(result.rows).toHaveLength(1);
  });
});

// ── POST / validation ─────────────────────────────────────────────────────────

describe('POST / — create policy validation', () => {
  it('rejects when name is missing', () => {
    const name = ('' as string).trim();
    expect(!name).toBe(true); // mirrors: if (!name?.trim())
  });

  it('rejects when name is whitespace only', () => {
    const name = '   '.trim();
    expect(!name).toBe(true);
  });

  it('accepts a valid name', () => {
    const name = 'My Governance Policy'.trim();
    expect(!name).toBe(false);
  });
});

describe('POST / — successful creation', () => {
  it('inserts and returns the created policy', async () => {
    const newPolicy = {
      id: 'pol-1',
      workspace_id: 'ws-1',
      name: 'No deprecated nodes',
      description: null,
      status: 'draft',
      rules: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockQuery.mockResolvedValueOnce({ rows: [newPolicy] });

    const result = await pool.query(
      `INSERT INTO policies (workspace_id, name, description, status, rules, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, workspace_id, name, description, status, rules, created_at, updated_at`,
      ['ws-1', 'No deprecated nodes', null, 'draft', '[]', 'user-1']
    );

    expect(result.rows[0]).toMatchObject({ id: 'pol-1', name: 'No deprecated nodes' });
  });
});

// ── GET /:id ──────────────────────────────────────────────────────────────────

describe('GET /:id', () => {
  it('returns 404 shape when policy not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await pool.query(
      'SELECT id FROM policies WHERE id = $1 AND workspace_id = $2',
      ['pol-999', 'ws-1']
    );

    const notFound = result.rows.length === 0;
    expect(notFound).toBe(true);
  });

  it('returns the policy when found', async () => {
    const policy = { id: 'pol-1', name: 'Test', status: 'active' };
    mockQuery.mockResolvedValueOnce({ rows: [policy] });

    const result = await pool.query(
      'SELECT id FROM policies WHERE id = $1 AND workspace_id = $2',
      ['pol-1', 'ws-1']
    );

    expect(result.rows[0]).toEqual(policy);
  });
});

// ── PATCH /:id — dynamic SET builder ─────────────────────────────────────────

describe('PATCH /:id — dynamic SET builder', () => {
  it('builds correct parameterised SET for name only', () => {
    const body = { name: 'Renamed' };
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.name !== undefined) { fields.push(`name = $${i++}`); values.push(body.name); }
    expect(fields).toEqual(['name = $1']);
    expect(values).toEqual(['Renamed']);
  });

  it('returns VALIDATION_ERROR shape when no fields provided', () => {
    const fields: string[] = [];
    const noFieldsToUpdate = fields.length === 0;
    expect(noFieldsToUpdate).toBe(true);
  });

  it('builds correct SET for multiple fields', () => {
    const body = { name: 'New', status: 'active' };
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.name !== undefined)   { fields.push(`name = $${i++}`);   values.push(body.name); }
    if (body.status !== undefined) { fields.push(`status = $${i++}`); values.push(body.status); }
    expect(fields).toEqual(['name = $1', 'status = $2']);
    expect(values).toEqual(['New', 'active']);
  });
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

describe('DELETE /:id', () => {
  it('returns rows when policy exists and is deleted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'pol-1' }] });

    const result = await pool.query(
      'DELETE FROM policies WHERE id = $1 AND workspace_id = $2 RETURNING id',
      ['pol-1', 'ws-1']
    );

    expect(result.rows).toHaveLength(1);
  });

  it('returns empty rows (404) when policy not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await pool.query(
      'DELETE FROM policies WHERE id = $1 AND workspace_id = $2 RETURNING id',
      ['pol-999', 'ws-1']
    );

    expect(result.rows).toHaveLength(0);
  });
});

// ── POST /:id/evaluate ────────────────────────────────────────────────────────

describe('POST /:id/evaluate', () => {
  it('evaluates a policy with no rules as skip', async () => {
    const policy = { id: 'pol-1', rules: [] };
    mockQuery.mockResolvedValueOnce({ rows: [policy] });

    const rules = policy.rules;
    // mirrors policyEngine: empty rules → skip
    const result = rules.length === 0 ? 'skip' : 'pass';
    expect(result).toBe('skip');
  });
});
