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

  const prompt = `Review these dbt models for logic drift — cases where a downstream model recomputes a column
that was already defined in an upstream model, but with different logic.

Return JSON:
{
  "findings": [
    {
      "model": "<downstream model>",
      "column": "<column name>",
      "title": "<short title>",
      "description": "<description of the divergence>",
      "recommendation": "<how to fix>",
      "severity": "medium"
    }
  ]
}
If no drift found, return { "findings": [] }.

Models:
${sample.map(m => `
Model: ${m.name}
Columns: ${m.columns.map(c => c.name).join(', ')}
SQL (excerpt): ${m.sql.slice(0, 400)}
`).join('\n---\n')}`;

  try {
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a senior analytics engineer. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { tier: 'premium', jsonMode: true, maxTokens: 2000 },
    );

    const parsed = parseJsonResponse<{ findings: Array<{ model: string; column: string; title: string; description: string; recommendation: string; severity: 'medium' }> }>(response.text);

    for (const f of parsed.findings) {
      findings.push({
        type: 'logic_drift',
        severity: 'medium',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.model,
        metadata: { column: f.column },
        cost_usd: response.cost_usd / Math.max(parsed.findings.length, 1),
        llm_reasoning: response.text,
      });
    }
  } catch {
    // Logic drift requires LLM reasoning — skip deterministic fallback
  }

  return findings;
}
