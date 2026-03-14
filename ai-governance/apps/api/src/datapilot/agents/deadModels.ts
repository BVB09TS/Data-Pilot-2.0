/**
 * Agent: Dead Models
 * Detects models with zero downstream consumers AND no recent query activity.
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
import type { ParsedModel, ParsedProject } from '../parser.js';
import type { AgentFinding } from './types.js';

export async function analyzeDeadModels(
  project: ParsedProject,
  queryHistory?: Record<string, number>, // model_name → query_count_90d
): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  // Build downstream map: for each model, who depends on it?
  const downstreamMap = new Map<string, string[]>();
  for (const model of project.models) {
    for (const dep of model.dependsOn) {
      // dep is a unique_id; map to name
      const depName = dep.split('.').pop() ?? dep;
      const existing = downstreamMap.get(depName) ?? [];
      existing.push(model.name);
      downstreamMap.set(depName, existing);
    }
  }

  // Find models with no downstream consumers
  const candidates: ParsedModel[] = project.models.filter(m => {
    const downstream = downstreamMap.get(m.name) ?? [];
    const queries = queryHistory?.[m.name] ?? 0;
    return downstream.length === 0 && queries === 0;
  });

  if (candidates.length === 0) return [];

  // LLM reasoning for context
  const prompt = `You are a dbt project auditor. The following models have zero downstream consumers and zero recent queries.
Analyze each and return JSON:
{
  "findings": [
    {
      "model": "<name>",
      "title": "<short title>",
      "description": "<why this is a problem>",
      "recommendation": "<what to do>",
      "severity": "high" | "medium"
    }
  ]
}

Models:
${candidates.map(m => `- ${m.name}: ${m.description || 'no description'} (file: ${m.filePath})`).join('\n')}`;

  try {
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a senior data engineer reviewing a dbt project for quality issues. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { tier: 'free', jsonMode: true, maxTokens: 1500 },
    );

    const parsed = parseJsonResponse<{ findings: Array<{ model: string; title: string; description: string; recommendation: string; severity: 'high' | 'medium' }> }>(response.text);

    for (const f of parsed.findings) {
      const model = candidates.find(m => m.name === f.model);
      findings.push({
        type: 'dead_model',
        severity: f.severity ?? 'high',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.model,
        metadata: { filePath: model?.filePath, tags: model?.tags },
        cost_usd: response.cost_usd / parsed.findings.length,
        llm_reasoning: response.text,
      });
    }
  } catch {
    // Fallback: deterministic finding without LLM
    for (const m of candidates) {
      findings.push({
        type: 'dead_model',
        severity: 'high',
        title: `Dead model: ${m.name}`,
        description: `Model "${m.name}" has no downstream consumers and no recent query activity.`,
        recommendation: 'Consider deprecating or removing this model, or document why it exists.',
        modelName: m.name,
        metadata: { filePath: m.filePath, tags: m.tags },
        cost_usd: 0,
      });
    }
  }

  return findings;
}
