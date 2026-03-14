/**
 * Agent: Deprecated Sources
 * Detects models that depend on sources or upstream models marked as deprecated
 * via tags, meta fields, or naming conventions.
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
import type { ParsedProject } from '../parser.js';
import type { AgentFinding } from './types.js';

const DEPRECATION_SIGNALS = ['deprecated', 'legacy', 'old_', '_old', 'do_not_use', 'archive'];

function isDeprecated(name: string, tags: string[], meta: Record<string, unknown>): boolean {
  const nameMatch = DEPRECATION_SIGNALS.some(s => name.toLowerCase().includes(s));
  const tagMatch = tags.some(t => DEPRECATION_SIGNALS.some(s => t.toLowerCase().includes(s)));
  const metaMatch = meta['deprecated'] === true || meta['status'] === 'deprecated';
  return nameMatch || tagMatch || metaMatch;
}

export async function analyzeDeprecatedSources(project: ParsedProject): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  // Find all deprecated nodes (models + sources)
  const deprecatedNames = new Set<string>();

  for (const m of project.models) {
    if (isDeprecated(m.name, m.tags, m.meta)) deprecatedNames.add(m.name);
  }
  for (const s of project.sources) {
    if (isDeprecated(s.name, s.tags, s.meta)) {
      deprecatedNames.add(s.name);
      deprecatedNames.add(`${s.sourceName}.${s.name}`);
    }
  }

  if (deprecatedNames.size === 0) return [];

  // Find models depending on deprecated nodes
  type DepChain = { model: string; deprecatedDep: string; filePath: string };
  const chains: DepChain[] = [];

  for (const m of project.models) {
    if (deprecatedNames.has(m.name)) continue; // skip deprecated models themselves
    for (const dep of m.dependsOn) {
      const depName = dep.split('.').pop() ?? dep;
      if (deprecatedNames.has(depName) || deprecatedNames.has(dep)) {
        chains.push({ model: m.name, deprecatedDep: depName, filePath: m.filePath });
      }
    }
  }

  if (chains.length === 0) return [];

  const prompt = `These dbt models depend on deprecated sources or models. This is a data quality risk.
Return JSON:
{
  "findings": [
    {
      "model": "<model>",
      "deprecated_dep": "<deprecated dependency>",
      "title": "<short title>",
      "description": "<risk explanation>",
      "recommendation": "<migration path>",
      "severity": "low" | "medium"
    }
  ]
}

Deprecated dependency chains:
${chains.map(c => `- ${c.model} → ${c.deprecatedDep}`).join('\n')}`;

  try {
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a data engineer reviewing deprecated lineage chains. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { tier: 'free', jsonMode: true, maxTokens: 1200 },
    );

    const parsed = parseJsonResponse<{ findings: Array<{ model: string; deprecated_dep: string; title: string; description: string; recommendation: string; severity: 'low' | 'medium' }> }>(response.text);

    for (const f of parsed.findings) {
      findings.push({
        type: 'deprecated_source',
        severity: f.severity ?? 'low',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.model,
        metadata: { deprecatedDep: f.deprecated_dep },
        cost_usd: response.cost_usd / Math.max(parsed.findings.length, 1),
        llm_reasoning: response.text,
      });
    }
  } catch {
    for (const c of chains) {
      findings.push({
        type: 'deprecated_source',
        severity: 'low',
        title: `${c.model} depends on deprecated: ${c.deprecatedDep}`,
        description: `"${c.model}" depends on "${c.deprecatedDep}" which is marked deprecated.`,
        recommendation: 'Migrate to a supported replacement before the deprecated source is removed.',
        modelName: c.model,
        metadata: { deprecatedDep: c.deprecatedDep, filePath: c.filePath },
        cost_usd: 0,
      });
    }
  }

  return findings;
}
