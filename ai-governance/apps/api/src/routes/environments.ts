import { Router, IRouter, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: IRouter = Router({ mergeParams: true });
router.use(requireAuth);

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return r.rows.length > 0;
}

// ── GET /api/workspaces/:workspaceId/environments ─────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT id, workspace_id, name, created_at
     FROM environments WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspaceId]
  );
  res.json({ data: result.rows });
});

// ── POST /api/workspaces/:workspaceId/environments ────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { name } = req.body as { name: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required', code: 'VALIDATION_ERROR' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO environments (workspace_id, name)
     VALUES ($1, $2)
     RETURNING id, workspace_id, name, created_at`,
    [workspaceId, name.trim()]
  );
  res.status(201).json({ data: result.rows[0] });
});

// ── GET /api/workspaces/:workspaceId/environments/:id ─────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT id, workspace_id, name, created_at
     FROM environments WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Environment not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: result.rows[0] });
});

// ── PATCH /api/workspaces/:workspaceId/environments/:id ───────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required', code: 'VALIDATION_ERROR' });
    return;
  }

  const result = await pool.query(
    `UPDATE environments SET name = $1
     WHERE id = $2 AND workspace_id = $3
     RETURNING id, workspace_id, name, created_at`,
    [name.trim(), id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Environment not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: result.rows[0] });
});

// ── DELETE /api/workspaces/:workspaceId/environments/:id ──────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `DELETE FROM environments WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Environment not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

export default router;
