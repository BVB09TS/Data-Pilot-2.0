import React from 'react'
import type { RawNode, RawEdge } from './LineageGraph'
import { LAYER_COLORS } from '../../types'

interface NodeDetailPanelProps {
  node:     RawNode | null
  allEdges: RawEdge[]
  onClose:  () => void
}

export function NodeDetailPanel({ node, allEdges, onClose }: NodeDetailPanelProps) {
  if (!node) return null

  const color      = LAYER_COLORS[node.layer] ?? '#64748b'
  const upstream   = allEdges.filter(e => e.target === node.id).map(e => e.source)
  const downstream = allEdges.filter(e => e.source === node.id).map(e => e.target)

  return (
    <aside className="w-72 shrink-0 flex flex-col
      bg-white dark:bg-slate-900
      border-l border-slate-200 dark:border-slate-800
      overflow-y-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-4 py-3
        border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
            {node.id}
          </p>
          <span
            className="inline-flex items-center mt-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: color + '20', color }}
          >
            {node.layer}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          className="ml-2 p-1 rounded text-slate-400 hover:text-slate-700
            hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      {/* ── Query activity ── */}
      {(node.q30 != null || node.q90 != null) && (
        <Section title="Query Activity">
          <div className="grid grid-cols-2 gap-2">
            {node.q30 != null && (
              <StatTile label="30-day" value={node.q30.toLocaleString()} />
            )}
            {node.q90 != null && (
              <StatTile
                label="90-day"
                value={node.q90.toLocaleString()}
                warn={node.q90 === 0}
              />
            )}
          </div>
          {node.q90 === 0 && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-2">
              Zero queries in 90 days — likely a dead model.
            </p>
          )}
        </Section>
      )}

      {/* ── Findings indicator ── */}
      {node.has_problem && (
        <Section title="">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg
            bg-amber-50 dark:bg-amber-950/40
            border border-amber-200 dark:border-amber-900">
            <span className="text-amber-500 shrink-0">⚠</span>
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              Audit findings exist for this model.
              Check the Findings tab for details.
            </p>
          </div>
        </Section>
      )}

      {/* ── Upstream ── */}
      <Section title={`Upstream (${upstream.length})`}>
        {upstream.length === 0
          ? <Muted>Source node — no upstream dependencies</Muted>
          : (
            <ul className="space-y-1">
              {upstream.map(id => (
                <ModelRef key={id} id={id} dot="bg-blue-400" />
              ))}
            </ul>
          )
        }
      </Section>

      {/* ── Downstream ── */}
      <Section title={`Downstream (${downstream.length})`}>
        {downstream.length === 0
          ? <Muted>Sink node — no downstream consumers</Muted>
          : (
            <ul className="space-y-1">
              {downstream.map(id => (
                <ModelRef key={id} id={id} dot="bg-green-400" />
              ))}
            </ul>
          )
        }
      </Section>
    </aside>
  )
}

/* ─── Helpers ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
      {title && (
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

function StatTile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${
      warn ? 'bg-red-50 dark:bg-red-950/40' : 'bg-slate-50 dark:bg-slate-800'
    }`}>
      <p className={`text-xs ${warn ? 'text-red-400' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${
        warn ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
      }`}>
        {value}{warn ? ' ⚠' : ''}
      </p>
    </div>
  )
}

function ModelRef({ id, dot }: { id: string; dot: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate">
        {id}
      </span>
    </li>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-slate-400 dark:text-slate-600 italic">{children}</p>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
