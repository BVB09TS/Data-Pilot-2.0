/**
 * DataPilot Audit Pipeline
 *
 * Orchestrates all 8 analysis agents in parallel, persists findings to PostgreSQL,
 * and updates the run status throughout.
 */

import { pool } from '../db/pool.js';
import { parseDbtProject } from './parser.js';
import { getQuotaStatus } from './llmGateway.js';
import { analyzeDeadModels } from './agents/deadModels.js';
import { analyzeOrphans } from './agents/orphans.js';
import { analyzeBrokenRefs } from './agents/brokenRefs.js';
import { analyzeDuplicateMetrics } from './agents/duplicateMetrics.js';
import { analyzeGrainJoins } from './agents/grainJoins.js';
import { analyzeLogicDrift } from './agents/logicDrift.js';
import { analyzeMissingTests } from './agents/missingTests.js';
import { analyzeDeprecatedSources } from './agents/deprecatedSources.js';
import type { AgentFinding } from './agents/types.js';

export interface PipelineOptions {
  projectPath: string;
  workspaceId: string;
  runId: string;
  environmentId?: string;
  queryHistory?: Record<string, number>; // model_name → query count in 90d
}

export interface PipelineResult {
  findings: AgentFinding[];
  totalFindings: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  totalCostUsd: number;
  quota: ReturnType<typeof getQuotaStatus>;
  durationMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setRunStatus(
  runId: string,
  status: 'running' | 'success' | 'failed',
  meta?: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `UPDATE runs SET status = $1, metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb WHERE id = $3`,
    [status, JSON.stringify(meta ?? {}), runId],
  );
}

async function persistFindings(
  findings: AgentFinding[],
  workspaceId: string,
  runId: string,
): Promise<void> {
  if (findings.length === 0) return;

  // Look up node IDs by model name for FK linkage
  const nodeRows = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM nodes WHERE workspace_id = $1`,
    [workspaceId],
  );
  const nameToId = new Map(nodeRows.rows.map(r => [r.name, r.id]));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const f of findings) {
      const nodeId = f.modelName ? nameToId.get(f.modelName) ?? null : null;
      await client.query(
        `INSERT INTO findings
           (workspace_id, run_id, node_id, type, severity, title, description,
            recommendation, llm_reasoning, cost_usd, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          workspaceId,
          runId,
          nodeId,
          f.type,
          f.severity,
          f.title,
          f.description,
          f.recommendation ?? null,
          f.llm_reasoning ?? null,
          f.cost_usd,
          JSON.stringify(f.metadata),
        ],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Run the full DataPilot audit pipeline.
 * Updates the run status in real-time and stores findings in PostgreSQL.
 */
export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const start = Date.now();

  await setRunStatus(opts.runId, 'running', { started_at: new Date().toISOString() });

  try {
    // 1. Parse the dbt project
    const project = await parseDbtProject(
      opts.projectPath,
      opts.workspaceId,
      opts.environmentId,
    );

    // 2. Run all 8 agents in parallel
    const agentResults = await Promise.allSettled([
      analyzeDeadModels(project, opts.queryHistory),
      analyzeOrphans(project),
      analyzeBrokenRefs(project),
      analyzeDuplicateMetrics(project),
      analyzeGrainJoins(project),
      analyzeLogicDrift(project),
      analyzeMissingTests(project),
      analyzeDeprecatedSources(project),
    ]);

    // Collect successful findings, log failures
    const allFindings: AgentFinding[] = [];
    for (const result of agentResults) {
      if (result.status === 'fulfilled') {
        allFindings.push(...result.value);
      } else {
        console.error('[DataPilot] Agent error:', result.reason);
      }
    }

    // 3. Persist findings
    await persistFindings(allFindings, opts.workspaceId, opts.runId);

    // 4. Build summary
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalCost = 0;

    for (const f of allFindings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
      byType[f.type] = (byType[f.type] ?? 0) + 1;
      totalCost += f.cost_usd;
    }

    const summary = {
      totalFindings: allFindings.length,
      bySeverity,
      byType,
      totalCostUsd: totalCost,
      durationMs: Date.now() - start,
      projectName: project.projectName,
      nodeCount: project.nodeCount,
      edgeCount: project.edgeCount,
    };

    await setRunStatus(opts.runId, 'success', summary);

    return {
      findings: allFindings,
      ...summary,
      quota: getQuotaStatus(),
    };
  } catch (err) {
    await setRunStatus(opts.runId, 'failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
