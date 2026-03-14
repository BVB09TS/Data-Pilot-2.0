/**
 * Agent: Duplicate Metrics
 * Detects metrics or KPIs computed multiple times with potentially different logic.
 * Uses LLM to compare SQL patterns and flag diverging definitions.
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
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

  const groupSummary = Array.from(groups.entries())
    .map(([kw, models]) =>
      `Keyword "${kw}":\n${models.map(m => `  - ${m.name}: ${m.sql.slice(0, 300).replace(/\n/g, ' ')}`).join('\n')}`,
    )
    .join('\n\n');

  const prompt = `Review these dbt models that share metric keywords. Identify any that compute the same metric with different logic (potential duplicate metrics).
Return JSON:
{
  "findings": [
    {
      "models": ["<model1>", "<model2>"],
      "metric": "<metric name>",
      "title": "<short title>",
      "description": "<explanation of the divergence>",
      "recommendation": "<how to consolidate>",
      "severity": "high"
    }
  ]
}
If no genuine duplicates exist, return { "findings": [] }.

${groupSummary}`;

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
      });
    }
  } catch {
    // No deterministic fallback for duplicate metrics — requires SQL reasoning
  }

  return findings;
}
