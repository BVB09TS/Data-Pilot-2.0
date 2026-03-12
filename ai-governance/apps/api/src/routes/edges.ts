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

// ── GET /api/workspaces/:workspaceId/edges ────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT e.id, e.workspace_id, e.source_node_id, e.target_node_id, e.label,
            e.metadata, e.created_at,
            sn.name AS source_name, tn.name AS target_name
     FROM edges e
     JOIN nodes sn ON sn.id = e.source_node_id
     JOIN nodes tn ON tn.id = e.target_node_id
     WHERE e.workspace_id = $1
     ORDER BY e.created_at DESC`,
    [workspaceId]
  );
  res.json({ data: result.rows });
});

// ── POST /api/workspaces/:workspaceId/edges ───────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { source_node_id, target_node_id, label, metadata = {} } = req.body as {
    source_node_id: string;
    target_node_id: string;
    label?: string;
    metadata?: Record<string, unknown>;
  };

  if (!source_node_id || !target_node_id) {
    res.status(400).json({ error: 'source_node_id and target_node_id are required', code: 'VALIDATION_ERROR' });
    return;
  }

  if (source_node_id === target_node_id) {
    res.status(400).json({ error: 'Self-loops are not allowed', code: 'SELF_LOOP' });
    return;
  }

  // Verify both nodes belong to this workspace
  const nodeCheck = await pool.query(
    `SELECT id FROM nodes WHERE id = ANY($1::uuid[]) AND workspace_id = $2`,
    [[source_node_id, target_node_id], workspaceId]
  );
  if (nodeCheck.rows.length < 2) {
    res.status(404).json({ error: 'One or both nodes not found in workspace', code: 'NODE_NOT_FOUND' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO edges (workspace_id, source_node_id, target_node_id, label, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, workspace_id, source_node_id, target_node_id, label, metadata, created_at`,
      [workspaceId, source_node_id, target_node_id, label ?? null, metadata]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    // Unique constraint violation → duplicate edge
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') {
      res.status(409).json({ error: 'Edge already exists', code: 'DUPLICATE_EDGE' });
      return;
    }
    throw err;
  }
});

// ── DELETE /api/workspaces/:workspaceId/edges/:id ─────────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `DELETE FROM edges WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Edge not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

export default router;
