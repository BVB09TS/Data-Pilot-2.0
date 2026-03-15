/**
 * Agent: Wrong Grain Joins
 * Detects joins between models operating at incompatible data grains.
 *
 * Detection strategy (no name-keyword reliance):
 *  1. Find models that JOIN >= 2 upstream models
 *  2. Classify each upstream model's grain from its SQL:
 *     - "aggregate" if it contains GROUP BY or aggregate functions (SUM/COUNT/AVG/MAX/MIN)
 *     - "transaction" otherwise
 *  3. Flag models where upstreams have mixed grain classifications
 *  4. Send flagged models to LLM for deeper analysis + confirmation
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
import type { ParsedProject, ParsedModel } from '../parser.js';
import type { AgentFinding } from './types.js';

const AGGREGATE_FUNCTIONS = /\b(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE|PERCENTILE|APPROX_COUNT)\s*\(/i;
const GROUP_BY = /\bGROUP\s+BY\b/i;
const DATE_TRUNC = /\b(DATE_TRUNC|TO_DATE|DATEADD|DATEDIFF)\b/i;

type Grain = 'aggregate' | 'transaction' | 'unknown';

function inferGrain(model: ParsedModel): Grain {
  const sql = model.sql;
  if (!sql) return 'unknown';
  const hasAgg = AGGREGATE_FUNCTIONS.test(sql) || GROUP_BY.test(sql);
  return hasAgg ? 'aggregate' : 'transaction';
}

export async function analyzeGrainJoins(project: ParsedProject): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  // Build lookup: uniqueId → model
  const modelById = new Map(project.models.map(m => [m.uniqueId, m]));
  const modelByName = new Map(project.models.map(m => [m.name, m]));

  // Find models that join >= 2 upstreams
  const joinCandidates = project.models.filter(m => {
    return m.dependsOn.length >= 2 && /\bJOIN\b/i.test(m.sql);
  });

  if (joinCandidates.length === 0) return [];

  // Classify upstreams by grain
  const suspicious = joinCandidates.filter(m => {
    const upstreams = m.dependsOn
      .map(dep => modelById.get(dep) ?? modelByName.get(dep.split('.').pop() ?? ''))
      .filter((u): u is ParsedModel => u !== undefined);

    if (upstreams.length < 2) return false;

    const grains = upstreams.map(inferGrain);
    const hasAggregate = grains.includes('aggregate');
    const hasTransaction = grains.includes('transaction');

    // Also flag if the join itself contains date_trunc suggesting cross-grain date join
    const hasCrossGrainDateJoin = DATE_TRUNC.test(m.sql) && /\bJOIN\b/i.test(m.sql);

    return (hasAggregate && hasTransaction) || hasCrossGrainDateJoin;
  });

  if (suspicious.length === 0) return [];

  // Build context for LLM with grain classification included
  const modelContext = suspicious.map(m => {
    const upstreams = m.dependsOn.map(dep => {
      const u = modelById.get(dep) ?? modelByName.get(dep.split('.').pop() ?? '');
      return u ? `${u.name} (grain: ${inferGrain(u)})` : dep.split('.').pop();
    });
    return `
Model: ${m.name}
Upstream deps: ${upstreams.join(', ')}
SQL (first 800 chars):
${m.sql.slice(0, 800)}`;
  }).join('\n---\n');

  const prompt = `These dbt models join upstream tables that may have incompatible data grains.
For each model, analyze the SQL and confirm whether a real grain mismatch exists.
Return JSON:
{
  "findings": [
    {
      "model": "<name>",
      "title": "<concise title>",
      "description": "<explain the grain mismatch>",
      "recommendation": "<how to fix — e.g. add aggregation before the join>",
      "severity": "critical" | "high",
      "confidence": 0.0-1.0
    }
  ]
}
Only include genuine grain mismatches. If uncertain, omit the entry.

${modelContext}`;

  try {
    const response = await llmCall(
      [
        {
          role: 'system',
          content: 'You are a senior data engineer expert in SQL grain analysis and data modeling. Always respond with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      { tier: 'premium', jsonMode: true, maxTokens: 2500 },
    );

    const parsed = parseJsonResponse<{
      findings: Array<{
        model: string;
        title: string;
        description: string;
        recommendation: string;
        severity: 'critical' | 'high';
        confidence: number;
      }>;
    }>(response.text);

    for (const f of parsed.findings) {
      if ((f.confidence ?? 1) < 0.4) continue; // skip low-confidence findings
      const src = suspicious.find(m => m.name === f.model);
      findings.push({
        type: 'grain_join',
        severity: f.severity ?? 'critical',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.model,
        metadata: {
          upstream: src?.dependsOn,
          confidence: f.confidence,
          grainAnalysis: src?.dependsOn.map(dep => {
            const u = modelById.get(dep) ?? modelByName.get(dep.split('.').pop() ?? '');
            return { name: u?.name ?? dep, grain: u ? inferGrain(u) : 'unknown' };
          }),
        },
        cost_usd: response.cost_usd / Math.max(parsed.findings.length, 1),
        llm_reasoning: response.text,
      });
    }
  } catch {
    // Fallback: emit deterministic findings for all suspicious models
    for (const m of suspicious) {
      const grainBreakdown = m.dependsOn.map(dep => {
        const u = modelById.get(dep) ?? modelByName.get(dep.split('.').pop() ?? '');
        return { name: u?.name ?? dep, grain: u ? inferGrain(u) : 'unknown' };
      });
      findings.push({
        type: 'grain_join',
        severity: 'high',
        title: `Possible grain mismatch in ${m.name}`,
        description:
          `"${m.name}" joins upstream models with different data grains: ` +
          grainBreakdown.map(g => `${g.name}(${g.grain})`).join(', '),
        recommendation:
          'Ensure all inputs are aggregated to the same grain before joining. ' +
          'Add a GROUP BY or CTE to align granularity.',
        modelName: m.name,
        metadata: { grainBreakdown },
        cost_usd: 0,
      });
    }
  }

  return findings;
}
