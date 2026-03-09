import React, { useEffect, useMemo, useState } from 'react'
import { LineageGraph, type RawNode, type RawEdge } from './LineageGraph'
import { NodeDetailPanel } from './NodeDetailPanel'
import { LAYER_ORDER, LAYER_COLORS } from '../../types'

/* ─── Types ─── */

interface GraphData {
  nodes: RawNode[]
  edges: RawEdge[]
}

/* ─── Main ─── */

export function LineageTab() {
  const [graphData,   setGraphData]   = useState<GraphData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [searchText,  setSearchText]  = useState('')
  const [layerFilter, setLayerFilter] = useState<string | null>(null)
  const [direction,   setDirection]   = useState<'LR' | 'TB'>('LR')
  const [selectedId,  setSelectedId]  = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/graph')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<GraphData>
      })
      .then(data => { setGraphData(data); setLoading(false) })
      .catch(() => { setError('Failed to load graph data'); setLoading(false) })
  }, [])

  const selectedNode = useMemo(
    () => graphData?.nodes.find(n => n.id === selectedId) ?? null,
    [graphData, selectedId],
  )

  // Layers present in the data (ordered by LAYER_ORDER)
  const layers = useMemo(() => {
    if (!graphData) return []
    const present = new Set(graphData.nodes.map(n => n.layer))
    return LAYER_ORDER.filter(l => present.has(l))
  }, [graphData])

  if (loading) return <LoadingSpinner />
  if (error)   return <ErrorBanner message={error} />
  if (!graphData || graphData.nodes.length === 0) return <EmptyState />

  const issueCount   = graphData.nodes.filter(n => n.has_problem).length
  const matchedCount = searchText.trim()
    ? graphData.nodes.filter(n => n.id.toLowerCase().includes(searchText.toLowerCase())).length
    : null

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">

      {/* ── Controls bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0
        bg-white dark:bg-slate-900
        border-b border-slate-200 dark:border-slate-800">

        {/* Search */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-52
          bg-slate-50 dark:bg-slate-800
          border border-slate-200 dark:border-slate-700 shrink-0">
          <MagnifyIcon className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Highlight nodes…"
            className="flex-1 min-w-0 bg-transparent text-xs text-slate-700
              dark:text-slate-300 placeholder:text-slate-400 outline-none"
          />
          {searchText && (
            <button onClick={() => setSearchText('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <CloseIcon size={11} />
            </button>
          )}
        </div>

        {/* Match count */}
        {matchedCount !== null && (
          <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">
            {matchedCount} match{matchedCount !== 1 ? 'es' : ''}
          </span>
        )}

        {/* Layer filter chips */}
        <div className="flex items-center gap-1">
          <FilterChip
            label="All"
            active={layerFilter === null}
            onClick={() => setLayerFilter(null)}
          />
          {layers.map(layer => (
            <FilterChip
              key={layer}
              label={layer}
              active={layerFilter === layer}
              activeColor={LAYER_COLORS[layer]}
              onClick={() => setLayerFilter(l => l === layer ? null : layer)}
            />
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats */}
        <span className="text-xs text-slate-400 dark:text-slate-600 shrink-0">
          {graphData.nodes.length} models · {graphData.edges.length} edges
          {issueCount > 0 && (
            <span className="text-amber-500 dark:text-amber-400"> · {issueCount} ⚠</span>
          )}
        </span>

        {/* Layout direction toggle */}
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0">
          <DirButton
            title="Left → Right"
            active={direction === 'LR'}
            onClick={() => setDirection('LR')}
            icon={<ArrowRightIcon />}
          />
          <DirButton
            title="Top → Bottom"
            active={direction === 'TB'}
            onClick={() => setDirection('TB')}
            icon={<ArrowDownIcon />}
          />
        </div>
      </div>

      {/* ── Graph + detail panel ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* React Flow canvas */}
        <div className="flex-1 overflow-hidden">
          <LineageGraph
            rawNodes={graphData.nodes}
            rawEdges={graphData.edges}
            searchText={searchText}
            layerFilter={layerFilter}
            direction={direction}
            selectedNodeId={selectedId}
            onSelectNode={setSelectedId}
          />
        </div>

        {/* Sliding detail panel */}
        {selectedId && (
          <NodeDetailPanel
            node={selectedNode}
            allEdges={graphData.edges}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function FilterChip({
  label, active, activeColor, onClick,
}: {
  label:        string
  active:       boolean
  activeColor?: string
  onClick:      () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
        ${active && !activeColor
          ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
          : !active
          ? 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          : 'text-white'
        }`}
      style={active && activeColor ? { backgroundColor: activeColor } : undefined}
    >
      {label}
    </button>
  )
}

function DirButton({
  title, active, onClick, icon,
}: {
  title:   string
  active:  boolean
  onClick: () => void
  icon:    React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors
        ${active
          ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm'
          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
    >
      {icon}
    </button>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
      <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700
        border-t-blue-500 rounded-full animate-spin" />
      <p className="text-sm">Loading lineage graph…</p>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-sm text-red-500 dark:text-red-400
        bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900
        px-4 py-3 rounded-xl">
        {message}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2
      text-slate-400 dark:text-slate-600 select-none">
      <span className="text-4xl">🕸️</span>
      <p className="text-sm">No graph data found — run an audit first.</p>
    </div>
  )
}

/* ─── Icons ─── */

function MagnifyIcon({ className }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function CloseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function ArrowDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}
