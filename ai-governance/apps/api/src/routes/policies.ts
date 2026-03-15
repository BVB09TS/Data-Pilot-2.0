import { Router, IRouter, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { evaluatePolicy } from '../services/policyEngine.js';
import type { PolicyRule, EvaluationSubject } from '../services/policyEngine.js';

const router: IRouter = Router({ mergeParams: true });
router.use(requireAuth);

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return r.rows.length > 0;
}

// ── GET /api/workspaces/:workspaceId/policies ─────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT id, workspace_id, name, description, status, rules, created_at, updated_at
     FROM policies WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspaceId]
  );
  res.json({ data: result.rows });
});

// ── POST /api/workspaces/:workspaceId/policies ────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { name, description, status = 'draft', rules = [] } = req.body as {
    name: string;
    description?: string;
    status?: string;
    rules?: PolicyRule[];
  };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required', code: 'VALIDATION_ERROR' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO policies (workspace_id, name, description, status, rules, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, workspace_id, name, description, status, rules, created_at, updated_at`,
    [workspaceId, name.trim(), description ?? null, status, JSON.stringify(rules), req.userId]
  );
  res.status(201).json({ data: result.rows[0] });
});

// ── GET /api/workspaces/:workspaceId/policies/:id ─────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT id, workspace_id, name, description, status, rules, created_at, updated_at
     FROM policies WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Policy not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: result.rows[0] });
});

// ── PATCH /api/workspaces/:workspaceId/policies/:id ───────────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const { name, description, status, rules } = req.body as {
    name?: string;
    description?: string;
    status?: string;
    rules?: PolicyRule[];
  };

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (name !== undefined)        { fields.push(`name = $${i++}`);        values.push(name); }
  if (description !== undefined) { fields.push(`description = $${i++}`); values.push(description); }
  if (status !== undefined)      { fields.push(`status = $${i++}`);      values.push(status); }
  if (rules !== undefined)       { fields.push(`rules = $${i++}`);       values.push(JSON.stringify(rules)); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' });
    return;
  }

  fields.push(`updated_at = now()`);
  values.push(id, workspaceId);

  const result = await pool.query(
    `UPDATE policies SET ${fields.join(', ')}
     WHERE id = $${i} AND workspace_id = $${i + 1}
     RETURNING id, workspace_id, name, description, status, rules, created_at, updated_at`,
    values
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Policy not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: result.rows[0] });
});

// ── DELETE /api/workspaces/:workspaceId/policies/:id ──────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `DELETE FROM policies WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Policy not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

// ── POST /api/workspaces/:workspaceId/policies/:id/evaluate ───────────────────
// Run the policy rules against a given node or run.

router.post('/:id/evaluate', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const policyResult = await pool.query(
    `SELECT * FROM policies WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  if (policyResult.rows.length === 0) {
    res.status(404).json({ error: 'Policy not found', code: 'NOT_FOUND' });
    return;
  }

  const policy = policyResult.rows[0];
  if (policy.status !== 'active') {
    res.status(400).json({ error: 'Policy is not active', code: 'POLICY_INACTIVE' });
    return;
  }

  const { node_id, run_id, metadata = {}, subject: inlineSubject } = req.body as {
    node_id?: string;
    run_id?: string;
    metadata?: Record<string, unknown>;
    subject?: EvaluationSubject;
  };

  // Inline subject takes precedence for ad-hoc / curl testing
  const subject: EvaluationSubject = inlineSubject ?? { metadata };

  // Load node from DB if node_id provided (and no inline subject)
  if (node_id && !inlineSubject) {
    const nr = await pool.query(`SELECT * FROM nodes WHERE id = $1 AND workspace_id = $2`, [node_id, workspaceId]);
    if (nr.rows.length > 0) subject.node = nr.rows[0];
    const connCount = await pool.query(`SELECT COUNT(*) FROM connections WHERE workspace_id = $1`, [workspaceId]);
    subject.connectionCount = parseInt(connCount.rows[0].count, 10);
  }

  // Load run from DB if run_id provided (and no inline subject)
  if (run_id && !inlineSubject) {
    const rr = await pool.query(`SELECT * FROM runs WHERE id = $1 AND workspace_id = $2`, [run_id, workspaceId]);
    if (rr.rows.length > 0) subject.run = rr.rows[0];
    const runCount = await pool.query(`SELECT COUNT(*) FROM runs WHERE workspace_id = $1`, [workspaceId]);
    subject.runCount = parseInt(runCount.rows[0].count, 10);
  }

  const evaluation = evaluatePolicy(policy.rules as PolicyRule[], subject);

  // Persist evaluation result
  await pool.query(
    `INSERT INTO policy_evaluations
       (workspace_id, policy_id, node_id, run_id, result, violations)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [workspaceId, id, node_id ?? null, run_id ?? null, evaluation.result, JSON.stringify(evaluation.violations)]
  );

  res.json({ data: { policy_id: id, ...evaluation } });
});

// ── GET /api/workspaces/:workspaceId/policies/:id/evaluations ─────────────────

router.get('/:id/evaluations', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  if (!await assertWorkspaceAccess(req.userId!, workspaceId)) {
    res.status(403).json({ error: 'Forbidden', code: 'WORKSPACE_ACCESS_DENIED' });
    return;
  }

  const result = await pool.query(
    `SELECT pe.id, pe.policy_id, pe.node_id, pe.run_id, pe.result, pe.violations, pe.evaluated_at,
            n.name AS node_name, r.status AS run_status
     FROM policy_evaluations pe
     LEFT JOIN nodes n ON n.id = pe.node_id
     LEFT JOIN runs r ON r.id = pe.run_id
     WHERE pe.policy_id = $1 AND pe.workspace_id = $2
     ORDER BY pe.evaluated_at DESC LIMIT 50`,
    [id, workspaceId]
  );
  res.json({ data: result.rows });
});

export default router;
