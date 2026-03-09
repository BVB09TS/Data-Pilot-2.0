import React, { useEffect, useMemo, useState } from 'react'
import type { Finding } from '../../types'

/* ─── Constants ─── */

const SEV_ORDER = ['critical', 'high', 'medium', 'low'] as const

const SEV_CFG: Record<string, {
  label:  string
  hex:    string
  badge:  string
  card:   string
  count:  string
}> = {
  critical: {
    label: 'Critical',
    hex:   '#ef4444',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400',
    card:  'border-l-red-500',
    count: 'text-red-600 dark:text-red-400',
  },
  high: {
    label: 'High',
    hex:   '#f97316',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-400',
    card:  'border-l-orange-500',
    count: 'text-orange-600 dark:text-orange-400',
  },
  medium: {
    label: 'Medium',
    hex:   '#eab308',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400',
    card:  'border-l-amber-400',
    count: 'text-amber-600 dark:text-amber-400',
  },
  low: {
    label: 'Low',
    hex:   '#22c55e',
    badge: 'bg-green-100 text-green-700 dark:bg-green-950/70 dark:text-green-400',
    card:  'border-l-green-500',
    count: 'text-green-600 dark:text-green-400',
  },
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
  redundant_model:   'Redundant Model',
}

/* ─── Types ─── */

interface FindingsResponse {
  total:    number
  findings: Finding[]
}

/* ─── Main ─── */

export function FindingsTab() {
  const [allFindings, setAllFindings] = useState<Finding[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [sevFilter,   setSevFilter]   = useState<string | null>(null)
  const [typeFilter,  setTypeFilter]  = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/findings')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<FindingsResponse>
      })
      .then(data => { setAllFindings(data.findings ?? []); setLoading(false) })
      .catch(() => { setError('Failed to load findings'); setLoading(false) })
  }, [])

  // Severity counts across ALL findings (unaffected by filters)
  const sevCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const f of allFindings) c[f.severity] = (c[f.severity] ?? 0) + 1
    return c
  }, [allFindings])

  // Types present in the data
  const availableTypes = useMemo(
    () => Array.from(new Set(allFindings.map(f => f.type))).sort(),
    [allFindings],
  )

  // Filtered list (client-side — instant feedback)
  const filtered = useMemo(() => {
    const lc = search.toLowerCase()
    return allFindings.filter(f => {
      const matchSev   = !sevFilter  || f.severity === sevFilter
      const matchType  = !typeFilter || f.type     === typeFilter
      const matchSearch = !lc ||
        f.model.toLowerCase().includes(lc) ||
        f.evidence.toLowerCase().includes(lc)
      return matchSev && matchType && matchSearch
    })
  }, [allFindings, sevFilter, typeFilter, search])

  const toggleExpand = (idx: number) =>
    setExpandedIdx(prev => prev === idx ? null : idx)

  if (loading) return <Spinner />
  if (error)   return <ErrorBanner message={error} />

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto w-full px-6 py-5 space-y-5">

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-5 gap-3">
          <SeverityCard
            label="Total"
            count={allFindings.length}
            active={sevFilter === null}
            onClick={() => setSevFilter(null)}
            cls="text-slate-700 dark:text-slate-300"
          />
          {SEV_ORDER.map(sev => (
            <SeverityCard
              key={sev}
              label={SEV_CFG[sev].label}
              count={sevCounts[sev] ?? 0}
              active={sevFilter === sev}
              onClick={() => setSevFilter(f => f === sev ? null : sev)}
              cls={SEV_CFG[sev].count}
              hex={SEV_CFG[sev].hex}
            />
          ))}
        </div>

        {/* ── Filter bar ── */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Severity chips */}
          <div className="flex items-center gap-1">
            <FilterChip label="All" active={sevFilter === null} onClick={() => setSevFilter(null)} />
            {SEV_ORDER.map(sev => (
              <FilterChip
                key={sev}
                label={SEV_CFG[sev].label}
                active={sevFilter === sev}
                activeHex={SEV_CFG[sev].hex}
                onClick={() => setSevFilter(f => f === sev ? null : sev)}
              />
            ))}
          </div>

          {/* Type dropdown */}
          <select
            value={typeFilter ?? ''}
            onChange={e => setTypeFilter(e.target.value || null)}
            className="text-xs px-2.5 py-1.5 rounded-lg border
              border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-900
              text-slate-700 dark:text-slate-300
              outline-none focus:border-blue-400 dark:focus:border-blue-600
              cursor-pointer"
          >
            <option value="">All Types</option>
            {availableTypes.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
            bg-white dark:bg-slate-900
            border border-slate-200 dark:border-slate-700">
            <MagnifyIcon className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search model or evidence…"
              className="w-52 bg-transparent text-xs text-slate-700 dark:text-slate-300
                placeholder:text-slate-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <CloseIcon />
              </button>
            )}
          </div>

          {/* Result count */}
          <span className="text-xs text-slate-400 dark:text-slate-600 shrink-0">
            {filtered.length} of {allFindings.length}
          </span>
        </div>

        {/* ── Findings list ── */}
        {filtered.length === 0
          ? (
            <div className="flex flex-col items-center justify-center py-20
              text-slate-400 dark:text-slate-600 gap-3">
              <span className="text-4xl">✅</span>
              <p className="text-sm">
                {allFindings.length === 0
                  ? 'No findings — run an audit first.'
                  : 'No findings match the current filters.'}
              </p>
            </div>
          )
          : (
            <div className="space-y-2">
              {filtered.map((f, idx) => (
                <FindingCard
                  key={idx}
                  finding={f}
                  expanded={expandedIdx === idx}
                  onToggle={() => toggleExpand(idx)}
                />
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function SeverityCard({
  label, count, active, onClick, cls, hex,
}: {
  label:   string
  count:   number
  active:  boolean
  onClick: () => void
  cls:     string
  hex?:    string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col gap-1 px-4 py-3 rounded-xl border text-left transition-all
        ${active
          ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 shadow-sm'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }
      `}
    >
      <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${cls}`}>
        {count}
      </span>
      {active && hex && (
        <div className="h-0.5 rounded-full mt-0.5" style={{ backgroundColor: hex }} />
      )}
    </button>
  )
}

function FilterChip({
  label, active, activeHex, onClick,
}: {
  label:      string
  active:     boolean
  activeHex?: string
  onClick:    () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
        ${active && !activeHex
          ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
          : !active
          ? 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          : 'text-white'
        }`}
      style={active && activeHex ? { backgroundColor: activeHex } : undefined}
    >
      {label}
    </button>
  )
}

function FindingCard({
  finding, expanded, onToggle,
}: {
  finding:  Finding
  expanded: boolean
  onToggle: () => void
}) {
  const cfg = SEV_CFG[finding.severity]

  return (
    <div className={`
      bg-white dark:bg-slate-900 rounded-xl
      border border-slate-200 dark:border-slate-800
      border-l-4 ${cfg?.card ?? 'border-l-slate-400'}
      overflow-hidden transition-shadow
      ${expanded ? 'shadow-md dark:shadow-black/30' : 'shadow-sm'}
    `}>
      {/* Always-visible row */}
      <button
        onClick={onToggle}
        className="flex items-start gap-4 w-full px-5 py-4 text-left
          hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        {/* Severity badge */}
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold
          uppercase tracking-wide shrink-0 mt-0.5 ${cfg?.badge ?? 'bg-slate-100 text-slate-600'}`}>
          {finding.severity}
        </span>

        {/* Type + model */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {TYPE_LABELS[finding.type] ?? finding.type}
            </span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-50
              dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {finding.model}
            </span>
          </div>
          <p className={`text-xs text-slate-500 dark:text-slate-400 ${expanded ? '' : 'line-clamp-1'}`}>
            {finding.evidence}
          </p>
        </div>

        {/* Expand chevron */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-slate-400 shrink-0 mt-1 transition-transform duration-150
            ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">

          {/* Full evidence */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest
              text-slate-400 dark:text-slate-600 mb-1">
              Evidence
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {finding.evidence}
            </p>
          </div>

          {/* Recommendation */}
          {finding.recommendation && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest
                text-slate-400 dark:text-slate-600 mb-1">
                Recommended Action
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed
                bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900
                px-3 py-2 rounded-lg">
                {finding.recommendation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Utility states ─── */

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
      <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700
        border-t-blue-500 rounded-full animate-spin" />
      <p className="text-sm">Loading findings…</p>
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

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
