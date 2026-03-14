/**
 * Agent: Wrong Grain Joins
 * Detects joins between models operating at incompatible data grains
 * (e.g. joining a daily aggregate to a transaction-level table without aggregation).
 */

import { llmCall, parseJsonResponse } from '../llmGateway.js';
import type { ParsedProject } from '../parser.js';
import type { AgentFinding } from './types.js';

// Keywords suggesting aggregated / summary grain
const AGGREGATE_KEYWORDS = ['daily', 'weekly', 'monthly', 'summary', 'agg', 'rollup', 'snapshot'];
// Keywords suggesting transaction / event grain
const TRANSACTION_KEYWORDS = ['event', 'transaction', 'order', 'click', 'log', 'raw', 'fact'];

export async function analyzeGrainJoins(project: ParsedProject): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  // Models that join multiple upstream sources
  const joinCandidates = project.models.filter(m => {
    const upstreamCount = m.dependsOn.length;
    const hasJoin = m.sql.toLowerCase().includes(' join ');
    return upstreamCount >= 2 && hasJoin;
  });

  if (joinCandidates.length === 0) return [];

  // For each join model, check if upstreams have mismatched grain signals
  const suspicious = joinCandidates.filter(m => {
    const upstreamNames = m.dependsOn.map(d => d.split('.').pop()?.toLowerCase() ?? '');
    const hasAgg = upstreamNames.some(n => AGGREGATE_KEYWORDS.some(kw => n.includes(kw)));
    const hasTxn = upstreamNames.some(n => TRANSACTION_KEYWORDS.some(kw => n.includes(kw)));
    return hasAgg && hasTxn;
  });

  if (suspicious.length === 0) return [];

  const prompt = `These dbt models join tables that may operate at different data grains (e.g. daily summary joined to raw events).
Analyze each join and identify grain mismatches.
Return JSON:
{
  "findings": [
    {
      "model": "<name>",
      "title": "<short title>",
      "description": "<grain mismatch explanation>",
      "recommendation": "<how to fix>",
      "severity": "critical" | "high"
    }
  ]
}
If no genuine grain issue, return { "findings": [] }.

Models to review:
${suspicious.map(m => `
Model: ${m.name}
Upstream: ${m.dependsOn.join(', ')}
SQL (excerpt):
${m.sql.slice(0, 600)}
`).join('\n---\n')}`;

  try {
    const response = await llmCall(
      [
        { role: 'system', content: 'You are a senior data engineer expert in SQL grain analysis. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { tier: 'premium', jsonMode: true, maxTokens: 2000 },
    );

    const parsed = parseJsonResponse<{ findings: Array<{ model: string; title: string; description: string; recommendation: string; severity: 'critical' | 'high' }> }>(response.text);

    for (const f of parsed.findings) {
      findings.push({
        type: 'grain_join',
        severity: f.severity ?? 'critical',
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        modelName: f.model,
        metadata: { upstream: suspicious.find(m => m.name === f.model)?.dependsOn },
        cost_usd: response.cost_usd / Math.max(parsed.findings.length, 1),
        llm_reasoning: response.text,
      });
    }
  } catch {
    for (const m of suspicious) {
      findings.push({
        type: 'grain_join',
        severity: 'critical',
        title: `Potential grain mismatch in ${m.name}`,
        description: `"${m.name}" joins tables that may operate at different data grains.`,
        recommendation: 'Review join keys and ensure all inputs are aggregated to the same grain before joining.',
        modelName: m.name,
        metadata: { upstream: m.dependsOn },
        cost_usd: 0,
      });
    }
  }

  return findings;
}
