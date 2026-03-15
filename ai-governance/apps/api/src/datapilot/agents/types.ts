/**
 * Shared types for all DataPilot analysis agents.
 */

export type FindingType =
  | 'dead_model'
  | 'orphan'
  | 'broken_ref'
  | 'duplicate_metric'
  | 'grain_join'
  | 'logic_drift'
  | 'missing_tests'
  | 'deprecated_source';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AgentFinding {
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  recommendation?: string;
  modelName?: string;
  metadata: Record<string, unknown>;
  cost_usd: number;
  llm_reasoning?: string;
  /**
   * Confidence score (0.0 – 1.0).
   * 1.0 = deterministic finding (graph-based, no LLM).
   * <1.0 = LLM-assisted; reflects model's self-reported confidence.
   */
  confidence?: number;
}
