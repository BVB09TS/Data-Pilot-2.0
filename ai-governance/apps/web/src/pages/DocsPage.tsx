import { useState } from 'react'
import { PublicNavbar } from '../components/public/PublicNavbar'
import { PublicFooter } from '../components/public/PublicFooter'

const sections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      { id: 'intro', label: 'Introduction' },
      { id: 'installation', label: 'Installation' },
      { id: 'quickstart', label: 'Quickstart' },
      { id: 'configuration', label: 'Configuration' },
    ],
  },
  {
    id: 'concepts',
    title: 'Concepts',
    items: [
      { id: 'lineage', label: 'Lineage Graph' },
      { id: 'agents', label: 'AI Agents' },
      { id: 'findings', label: 'Findings & Severity' },
      { id: 'best-practices', label: 'Best Practices Engine' },
    ],
  },
  {
    id: 'cli',
    title: 'CLI Reference',
    items: [
      { id: 'audit', label: 'datapilot audit' },
      { id: 'serve', label: 'datapilot serve' },
      { id: 'integrations', label: 'datapilot integrations' },
      { id: 'generate-dag', label: 'datapilot generate-dag' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    items: [
      { id: 'dbt-cloud', label: 'dbt Cloud' },
      { id: 'snowflake', label: 'Snowflake' },
      { id: 'gitlab', label: 'GitLab' },
      { id: 'azure', label: 'Azure' },
      { id: 'powerbi', label: 'Power BI' },
      { id: 'airflow', label: 'Airflow' },
    ],
  },
]

const content: Record<string, { title: string; body: React.ReactNode }> = {
  intro: {
    title: 'Introduction',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          DataPilot is an AI-powered dbt project auditor. It parses your dbt project, builds a lineage DAG,
          runs a set of deterministic + LLM-assisted analysis agents, and produces findings across multiple export formats.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The tool is designed to be pointed at any dbt project and return a prioritised report of problems,
          wasted compute spend, and risks — in minutes, not weeks.
        </p>
        <h3 className="text-white font-semibold text-lg">What DataPilot detects</h3>
        <ul className="space-y-2">
          {[
            ['Dead models', 'Models with 0 queries in the past 90 days'],
            ['Orphaned models', 'Models with no downstream consumers'],
            ['Broken refs', 'ref() calls pointing to non-existent models'],
            ['Wrong grain joins', 'Joins across incompatible data grains'],
            ['Duplicate metrics', 'The same metric computed with different logic across models'],
            ['Missing tests', 'Models lacking not_null, unique, or other dbt tests'],
            ['Deprecated sources', 'Source chains feeding deprecated models'],
            ['Logic drift', 'Business logic that diverged from source definitions'],
          ].map(([name, desc]) => (
            <li key={name} className="flex gap-3 text-sm">
              <span className="text-blue-400 mt-0.5">✓</span>
              <span><strong className="text-white">{name}</strong> — <span className="text-gray-400">{desc}</span></span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  installation: {
    title: 'Installation',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Install DataPilot via pip. Python 3.10+ required.</p>
        <div className="bg-gray-900 rounded-xl border border-white/10 p-4 font-mono text-sm">
          <p className="text-gray-500 mb-2"># Basic install</p>
          <p className="text-green-400">pip install datapilot</p>
          <p className="text-gray-500 mt-4 mb-2"># With all integrations</p>
          <p className="text-green-400">pip install "datapilot[airflow,snowflake,azure,aws]"</p>
          <p className="text-gray-500 mt-4 mb-2"># Development install</p>
          <p className="text-green-400">git clone https://github.com/datapilot/datapilot</p>
          <p className="text-green-400">cd datapilot && pip install -e ".[dev]"</p>
        </div>
        <h3 className="text-white font-semibold">Environment variables</h3>
        <div className="bg-gray-900 rounded-xl border border-white/10 p-4 font-mono text-sm space-y-1">
          <p className="text-gray-500"># .env file</p>
          <p className="text-blue-300">GROQ_API_KEY<span className="text-white">=gsk_...</span>         <span className="text-gray-600"># Required (free)</span></p>
          <p className="text-blue-300">ANTHROPIC_API_KEY<span className="text-white">=sk-ant-...</span>  <span className="text-gray-600"># Optional (premium)</span></p>
          <p className="text-blue-300">OPENAI_API_KEY<span className="text-white">=sk-...</span>         <span className="text-gray-600"># Optional (standard)</span></p>
        </div>
      </div>
    ),
  },
  quickstart: {
    title: 'Quickstart',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Run your first audit in 3 commands.</p>
        <div className="bg-gray-900 rounded-xl border border-white/10 p-4 font-mono text-sm space-y-2">
          <p className="text-gray-500"># 1. Point at your dbt project</p>
          <p className="text-green-400">datapilot audit --project ./my_dbt_project --output ./output</p>
          <p className="text-gray-500 mt-3"># 2. Open the dashboard</p>
          <p className="text-green-400">datapilot serve --report ./output/datapilot_report.json</p>
          <p className="text-gray-500 mt-3"># 3. Or run audit + serve in one command</p>
          <p className="text-green-400">datapilot audit --project ./my_dbt_project --serve --port 5000</p>
        </div>
        <p className="text-gray-400 text-sm">The audit typically completes in under 2 minutes for projects with up to 200 models.</p>
      </div>
    ),
  },
  configuration: {
    title: 'Configuration',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">DataPilot is configured via <code className="bg-gray-800 px-1.5 py-0.5 rounded text-blue-300 text-sm">datapilot.yaml</code> in your project root.</p>
        <div className="bg-gray-900 rounded-xl border border-white/10 p-4 font-mono text-sm space-y-1">
          <p className="text-violet-400">project_root<span className="text-white">: ./my_dbt_project</span></p>
          <p className="text-violet-400">output_dir<span className="text-white">: ./output</span></p>
          <p className="text-violet-400">log_level<span className="text-white">: INFO</span></p>
          <p className="text-gray-500 mt-3"># LLM providers</p>
          <p className="text-violet-400">llm_providers<span className="text-white">:</span></p>
          <p className="text-white pl-4">groq:</p>
          <p className="text-violet-400 pl-8">model<span className="text-white">: llama-3.3-70b-versatile</span></p>
          <p className="text-gray-500 mt-3"># Pipeline settings</p>
          <p className="text-violet-400">pipeline<span className="text-white">:</span></p>
          <p className="text-violet-400 pl-4">max_workers<span className="text-white">: 4</span></p>
          <p className="text-violet-400 pl-4">cache_enabled<span className="text-white">: true</span></p>
        </div>
      </div>
    ),
  },
  audit: {
    title: 'datapilot audit',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Run a full audit on a dbt project.</p>
        <div className="bg-gray-900 rounded-xl border border-white/10 p-4 font-mono text-sm">
          <p className="text-green-400">datapilot audit [OPTIONS]</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 text-gray-400 font-medium">Option</th>
              <th className="text-left py-2 text-gray-400 font-medium">Default</th>
              <th className="text-left py-2 text-gray-400 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              ['--project', './', 'Path to dbt project root'],
              ['--output', './output', 'Output directory for reports'],
              ['--serve', 'false', 'Start web dashboard after audit'],
              ['--port', '5000', 'Dashboard port (with --serve)'],
              ['--config', 'datapilot.yaml', 'Config file path'],
            ].map(([opt, def, desc]) => (
              <tr key={opt}>
                <td className="py-2.5 font-mono text-blue-300 text-xs">{opt}</td>
                <td className="py-2.5 text-gray-500 text-xs">{def}</td>
                <td className="py-2.5 text-gray-400 text-xs">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
}

export function DocsPage() {
  const [activeId, setActiveId] = useState('intro')
  const active = content[activeId] ?? content['intro']

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNavbar />

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 flex gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 pt-8">
          <div className="sticky top-24 space-y-6">
            {sections.map(sec => (
              <div key={sec.id}>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{sec.title}</p>
                <ul className="space-y-1">
                  {sec.items.map(item => (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveId(item.id)}
                        className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                          activeId === item.id
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 pt-8 min-w-0">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold mb-8">{active.title}</h1>
            <div className="prose-custom">{active.body}</div>
          </div>
        </main>
      </div>

      <PublicFooter />
    </div>
  )
}
