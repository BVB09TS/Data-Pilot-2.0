import { useEffect, useState } from 'react'
import type { Model, ModelsData } from '../../types'
import { LAYER_ORDER, LAYER_COLORS } from '../../types'

interface SidebarProps {
  open: boolean
  selectedModel: string | null
  onSelectModel: (name: string) => void
}

export function Sidebar({ open, selectedModel, onSelectModel }: SidebarProps) {
  const [modelsData, setModelsData] = useState<ModelsData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [filter, setFilter]         = useState('')
  const [onlyIssues, setOnlyIssues] = useState(false)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set(LAYER_ORDER))

  useEffect(() => {
    fetch('/api/models')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<ModelsData>
      })
      .then(data => { setModelsData(data); setLoading(false) })
      .catch(() => { setError('Failed to load models'); setLoading(false) })
  }, [])

  const toggleLayer = (layer: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })

  const filterModels = (models: Model[]) =>
    models.filter(m => {
      const matchText   = !filter || m.name.toLowerCase().includes(filter.toLowerCase())
      const matchIssues = !onlyIssues || m.has_problem
      return matchText && matchIssues
    })

  const totalModels  = modelsData ? Object.values(modelsData).flat().length : 0
  const totalIssues  = modelsData ? Object.values(modelsData).flat().filter(m => m.has_problem).length : 0
  const totalLayers  = modelsData ? Object.keys(modelsData).length : 0

  return (
    <aside className={`
      fixed left-0 top-14 bottom-0 z-40 w-72
      flex flex-col
      bg-white dark:bg-slate-900
      border-r border-slate-200 dark:border-slate-800
      transition-transform duration-200 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full'}
    `}>

      {/* ── Sidebar header ── */}
      <div className="flex items-center justify-between px-4 py-3
        border-b border-slate-100 dark:border-slate-800 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest
          text-slate-400 dark:text-slate-500">
          Explorer
        </span>
        {totalIssues > 0 && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full
            bg-red-50 text-red-600 border border-red-200
            dark:bg-red-950/50 dark:text-red-400 dark:border-red-900">
            {totalIssues} issues
          </span>
        )}
      </div>

      {/* ── Search + filter ── */}
      <div className="px-3 py-2.5 space-y-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
        {/* Text filter */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
          bg-slate-50 dark:bg-slate-800
          border border-slate-200 dark:border-slate-700">
          <MagnifyIcon className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter models..."
            className="flex-1 min-w-0 bg-transparent text-xs text-slate-700
              dark:text-slate-300 placeholder:text-slate-400 outline-none"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {/* Issues-only toggle */}
        <button
          onClick={() => setOnlyIssues(v => !v)}
          className={`
            flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${onlyIssues
              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900'
              : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
            }
          `}
        >
          <WarnIcon />
          {onlyIssues ? 'Showing issues only' : 'Show issues only'}
        </button>
      </div>

      {/* ── Model tree ── */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && <SidebarSkeleton />}
        {error   && (
          <p className="px-4 py-3 text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
        {modelsData && LAYER_ORDER.map(layer => {
          const models   = modelsData[layer] ?? []
          const filtered = filterModels(models)
          const issues   = models.filter(m => m.has_problem).length

          if (filter && filtered.length === 0) return null

          return (
            <LayerGroup
              key={layer}
              layer={layer}
              models={filtered}
              issueCount={issues}
              expanded={expanded.has(layer)}
              selectedModel={selectedModel}
              onToggle={() => toggleLayer(layer)}
              onSelectModel={onSelectModel}
            />
          )
        })}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 shrink-0">
        <p className="text-xs text-slate-400 dark:text-slate-600">
          {loading
            ? 'Loading…'
            : `${totalModels} models · ${totalLayers} layers · ${totalIssues} issues`
          }
        </p>
      </div>
    </aside>
  )
}

/* ─── Layer group ─── */

interface LayerGroupProps {
  layer: string
  models: Model[]
  issueCount: number
  expanded: boolean
  selectedModel: string | null
  onToggle: () => void
  onSelectModel: (name: string) => void
}

function LayerGroup({
  layer, models, issueCount, expanded, selectedModel, onToggle, onSelectModel,
}: LayerGroupProps) {
  const color = LAYER_COLORS[layer] ?? '#64748b'

  return (
    <div>
      {/* Layer header button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-2
          hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <ChevronIcon className={`text-slate-400 transition-transform duration-150 shrink-0 ${expanded ? 'rotate-90' : ''}`} />
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="flex-1 text-left text-xs font-semibold uppercase tracking-wider
          text-slate-600 dark:text-slate-400">
          {layer}
        </span>
        <div className="flex items-center gap-1.5">
          {issueCount > 0 && (
            <span className="text-xs px-1 py-0.5 rounded
              bg-amber-100 text-amber-700 font-medium
              dark:bg-amber-950/50 dark:text-amber-400">
              ⚠ {issueCount}
            </span>
          )}
          <span className="text-xs font-mono text-slate-400 dark:text-slate-600">
            {models.length}
          </span>
        </div>
      </button>

      {/* Model list */}
      {expanded && (
        <ul>
          {models.map(model => (
            <ModelItem
              key={model.name}
              model={model}
              selected={selectedModel === model.name}
              layerColor={color}
              onSelect={() => onSelectModel(model.name)}
            />
          ))}
          {models.length === 0 && (
            <li className="pl-10 pr-4 py-1.5 text-xs text-slate-400 dark:text-slate-600 italic">
              No matches
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/* ─── Model row ─── */

interface ModelItemProps {
  model: Model
  selected: boolean
  layerColor: string
  onSelect: () => void
}

function ModelItem({ model, selected, layerColor, onSelect }: ModelItemProps) {
  return (
    <li>
      <button
        onClick={onSelect}
        title={model.description || model.name}
        className={`
          flex items-center gap-2 w-full pl-9 pr-3 py-1.5 text-left transition-colors
          ${selected
            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
          }
        `}
      >
        {/* Layer accent bar */}
        <span
          className="w-0.5 h-4 rounded-full shrink-0 opacity-60"
          style={{ backgroundColor: layerColor }}
        />
        <span className="flex-1 min-w-0 text-xs font-mono truncate">
          {model.name}
        </span>
        {model.has_problem && (
          <span className="text-amber-500 dark:text-amber-400 shrink-0 text-xs" title="Has issues">
            ⚠
          </span>
        )}
      </button>
    </li>
  )
}

/* ─── Loading skeleton ─── */

function SidebarSkeleton() {
  return (
    <div className="px-4 py-3 space-y-4 animate-pulse">
      {[4, 3, 5, 3].map((count, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-20" />
          {Array.from({ length: count }).map((_, j) => (
            <div
              key={j}
              className="h-2.5 bg-slate-50 dark:bg-slate-800/60 rounded ml-4"
              style={{ width: `${55 + (j * 17) % 30}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ─── Tiny icon helpers ─── */

function MagnifyIcon({ className }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
