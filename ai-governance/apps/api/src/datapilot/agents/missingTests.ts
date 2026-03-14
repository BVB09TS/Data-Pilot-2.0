/**
 * Agent: Missing Tests
 * Detects models that have no dbt tests defined (not_null, unique, etc.)
 * or are missing tests on critical columns (id, key, amount).
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
import type { ParsedProject } from '../parser.js';
import type { AgentFinding } from './types.js';

// Columns that should always have not_null + unique tests
const CRITICAL_COLUMN_PATTERNS = [/^id$/, /_id$/, /^key$/, /_key$/, /^pk$/, /^surrogate/];

export async function analyzeMissingTests(project: ParsedProject): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  // Models with no tests at all (config.tests is empty or absent)
  const noTestModels = project.models.filter(m => {
    const tests = (m.config?.['tests'] as unknown[]) ?? [];
    return tests.length === 0;
  });

  // Models with critical columns but no test coverage on them
  const missingCriticalTests = project.models
    .filter(m => !noTestModels.includes(m))
    .filter(m => {
      return m.columns.some(col =>
        CRITICAL_COLUMN_PATTERNS.some(pat => pat.test(col.name.toLowerCase())),
      );
    });

  const allCandidates = [...noTestModels, ...missingCriticalTests];
  if (allCandidates.length === 0) return [];

  const prompt = `These dbt models are missing test coverage. Identify which ones are highest risk and need immediate tests.
Return JSON:
{
  "findings": [
    {
      "model": "<name>",
      "title": "<short title>",
      "description": "<what tests are missing and why it matters>",
      "recommendation": "<which specific tests to add>",
      "severity": "medium" | "high"
    }
  ]
}

Models without any tests:
${noTestModels.map(m => `- ${m.name} (${m.columns.length} columns)`).join('\n')}

Models missing tests on critical columns:
${missingCriticalTests.map(m => `- ${m.name}: critical columns = ${m.columns.filter(c => CRITICAL_COLUMN_PATTERNS.some(p => p.test(c.name.toLowerCase()))).map(c => c.name).join(', ')}`).join('\n')}`;

  try {
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a dbt testing expert. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { tier: 'free', jsonMode: true, maxTokens: 1500 },
    );

    const parsed = parseJsonResponse<{ findings: Array<{ model: string; title: string; description: string; recommendation: string; severity: 'medium' | 'high' }> }>(response.text);

    for (const f of parsed.findings) {
      findings.push({
        type: 'missing_tests',
        severity: f.severity ?? 'medium',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.model,
        metadata: {},
        cost_usd: response.cost_usd / Math.max(parsed.findings.length, 1),
        llm_reasoning: response.text,
      });
    }
  } catch {
    for (const m of noTestModels.slice(0, 10)) {
      findings.push({
        type: 'missing_tests',
        severity: 'medium',
        title: `No tests defined for ${m.name}`,
        description: `Model "${m.name}" has no dbt tests. Data quality issues will go undetected.`,
        recommendation: 'Add at minimum not_null and unique tests on primary key columns.',
        modelName: m.name,
        metadata: {},
        cost_usd: 0,
      });
    }
  }

  return findings;
}
