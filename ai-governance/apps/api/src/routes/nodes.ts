import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return r.rows.length > 0;
}

// ── GET /api/workspaces/:workspaceId/nodes ─────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { type } = req.query;
  const values: unknown[] = [workspaceId];
  let filter = '';
  if (type) {
    filter = ` AND type = $2`;
    values.push(type);
  }

  const result = await pool.query(
    `SELECT id, workspace_id, name, type, description, metadata, config, created_at, updated_at
     FROM nodes WHERE workspace_id = $1${filter} ORDER BY created_at DESC`,
    values
  );
  res.json({ data: result.rows });
});

// ── POST /api/workspaces/:workspaceId/nodes ───────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { name, type, description, metadata = {}, config = {} } = req.body as {
    name: string;
    type: string;
    description?: string;
    metadata?: Record<string, unknown>;
    config?: Record<string, unknown>;
  };

  if (!name || !type) {
    res.status(400).json({ error: 'name and type are required', code: 'VALIDATION_ERROR' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO nodes (workspace_id, name, type, description, metadata, config)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, workspace_id, name, type, description, metadata, config, created_at, updated_at`,
    [workspaceId, name, type, description ?? null, metadata, config]
  );
  res.status(201).json({ data: result.rows[0] });
});

// ── GET /api/workspaces/:workspaceId/nodes/:id ────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT id, workspace_id, name, type, description, metadata, config, created_at, updated_at
     FROM nodes WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Node not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: result.rows[0] });
});

// ── PATCH /api/workspaces/:workspaceId/nodes/:id ──────────────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { name, description, metadata, config } = req.body as {
    name?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    config?: Record<string, unknown>;
  };

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (name !== undefined)        { fields.push(`name = $${i++}`);        values.push(name); }
  if (description !== undefined) { fields.push(`description = $${i++}`); values.push(description); }
  if (metadata !== undefined)    { fields.push(`metadata = $${i++}`);    values.push(metadata); }
  if (config !== undefined)      { fields.push(`config = $${i++}`);      values.push(config); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' });
    return;
  }

  fields.push(`updated_at = now()`);
  values.push(id, workspaceId);

  const result = await pool.query(
    `UPDATE nodes SET ${fields.join(', ')}
     WHERE id = $${i} AND workspace_id = $${i + 1}
     RETURNING id, workspace_id, name, type, description, metadata, config, created_at, updated_at`,
    values
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Node not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: result.rows[0] });
});

// ── DELETE /api/workspaces/:workspaceId/nodes/:id ─────────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `DELETE FROM nodes WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Node not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

export default router;
