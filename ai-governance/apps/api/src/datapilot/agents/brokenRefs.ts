/**
 * Agent: Broken References
 * Detects ref() calls pointing to models that don't exist in the project.
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
import type { ParsedProject } from '../parser.js';
import type { AgentFinding } from './types.js';

export async function analyzeBrokenRefs(project: ParsedProject): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  // All known model names + source names
  const knownNames = new Set([
    ...project.models.map(m => m.name),
    ...project.sources.map(s => s.name),
    ...project.sources.map(s => `${s.sourceName}.${s.name}`),
  ]);

  type BrokenRef = { model: string; missingDep: string; filePath: string };
  const brokenRefs: BrokenRef[] = [];

  for (const model of project.models) {
    for (const dep of model.dependsOn) {
      const depName = dep.split('.').pop() ?? dep;
      if (!knownNames.has(depName) && !knownNames.has(dep)) {
        brokenRefs.push({ model: model.name, missingDep: depName, filePath: model.filePath });
      }
    }
  }

  if (brokenRefs.length === 0) return [];

  const prompt = `These dbt models reference models or sources that do not exist in the project.
This will cause dbt compilation to fail.
Return JSON:
{
  "findings": [
    {
      "model": "<model with broken ref>",
      "missing": "<missing ref name>",
      "title": "<short title>",
      "description": "<explanation>",
      "recommendation": "<how to fix>"
    }
  ]
}

Broken references:
${brokenRefs.map(r => `- ${r.model} → ${r.missingDep} (file: ${r.filePath})`).join('\n')}`;

  try {
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a dbt expert. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { tier: 'free', jsonMode: true, maxTokens: 1200 },
    );

    const parsed = parseJsonResponse<{ findings: Array<{ model: string; missing: string; title: string; description: string; recommendation: string }> }>(response.text);

    for (const f of parsed.findings) {
      findings.push({
        type: 'broken_ref',
        severity: 'critical',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.model,
        metadata: { missingDep: f.missing },
        cost_usd: response.cost_usd / parsed.findings.length,
        llm_reasoning: response.text,
      });
    }
  } catch {
    for (const r of brokenRefs) {
      findings.push({
        type: 'broken_ref',
        severity: 'critical',
        title: `Broken ref in ${r.model}: "${r.missingDep}" not found`,
        description: `Model "${r.model}" references "${r.missingDep}" which does not exist in the project.`,
        recommendation: 'Fix or remove the ref() call. Run "dbt parse" to verify.',
        modelName: r.model,
        metadata: { missingDep: r.missingDep, filePath: r.filePath },
        cost_usd: 0,
      });
    }
  }

  return findings;
}
