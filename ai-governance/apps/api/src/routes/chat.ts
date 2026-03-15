/**
 * Chat API — DataPilot AI assistant
 *
 * POST /api/workspaces/:workspaceId/chat
 *
 * Accepts a user message and optional context (finding ID or model name),
 * queries recent findings from the DB to give the LLM grounding,
 * and returns a streaming-compatible JSON response.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { llmCall } from '../datapilot/llmGateway.js';
import { validate, required, isString, maxLen } from '../middleware/validate.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { workspaceId } = req.params;

  // Verify workspace access
  const access = await pool.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, req.userId],
  );
  if (access.rows.length === 0) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const errors = validate(req.body as Record<string, unknown>, {
    message: [required, isString, maxLen(2000)],
  });
  if (errors.length) {
    res.status(400).json({ errors });
    return;
  }

  const {
    message,
    history = [],
    context_finding_id,
    context_model_name,
  } = req.body as {
    message: string;
    history?: ChatMessage[];
    context_finding_id?: string;
    context_model_name?: string;
  };

  // Build context from recent findings
  let contextBlock = '';

  if (context_finding_id) {
    const r = await pool.query(
      `SELECT type, severity, title, description, recommendation, metadata
       FROM findings WHERE id = $1 AND workspace_id = $2`,
      [context_finding_id, workspaceId],
    );
    if (r.rows.length > 0) {
      const f = r.rows[0];
      contextBlock = `\nCurrent finding context:\n- Type: ${f.type}\n- Severity: ${f.severity}\n- Title: ${f.title}\n- Description: ${f.description}\n- Recommendation: ${f.recommendation ?? 'N/A'}\n`;
    }
  } else if (context_model_name) {
    const r = await pool.query(
      `SELECT type, severity, title, description FROM findings
       WHERE workspace_id = $1 AND metadata->>'model_name' = $2
       ORDER BY created_at DESC LIMIT 5`,
      [workspaceId, context_model_name],
    );
    if (r.rows.length > 0) {
      contextBlock = `\nFindings for model "${context_model_name}":\n${r.rows.map(f => `- [${f.severity}] ${f.title}: ${f.description}`).join('\n')}\n`;
    }
  } else {
    // Give recent findings summary
    const r = await pool.query(
      `SELECT severity, COUNT(*) FROM findings WHERE workspace_id = $1 GROUP BY severity`,
      [workspaceId],
    );
    if (r.rows.length > 0) {
      const counts = r.rows.map(row => `${row.count} ${row.severity}`).join(', ');
      contextBlock = `\nWorkspace finding summary: ${counts} findings.\n`;
    }
  }

  const systemPrompt = `You are DataPilot AI, an expert dbt data engineering assistant embedded in the AI Governance platform.
You help users understand findings from dbt project audits, explain lineage issues, suggest fixes, and answer data modeling questions.
Be concise, practical, and cite specific model names or SQL patterns when relevant.
${contextBlock}`;

  // Build messages array (last 6 turns of history + new message)
  const recentHistory = (history ?? []).slice(-6) as ChatMessage[];
  const messages: ChatMessage[] = [
    ...recentHistory,
    { role: 'user', content: message },
  ];

  try {
    const response = await llmCall(
      [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      { tier: 'standard', maxTokens: 1000 },
    );

    res.json({
      reply: response.text,
      cost_usd: response.cost_usd,
      model: response.model,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LLM unavailable';
    res.status(503).json({ error: msg });
  }
});

export default router;
