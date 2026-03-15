/**
 * DataPilot API Routes
 *
 * POST /api/workspaces/:workspaceId/datapilot/audit   — trigger an audit run
 * GET  /api/workspaces/:workspaceId/datapilot/findings — list findings
 * GET  /api/workspaces/:workspaceId/datapilot/findings/:findingId — single finding
 * GET  /api/workspaces/:workspaceId/datapilot/quota    — LLM quota status
 */

import { Router, IRouter, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { runPipeline } from '../datapilot/runPipeline.js';
import { getQuotaStatus } from '../datapilot/llmGateway.js';
import { validate, required, isString, maxLen, isUUID, noPathTraversal, optional } from '../middleware/validate.js';

const router: IRouter = Router({ mergeParams: true });
router.use(requireAuth);

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  return r.rows.length > 0;
}

// ── POST /audit ───────────────────────────────────────────────────────────────

router.post('/audit', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { project_path, environment_id, query_history } = req.body as {
    project_path: string;
    environment_id?: string;
    query_history?: Record<string, number>;
  };

  const errors = validate(req.body as Record<string, unknown>, {
    project_path: [required, isString, maxLen(512), noPathTraversal],
    environment_id: [optional, isUUID],
  });
  if (errors.length) {
    res.status(400).json({ errors });
    return;
  }

  // Create a run record
  const runResult = await pool.query<{ id: string }>(
    `INSERT INTO runs (workspace_id, environment_id, status, metadata)
     VALUES ($1, $2, 'pending', $3)
     RETURNING id`,
    [workspaceId, environment_id ?? null, JSON.stringify({ project_path })],
  );
  const runId = runResult.rows[0].id;

  // Kick off pipeline asynchronously — respond immediately with run ID
  setImmediate(() => {
    runPipeline({
      projectPath: project_path,
      workspaceId,
      runId,
      environmentId: environment_id,
      queryHistory: query_history,
    }).catch(err => {
      console.error('[VORO] Pipeline failed:', err);
    });
  });

  res.status(202).json({
    run_id: runId,
    status: 'pending',
    message: 'Audit started. Poll GET /runs/:runId for status.',
  });
});

// ── GET /findings ─────────────────────────────────────────────────────────────

router.get('/findings', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const {
    run_id,
    type,
    severity,
    limit = '50',
    offset = '0',
  } = req.query as Record<string, string>;

  const conditions: string[] = ['f.workspace_id = $1'];
  const values: unknown[] = [workspaceId];
  let i = 2;

  if (run_id)   { conditions.push(`f.run_id = $${i++}`);   values.push(run_id); }
  if (type)     { conditions.push(`f.type = $${i++}`);      values.push(type); }
  if (severity) { conditions.push(`f.severity = $${i++}`);  values.push(severity); }

  const where = conditions.join(' AND ');

  const result = await pool.query(
    `SELECT f.id, f.run_id, f.node_id, f.type, f.severity, f.title,
            f.description, f.recommendation, f.cost_usd, f.metadata, f.created_at,
            n.name AS model_name
     FROM findings f
     LEFT JOIN nodes n ON n.id = f.node_id
     WHERE ${where}
     ORDER BY
       CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       f.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...values, parseInt(limit), parseInt(offset)],
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM findings f WHERE ${where}`,
    values,
  );

  res.json({
    findings: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit: parseInt(limit),
    offset: parseInt(offset),
  });
});

// ── GET /findings/:findingId ──────────────────────────────────────────────────

router.get('/findings/:findingId', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, findingId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT f.*, n.name AS model_name
     FROM findings f
     LEFT JOIN nodes n ON n.id = f.node_id
     WHERE f.id = $1 AND f.workspace_id = $2`,
    [findingId, workspaceId],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Finding not found' });
    return;
  }

  res.json(result.rows[0]);
});

// ── GET /quota ────────────────────────────────────────────────────────────────

router.get('/quota', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  res.json(getQuotaStatus());
});

export default router;
