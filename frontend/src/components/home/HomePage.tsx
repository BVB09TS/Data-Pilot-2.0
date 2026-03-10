import React, { useEffect, useState } from 'react'
import type { ReportData, Finding, Tab } from '../../types'

/* ─── Constants ─── */

const SEV_CFG: Record<string, { label: string; hex: string; badge: string }> = {
  critical: { label: 'Critical', hex: '#ef4444', badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400' },
  high:     { label: 'High',     hex: '#f97316', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400' },
  medium:   { label: 'Medium',   hex: '#eab308', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400' },
  low:      { label: 'Low',      hex: '#22c55e', badge: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400' },
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

function parseReport(raw: Record<string, unknown>): ReportData | null {
  const r = ((raw as { report?: unknown }).report ?? raw) as Partial<ReportData>
  if (!r.findings && !r.by_severity) return null
  return {
    findings:       Array.isArray(r.findings) ? (r.findings as Finding[]) : [],
    by_severity:    (r.by_severity as Record<string, number>) ?? {},
    by_type:        (r.by_type as Record<string, number>) ?? {},
    total_findings: (r.total_findings as number) ?? 0,
    metadata:       r.metadata,
  }
}

function calcScore(bySev: Record<string, number>): number {
  const p = (bySev.critical ?? 0) * 15 + (bySev.high ?? 0) * 8 + (bySev.medium ?? 0) * 3 + (bySev.low ?? 0) * 1
  return Math.max(0, Math.min(100, 100 - p))
}

function scoreStyle(s: number) {
  if (s >= 85) return { label: 'Healthy',  color: '#22c55e', ring: 'stroke-green-500'  }
  if (s >= 65) return { label: 'Moderate', color: '#eab308', ring: 'stroke-amber-400'  }
  if (s >= 40) return { label: 'At Risk',  color: '#f97316', ring: 'stroke-orange-500' }
  return              { label: 'Critical', color: '#ef4444', ring: 'stroke-red-500'     }
}

/* ─── Props ─── */

interface HomePageProps {
  totalModels: number
  onNavigate:  (tab: Tab) => void
}

/* ─── Main ─── */

export function HomePage({ totalModels, onNavigate }: HomePageProps) {
  const [report,     setReport]     = useState<ReportData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('ShopMesh')

  useEffect(() => {
    fetch('/api/report')
      .then(r => r.json())
      .then((data: Record<string, unknown>) => {
        const parsed = parseReport(data)
        setReport(parsed)
        const name = parsed?.metadata?.project_name
        if (name && typeof name === 'string') setProjectName(name)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const triggerAudit = () => {
    setTriggering(true)
    setTriggerMsg(null)
    fetch('/api/v1/audit/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(() => { setTriggerMsg('Audit started — refresh to see results.'); setTriggering(false) })
      .catch(() => { setTriggerMsg('Could not reach audit endpoint.'); setTriggering(false) })
  }

  if (loading) return <HomeLoading />

  const score  = report ? calcScore(report.by_severity) : null
  const sStyle = score !== null ? scoreStyle(score) : null

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">

      {/* ── Hero banner ── */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900
        dark:from-slate-950 dark:via-blue-950/80 dark:to-slate-950
        border-b border-slate-800 px-8 py-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600
                flex items-center justify-center shadow-lg shadow-blue-900/40">
                <span className="text-white font-bold text-lg select-none">D</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">DataPilot 2.0</p>
                <h1 className="text-2xl font-bold text-white leading-tight">{projectName}</h1>
              </div>
            </div>
            <p className="text-sm text-slate-400 max-w-md">
              AI-powered dbt project auditor — lineage analysis, quality checks, and automated findings.
            </p>
            {report?.metadata?.run_at && (
              <p className="text-xs text-slate-500">
                Last audit: {new Date(report.metadata.run_at).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-6 shrink-0">
            {score !== null && sStyle && (
              <ScoreRing score={score} color={sStyle.color} label={sStyle.label} />
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={triggerAudit}
                disabled={triggering}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                  bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold
                  transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/40"
              >
                <PlayIcon />
                {triggering ? 'Running…' : 'Run Audit'}
              </button>
              {triggerMsg && (
                <p className="text-xs text-blue-400 text-center">{triggerMsg}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

        {/* Stat row */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Models"
            value={totalModels}
            sub="across all layers"
            icon={<LayersIcon />}
            onClick={() => onNavigate('models')}
          />
          <StatCard
            label="Total Findings"
            value={report?.total_findings ?? 0}
            sub={report
              ? `${report.by_severity.critical ?? 0} critical · ${report.by_severity.high ?? 0} high`
              : 'No audit run yet'}
            icon={<AlertIcon />}
            accent={(report?.by_severity.critical ?? 0) > 0 ? '#ef4444' : undefined}
            onClick={() => onNavigate('findings')}
          />
          <StatCard
            label="Lineage Graph"
            value="View"
            sub="Interactive DAG explorer"
            icon={<GraphIcon />}
            onClick={() => onNavigate('lineage')}
          />
          <StatCard
            label="Settings"
            value="Configure"
            sub="API keys · MCP · Integrations"
            icon={<GearIcon />}
            onClick={() => onNavigate('settings')}
          />
        </div>

        {/* Navigation cards */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
            Jump to section
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <NavCard
              title="Lineage Explorer"
              description="Interactive, draggable DAG of all models and their dependencies across layers."
              icon={<GraphIcon />}
              color="blue"
              onClick={() => onNavigate('lineage')}
            />
            <NavCard
              title="Audit Findings"
              description="All issues found by AI agents: dead models, broken refs, missing tests, and more."
              icon={<AlertIcon />}
              color="orange"
              count={report?.total_findings}
              onClick={() => onNavigate('findings')}
            />
            <NavCard
              title="Model Catalog"
              description="Browse all dbt models by layer. View SQL, columns, tests, and downstream impact."
              icon={<LayersIcon />}
              color="teal"
              count={totalModels}
              onClick={() => onNavigate('models')}
            />
            <NavCard
              title="Overview Dashboard"
              description="Health score, severity distribution, findings by type, and trend charts."
              icon={<ChartIcon />}
              color="purple"
              onClick={() => onNavigate('overview')}
            />
            <NavCard
              title="Integrations"
              description="Check the status of connected platforms: Airflow, Snowflake, Slack, and more."
              icon={<PlugIcon />}
              color="slate"
              onClick={() => onNavigate('integrations')}
            />
            <NavCard
              title="Settings"
              description="Manage LLM provider API keys, MCP server connections, and project configuration."
              icon={<GearIcon />}
              color="slate"
              onClick={() => onNavigate('settings')}
            />
          </div>
        </div>

        {/* Recent findings */}
        {report && report.findings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Recent Findings
              </h2>
              <button
                onClick={() => onNavigate('findings')}
                className="text-xs text-blue-500 hover:underline"
              >
                View all →
              </button>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl
              border border-slate-200 dark:border-slate-800 overflow-hidden">
              {report.findings.slice(0, 6).map((f, i) => (
                <div key={i}
                  className="flex items-start gap-4 px-5 py-3.5
                    border-b border-slate-50 dark:border-slate-800/80 last:border-0
                    hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <span className={`
                    inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold
                    uppercase tracking-wide shrink-0 mt-0.5
                    ${SEV_CFG[f.severity]?.badge ?? 'bg-slate-100 text-slate-600'}
                  `}>
                    {f.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {TYPE_LABELS[f.type] ?? f.type}
                      </span>
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-600 truncate">
                        {f.model}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-1">
                      {f.evidence}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!report && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800
              flex items-center justify-center text-3xl">
              🚀
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">No audit report yet</h3>
              <p className="text-sm text-slate-400 mt-1">
                Run your first audit to see findings and lineage analysis.
              </p>
            </div>
            <button
              onClick={triggerAudit}
              disabled={triggering}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl
                bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                transition-colors disabled:opacity-50"
            >
              <PlayIcon />
              {triggering ? 'Running…' : 'Run First Audit'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function ScoreRing({ score, color, label }: { score: number; color: string; label: string }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 88 88" className="-rotate-90 w-full h-full">
          <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white leading-none">{score}</span>
          <span className="text-[9px] text-slate-400 uppercase tracking-widest">/100</span>
        </div>
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

function StatCard({
  label, value, sub, icon, accent, onClick,
}: {
  label:    string
  value:    number | string
  sub?:     string
  icon:     React.ReactNode
  accent?:  string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-white dark:bg-slate-900 rounded-2xl
        border border-slate-200 dark:border-slate-800 p-5
        hover:border-blue-300 dark:hover:border-blue-700
        hover:shadow-md transition-all duration-150 group"
      style={accent ? { borderColor: accent + '50' } : undefined}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        <span className="text-slate-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors">
          {icon}
        </span>
      </div>
      <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
    </button>
  )
}

const NAV_COLORS: Record<string, string> = {
  blue:   'hover:border-blue-300 dark:hover:border-blue-700 group-hover:text-blue-500',
  orange: 'hover:border-orange-300 dark:hover:border-orange-700 group-hover:text-orange-500',
  teal:   'hover:border-teal-300 dark:hover:border-teal-700 group-hover:text-teal-500',
  purple: 'hover:border-purple-300 dark:hover:border-purple-700 group-hover:text-purple-500',
  slate:  'hover:border-slate-300 dark:hover:border-slate-600 group-hover:text-slate-500',
}

function NavCard({
  title, description, icon, color, count, onClick,
}: {
  title:       string
  description: string
  icon:        React.ReactNode
  color:       string
  count?:      number
  onClick:     () => void
}) {
  const colorCls = NAV_COLORS[color] ?? NAV_COLORS.slate
  return (
    <button
      onClick={onClick}
      className={`group text-left w-full bg-white dark:bg-slate-900 rounded-2xl
        border border-slate-200 dark:border-slate-800
        p-5 transition-all duration-150 hover:shadow-md ${colorCls}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-slate-400 dark:text-slate-500 transition-colors">{icon}</span>
        {count !== undefined && (
          <span className="text-xs font-mono text-slate-400 dark:text-slate-600">{count}</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    </button>
  )
}

function HomeLoading() {
  return (
    <div className="h-full animate-pulse">
      <div className="h-48 bg-slate-200 dark:bg-slate-800" />
      <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

/* ─── Icons ─── */

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  )
}

function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

function GraphIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="5" cy="6" r="3"/><circle cx="19" cy="6" r="3"/><circle cx="12" cy="18" r="3"/>
      <line x1="8" y1="6" x2="16" y2="6"/>
      <line x1="6.5" y1="8.5" x2="10.5" y2="15.5"/>
      <line x1="17.5" y1="8.5" x2="13.5" y2="15.5"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
      <line x1="2"  y1="20" x2="22" y2="20"/>
    </svg>
  )
}

function PlugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22v-5M9 7V3M15 7V3M9 12H5a2 2 0 0 1-2-2V7h18v3a2 2 0 0 1-2 2h-4"/>
      <rect x="9" y="12" width="6" height="5" rx="1"/>
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
               1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33
               l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4
               h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06
               A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51
               a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9
               a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
