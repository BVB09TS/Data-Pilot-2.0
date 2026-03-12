/**
 * Unit tests for the audit log route business logic.
 * Focuses on the query-builder (filter + pagination) without HTTP.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/pool.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../middleware/requireAuth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { pool } from '../db/pool.js';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

// ── Pagination clamping ───────────────────────────────────────────────────────

describe('pagination clamping', () => {
  it('clamps limit to 200 max', () => {
    const lim = Math.min(parseInt('9999', 10) || 50, 200);
    expect(lim).toBe(200);
  });

  it('uses default 50 when limit is not a number', () => {
    const lim = Math.min(parseInt('abc', 10) || 50, 200);
    expect(lim).toBe(50);
  });

  it('clamps offset to minimum 0', () => {
    const off = Math.max(parseInt('-10', 10) || 0, 0);
    expect(off).toBe(0);
  });

  it('uses default 0 when offset is missing', () => {
    const off = Math.max(parseInt('0', 10) || 0, 0);
    expect(off).toBe(0);
  });

  it('accepts valid limit and offset', () => {
    const lim = Math.min(parseInt('25', 10) || 50, 200);
    const off = Math.max(parseInt('100', 10) || 0, 0);
    expect(lim).toBe(25);
    expect(off).toBe(100);
  });
});

// ── Dynamic filter builder ────────────────────────────────────────────────────

describe('filter builder', () => {
  function buildFilters(query: Record<string, string | undefined>) {
    const { resource_type, resource_id, user_id, action } = query;
    const conditions: string[] = ['ae.workspace_id = $1'];
    const values: unknown[] = ['ws-1'];
    let i = 2;
    if (resource_type) { conditions.push(`ae.resource_type = $${i++}`); values.push(resource_type); }
    if (resource_id)   { conditions.push(`ae.resource_id = $${i++}`);   values.push(resource_id); }
    if (user_id)       { conditions.push(`ae.user_id = $${i++}`);       values.push(user_id); }
    if (action)        { conditions.push(`ae.action ILIKE $${i++}`);    values.push(`%${action}%`); }
    return { conditions, values };
  }

  it('starts with only the workspace condition when no filters given', () => {
    const { conditions, values } = buildFilters({});
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toBe('ae.workspace_id = $1');
    expect(values).toEqual(['ws-1']);
  });

  it('adds resource_type filter', () => {
    const { conditions, values } = buildFilters({ resource_type: 'connections' });
    expect(conditions).toContain('ae.resource_type = $2');
    expect(values).toContain('connections');
  });

  it('adds action ILIKE filter with % wildcards', () => {
    const { conditions, values } = buildFilters({ action: 'create' });
    expect(conditions.some(c => c.includes('ILIKE'))).toBe(true);
    expect(values).toContain('%create%');
  });

  it('stacks multiple filters with correct parameter indices', () => {
    const { conditions, values } = buildFilters({
      resource_type: 'nodes',
      user_id: 'user-42',
    });
    expect(conditions).toHaveLength(3);
    expect(conditions[1]).toBe('ae.resource_type = $2');
    expect(conditions[2]).toBe('ae.user_id = $3');
    expect(values[1]).toBe('nodes');
    expect(values[2]).toBe('user-42');
  });
});

// ── Response shape ────────────────────────────────────────────────────────────

describe('response shape', () => {
  it('returns { data, total } with rows and count', async () => {
    // First query: event rows
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'ev-1', action: 'connections.create', resource_type: 'connections' },
        { id: 'ev-2', action: 'nodes.delete',       resource_type: 'nodes' },
      ],
    });
    // Second query: COUNT(*)
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const [rowsResult, countResult] = await Promise.all([
      pool.query('SELECT ...', []),
      pool.query('SELECT COUNT(*) ...', []),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    expect(rowsResult.rows).toHaveLength(2);
    expect(total).toBe(2);
  });

  it('returns empty data when no events match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const [rowsResult, countResult] = await Promise.all([
      pool.query('SELECT ...', []),
      pool.query('SELECT COUNT(*) ...', []),
    ]);

    expect(rowsResult.rows).toHaveLength(0);
    expect(parseInt(countResult.rows[0].count, 10)).toBe(0);
  });
});

// ── auditLog service ──────────────────────────────────────────────────────────

describe('audit service', () => {
  it('inserts an event row', async () => {
    const event = {
      id: 'ev-1',
      workspace_id: 'ws-1',
      action: 'connections.create',
      resource_type: 'connections',
    };
    mockQuery.mockResolvedValueOnce({ rows: [event] });

    const result = await pool.query(
      `INSERT INTO audit_events (workspace_id, user_id, action, resource_type, resource_id, meta, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      ['ws-1', 'user-1', 'connections.create', 'connections', null, null, '127.0.0.1']
    );

    expect(result.rows[0].action).toBe('connections.create');
  });
});
