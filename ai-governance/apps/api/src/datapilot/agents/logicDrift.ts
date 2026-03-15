/**
 * Agent: Logic Drift
 * Detects business logic in downstream models that diverges from
 * how the same concept is defined in upstream/source models.
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
import type { ParsedProject } from '../parser.js';
import type { AgentFinding } from './types.js';

export async function analyzeLogicDrift(project: ParsedProject): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  // Find models that redefine fields already defined in their upstream models
  // Heuristic: same column name appears in both model SQL (calculated differently)
  const candidates = project.models.filter(m => {
    return m.dependsOn.length > 0 && m.sql.length > 100 && m.columns.length > 0;
  });

  if (candidates.length < 2) return [];

  // Take only the first 8 candidates to keep prompt size manageable
  const sample = candidates.slice(0, 8);

  const prompt = `You are a senior analytics engineer auditing a dbt project for logic drift.

Logic drift = a downstream model recomputes a business concept (column/metric) differently from how
an upstream model already defined it. This creates inconsistency and confusion.

Examine these models. Find any CONCRETE cases where a column appears in both an upstream and downstream
model but with different calculation logic. You must quote the differing SQL fragments.

Return JSON:
{
  "findings": [
    {
      "model": "<downstream model name>",
      "column": "<column name>",
      "upstream_model": "<upstream model where column was originally defined>",
      "title": "<concise title, e.g. 'revenue redefined in analytics_orders'>",
      "description": "<concrete diff: quote the upstream formula vs downstream formula>",
      "recommendation": "<how to fix — e.g. ref upstream column directly>",
      "severity": "medium",
      "confidence": 0.0-1.0
    }
  ]
}
If no genuine drift found, return { "findings": [] }.

Models:
${sample.map(m => `
Model: ${m.name}
Depends on: ${m.dependsOn.join(', ') || 'none'}
Columns: ${m.columns.map(c => c.name).join(', ') || 'not documented'}
SQL:
${m.sql.slice(0, 500)}
`).join('\n---\n')}`;

  try {
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a senior analytics engineer. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { tier: 'premium', jsonMode: true, maxTokens: 2500 },
    );

    const parsed = parseJsonResponse<{
      findings: Array<{
        model: string;
        column: string;
        upstream_model?: string;
        title: string;
        description: string;
        recommendation: string;
        severity: 'medium';
        confidence: number;
      }>;
    }>(response.text);

    for (const f of parsed.findings) {
      const confidence = typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.75;
      if (confidence < 0.4) continue;
      findings.push({
        type: 'logic_drift',
        severity: 'medium',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.model,
        metadata: { column: f.column, upstream_model: f.upstream_model },
        cost_usd: response.cost_usd / Math.max(parsed.findings.length, 1),
        llm_reasoning: response.text,
        confidence,
      });
    }
  } catch {
    // Logic drift requires LLM reasoning — skip deterministic fallback
  }

  return findings;
}
