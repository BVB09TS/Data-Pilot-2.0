import { Link } from 'react-router-dom'
import { PublicNavbar } from '../components/public/PublicNavbar'
import { PublicFooter } from '../components/public/PublicFooter'

const features = [
  {
    icon: '🔍',
    title: 'Dead Model Detection',
    desc: 'Automatically find models with zero queries in the past 90 days. Stop paying for compute that delivers no value.',
  },
  {
    icon: '🔗',
    title: 'Lineage Intelligence',
    desc: 'Full upstream/downstream lineage graph. Instantly understand what breaks when you change a model.',
  },
  {
    icon: '⚠️',
    title: 'Grain Join Analysis',
    desc: 'Detect joins across incompatible data grains before they corrupt your metrics and reports.',
  },
  {
    icon: '📋',
    title: 'Best Practices Engine',
    desc: "Define your team's standards in YAML. DataPilot enforces them automatically on every audit.",
  },
  {
    icon: '🤖',
    title: 'AI-Powered Review Bot',
    desc: 'Auto-reviews GitLab MRs touching dbt models. Posts findings as comments, proposes fixes inline.',
  },
  {
    icon: '📊',
    title: 'YAML Docs Scoring',
    desc: 'Score every model on documentation completeness. Surface missing owners, descriptions, and column definitions.',
  },
  {
    icon: '🔀',
    title: 'Duplicate Metric Detection',
    desc: 'Find the same metric computed differently across 6 models. Align your team on a single source of truth.',
  },
  {
    icon: '💸',
    title: 'Cost Impact Reports',
    desc: 'Estimate exactly how much dead models and redundant compute are costing your team per month.',
  },
]

const steps = [
  { step: '01', title: 'Connect your dbt project', desc: 'Point DataPilot at your dbt project directory or connect via dbt Cloud API. Parsing happens in seconds.' },
  { step: '02', title: 'Run the audit', desc: 'DataPilot builds your lineage DAG, runs 8 specialist AI agents in parallel, and scores every model.' },
  { step: '03', title: 'Review findings', desc: 'Prioritised list of problems by severity — critical, high, medium, low — with recommended actions and cost estimates.' },
  { step: '04', title: 'Fix & automate', desc: 'Accept AI-proposed fixes, set up the MR review bot, and schedule daily audits to stay clean.' },
]

const stats = [
  { value: '90%', label: 'Less review time' },
  { value: '2,100+', label: 'Engineering hours saved / year' },
  { value: '28', label: 'Problem categories detected' },
  { value: '<2min', label: 'Audit runtime' },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-blue-400 text-sm font-medium">Now with AI-powered MR review bot</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Your dbt project,
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent">
              audited in minutes.
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            DataPilot scans your dbt project, builds a lineage graph, and uses AI to find dead models,
            broken joins, duplicate metrics, and documentation gaps — before they cost you.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-all hover:scale-105"
            >
              Start free audit →
            </Link>
            <Link
              to="/docs"
              className="text-gray-400 hover:text-white px-8 py-3.5 rounded-xl font-medium text-base border border-white/10 hover:border-white/20 transition-all"
            >
              Read the docs
            </Link>
          </div>

          {/* Hero visual */}
          <div className="mt-20 rounded-2xl border border-white/10 bg-gray-900/50 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-gray-500 text-xs font-mono">datapilot audit --project ./my_dbt_project</span>
            </div>
            <div className="p-6 font-mono text-sm text-left space-y-2">
              <p className="text-gray-500">Parsing 84 models across 4 layers...</p>
              <p className="text-green-400">✓ Lineage DAG built — 84 nodes, 217 edges</p>
              <p className="text-yellow-400">⚠ Running 8 AI audit agents in parallel...</p>
              <p className="text-gray-500 pl-4">  → dead_models: 7 found</p>
              <p className="text-gray-500 pl-4">  → orphaned_models: 6 found</p>
              <p className="text-gray-500 pl-4">  → broken_refs: 2 found</p>
              <p className="text-gray-500 pl-4">  → grain_joins: 1 found</p>
              <p className="text-gray-500 pl-4">  → missing_tests: 4 found</p>
              <p className="text-red-400 font-semibold mt-4">● 3 Critical  ● 8 High  ● 10 Medium  ● 3 Low</p>
              <p className="text-blue-400">→ Estimated wasted compute: $1,840/month</p>
              <p className="text-green-400 font-semibold">Report saved → output/datapilot_report.html</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-white/10 bg-gray-900/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-4xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything your data team needs</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Eight specialist AI agents analyze your dbt project from every angle simultaneously.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(f => (
              <div
                key={f.title}
                className="bg-gray-900/60 border border-white/10 rounded-xl p-6 hover:border-blue-500/30 hover:bg-gray-900 transition-all"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How it works</h2>
            <p className="text-gray-400 text-lg">From zero to full audit in under 2 minutes.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map(s => (
              <div key={s.step} className="relative">
                <div className="text-6xl font-bold text-white/5 mb-4 font-mono">{s.step}</div>
                <h3 className="text-white font-semibold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations strip */}
      <section className="py-16 px-6 border-y border-white/10">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-gray-500 text-sm mb-8 uppercase tracking-widest">Integrates with your stack</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {['dbt Cloud', 'Snowflake', 'GitLab', 'Azure', 'AWS', 'Power BI', 'Airflow', 'Kubernetes'].map(tool => (
              <span key={tool} className="text-gray-400 font-medium text-sm px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                {tool}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6">
            Ready to audit your
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent">
              data platform?
            </span>
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            Free tier includes 1 project, unlimited audits, and full access to all 8 AI agents.
          </p>
          <Link
            to="/login"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105"
          >
            Get started — it's free
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
