/**
 * Agent: Orphaned Models
 * Detects models that have no upstream sources AND no downstream consumers —
 * completely disconnected from the lineage graph.
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
import type { ParsedProject } from '../parser.js';
import type { AgentFinding } from './types.js';

export async function analyzeOrphans(project: ParsedProject): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  // Models that have no upstream deps
  const hasUpstream = new Set(
    project.models.filter(m => m.dependsOn.length > 0).map(m => m.name),
  );

  // Models that are depended upon by others
  const hasDownstream = new Set<string>();
  for (const m of project.models) {
    for (const dep of m.dependsOn) {
      hasDownstream.add(dep.split('.').pop() ?? dep);
    }
  }

  const orphans = project.models.filter(
    m => !hasUpstream.has(m.name) && !hasDownstream.has(m.name),
  );

  if (orphans.length === 0) return [];

  const prompt = `These dbt models are completely isolated — no upstream dependencies and no downstream consumers.
Return JSON:
{
  "findings": [
    {
      "model": "<name>",
      "title": "<short title>",
      "description": "<explanation>",
      "recommendation": "<action>",
      "severity": "medium"
    }
  ]
}

Orphaned models:
${orphans.map(m => `- ${m.name}: ${m.description || 'no description'}`).join('\n')}`;

  try {
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a senior data engineer reviewing dbt lineage. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { tier: 'standard', jsonMode: true, maxTokens: 1200 },
    );

    const parsed = parseJsonResponse<{ findings: Array<{ model: string; title: string; description: string; recommendation: string; severity: 'medium' }> }>(response.text);

    for (const f of parsed.findings) {
      findings.push({
        type: 'orphan',
        severity: 'medium',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.model,
        metadata: { filePath: orphans.find(m => m.name === f.model)?.filePath },
        cost_usd: response.cost_usd / parsed.findings.length,
        llm_reasoning: response.text,
        confidence: 1.0, // deterministic — graph-based detection
      });
    }
  } catch {
    for (const m of orphans) {
      findings.push({
        type: 'orphan',
        severity: 'medium',
        title: `Orphaned model: ${m.name}`,
        description: `"${m.name}" has no upstream dependencies and no downstream consumers.`,
        recommendation: 'Connect this model to the lineage graph or remove it.',
        modelName: m.name,
        metadata: { filePath: m.filePath },
        cost_usd: 0,
        confidence: 1.0, // deterministic
      });
    }
  }

  return findings;
}
