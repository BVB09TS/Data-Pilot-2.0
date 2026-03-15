import { PublicNavbar } from '../components/public/PublicNavbar'
import { PublicFooter } from '../components/public/PublicFooter'

const releases = [
  {
    version: '2.0.0',
    date: 'March 2026',
    tag: 'Latest',
    tagColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    summary: 'Major release. Full rewrite of the audit engine with 8 specialist AI agents, React lineage explorer, and enterprise integrations.',
    changes: {
      added: [
        'New React + D3 lineage explorer with upstream/downstream depth control',
        '8 specialist AI audit agents running in parallel (ThreadPoolExecutor)',
        'AI chat panel with model context auto-injection',
        'Multi-provider LLM routing: Groq → OpenAI → Anthropic with fallback',
        'SARIF 2.1.0 export for GitHub/GitLab security scanning',
        'Jira ticket export format',
        'Airflow DAG generation CLI command',
        'Kubernetes manifest generation CLI command',
        'REST API: /api/v1/health, /report, /audit/trigger, /metrics',
        'Enterprise integrations: Snowflake, Azure, AWS, GitLab, Power BI, Kubernetes',
        'FeedbackStore for append-only run history',
        'Pydantic v2 configuration with full YAML support',
        'Docker + Docker Compose support',
        'GitHub Actions CI with SARIF upload',
      ],
      changed: [
        'Complete rewrite from monolithic agent to pipeline + router architecture',
        'Severity mapping now uses 4 levels: critical, high, medium, low',
        'Report format upgraded — includes cost_usd estimates per finding',
        'CLI rebuilt with Click 8, replacing argparse',
      ],
      fixed: [
        'LLM output parser now handles markdown-wrapped and partial JSON gracefully',
        'Lineage DAG correctly handles circular reference detection',
      ],
    },
  },
  {
    version: '1.4.2',
    date: 'January 2026',
    tag: 'Stable',
    tagColor: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    summary: 'Bug fixes and stability improvements for the v1 agent.',
    changes: {
      added: [
        'Query history JSON parsing for 180-day usage stats',
        'Dead model detection now considers query frequency thresholds',
      ],
      changed: [
        'Groq API upgraded to llama-3.3-70b-versatile',
      ],
      fixed: [
        'Fixed YAML parsing failure on models with empty description blocks',
        'Fixed broken ref detection missing indirect dependencies',
      ],
    },
  },
  {
    version: '1.3.0',
    date: 'November 2025',
    tag: '',
    tagColor: '',
    summary: 'Added orphan detection and duplicate metric analysis.',
    changes: {
      added: [
        'Orphaned model detection (no downstream consumers)',
        'Duplicate metric analysis across model layers',
        'HTML report export',
      ],
      changed: [
        'Improved LLM prompt quality for grain join detection',
      ],
      fixed: [],
    },
  },
  {
    version: '1.0.0',
    date: 'September 2025',
    tag: 'Initial release',
    tagColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    summary: 'First public release. Basic dbt project parsing, lineage DAG, and dead model detection.',
    changes: {
      added: [
        'dbt project parser (SQL + YAML)',
        'NetworkX lineage DAG',
        'Dead model detection',
        'Broken ref detection',
        'JSON and CSV export',
        'Flask web dashboard',
      ],
      changed: [],
      fixed: [],
    },
  },
]

const tagLabels: Record<string, string> = {
  added: '+ Added',
  changed: '~ Changed',
  fixed: '✓ Fixed',
}

const tagStyles: Record<string, string> = {
  added: 'text-green-400',
  changed: 'text-yellow-400',
  fixed: 'text-blue-400',
}

export function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      <div className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-16">
          <h1 className="text-4xl font-bold mb-3">Changelog</h1>
          <p className="text-gray-400">Every release, documented. Subscribe to our newsletter to get notified.</p>
        </div>

        <div className="space-y-16">
          {releases.map(rel => (
            <div key={rel.version} className="relative pl-8 border-l border-white/10">
              {/* Dot */}
              <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-gray-700 border-2 border-gray-600" />

              <div className="mb-4 flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-white">v{rel.version}</h2>
                {rel.tag && (
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${rel.tagColor}`}>
                    {rel.tag}
                  </span>
                )}
                <span className="text-gray-500 text-sm">{rel.date}</span>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-6">{rel.summary}</p>

              {(['added', 'changed', 'fixed'] as const).map(type => {
                const items = rel.changes[type]
                if (!items.length) return null
                return (
                  <div key={type} className="mb-5">
                    <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${tagStyles[type]}`}>
                      {tagLabels[type]}
                    </p>
                    <ul className="space-y-1.5">
                      {items.map(item => (
                        <li key={item} className="text-sm text-gray-300 flex gap-2">
                          <span className="text-gray-600 shrink-0">—</span>
                          {item}
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
