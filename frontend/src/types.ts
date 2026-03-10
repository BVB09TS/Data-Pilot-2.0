export interface Column {
  name: string
  description?: string
  tests?: string[]
  data_type?: string
}

export interface Finding {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  model: string
  evidence: string
  recommendation?: string
}

export interface Model {
  name: string
  layer: string
  description: string
  tags: string[]
  columns: Column[]
  q30: number | null
  q90: number | null
  has_problem: boolean
  findings_count: number
  findings: Finding[]
}

export interface ReportData {
  findings: Finding[]
  by_severity: Record<string, number>
  by_type: Record<string, number>
  total_findings: number
  suggestions?: unknown[]
  metadata?: { project_name?: string; run_at?: string; [k: string]: unknown }
}

export interface IntegrationsResponse {
  available: string[]
  configured: string[]
}

export type ModelsData = Record<string, Model[]>

/** All top-level tab identifiers */
export type Tab = 'home' | 'overview' | 'lineage' | 'findings' | 'models' | 'integrations' | 'settings'

export type Theme = 'light' | 'dark'

export const LAYER_ORDER = ['raw', 'source', 'core', 'analytics'] as const

export type Layer = (typeof LAYER_ORDER)[number]

export const LAYER_COLORS: Record<string, string> = {
  raw:       '#1d6de0',
  source:    '#06b6d4',
  core:      '#0fbc88',
  analytics: '#f2994a',
}
