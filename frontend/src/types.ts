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
  cost_usd?: number
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

export type ModelsData = Record<string, Model[]>

export type Tab = 'overview' | 'lineage' | 'findings' | 'models'

export type Theme = 'light' | 'dark'

export const LAYER_ORDER = ['raw', 'source', 'core', 'analytics'] as const

export type Layer = (typeof LAYER_ORDER)[number]

export const LAYER_COLORS: Record<string, string> = {
  raw:       '#1d6de0',
  source:    '#06b6d4',
  core:      '#0fbc88',
  analytics: '#f2994a',
}
