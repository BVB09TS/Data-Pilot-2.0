import { Link } from 'react-router-dom'
import { PublicNavbar } from '../components/public/PublicNavbar'
import { PublicFooter } from '../components/public/PublicFooter'

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    title: 'Lineage Intelligence',
    desc: 'Full upstream and downstream lineage graph across your entire data stack. See what breaks before you ship.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Dead Model Detection',
    desc: 'Automatically surface models with zero queries in 90 days. Stop paying for compute that delivers no value.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    title: 'Grain Join Analysis',
    desc: 'Detect joins across incompatible data grains before they silently corrupt your metrics and reports.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Governance Policies',
    desc: 'Define your team\'s standards once. VORO enforces them automatically on every audit and pull request.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    title: 'AI PR Review Bot',
    desc: 'Auto-reviews pull requests touching data models. Posts structured findings as comments with proposed fixes.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Duplicate Metric Detection',
    desc: 'Find the same metric computed with different logic across your models. Align on a single source of truth.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Documentation Scoring',
    desc: 'Score every model on completeness. Surface missing owners, descriptions, and column definitions at scale.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Cost Impact Reports',
    desc: 'Estimate exactly how much dead models and redundant compute cost your team per month, per model.',
  },
]

const steps = [
  {
    step: '01',
    title: 'Connect your data project',
    desc: 'Point VORO at your project directory or connect via API. Parsing happens in seconds — no agents to install.',
  },
  {
    step: '02',
    title: 'Run the audit',
    desc: 'VORO builds a lineage DAG, runs 8 specialist AI agents in parallel, and scores every model and source.',
  },
  {
    step: '03',
    title: 'Review prioritised findings',
    desc: 'Critical, high, medium, low — every issue has a severity, recommended action, and estimated cost impact.',
  },
  {
    step: '04',
    title: 'Fix and automate',
    desc: 'Apply AI-proposed fixes, enable the PR review bot, and schedule daily audits to keep your platform clean.',
  },
]

const stats = [
  { value: '90%', label: 'Less manual review time' },
  { value: '8', label: 'Specialist AI agents' },
  { value: '28+', label: 'Problem categories detected' },
  { value: '<2 min', label: 'Audit runtime' },
]

const integrations = [
  'Snowflake', 'BigQuery', 'Redshift', 'dbt Cloud', 'GitLab', 'GitHub', 'Azure', 'AWS', 'Airflow', 'Kubernetes',
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 bg-white/60 rounded-full" />
            <span className="text-gray-400 text-sm">VORO — AI governance for modern data platforms</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            AI governance for your
            <br />
            <span className="text-white">
              entire data platform
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            VORO connects to your data sources, builds a complete lineage graph, and deploys
            8 specialist AI agents to surface quality issues, cost waste, and governance risks — automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="bg-white hover:bg-neutral-100 text-black px-8 py-3.5 rounded-xl font-semibold text-base transition-all hover:scale-[1.02]"
            >
              Get started free
            </Link>
            <Link
              to="/docs"
              className="text-gray-400 hover:text-white px-8 py-3.5 rounded-xl font-medium text-base border border-white/10 hover:border-white/20 transition-all"
            >
              Read the docs
            </Link>
          </div>

          {/* Terminal */}
          <div className="mt-20 rounded-2xl border border-white/10 bg-gray-900/80 overflow-hidden shadow-2xl text-left">
            <div className="flex items-center gap-2 px-5 py-3.5 bg-gray-900 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-4 text-gray-500 text-xs font-mono">voro audit --project ./my_project --output ./output</span>
            </div>
            <div className="p-6 font-mono text-sm space-y-2">
              <p className="text-gray-500">  Parsing project — 84 models, 4 layers, 217 dependencies...</p>
              <p className="text-green-400">  Lineage DAG built — 84 nodes, 217 edges</p>
              <p className="text-gray-400">  Launching 8 AI audit agents in parallel...</p>
              <div className="pl-4 space-y-1 text-gray-500">
                <p>  dead_models       7 detected</p>
                <p>  orphaned_models   6 detected</p>
                <p>  broken_refs       2 detected</p>
                <p>  grain_joins       1 detected</p>
                <p>  missing_tests     4 detected</p>
                <p>  duplicate_metrics 1 detected</p>
              </div>
              <div className="pt-3 flex flex-wrap gap-4">
                <span className="text-red-400 font-semibold">3 Critical</span>
                <span className="text-orange-400 font-semibold">8 High</span>
                <span className="text-yellow-400 font-semibold">10 Medium</span>
                <span className="text-gray-400 font-semibold">3 Low</span>
              </div>
              <p className="text-gray-500">  Estimated wasted compute: <span className="text-white">$1,840/month</span></p>
              <p className="text-green-400">  Report saved — output/voro_report.html</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-white/[0.07] bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-4xl font-bold text-white mb-1.5 tracking-tight">{s.value}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Everything your data team needs</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Eight specialist AI agents analyze your data platform from every angle — simultaneously.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map(f => (
              <div
                key={f.title}
                className="group bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 hover:border-white/20 hover:bg-white/[0.05] transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-white/60 group-hover:bg-white/10 group-hover:text-white transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-28 px-6 bg-white/[0.02] border-y border-white/[0.07]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">How it works</h2>
            <p className="text-gray-400 text-lg">From zero to a full audit report in under 2 minutes.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
            {steps.map((s, i) => (
              <div key={s.step} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-3 left-full w-full h-px bg-white/10 -translate-x-4" />
                )}
                <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center mb-4">
                  <span className="text-xs font-mono text-gray-400">{s.step}</span>
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600 text-xs mb-8 uppercase tracking-[0.15em]">Integrates with your stack</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {integrations.map(tool => (
              <span
                key={tool}
                className="text-gray-400 text-sm px-4 py-2 bg-white/[0.03] rounded-lg border border-white/[0.08] hover:border-white/15 hover:text-gray-300 transition-colors"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 border-t border-white/[0.07]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6 tracking-tight leading-tight">
            Ready to govern your
            <br />
            data platform?
          </h2>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            Free to start. Connect your project in minutes. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="inline-block bg-white hover:bg-neutral-100 text-black px-10 py-4 rounded-xl font-semibold text-base transition-all hover:scale-[1.02]"
            >
              Get started free
            </Link>
            <Link
              to="/docs"
              className="text-gray-400 hover:text-white text-base font-medium transition-colors"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
