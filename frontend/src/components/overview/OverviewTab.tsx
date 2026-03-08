import React, { useEffect, useState } from 'react'
import type { Finding, ReportData } from '../../types'

/* ─── Constants ─── */

const SEV_ORDER = ['critical', 'high', 'medium', 'low'] as const

const SEV_CFG: Record<string, { label: string; hex: string; bar: string; badge: string }> = {
  critical: {
    label: 'Critical',
    hex:   '#ef4444',
    bar:   'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400',
  },
  high: {
    label: 'High',
    hex:   '#f97316',
    bar:   'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400',
  },
  medium: {
    label: 'Medium',
    hex:   '#eab308',
    bar:   'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  },
  low: {
    label: 'Low',
    hex:   '#22c55e',
    bar:   'bg-green-500',
    badge: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400',
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

/* ─── Helpers ─── */

function parseReport(raw: Record<string, unknown>): ReportData | null {
  const r = ((raw as { report?: unknown }).report ?? raw) as Partial<ReportData>
  if (!r.findings && !r.by_severity) return null
  return {
    findings:       Array.isArray(r.findings)    ? (r.findings as Finding[])             : [],
    by_severity:    (r.by_severity as Record<string, number>)    ?? {},
    by_type:        (r.by_type     as Record<string, number>)    ?? {},
    total_findings: (r.total_findings as number) ?? r.findings?.length ?? 0,
    metadata:       r.metadata,
  }
}

function calcScore(bySev: Record<string, number>): number {
  const p =
    (bySev.critical ?? 0) * 15 +
    (bySev.high     ?? 0) *  8 +
    (bySev.medium   ?? 0) *  3 +
    (bySev.low      ?? 0) *  1
  return Math.max(0, Math.min(100, 100 - p))
}

function scoreStyle(s: number): { label: string; cls: string; bar: string } {
  if (s >= 85) return { label: 'Healthy',  cls: 'text-green-600 dark:text-green-400',  bar: 'bg-green-500'  }
  if (s >= 65) return { label: 'Moderate', cls: 'text-amber-600 dark:text-amber-400',  bar: 'bg-amber-400'  }
  if (s >= 40) return { label: 'At Risk',  cls: 'text-orange-600 dark:text-orange-400',bar: 'bg-orange-500' }
  return              { label: 'Critical', cls: 'text-red-600 dark:text-red-400',       bar: 'bg-red-500'    }
}

/* ─── Main ─── */

interface OverviewTabProps {
  totalModels: number
}

export function OverviewTab({ totalModels }: OverviewTabProps) {
  const [report,     setReport]     = useState<ReportData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/report')
      .then(r => r.json())
      .then((data: Record<string, unknown>) => {
        setReport(parseReport(data))
        setLoading(false)
      })
      .catch(() => { setError('Failed to load report'); setLoading(false) })
  }, [])

  const triggerAudit = () => {
    setTriggering(true)
    setTriggerMsg(null)
    fetch('/api/v1/audit/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(r => r.json())
      .then(() => { setTriggerMsg('Audit accepted — refresh once complete.'); setTriggering(false) })
      .catch(() => { setTriggerMsg('Could not reach the audit endpoint.'); setTriggering(false) })
  }

  if (loading) return <Skeleton />
  if (error)   return <Banner type="error">{error}</Banner>

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <span className="text-4xl">🚀</span>
        <p className="text-slate-500 dark:text-slate-400 text-sm">No audit report found yet.</p>
        <button onClick={triggerAudit} disabled={triggering}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
            transition-colors disabled:opacity-50">
          {triggering ? 'Triggering…' : 'Run First Audit'}
        </button>
        {triggerMsg && <p className="text-xs text-slate-400">{triggerMsg}</p>}
      </div>
    )
  }

  const score    = calcScore(report.by_severity)
  const sStyle   = scoreStyle(score)
  const typeSorted = Object.entries(report.by_type).sort(([, a], [, b]) => b - a)
  const maxType    = Math.max(...typeSorted.map(([, v]) => v), 1)
  const recent     = report.findings.slice(0, 8)

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5">

      {/* ── Row 1: Health score card + stat cards ── */}
      <div className="grid grid-cols-4 gap-4">

        {/* Health score */}
        <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl
          border border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest
                text-slate-400 dark:text-slate-500 mb-1">
                Health Score
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold tabular-nums
                  text-slate-900 dark:text-slate-100">
                  {score}
                </span>
                <span className="text-xl text-slate-300 dark:text-slate-600">/100</span>
              </div>
              <p className={`text-sm font-semibold mt-0.5 ${sStyle.cls}`}>{sStyle.label}</p>
            </div>

            <button
              onClick={triggerAudit}
              disabled={triggering}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                border border-slate-200 dark:border-slate-700
                text-slate-500 dark:text-slate-400
                hover:bg-slate-50 dark:hover:bg-slate-800
                transition-colors disabled:opacity-50"
            >
              <RefreshIcon />
              {triggering ? 'Running…' : 'Re-run Audit'}
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${sStyle.bar}`}
              style={{ width: `${score}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-600">
            <span>
              {report.metadata?.run_at
                ? `Last run: ${new Date(report.metadata.run_at).toLocaleString()}`
                : 'Run an audit to see results'}
            </span>
            {triggerMsg && <span className="text-blue-500">{triggerMsg}</span>}
          </div>
        </div>

        {/* Stat: Total Models */}
        <StatCard
          label="Total Models"
          value={totalModels}
          sub="across all layers"
          icon="🗂️"
        />

        {/* Stat: Findings */}
        <StatCard
          label="Total Findings"
          value={report.total_findings}
          sub={`${report.by_severity.critical ?? 0} critical · ${report.by_severity.high ?? 0} high`}
          icon="🔍"
          accentClass={(report.by_severity.critical ?? 0) > 0
            ? 'border-red-200 dark:border-red-900'
            : (report.by_severity.high ?? 0) > 0
            ? 'border-orange-200 dark:border-orange-900'
            : undefined}
        />
      </div>

      {/* ── Row 2: Severity distribution + Findings by type ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Severity bars */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl
          border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Severity Distribution
          </h3>
          {SEV_ORDER.map(sev => {
            const count  = report.by_severity[sev] ?? 0
            const total  = Math.max(report.total_findings, 1)
            const pct    = (count / total) * 100
            const cfg    = SEV_CFG[sev]
            return (
              <div key={sev} className="flex items-center gap-3">
                <span className="w-1.5 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.hex }} />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-14 shrink-0">
                  {cfg.label}
                </span>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                    style={{ width: count > 0 ? `${Math.max(pct, 3)}%` : '0%' }}
                  />
                </div>
                <span className={`text-xs font-semibold w-5 text-right ${
                  count > 0
                    ? (sev === 'critical' ? 'text-red-600 dark:text-red-400'
                      : sev === 'high'    ? 'text-orange-600 dark:text-orange-400'
                      : sev === 'medium'  ? 'text-amber-600 dark:text-amber-400'
                      :                    'text-green-600 dark:text-green-400')
                    : 'text-slate-300 dark:text-slate-700'
                }`}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>

        {/* Findings by type */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl
          border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Findings by Type
          </h3>
          {typeSorted.length === 0
            ? <p className="text-xs text-slate-400 dark:text-slate-600">No findings recorded.</p>
            : (
              <div className="space-y-3">
                {typeSorted.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 dark:text-slate-400 w-36 truncate shrink-0">
                      {TYPE_LABELS[type] ?? type}
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400 dark:bg-blue-500 transition-all duration-500"
                        style={{ width: `${(count / maxType) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-5 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* ── Row 3: Recent findings ── */}
      {recent.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl
          border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800
            flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Recent Findings
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-600">
              {report.total_findings} total
            </span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/80">
            {recent.map((f, i) => (
              <FindingRow key={i} finding={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Sub-components ─── */

function StatCard({
  label, value, sub, icon, accentClass,
}: {
  label: string
  value: number | string
  sub?: string
  icon: string
  accentClass?: string
}) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl
      border border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-1
      ${accentClass ?? ''}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-widest
          text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <span className="text-base">{icon}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-slate-400 dark:text-slate-600 truncate">{sub}</p>
      )}
    </div>
  )
}

function FindingRow({ finding }: { finding: Finding }) {
  const cfg = SEV_CFG[finding.severity]
  return (
    <div className="flex items-start gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40
      transition-colors">
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold
        uppercase tracking-wide shrink-0 mt-0.5 ${cfg?.badge ?? 'bg-slate-100 text-slate-600'}`}>
        {finding.severity}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {TYPE_LABELS[finding.type] ?? finding.type}
          </span>
          <span className="text-xs font-mono text-slate-400 dark:text-slate-600 truncate">
            {finding.model}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-1">
          {finding.evidence}
        </p>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2 h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
      </div>
      <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
    </div>
  )
}

function Banner({ type, children }: { type: 'error'; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30
        border border-red-200 dark:border-red-900 px-4 py-3 rounded-xl">
        {children}
      </div>
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  )
}
