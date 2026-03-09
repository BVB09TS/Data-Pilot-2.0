import React, { useEffect, useMemo, useState } from 'react'
import type { Column, Finding, Model, ModelsData } from '../../types'
import { LAYER_ORDER, LAYER_COLORS } from '../../types'

/* ══════════════════════════════════════════════════
   SQL TOKENIZER
══════════════════════════════════════════════════ */

type TokenKind = 'keyword' | 'function' | 'jinja' | 'comment' | 'string' | 'number' | 'plain'
interface Token { kind: TokenKind; text: string }

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS',
  'FULL', 'ON', 'GROUP', 'ORDER', 'BY', 'HAVING', 'WITH', 'AS', 'AND', 'OR',
  'NOT', 'IN', 'IS', 'NULL', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'UNION', 'ALL', 'LIMIT', 'OFFSET', 'BETWEEN', 'LIKE', 'EXISTS', 'OVER',
  'PARTITION', 'USING', 'TRUE', 'FALSE', 'CREATE', 'VIEW', 'TABLE', 'REPLACE',
  'EXTRACT', 'FILTER', 'QUALIFY', 'DATE', 'TIMESTAMP', 'INTERVAL', 'EXCEPT',
])

const SQL_FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROW_NUMBER', 'RANK', 'DENSE_RANK',
  'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'TRIM', 'LOWER', 'UPPER',
  'SUBSTRING', 'CONCAT', 'LENGTH', 'ROUND', 'FLOOR', 'CEIL', 'ABS',
  'COALESCE', 'NULLIF', 'CAST', 'CONVERT', 'DATE_TRUNC', 'DATE_DIFF',
  'STRFTIME', 'IFNULL', 'NVL', 'IFF', 'DECODE', 'IF', 'GREATEST', 'LEAST',
  'ARRAY_AGG', 'STRING_AGG', 'LISTAGG',
])

const TOKEN_CLS: Record<TokenKind, string> = {
  keyword:  'text-blue-600  dark:text-blue-400  font-semibold',
  function: 'text-teal-600  dark:text-teal-400',
  jinja:    'text-purple-600 dark:text-purple-400',
  comment:  'text-slate-400  dark:text-slate-500  italic',
  string:   'text-orange-600 dark:text-orange-400',
  number:   'text-green-600  dark:text-green-400',
  plain:    '',
}

function tokenize(line: string): Token[] {
  const tokens: Token[] = []
  // Order matters: jinja > comment > string > identifier > number > rest
  const re = /(\{\{[^}]*\}\}|\{%-?[^%]*-?%\})|(--[^\n]*)|(\'[^\']*\'|\"[^\"]*\")|([A-Za-z_]\w*)|(\b\d+\.?\d*\b)|([\s\S])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if      (m[1]) tokens.push({ kind: 'jinja',   text: m[1] })
    else if (m[2]) tokens.push({ kind: 'comment', text: m[2] })
    else if (m[3]) tokens.push({ kind: 'string',  text: m[3] })
    else if (m[4]) {
      const up = m[4].toUpperCase()
      if      (SQL_KEYWORDS.has(up))  tokens.push({ kind: 'keyword',  text: m[4] })
      else if (SQL_FUNCTIONS.has(up)) tokens.push({ kind: 'function', text: m[4] })
      else                            tokens.push({ kind: 'plain',    text: m[4] })
    }
    else if (m[5]) tokens.push({ kind: 'number', text: m[5] })
    else           tokens.push({ kind: 'plain',  text: m[6] })
  }
  return tokens
}

/* ══════════════════════════════════════════════════
   SQL VIEWER
══════════════════════════════════════════════════ */

function SqlViewer({ sql }: { sql: string }) {
  const lines = sql.split('\n')

  return (
    <div className="overflow-auto h-full">
      <div className="font-mono text-xs leading-6 p-4 min-w-max select-text">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start hover:bg-black/[0.02] dark:hover:bg-white/[0.02] -mx-4 px-4 py-px">
            <span className="select-none text-right w-8 shrink-0 mr-5 text-slate-300 dark:text-slate-700 tabular-nums">
              {i + 1}
            </span>
            <span>
              {tokenize(line).map((tok, j) => (
                <span key={j} className={TOKEN_CLS[tok.kind]}>{tok.text}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════ */

const SEV_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-400',
  medium:   'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400',
  low:      'bg-green-100 text-green-700 dark:bg-green-950/70 dark:text-green-400',
}

const TYPE_LABELS: Record<string, string> = {
  dead_model:        'Dead Model',
  orphaned_model:    'Orphaned Model',
  broken_lineage:    'Broken Lineage',
  duplicate_metric:  'Duplicate Metric',
  missing_tests:     'Missing Tests',
  logic_drift:       'Logic Drift',
  deprecated_source: 'Deprecated Source',
  wrong_grain_join:  'Wrong Grain Join',
}

/* ══════════════════════════════════════════════════
   LEFT PANE — MODEL LIST
══════════════════════════════════════════════════ */

interface ModelListProps {
  modelsData:     ModelsData
  selectedName:   string | null
  onSelectModel:  (name: string) => void
}

function ModelList({ modelsData, selectedName, onSelectModel }: ModelListProps) {
  const [search,     setSearch]     = useState('')
  const [layerFilter, setLayerFilter] = useState<string | null>(null)
  const [onlyIssues, setOnlyIssues] = useState(false)

  const layers = LAYER_ORDER.filter(l => !!modelsData[l]?.length)

  const filteredData = useMemo(() => {
    const result: ModelsData = {}
    const lc = search.toLowerCase()
    for (const layer of layers) {
      const models = (modelsData[layer] ?? []).filter(m => {
        const matchLayer  = !layerFilter || m.layer === layerFilter
        const matchSearch = !lc || m.name.toLowerCase().includes(lc) ||
          (m.description || '').toLowerCase().includes(lc)
        const matchIssue  = !onlyIssues || m.has_problem
        return matchLayer && matchSearch && matchIssue
      })
      if (models.length) result[layer] = models
    }
    return result
  }, [modelsData, search, layerFilter, onlyIssues, layers])

  const totalShown  = Object.values(filteredData).flat().length
  const totalModels = Object.values(modelsData).flat().length

  return (
    <div className="w-64 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800
      bg-white dark:bg-slate-900">

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
          bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <SearchIcon className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search models…"
            className="flex-1 min-w-0 bg-transparent text-xs text-slate-700
              dark:text-slate-300 placeholder:text-slate-400 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <XIcon />
            </button>
          )}
        </div>

        {/* Issues toggle */}
        <button
          onClick={() => setOnlyIssues(v => !v)}
          className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${onlyIssues
              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900'
              : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
        >
          <WarnIcon />
          {onlyIssues ? 'Issues only' : 'Show issues only'}
        </button>
      </div>

      {/* Layer chips */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setLayerFilter(null)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors
            ${!layerFilter
              ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
              : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
        >
          All
        </button>
        {layers.map(l => (
          <button
            key={l}
            onClick={() => setLayerFilter(f => f === l ? null : l)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors
              ${layerFilter === l ? 'text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
            style={layerFilter === l ? { backgroundColor: LAYER_COLORS[l] } : undefined}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Model list */}
      <div className="flex-1 overflow-y-auto py-1">
        {Object.entries(filteredData).length === 0
          ? <p className="px-4 py-4 text-xs text-slate-400 dark:text-slate-600 italic">No models match</p>
          : Object.entries(filteredData).map(([layer, models]) => (
            <div key={layer}>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: LAYER_COLORS[layer] ?? '#64748b' }} />
                <span className="text-xs font-semibold uppercase tracking-widest
                  text-slate-400 dark:text-slate-600">
                  {layer}
                </span>
                <span className="text-xs font-mono text-slate-300 dark:text-slate-700">
                  {models.length}
                </span>
              </div>
              {models.map(m => (
                <button
                  key={m.name}
                  onClick={() => onSelectModel(m.name)}
                  title={m.description || m.name}
                  className={`flex items-center gap-2 w-full pl-7 pr-3 py-1.5 text-left transition-colors
                    ${selectedName === m.name
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                >
                  <span className="flex-1 font-mono text-xs truncate">{m.name}</span>
                  {m.findings_count > 0 && (
                    <span className="text-[10px] text-amber-500 dark:text-amber-400 shrink-0">
                      ⚠ {m.findings_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))
        }
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
        <p className="text-xs text-slate-400 dark:text-slate-600">
          {totalShown === totalModels
            ? `${totalModels} models`
            : `${totalShown} of ${totalModels}`}
        </p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   RIGHT PANE — MODEL DETAIL
══════════════════════════════════════════════════ */

type DetailTab = 'overview' | 'sql' | 'columns' | 'findings'

interface LineageData { upstream: string[]; downstream: string[] }

interface ModelDetailProps { model: Model }

function ModelDetail({ model }: ModelDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [sql,       setSql]       = useState<string | null>(null)
  const [sqlLoading, setSqlLoading] = useState(false)
  const [lineage,   setLineage]   = useState<LineageData | null>(null)

  // Reset sub-tab when model changes
  useEffect(() => {
    setActiveTab('overview')
    setSql(null)
    setLineage(null)
  }, [model.name])

  // Lazy-fetch SQL when SQL tab is active
  useEffect(() => {
    if (activeTab !== 'sql' || sql !== null) return
    setSqlLoading(true)
    fetch(`/api/models/${encodeURIComponent(model.name)}/sql`)
      .then(r => r.json())
      .then((d: { sql: string }) => { setSql(d.sql ?? '-- not found'); setSqlLoading(false) })
      .catch(() => { setSql('-- failed to load SQL'); setSqlLoading(false) })
  }, [activeTab, model.name, sql])

  // Lazy-fetch lineage when Lineage tab is active
  useEffect(() => {
    if (activeTab !== 'columns' || lineage !== null) return
    fetch(`/api/models/${encodeURIComponent(model.name)}/lineage`)
      .then(r => r.json())
      .then((d: LineageData) => setLineage(d))
      .catch(() => setLineage({ upstream: [], downstream: [] }))
  }, [activeTab, model.name, lineage])

  const color = LAYER_COLORS[model.layer] ?? '#64748b'

  const DETAIL_TABS: { id: DetailTab; label: string; count?: number }[] = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'sql',       label: 'SQL'       },
    { id: 'columns',   label: 'Columns',  count: model.columns.length },
    { id: 'findings',  label: 'Findings', count: model.findings.length || undefined },
  ]

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white dark:bg-slate-900">

      {/* Model header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
          <div className="min-w-0 flex-1">
            <h2 className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {model.name}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: color + '20', color }}>
                {model.layer}
              </span>
              {model.tags.map(tag => (
                <span key={tag} className="text-xs px-1.5 py-0.5 rounded
                  bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {tag}
                </span>
              ))}
              {model.has_problem && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">⚠ Has issues</span>
              )}
            </div>
          </div>
        </div>
        {model.description && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed ml-4">
            {model.description}
          </p>
        )}
      </div>

      {/* Sub-tab nav */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
        {DETAIL_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
              ${activeTab === t.id
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800'
              }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={`text-[10px] font-semibold px-1 py-0.5 rounded
                ${t.id === 'findings'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && <OverviewPane model={model} />}
        {activeTab === 'sql' && (
          sqlLoading
            ? <CenterMsg>Loading SQL…</CenterMsg>
            : <SqlViewer sql={sql ?? ''} />
        )}
        {activeTab === 'columns' && <ColumnsPane columns={model.columns} />}
        {activeTab === 'findings' && <FindingsPane findings={model.findings} />}
      </div>
    </div>
  )
}

/* ─── Overview pane ─── */

function OverviewPane({ model }: { model: Model }) {
  return (
    <div className="overflow-auto h-full p-6 space-y-5">
      {/* Query stats */}
      {(model.q30 != null || model.q90 != null) && (
        <div>
          <SectionTitle>Query Activity</SectionTitle>
          <div className="flex gap-3">
            {model.q30 != null && (
              <StatTile label="30-day queries" value={model.q30.toLocaleString()} />
            )}
            {model.q90 != null && (
              <StatTile
                label="90-day queries"
                value={model.q90.toLocaleString()}
                warn={model.q90 === 0}
              />
            )}
          </div>
          {model.q90 === 0 && (
            <p className="mt-2 text-xs text-red-500 dark:text-red-400">
              Zero queries in 90 days — this model may be unused.
            </p>
          )}
        </div>
      )}

      {/* Description */}
      {model.description && (
        <div>
          <SectionTitle>Description</SectionTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {model.description}
          </p>
        </div>
      )}

      {/* Tags */}
      {model.tags.length > 0 && (
        <div>
          <SectionTitle>Tags</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {model.tags.map(tag => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full
                bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div>
        <SectionTitle>Summary</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Columns"  value={String(model.columns.length)} />
          <StatTile label="Findings" value={String(model.findings_count)} warn={model.findings_count > 0} />
        </div>
      </div>
    </div>
  )
}

/* ─── Columns pane ─── */

function ColumnsPane({ columns }: { columns: Column[] }) {
  if (!columns.length) {
    return <CenterMsg>No column metadata found for this model.</CenterMsg>
  }
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 sticky top-0
            bg-white dark:bg-slate-900">
            <th className="text-left px-6 py-2.5 font-semibold text-slate-500 dark:text-slate-400 w-48">Column</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 w-32">Type</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 w-48">Tests</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {columns.map(col => (
            <tr key={col.name}
              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <td className="px-6 py-2.5">
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{col.name}</span>
              </td>
              <td className="px-4 py-2.5">
                {col.data_type
                  ? <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800
                      text-slate-500 dark:text-slate-400 font-mono">{col.data_type}</span>
                  : <span className="text-slate-300 dark:text-slate-700">—</span>
                }
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {(col.tests ?? []).map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium
                      bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                      {t}
                    </span>
                  ))}
                  {!col.tests?.length && (
                    <span className="text-slate-300 dark:text-slate-700">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2.5 text-slate-500 dark:text-slate-500">
                {col.description ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Findings pane ─── */

function FindingsPane({ findings }: { findings: Finding[] }) {
  if (!findings.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 dark:text-slate-600">
        <span className="text-3xl">✅</span>
        <p className="text-sm">No findings for this model.</p>
      </div>
    )
  }
  return (
    <div className="overflow-auto h-full p-4 space-y-2">
      {findings.map((f, i) => (
        <div key={i} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide
              ${SEV_BADGE[f.severity] ?? 'bg-slate-100 text-slate-600'}`}>
              {f.severity}
            </span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {TYPE_LABELS[f.type] ?? f.type}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{f.evidence}</p>
          {f.recommendation && (
            <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40
              border border-blue-100 dark:border-blue-900 px-3 py-2 rounded-lg leading-relaxed">
              {f.recommendation}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   MAIN TAB
══════════════════════════════════════════════════ */

export function ModelsTab({ initialModel }: { initialModel: string | null }) {
  const [modelsData,    setModelsData]    = useState<ModelsData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [selectedName,  setSelectedName]  = useState<string | null>(initialModel)

  // Sync when sidebar selects a new model
  useEffect(() => { setSelectedName(initialModel) }, [initialModel])

  useEffect(() => {
    fetch('/api/models')
      .then(r => r.json())
      .then((data: ModelsData) => { setModelsData(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const selectedModel = useMemo(() => {
    if (!modelsData || !selectedName) return null
    return Object.values(modelsData).flat().find(m => m.name === selectedName) ?? null
  }, [modelsData, selectedName])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700
          border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm">Loading models…</p>
      </div>
    )
  }

  if (!modelsData) {
    return <CenterMsg>Failed to load model data.</CenterMsg>
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ModelList
        modelsData={modelsData}
        selectedName={selectedName}
        onSelectModel={setSelectedName}
      />

      <div className="flex-1 overflow-hidden">
        {selectedModel
          ? <ModelDetail model={selectedModel} />
          : (
            <div className="flex flex-col items-center justify-center h-full gap-2
              text-slate-400 dark:text-slate-600 select-none">
              <span className="text-4xl">🗂️</span>
              <p className="text-sm">Select a model from the list to explore it.</p>
            </div>
          )
        }
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">
      {children}
    </p>
  )
}

function StatTile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded-xl ${
      warn ? 'bg-red-50 dark:bg-red-950/30' : 'bg-slate-50 dark:bg-slate-800/60'
    }`}>
      <p className={`text-xs mb-0.5 ${warn ? 'text-red-400' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-xl font-bold tabular-nums ${
        warn ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'
      }`}>{value}</p>
    </div>
  )
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-slate-400 dark:text-slate-600">{children}</p>
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
