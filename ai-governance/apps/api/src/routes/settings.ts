/**
 * Workspace Settings Routes
 *
 * GET  /api/workspaces/:workspaceId/settings  — read settings (keys masked)
 * PATCH /api/workspaces/:workspaceId/settings — update settings
 */

import { Router, IRouter, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate, isString, maxLen, optional } from '../middleware/validate.js';

const router: IRouter = Router({ mergeParams: true });
router.use(requireAuth);

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  return r.rows.length > 0;
}

/** Mask an API key: show only "sk-...XXXX" or just "****XXXX" */
function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return '****';
  return '****' + key.slice(-4);
}

// ── GET /settings ──────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId || !(await assertWorkspaceAccess(userId, workspaceId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const r = await pool.query(
    `SELECT groq_api_key, openai_api_key, anthropic_api_key, default_project_path, updated_at
       FROM workspace_settings WHERE workspace_id = $1`,
    [workspaceId],
  );

  if (r.rows.length === 0) {
    res.json({
      groq_api_key: null,
      openai_api_key: null,
      anthropic_api_key: null,
      default_project_path: null,
      updated_at: null,
    });
    return;
  }

  const row = r.rows[0];
  res.json({
    groq_api_key: maskKey(row.groq_api_key),
    openai_api_key: maskKey(row.openai_api_key),
    anthropic_api_key: maskKey(row.anthropic_api_key),
    default_project_path: row.default_project_path ?? null,
    updated_at: row.updated_at,
  });
});

// ── PATCH /settings ────────────────────────────────────────────────────────────

router.patch('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId || !(await assertWorkspaceAccess(userId, workspaceId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const errors = validate(req.body, {
    groq_api_key:         [optional, isString, maxLen(200)],
    openai_api_key:       [optional, isString, maxLen(200)],
    anthropic_api_key:    [optional, isString, maxLen(200)],
    default_project_path: [optional, isString, maxLen(512)],
  });
  if (errors.length) {
    res.status(400).json({ error: errors[0] });
    return;
  }

  const { groq_api_key, openai_api_key, anthropic_api_key, default_project_path } = req.body as Record<string, string | undefined>;

  // Build dynamic SET clause — only update fields that are explicitly provided
  const updates: string[] = [];
  const values: unknown[] = [workspaceId];

  if (groq_api_key !== undefined) {
    values.push(groq_api_key || null);
    updates.push(`groq_api_key = $${values.length}`);
  }
  if (openai_api_key !== undefined) {
    values.push(openai_api_key || null);
    updates.push(`openai_api_key = $${values.length}`);
  }
  if (anthropic_api_key !== undefined) {
    values.push(anthropic_api_key || null);
    updates.push(`anthropic_api_key = $${values.length}`);
  }
  if (default_project_path !== undefined) {
    values.push(default_project_path || null);
    updates.push(`default_project_path = $${values.length}`);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  // Ensure row exists, then update only specified fields
  await pool.query(
    `INSERT INTO workspace_settings (workspace_id) VALUES ($1)
       ON CONFLICT (workspace_id) DO NOTHING`,
    [workspaceId],
  );

  await pool.query(
    `UPDATE workspace_settings SET ${updates.join(', ')}, updated_at = now()
       WHERE workspace_id = $1`,
    values,
  );

  res.json({ ok: true });
});

export default router;
