import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { checkHealth } from '../services/healthCheck.js';

const router = Router({ mergeParams: true });

// All routes require auth
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Verify the requesting user belongs to the workspace in the URL params. */
async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return r.rows.length > 0;
}

/** Strip encrypted_secret before sending to client. */
function redact(row: Record<string, unknown>) {
  const { encrypted_secret: _, ...safe } = row;
  return safe;
}

// ── GET /api/workspaces/:workspaceId/connections ───────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT id, workspace_id, environment_id, type, provider, name, config,
            is_enabled, last_health_check, health_status, created_at
     FROM connections WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspaceId]
  );
  res.json({ data: result.rows });
});

// ── POST /api/workspaces/:workspaceId/connections ─────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { type, provider, name, secret, config = {}, environment_id } = req.body as {
    type: string;
    provider?: string;
    name: string;
    secret?: string;
    config?: Record<string, unknown>;
    environment_id?: string;
  };

  if (!type || !name) {
    res.status(400).json({ error: 'type and name are required', code: 'VALIDATION_ERROR' });
    return;
  }

  const encrypted = secret ? encrypt(secret) : null;

  const result = await pool.query(
    `INSERT INTO connections
       (workspace_id, environment_id, type, provider, name, encrypted_secret, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, workspace_id, environment_id, type, provider, name, config,
               is_enabled, last_health_check, health_status, created_at`,
    [workspaceId, environment_id ?? null, type, provider ?? null, name, encrypted, config]
  );

  res.status(201).json({ data: result.rows[0] });
});

// ── GET /api/workspaces/:workspaceId/connections/:id ──────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT * FROM connections WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Connection not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: redact(result.rows[0]) });
});

// ── PATCH /api/workspaces/:workspaceId/connections/:id ────────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  // Check it exists
  const existing = await pool.query(
    `SELECT id FROM connections WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Connection not found', code: 'NOT_FOUND' });
    return;
  }

  const { name, provider, secret, config, is_enabled, environment_id } = req.body as {
    name?: string;
    provider?: string;
    secret?: string;
    config?: Record<string, unknown>;
    is_enabled?: boolean;
    environment_id?: string;
  };

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (name !== undefined)           { fields.push(`name = $${i++}`);           values.push(name); }
  if (provider !== undefined)       { fields.push(`provider = $${i++}`);       values.push(provider); }
  if (secret !== undefined)         { fields.push(`encrypted_secret = $${i++}`); values.push(encrypt(secret)); }
  if (config !== undefined)         { fields.push(`config = $${i++}`);         values.push(config); }
  if (is_enabled !== undefined)     { fields.push(`is_enabled = $${i++}`);     values.push(is_enabled); }
  if (environment_id !== undefined) { fields.push(`environment_id = $${i++}`); values.push(environment_id); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' });
    return;
  }

  values.push(id, workspaceId);
  const result = await pool.query(
    `UPDATE connections SET ${fields.join(', ')}
     WHERE id = $${i} AND workspace_id = $${i + 1}
     RETURNING id, workspace_id, environment_id, type, provider, name, config,
               is_enabled, last_health_check, health_status, created_at`,
    values
  );
  res.json({ data: result.rows[0] });
});

// ── DELETE /api/workspaces/:workspaceId/connections/:id ───────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `DELETE FROM connections WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Connection not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

// ── POST /api/workspaces/:workspaceId/connections/:id/ping ────────────────────

router.post('/:id/ping', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT * FROM connections WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Connection not found', code: 'NOT_FOUND' });
    return;
  }

  const conn = result.rows[0];
  const plainSecret = conn.encrypted_secret ? decrypt(conn.encrypted_secret) : undefined;
  const status = await checkHealth(conn.type, conn.provider, plainSecret, conn.config);

  await pool.query(
    `UPDATE connections SET health_status = $1, last_health_check = now() WHERE id = $2`,
    [status, id]
  );

  res.json({ data: { id, health_status: status, last_health_check: new Date().toISOString() } });
});

export default router;
