import { PublicNavbar } from '../components/public/PublicNavbar'
import { PublicFooter } from '../components/public/PublicFooter'

const releases = [
  {
    version: '2.0.1',
    date: 'March 2026',
    tag: 'Latest',
    tagColor: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    dotColor: 'bg-blue-500',
    summary: 'Patch: workspace settings, chat panel improvements, and policy evaluation fixes.',
    changes: {
      added: [
        'Workspace-scoped LLM API key management in Settings',
        'Chat panel retains conversation history across page navigation',
        'GitHub Actions SARIF upload step added to CI workflow',
      ],
      changed: [
        'Policy evaluation now returns structured violation details per rule',
        'Findings table now links model names directly to lineage graph with focus mode',
      ],
      fixed: [
        'Rate limiter no longer resets on API server restart',
        'Audit log pagination offset correctly handles large event counts',
        'CSRF middleware now allows same-origin requests from Vite dev server',
      ],
    },
  },
  {
    version: '2.0.0',
    date: 'February 2026',
    tag: 'Major release',
    tagColor: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
    dotColor: 'bg-violet-500',
    summary: 'Full platform rewrite. New TypeScript governance API, React dashboard, 8 specialist AI agents, and enterprise integrations.',
    changes: {
      added: [
        'TypeScript Express API with PostgreSQL — full replacement of legacy Flask backend',
        'React + Vite + Tailwind SPA with dark/light mode',
        'ReactFlow lineage explorer with upstream/downstream depth control and focus mode',
        '8 specialist AI audit agents running in parallel (dead models, orphans, broken refs, grain joins, duplicate metrics, missing tests, logic drift, deprecated sources)',
        'Multi-provider LLM routing: Groq → OpenAI → Anthropic with automatic fallback',
        'AI chat panel (Voro) with findings context auto-injection',
        'GitHub OAuth, GitLab OAuth, and Google OAuth login',
        'SARIF 2.1.0 export for GitHub and GitLab security scanning dashboards',
        'Jira ticket export format for issue tracking integration',
        'Governance policies — define rules (require_field, deny_value, max_runs) and evaluate against runs',
        'Immutable audit event log with resource-type and action filtering',
        'GitHub PR review bot — auto-reviews pull requests and posts structured findings',
        'Enterprise integrations: Snowflake, Azure, AWS S3, GitLab, Power BI, Airflow, Kubernetes',
        'Kubernetes manifest generation CLI command',
        'Airflow DAG generation CLI command',
        'Pydantic v2 configuration with full YAML support',
        'Docker + Docker Compose support with optional Redis profile',
        'Sequential SQL migration runner — automatic schema management on startup',
        'JWT HttpOnly cookie auth with sliding-window rate limiting and CSRF protection',
        'Structured JSON request logging with request IDs',
      ],
      changed: [
        'Complete architecture rewrite — pipeline + router replaces monolithic v1 agent',
        'Severity system upgraded to 4 levels: critical, high, medium, low',
        'Report format now includes cost_usd estimates per finding',
        'CLI rebuilt with Click 8 — replaces argparse',
        'Lineage DAG now uses NetworkX 3 with correct circular reference detection',
      ],
      fixed: [
        'LLM output parser now handles markdown-wrapped and partial JSON gracefully',
        'Project path validation prevents path traversal in audit triggers',
      ],
    },
  },
  {
    version: '1.4.2',
    date: 'January 2026',
    tag: 'Previous stable',
    tagColor: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
    dotColor: 'bg-gray-600',
    summary: 'Stability improvements and LLM provider upgrade for the v1 audit agent.',
    changes: {
      added: [
        'Query history JSON parsing for 180-day usage statistics',
        'Dead model detection now considers configurable query frequency thresholds',
        'HTML report export with embedded D3 lineage graph',
      ],
      changed: [
        'Groq provider upgraded to llama-3.3-70b-versatile',
        'Improved LLM prompts for grain join and duplicate metric detection',
      ],
      fixed: [
        'YAML parsing no longer fails on models with empty description blocks',
        'Broken ref detection now correctly follows indirect dependencies',
        'Cost estimate calculation fixed for multi-layer orphan chains',
      ],
    },
  },
  {
    version: '1.0.0',
    date: 'September 2025',
    tag: 'Initial release',
    tagColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    dotColor: 'bg-emerald-600',
    summary: 'First public release. dbt project parsing, lineage DAG, dead model and broken ref detection.',
    changes: {
      added: [
        'dbt project parser — SQL + YAML + query history',
        'NetworkX lineage DAG builder',
        'Dead model detection (0 queries in 90 days)',
        'Broken ref detection (ref() to non-existent models)',
        'JSON and CSV report export',
        'Flask web dashboard with D3 lineage graph',
        'Groq Llama integration for AI-assisted analysis',
      ],
      changed: [],
      fixed: [],
    },
  },
]

const tagStyles: Record<string, { label: string; cls: string }> = {
  added:   { label: 'Added',   cls: 'text-emerald-400' },
  changed: { label: 'Changed', cls: 'text-yellow-400' },
  fixed:   { label: 'Fixed',   cls: 'text-blue-400' },
}

export function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      <div className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        {/* Header */}
        <div className="mb-16">
          <h1 className="text-4xl font-bold mb-3 tracking-tight">Changelog</h1>
          <p className="text-gray-400">Every DataPilot release, documented. Always up to date.</p>
        </div>

        {/* Timeline */}
        <div className="space-y-14">
          {releases.map(rel => (
            <div key={rel.version} className="relative pl-8 border-l border-white/[0.08]">
              {/* Timeline dot */}
              <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${rel.dotColor} shadow-lg`} />

              {/* Header */}
              <div className="mb-4 flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">v{rel.version}</h2>
                {rel.tag && (
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${rel.tagColor}`}>
                    {rel.tag}
                  </span>
                )}
                <span className="text-gray-600 text-sm">{rel.date}</span>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-6">{rel.summary}</p>

              {/* Change groups */}
              {(['added', 'changed', 'fixed'] as const).map(type => {
                const items = rel.changes[type]
                if (!items.length) return null
                const { label, cls } = tagStyles[type]
                return (
                  <div key={type} className="mb-5">
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] mb-2.5 ${cls}`}>
                      {label}
                    </p>
                    <ul className="space-y-2">
                      {items.map(item => (
                        <li key={item} className="text-sm text-gray-400 flex gap-2.5 leading-relaxed">
                          <span className="text-gray-700 shrink-0 mt-0.5">—</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
