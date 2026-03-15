/**
 * GitHub PR Review routes
 *
 * Public:
 *   POST /api/github/webhook  — receives GitHub webhook events (verified by HMAC)
 *
 * Workspace-scoped (requireAuth):
 *   GET    /api/workspaces/:wid/github/installations       — list connected repos
 *   POST   /api/workspaces/:wid/github/installations       — connect a repo
 *   DELETE /api/workspaces/:wid/github/installations/:id   — disconnect a repo
 *   GET    /api/workspaces/:wid/github/reviews             — list PR reviews
 *   GET    /api/workspaces/:wid/github/reviews/:id         — get one PR review
 */

import { Router, IRouter, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { encrypt } from '../utils/crypto.js';
import {
  runPRReview,
  formatPRComment,
  postPRComment,
  registerWebhook,
  deleteWebhook,
} from '../services/githubPrReview.js';

// ── Webhook router (public — no auth, verified by HMAC) ───────────────────────

export const webhookRouter: IRouter = Router();

webhookRouter.post('/github/webhook', async (req: Request, res: Response): Promise<void> => {
  const event = req.headers['x-github-event'] as string | undefined;
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody = JSON.stringify(req.body);

  if (!event || !signature) {
    res.status(400).json({ error: 'Missing GitHub event headers' });
    return;
  }

  const payload = req.body as Record<string, unknown>;

  // Determine repo
  const repoFullName = (payload.repository as { full_name?: string })?.full_name;
  if (!repoFullName) {
    res.status(200).json({ ok: true, skipped: 'no repository in payload' });
    return;
  }

  // Look up the installation for this repo
  const installResult = await pool.query<{
    id: string;
    workspace_id: string;
    encrypted_token: string;
    webhook_secret: string;
  }>(
    `SELECT id, workspace_id, encrypted_token, webhook_secret
     FROM github_installations
     WHERE repo_full_name = $1 AND is_active = TRUE
     LIMIT 1`,
    [repoFullName]
  );

  if (installResult.rows.length === 0) {
    res.status(200).json({ ok: true, skipped: 'no installation for repo' });
    return;
  }

  const installation = installResult.rows[0];

  // Verify HMAC signature
  if (installation.webhook_secret) {
    const expected = `sha256=${crypto
      .createHmac('sha256', installation.webhook_secret)
      .update(rawBody)
      .digest('hex')}`;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }
  }

  // Handle pull_request opened or synchronize
  if (event === 'pull_request') {
    const action = payload.action as string;
    if (action !== 'opened' && action !== 'synchronize' && action !== 'reopened') {
      res.status(200).json({ ok: true, skipped: `action=${action}` });
      return;
    }

    const pr = payload.pull_request as {
      number: number;
      title: string;
      user: { login: string };
      base: { ref: string };
      head: { ref: string; sha: string };
    };

    // Create pending review record
    const reviewResult = await pool.query<{ id: string }>(
      `INSERT INTO pr_reviews
         (workspace_id, installation_id, repo_full_name, pr_number, pr_title,
          pr_author, base_branch, head_branch, commit_sha, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'running')
       RETURNING id`,
      [
        installation.workspace_id,
        installation.id,
        repoFullName,
        pr.number,
        pr.title,
        pr.user.login,
        pr.base.ref,
        pr.head.ref,
        pr.head.sha,
      ]
    );
    const reviewId = reviewResult.rows[0].id;

    // Run the review asynchronously (don't await — GitHub expects fast 200)
    res.status(200).json({ ok: true, review_id: reviewId });

    void (async () => {
      try {
        const result = await runPRReview(
          installation.workspace_id,
          installation.encrypted_token,
          repoFullName,
          pr.number,
          pr.head.sha
        );

        const comment = formatPRComment(result);
        const commentId = await postPRComment(
          installation.encrypted_token,
          repoFullName,
          pr.number,
          comment
        );

        await pool.query(
          `UPDATE pr_reviews
           SET status = 'completed',
               findings = $1,
               summary = $2,
               github_comment_id = $3,
               files_changed = $4,
               dbt_files_found = $5,
               completed_at = NOW()
           WHERE id = $6`,
          [
            JSON.stringify(result.findings),
            result.summary,
            commentId,
            result.stats.files_changed,
            result.stats.dbt_files,
            reviewId,
          ]
        );
      } catch (err) {
        console.error('[PR Review] failed:', err);
        await pool.query(
          `UPDATE pr_reviews SET status = 'failed', completed_at = NOW() WHERE id = $1`,
          [reviewId]
        );
      }
    })();

    return;
  }

  res.status(200).json({ ok: true, skipped: `event=${event}` });
});

// ── Workspace-scoped router (requires auth) ───────────────────────────────────

export const githubRouter: IRouter = Router({ mergeParams: true });

githubRouter.use(requireAuth);

async function assertWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return r.rows.length > 0;
}

// GET /api/workspaces/:workspaceId/github/installations
githubRouter.get('/installations', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  const userId = req.userId!;

  if (!(await assertWorkspaceAccess(userId, workspaceId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await pool.query(
    `SELECT id, account_login, repo_full_name, webhook_id, is_active, created_at
     FROM github_installations
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId]
  );

  res.json(result.rows);
});

// POST /api/workspaces/:workspaceId/github/installations
githubRouter.post('/installations', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  const userId = req.userId!;
  const { repo_full_name, token, webhook_url } = req.body as {
    repo_full_name?: string;
    token?: string;
    webhook_url?: string;
  };

  if (!(await assertWorkspaceAccess(userId, workspaceId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (!repo_full_name || !token) {
    res.status(400).json({ error: 'repo_full_name and token are required' });
    return;
  }

  if (!repo_full_name.includes('/')) {
    res.status(400).json({ error: 'repo_full_name must be in "owner/repo" format' });
    return;
  }

  const [accountLogin] = repo_full_name.split('/');
  const encryptedToken = encrypt(token);
  const webhookSecret = crypto.randomBytes(24).toString('hex');
  let webhookId: number | null = null;

  // Register webhook on GitHub if a public webhook URL is provided
  if (webhook_url) {
    try {
      webhookId = await registerWebhook(encryptedToken, repo_full_name, webhook_url, webhookSecret);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Unknown error';
      res.status(400).json({ error: `Failed to register webhook on GitHub: ${msg}` });
      return;
    }
  }

  const result = await pool.query<{ id: string }>(
    `INSERT INTO github_installations
       (workspace_id, account_login, repo_full_name, encrypted_token, webhook_id, webhook_secret)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (workspace_id, repo_full_name) DO UPDATE
       SET encrypted_token = EXCLUDED.encrypted_token,
           webhook_id = EXCLUDED.webhook_id,
           webhook_secret = EXCLUDED.webhook_secret,
           is_active = TRUE
     RETURNING id`,
    [workspaceId, accountLogin, repo_full_name, encryptedToken, webhookId, webhookSecret]
  );

  res.status(201).json({
    id: result.rows[0].id,
    repo_full_name,
    webhook_secret: webhookId ? webhookSecret : undefined,
    webhook_registered: !!webhookId,
    message: webhookId
      ? 'Repository connected and webhook registered.'
      : 'Repository connected. Register the webhook manually using the secret below.',
  });
});

// DELETE /api/workspaces/:workspaceId/github/installations/:id
githubRouter.delete('/installations/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  const userId = req.userId!;

  if (!(await assertWorkspaceAccess(userId, workspaceId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await pool.query<{
    encrypted_token: string;
    repo_full_name: string;
    webhook_id: number | null;
  }>(
    `DELETE FROM github_installations
     WHERE id = $1 AND workspace_id = $2
     RETURNING encrypted_token, repo_full_name, webhook_id`,
    [id, workspaceId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Installation not found' });
    return;
  }

  const { encrypted_token, repo_full_name, webhook_id } = result.rows[0];
  if (webhook_id) {
    await deleteWebhook(encrypted_token, repo_full_name, webhook_id);
  }

  res.json({ ok: true });
});

// GET /api/workspaces/:workspaceId/github/reviews
githubRouter.get('/reviews', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10), 100);
  const offset = parseInt(req.query.offset as string ?? '0', 10);

  if (!(await assertWorkspaceAccess(userId, workspaceId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await pool.query(
    `SELECT r.id, r.repo_full_name, r.pr_number, r.pr_title, r.pr_author,
            r.base_branch, r.head_branch, r.commit_sha, r.status,
            r.summary, r.files_changed, r.dbt_files_found,
            r.github_comment_id, r.created_at, r.completed_at,
            jsonb_array_length(r.findings) AS finding_count
     FROM pr_reviews r
     WHERE r.workspace_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [workspaceId, limit, offset]
  );

  const total = await pool.query(
    `SELECT COUNT(*) FROM pr_reviews WHERE workspace_id = $1`,
    [workspaceId]
  );

  res.json({ reviews: result.rows, total: parseInt(total.rows[0].count, 10) });
});

// GET /api/workspaces/:workspaceId/github/reviews/:id
githubRouter.get('/reviews/:id', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId, id } = req.params;
  const userId = req.userId!;

  if (!(await assertWorkspaceAccess(userId, workspaceId))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await pool.query(
    `SELECT * FROM pr_reviews WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }

  res.json(result.rows[0]);
});
