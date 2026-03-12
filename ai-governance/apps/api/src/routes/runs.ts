import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// ── Types ─────────────────────────────────────────────────────────────────────

type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

interface LogEntry {
  ts: string;        // ISO timestamp
  level: 'info' | 'warn' | 'error';
  message: string;
  [key: string]: unknown;
}

// Valid status transitions
const TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  pending:   ['running', 'cancelled'],
  running:   ['success', 'failed', 'cancelled'],
  success:   [],
  failed:    [],
  cancelled: [],
};

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return r.rows.length > 0;
}

// ── GET /api/workspaces/:workspaceId/runs ─────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { status, node_id, environment_id, limit = '50', offset = '0' } = req.query as Record<string, string>;

  const conditions: string[] = ['r.workspace_id = $1'];
  const values: unknown[] = [workspaceId];
  let i = 2;

  if (status)         { conditions.push(`r.status = $${i++}`);         values.push(status); }
  if (node_id)        { conditions.push(`r.node_id = $${i++}`);        values.push(node_id); }
  if (environment_id) { conditions.push(`r.environment_id = $${i++}`); values.push(environment_id); }

  values.push(Math.min(parseInt(limit, 10) || 50, 200));
  values.push(Math.max(parseInt(offset, 10) || 0, 0));

  const result = await pool.query(
    `SELECT r.id, r.workspace_id, r.environment_id, r.node_id, r.status,
            r.started_at, r.finished_at, r.metadata, r.created_at,
            n.name AS node_name, e.name AS environment_name
     FROM runs r
     LEFT JOIN nodes n ON n.id = r.node_id
     LEFT JOIN environments e ON e.id = r.environment_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    values
  );

  // Return count for pagination
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM runs r WHERE ${conditions.slice(0, -0).join(' AND ')}`,
    values.slice(0, i - 1)
  );

  res.json({ data: result.rows, total: parseInt(countResult.rows[0].count, 10) });
});

// ── POST /api/workspaces/:workspaceId/runs ────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { node_id, environment_id, metadata = {} } = req.body as {
    node_id?: string;
    environment_id?: string;
    metadata?: Record<string, unknown>;
  };

  // Verify node belongs to workspace if provided
  if (node_id) {
    const nodeCheck = await pool.query(
      `SELECT 1 FROM nodes WHERE id = $1 AND workspace_id = $2`,
      [node_id, workspaceId]
    );
    if (nodeCheck.rows.length === 0) {
      res.status(404).json({ error: 'Node not found in workspace', code: 'NODE_NOT_FOUND' });
      return;
    }
  }

  // Verify environment belongs to workspace if provided
  if (environment_id) {
    const envCheck = await pool.query(
      `SELECT 1 FROM environments WHERE id = $1 AND workspace_id = $2`,
      [environment_id, workspaceId]
    );
    if (envCheck.rows.length === 0) {
      res.status(404).json({ error: 'Environment not found in workspace', code: 'ENVIRONMENT_NOT_FOUND' });
      return;
    }
  }

  const result = await pool.query(
    `INSERT INTO runs (workspace_id, node_id, environment_id, status, metadata)
     VALUES ($1, $2, $3, 'pending', $4)
     RETURNING id, workspace_id, environment_id, node_id, status,
               started_at, finished_at, metadata, created_at`,
    [workspaceId, node_id ?? null, environment_id ?? null, metadata]
  );
  res.status(201).json({ data: result.rows[0] });
});

// ── GET /api/workspaces/:workspaceId/runs/:id ─────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT r.id, r.workspace_id, r.environment_id, r.node_id, r.status,
            r.started_at, r.finished_at, r.logs, r.metadata, r.created_at,
            n.name AS node_name, e.name AS environment_name
     FROM runs r
     LEFT JOIN nodes n ON n.id = r.node_id
     LEFT JOIN environments e ON e.id = r.environment_id
     WHERE r.id = $1 AND r.workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Run not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: result.rows[0] });
});

// ── PATCH /api/workspaces/:workspaceId/runs/:id/status ────────────────────────
// Drives the status machine: pending → running → success | failed | cancelled

router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { status } = req.body as { status: RunStatus };
  const validStatuses: RunStatus[] = ['pending', 'running', 'success', 'failed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      code: 'INVALID_STATUS',
    });
    return;
  }

  const existing = await pool.query<{ status: RunStatus }>(
    `SELECT status FROM runs WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Run not found', code: 'NOT_FOUND' });
    return;
  }

  const currentStatus = existing.rows[0].status;
  if (!TRANSITIONS[currentStatus].includes(status)) {
    res.status(409).json({
      error: `Cannot transition from '${currentStatus}' to '${status}'`,
      code: 'INVALID_TRANSITION',
      allowed: TRANSITIONS[currentStatus],
    });
    return;
  }

  // Set timestamps based on transition
  const extraFields: string[] = [];
  if (status === 'running')                                        extraFields.push(`started_at = now()`);
  if (['success', 'failed', 'cancelled'].includes(status))        extraFields.push(`finished_at = now()`);

  const setClause = [`status = $1`, ...extraFields].join(', ');

  const result = await pool.query(
    `UPDATE runs SET ${setClause}
     WHERE id = $2 AND workspace_id = $3
     RETURNING id, workspace_id, environment_id, node_id, status,
               started_at, finished_at, metadata, created_at`,
    [status, id, workspaceId]
  );
  res.json({ data: result.rows[0] });
});

// ── POST /api/workspaces/:workspaceId/runs/:id/logs ───────────────────────────
// Append one or more log entries to the run's JSONB log array.

router.post('/:id/logs', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  // Accept a single entry or an array
  const body = req.body as LogEntry | LogEntry[];
  const entries: LogEntry[] = Array.isArray(body) ? body : [body];

  if (entries.length === 0) {
    res.status(400).json({ error: 'At least one log entry is required', code: 'VALIDATION_ERROR' });
    return;
  }

  // Stamp any entries missing a timestamp
  const stamped = entries.map(e => ({
    ts: new Date().toISOString(),
    level: 'info',
    ...e,
  }));

  const result = await pool.query(
    `UPDATE runs
     SET logs = logs || $1::jsonb
     WHERE id = $2 AND workspace_id = $3
     RETURNING id, status, jsonb_array_length(logs) AS log_count`,
    [JSON.stringify(stamped), id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Run not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: result.rows[0] });
});

// ── GET /api/workspaces/:workspaceId/runs/:id/logs ────────────────────────────

router.get('/:id/logs', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT logs FROM runs WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Run not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: result.rows[0].logs ?? [] });
});

export default router;
