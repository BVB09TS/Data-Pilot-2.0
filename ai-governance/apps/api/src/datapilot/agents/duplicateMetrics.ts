/**
 * Agent: Duplicate Metrics
 * Detects metrics or KPIs computed multiple times with potentially different logic.
 * Uses LLM to compare SQL patterns and flag diverging definitions.
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
import { fingerprintSQL, extractAggregateExpressions } from '../sqlAst.js';
import type { ParsedModel, ParsedProject } from '../parser.js';
import type { AgentFinding } from './types.js';

// Common metric keywords to identify candidate models
const METRIC_KEYWORDS = [
  'revenue', 'gmv', 'orders', 'conversion', 'retention', 'churn',
  'mrr', 'arr', 'ltv', 'cac', 'dau', 'mau', 'sessions', 'transactions',
];

export async function analyzeDuplicateMetrics(project: ParsedProject): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  // Find models whose name or description contains metric keywords
  const metricCandidates = project.models.filter(m => {
    const text = `${m.name} ${m.description}`.toLowerCase();
    return METRIC_KEYWORDS.some(kw => text.includes(kw));
  });

  if (metricCandidates.length < 2) return [];

  // Group by shared keyword
  const groups = new Map<string, ParsedModel[]>();
  for (const kw of METRIC_KEYWORDS) {
    const matches = metricCandidates.filter(m =>
      `${m.name} ${m.description}`.toLowerCase().includes(kw),
    );
    if (matches.length >= 2) groups.set(kw, matches);
  }

  if (groups.size === 0) return [];

  // AST pre-filter: skip models with identical SQL fingerprints (same logic, just aliases differ)
  // Only pass models with at least one aggregate expression to the LLM
  const dedupedCandidates = metricCandidates.filter(m => extractAggregateExpressions(m.sql).length > 0
    || /\b(SUM|COUNT|AVG|MIN|MAX)\s*\(/i.test(m.sql));

  // Build SQL fingerprints — models with identical fingerprints are exact copies, not duplicates
  const fingerprints = new Map(dedupedCandidates.map(m => [m.name, fingerprintSQL(m.sql)]));
  const uniqueByFingerprint = dedupedCandidates.filter((m, i, arr) =>
    arr.findIndex(other => other.name !== m.name && fingerprints.get(other.name) === fingerprints.get(m.name)) === i
  );

  const finalCandidates = uniqueByFingerprint.length >= 2 ? uniqueByFingerprint : metricCandidates;

  // Give LLM the full model data with AST-extracted aggregates highlighted
  const modelData = finalCandidates
    .map(m => {
      const aggExprs = extractAggregateExpressions(m.sql);
      return `Model: ${m.name}${aggExprs.length ? `\nAggregate columns: ${aggExprs.join(', ')}` : ''}\nSQL:\n${m.sql.slice(0, 500)}`;
    })
    .join('\n\n---\n\n');

  const prompt = `You are a senior analytics engineer auditing a dbt project for duplicate metric definitions.

Examine these models and find any cases where the SAME business metric is computed with DIFFERENT logic across multiple models.
Look for: different filters, different denominators, different date ranges, different join conditions.

Return JSON — only include genuine duplicates (do NOT include models that simply reference the same upstream):
{
  "findings": [
    {
      "models": ["<model1>", "<model2>"],
      "metric": "<metric name>",
      "title": "<concise title, e.g. 'Duplicate revenue definition'>",
      "description": "<concrete explanation of HOW the logic differs>",
      "recommendation": "<how to consolidate into a single source of truth>",
      "severity": "high",
      "confidence": 0.0-1.0
    }
  ]
}
If no genuine duplicates exist, return { "findings": [] }.

Models to analyze:
${modelData}`;

  try {
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a senior analytics engineer. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { tier: 'premium', jsonMode: true, maxTokens: 2000 },
    );

    const parsed = parseJsonResponse<{ findings: Array<{ models: string[]; metric: string; title: string; description: string; recommendation: string; severity: 'high' }> }>(response.text);

    for (const f of parsed.findings) {
      const confidence = typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.8;
      if (confidence < 0.4) continue; // skip very low confidence findings
      findings.push({
        type: 'duplicate_metric',
        severity: 'high',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.models[0],
        metadata: { models: f.models, metric: f.metric },
        cost_usd: response.cost_usd / Math.max(parsed.findings.length, 1),
        llm_reasoning: response.text,
        confidence,
      });
    }
  } catch {
    // No deterministic fallback for duplicate metrics — requires SQL reasoning
  }

  return findings;
}
