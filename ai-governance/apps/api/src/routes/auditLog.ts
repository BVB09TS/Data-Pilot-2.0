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

// ── GET /api/workspaces/:workspaceId/audit ────────────────────────────────────
// Paginated, filterable audit log.

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const {
    resource_type,
    resource_id,
    user_id,
    action,
    limit = '50',
    offset = '0',
  } = req.query as Record<string, string>;

  const conditions: string[] = ['ae.workspace_id = $1'];
  const values: unknown[] = [workspaceId];
  let i = 2;

  if (resource_type) { conditions.push(`ae.resource_type = $${i++}`); values.push(resource_type); }
  if (resource_id)   { conditions.push(`ae.resource_id = $${i++}`);   values.push(resource_id); }
  if (user_id)       { conditions.push(`ae.user_id = $${i++}`);       values.push(user_id); }
  if (action)        { conditions.push(`ae.action ILIKE $${i++}`);    values.push(`%${action}%`); }

  const lim = Math.min(parseInt(limit, 10) || 50, 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  values.push(lim, off);

  const result = await pool.query(
    `SELECT ae.id, ae.action, ae.resource_type, ae.resource_id,
            ae.meta, ae.ip, ae.created_at,
            u.name AS user_name, u.email AS user_email
     FROM audit_events ae
     LEFT JOIN users u ON u.id = ae.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ae.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    values
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM audit_events ae WHERE ${conditions.join(' AND ')}`,
    values.slice(0, i - 1)
  );

  res.json({ data: result.rows, total: parseInt(countResult.rows[0].count, 10) });
});

export default router;
