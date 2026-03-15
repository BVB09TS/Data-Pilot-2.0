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
      { id: 'policies', label: 'Governance Policies' },
    ],
  },
  {
    id: 'cli',
    title: 'CLI Reference',
    items: [
      { id: 'cli-audit', label: 'datapilot audit' },
      { id: 'cli-serve', label: 'datapilot serve' },
      { id: 'cli-integrations', label: 'datapilot integrations' },
      { id: 'cli-generate-dag', label: 'datapilot generate-dag' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    items: [
      { id: 'int-snowflake', label: 'Snowflake' },
      { id: 'int-gitlab', label: 'GitLab' },
      { id: 'int-github', label: 'GitHub' },
      { id: 'int-azure', label: 'Azure' },
      { id: 'int-airflow', label: 'Airflow' },
    ],
  },
]

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-white/[0.08] text-blue-300 text-[13px] px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  )
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-white/[0.08] p-5 font-mono text-sm space-y-1 overflow-x-auto">
      {children}
    </div>
  )
}

const content: Record<string, { title: string; body: React.ReactNode }> = {
  intro: {
    title: 'Introduction',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          DataPilot is an AI-powered governance platform for data teams. It connects to your data projects,
          builds a complete lineage graph, and deploys 8 specialist AI agents to surface quality issues,
          cost waste, and governance risks — in minutes, not weeks.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The platform works as both a CLI tool and a full web application. Run ad-hoc audits from your
          terminal or use the dashboard for continuous governance across your team.
        </p>
        <h3 className="text-white font-semibold text-base pt-2">What DataPilot detects</h3>
        <ul className="space-y-3">
          {[
            ['Dead models', 'Models with 0 queries in the past 90 days — compute you're paying for but nobody uses'],
            ['Orphaned models', 'Models with no downstream consumers — dead ends in your lineage graph'],
            ['Broken refs', 'References to models that no longer exist — silent errors in your pipeline'],
            ['Wrong grain joins', 'Joins across incompatible data grains — a common cause of corrupted metrics'],
            ['Duplicate metrics', 'The same metric computed with different logic — prevents a single source of truth'],
            ['Missing tests', 'Models lacking data quality tests — unvalidated assumptions in production'],
            ['Deprecated sources', 'Source chains feeding deprecated models — tech debt hidden in lineage'],
            ['Logic drift', 'Business logic that has diverged from source definitions — model rot over time'],
          ].map(([name, desc]) => (
            <li key={name} className="flex gap-3 text-sm">
              <span className="text-blue-400 mt-0.5 shrink-0">✓</span>
              <span>
                <strong className="text-white">{name}</strong>
                <span className="text-gray-500"> — {desc}</span>
              </span>
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
        <p className="text-gray-300">Install the DataPilot CLI via pip. Python 3.10+ is required.</p>
        <Block>
          <p className="text-gray-600"># Core install</p>
          <p className="text-green-400">pip install datapilot</p>
          <p className="text-gray-600 mt-3"># With optional integrations</p>
          <p className="text-green-400">pip install "datapilot[airflow,snowflake,azure,aws]"</p>
          <p className="text-gray-600 mt-3"># Development install (from source)</p>
          <p className="text-green-400">git clone https://github.com/datapilot/datapilot</p>
          <p className="text-green-400">cd datapilot && pip install -e ".[dev]"</p>
        </Block>
        <h3 className="text-white font-semibold text-base">Environment variables</h3>
        <p className="text-gray-400 text-sm">
          At minimum you need a Groq API key (free tier). Anthropic and OpenAI are optional — used for
          premium-tier analysis tasks via automatic routing.
        </p>
        <Block>
          <p className="text-gray-600"># .env file at project root</p>
          <p><span className="text-violet-400">GROQ_API_KEY</span><span className="text-white">=gsk_...</span>          <span className="text-gray-600">  # Required</span></p>
          <p><span className="text-violet-400">ANTHROPIC_API_KEY</span><span className="text-white">=sk-ant-...</span>   <span className="text-gray-600">  # Optional</span></p>
          <p><span className="text-violet-400">OPENAI_API_KEY</span><span className="text-white">=sk-...</span>          <span className="text-gray-600">  # Optional</span></p>
        </Block>
      </div>
    ),
  },
  quickstart: {
    title: 'Quickstart',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Run your first audit in 2 commands.</p>
        <Block>
          <p className="text-gray-600"># Run a full audit</p>
          <p className="text-green-400">datapilot audit --project ./my_project --output ./output</p>
          <p className="text-gray-600 mt-4"># Open the web dashboard</p>
          <p className="text-green-400">datapilot serve --report ./output/datapilot_report.json</p>
          <p className="text-gray-600 mt-4"># Audit + serve in one command</p>
          <p className="text-green-400">datapilot audit --project ./my_project --serve --port 5000</p>
        </Block>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm">
          <p className="text-white font-medium mb-1">Typical runtime</p>
          <p className="text-gray-400">Audits complete in under 2 minutes for projects with up to 200 models. Larger projects scale linearly — all 8 agents run in parallel via <Code>ThreadPoolExecutor</Code>.</p>
        </div>
      </div>
    ),
  },
  configuration: {
    title: 'Configuration',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">
          DataPilot is configured via <Code>datapilot.yaml</Code> in your project root.
          Environment variables in <Code>.env</Code> override YAML values.
        </p>
        <Block>
          <p><span className="text-violet-400">project_root</span><span className="text-white">: ./my_project</span></p>
          <p><span className="text-violet-400">output_dir</span><span className="text-white">: ./output</span></p>
          <p><span className="text-violet-400">log_level</span><span className="text-white">: INFO</span></p>
          <p className="text-gray-600 mt-3"># LLM providers</p>
          <p><span className="text-violet-400">llm_providers</span><span className="text-white">:</span></p>
          <p className="text-white pl-4">groq:</p>
          <p className="pl-8"><span className="text-violet-400">model</span><span className="text-white">: llama-3.3-70b-versatile</span></p>
          <p className="text-gray-600 mt-3"># Pipeline settings</p>
          <p><span className="text-violet-400">pipeline</span><span className="text-white">:</span></p>
          <p className="pl-4"><span className="text-violet-400">max_workers</span><span className="text-white">: 4</span></p>
          <p className="pl-4"><span className="text-violet-400">cache_enabled</span><span className="text-white">: true</span></p>
        </Block>
        <p className="text-gray-500 text-sm">
          See <Code>datapilot.example.yaml</Code> in the repository root for the full configuration reference with all options and defaults.
        </p>
      </div>
    ),
  },
  lineage: {
    title: 'Lineage Graph',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          DataPilot builds a directed acyclic graph (DAG) of your entire data project. Each node is a model
          or source, and each edge represents a dependency. The graph is built deterministically from your
          project files — no database connection required.
        </p>
        <h3 className="text-white font-semibold text-base">What the graph enables</h3>
        <ul className="space-y-2 text-sm">
          {[
            'Upstream impact analysis — what feeds into this model?',
            'Downstream blast radius — if this model changes, what breaks?',
            'Dead model identification — models with no downstream consumers',
            'Broken ref detection — refs pointing to non-existent models',
            'Grain propagation analysis — tracking granularity changes across joins',
          ].map(item => (
            <li key={item} className="flex gap-2.5 text-gray-400">
              <span className="text-gray-600 shrink-0 mt-0.5">—</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-gray-400 text-sm leading-relaxed">
          The interactive lineage explorer in the dashboard uses ReactFlow with an auto-dagre layout.
          You can navigate to any model with <Code>/lineage?focus=model_name</Code>.
        </p>
      </div>
    ),
  },
  agents: {
    title: 'AI Agents',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          DataPilot runs 8 specialist AI agents in parallel. Each agent combines deterministic graph analysis
          with LLM-assisted reasoning. LLM calls are routed automatically by task complexity.
        </p>
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Agent</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">LLM tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {[
                ['dead_models', 'Standard'],
                ['orphans', 'Standard'],
                ['broken_refs', 'Free'],
                ['deprecated_sources', 'Free'],
                ['missing_tests', 'Free'],
                ['duplicate_metrics', 'Premium'],
                ['grain_joins', 'Premium'],
                ['logic_drift', 'Standard'],
              ].map(([agent, tier]) => (
                <tr key={agent}>
                  <td className="px-4 py-3 font-mono text-blue-300 text-xs">{agent}</td>
                  <td className="px-4 py-3 text-gray-400">{tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-gray-500 text-sm">
          Tier routing: <strong className="text-gray-300">Free</strong> → Groq Llama, <strong className="text-gray-300">Standard</strong> → GPT-4o-mini, <strong className="text-gray-300">Premium</strong> → Claude / GPT-4o. Automatic fallback to lower tier if a key is missing.
        </p>
      </div>
    ),
  },
  findings: {
    title: 'Findings & Severity',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Every finding has a type, severity level, title, description, recommended action, and estimated cost impact in USD.
        </p>
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Finding type</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {[
                ['broken_lineage', 'Critical', 'text-red-400'],
                ['wrong_grain_join', 'Critical', 'text-red-400'],
                ['dead_model', 'High', 'text-orange-400'],
                ['duplicate_metric', 'High', 'text-orange-400'],
                ['orphaned_model', 'Medium', 'text-yellow-400'],
                ['missing_tests', 'Medium', 'text-yellow-400'],
                ['logic_drift', 'Medium', 'text-yellow-400'],
                ['deprecated_source', 'Low', 'text-blue-400'],
              ].map(([type, sev, cls]) => (
                <tr key={type}>
                  <td className="px-4 py-3 font-mono text-blue-300 text-xs">{type}</td>
                  <td className={`px-4 py-3 text-sm font-medium ${cls}`}>{sev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  policies: {
    title: 'Governance Policies',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Governance policies let you define your team's standards as code. Policies are evaluated automatically
          against every audit run and can block deployments via the PR review bot.
        </p>
        <h3 className="text-white font-semibold text-base">Rule types</h3>
        <ul className="space-y-2 text-sm">
          {[
            ['require_field', 'Assert that a specific metadata field is present on all models'],
            ['deny_value', 'Reject runs where a field contains a prohibited value'],
            ['require_connection', 'Ensure a named connection is healthy before allowing a run'],
            ['max_runs', 'Cap the number of concurrent or total runs for a pipeline'],
          ].map(([rule, desc]) => (
            <li key={rule} className="flex gap-3 text-sm">
              <Code>{rule}</Code>
              <span className="text-gray-400">{desc}</span>
            </li>
          ))}
        </ul>
        <p className="text-gray-400 text-sm leading-relaxed">
          Policies are managed from the <strong className="text-white">Policies</strong> page in the dashboard.
          Each policy supports multiple rules and can be activated or deactivated independently.
        </p>
      </div>
    ),
  },
  'cli-audit': {
    title: 'datapilot audit',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Run a full audit on a data project.</p>
        <Block>
          <p className="text-green-400">datapilot audit [OPTIONS]</p>
        </Block>
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Option</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Default</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {[
                ['--project', './', 'Path to project root'],
                ['--output', './output', 'Output directory for reports'],
                ['--serve', 'false', 'Start web dashboard after audit'],
                ['--port', '5000', 'Dashboard port (with --serve)'],
                ['--config', 'datapilot.yaml', 'Config file path'],
              ].map(([opt, def, desc]) => (
                <tr key={opt}>
                  <td className="px-4 py-3 font-mono text-blue-300 text-xs whitespace-nowrap">{opt}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{def}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  'cli-serve': {
    title: 'datapilot serve',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Serve a previously generated report on the web dashboard.</p>
        <Block>
          <p className="text-green-400">datapilot serve --report ./output/datapilot_report.json</p>
          <p className="text-green-400">datapilot serve --report ./output/datapilot_report.json --port 8080</p>
        </Block>
        <p className="text-gray-400 text-sm">Opens the interactive lineage explorer and findings table. No re-analysis — uses the cached report.</p>
      </div>
    ),
  },
  'cli-integrations': {
    title: 'datapilot integrations',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Check health of all configured integrations.</p>
        <Block>
          <p className="text-green-400">datapilot integrations --check</p>
          <p className="text-gray-600 mt-3"># Example output</p>
          <p className="text-green-400">✓ snowflake       connected</p>
          <p className="text-green-400">✓ azure_storage   connected</p>
          <p className="text-yellow-400">⚠ airflow         degraded — API returned 503</p>
          <p className="text-red-400">✗ gitlab          failed — invalid token</p>
        </Block>
      </div>
    ),
  },
  'cli-generate-dag': {
    title: 'datapilot generate-dag',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Generate an Airflow DAG that runs DataPilot on a schedule.</p>
        <Block>
          <p className="text-green-400">datapilot generate-dag --schedule "0 6 * * *"</p>
          <p className="text-green-400">datapilot generate-dag --schedule "0 6 * * *" --output ./dags/datapilot.py</p>
        </Block>
        <p className="text-gray-400 text-sm">
          The generated DAG runs <Code>datapilot audit</Code> and uploads the SARIF report to configured storage.
          Use <Code>datapilot generate-k8s</Code> to generate Kubernetes manifests instead.
        </p>
      </div>
    ),
  },
  'int-snowflake': {
    title: 'Snowflake',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Connect DataPilot to Snowflake to enrich audit findings with live query history and table statistics.</p>
        <Block>
          <p className="text-gray-600"># datapilot.yaml</p>
          <p><span className="text-violet-400">integrations</span><span className="text-white">:</span></p>
          <p className="pl-4"><span className="text-violet-400">snowflake</span><span className="text-white">:</span></p>
          <p className="pl-8"><span className="text-violet-400">account</span><span className="text-white">: myorg.us-east-1</span></p>
          <p className="pl-8"><span className="text-violet-400">user</span><span className="text-white">: datapilot_svc</span></p>
          <p className="pl-8"><span className="text-violet-400">warehouse</span><span className="text-white">: COMPUTE_WH</span></p>
          <p className="pl-8"><span className="text-violet-400">database</span><span className="text-white">: ANALYTICS</span></p>
        </Block>
        <p className="text-gray-500 text-sm">Set <Code>SNOWFLAKE_PASSWORD</Code> in your environment. Install with <Code>pip install "datapilot[snowflake]"</Code>.</p>
      </div>
    ),
  },
  'int-gitlab': {
    title: 'GitLab',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Connect to GitLab to post audit findings as MR comments and upload SARIF to the security dashboard.</p>
        <Block>
          <p className="text-gray-600"># Environment variables</p>
          <p><span className="text-violet-400">GITLAB_TOKEN</span><span className="text-white">=glpat-...</span></p>
          <p><span className="text-violet-400">GITLAB_PROJECT_ID</span><span className="text-white">=12345</span></p>
        </Block>
        <p className="text-gray-500 text-sm">The GitLab integration enables the MR review bot. DataPilot posts structured findings as review comments and proposes inline fixes.</p>
      </div>
    ),
  },
  'int-github': {
    title: 'GitHub',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Connect GitHub to enable the PR review bot and upload SARIF findings to GitHub Advanced Security.</p>
        <p className="text-gray-400 text-sm leading-relaxed">
          Configure a webhook in your GitHub repository settings pointing to your DataPilot API endpoint.
          Set the <Code>GITHUB_WEBHOOK_SECRET</Code> environment variable to validate payloads.
        </p>
        <Block>
          <p className="text-gray-600"># Webhook endpoint</p>
          <p className="text-white">POST /api/v1/github/webhook</p>
        </Block>
        <p className="text-gray-500 text-sm">The PR review bot automatically triggers an audit on every PR that touches data model files and posts findings as review comments.</p>
      </div>
    ),
  },
  'int-azure': {
    title: 'Azure',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Export audit reports to Azure Blob Storage and authenticate via Managed Identity or service principal.</p>
        <Block>
          <p className="text-gray-600"># datapilot.yaml</p>
          <p><span className="text-violet-400">integrations</span><span className="text-white">:</span></p>
          <p className="pl-4"><span className="text-violet-400">azure</span><span className="text-white">:</span></p>
          <p className="pl-8"><span className="text-violet-400">storage_account</span><span className="text-white">: mystorageaccount</span></p>
          <p className="pl-8"><span className="text-violet-400">container</span><span className="text-white">: datapilot-reports</span></p>
          <p className="pl-8"><span className="text-violet-400">use_managed_identity</span><span className="text-white">: true</span></p>
        </Block>
        <p className="text-gray-500 text-sm">Install with <Code>pip install "datapilot[azure]"</Code>.</p>
      </div>
    ),
  },
  'int-airflow': {
    title: 'Airflow',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Schedule DataPilot audits as Airflow DAG tasks and trigger audits via the Airflow REST API.</p>
        <Block>
          <p className="text-green-400">datapilot generate-dag \</p>
          <p className="text-green-400 pl-4">  --schedule "0 6 * * *" \</p>
          <p className="text-green-400 pl-4">  --output ./dags/datapilot_audit.py</p>
        </Block>
        <p className="text-gray-400 text-sm leading-relaxed">
          The generated DAG uses the <Code>BashOperator</Code> to run <Code>datapilot audit</Code> and
          the <Code>S3HookOperator</Code> or <Code>AzureBlobStorageHook</Code> to upload reports.
        </p>
        <p className="text-gray-500 text-sm">Install with <Code>pip install "datapilot[airflow]"</Code>.</p>
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

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 flex gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0 pt-8">
          <div className="sticky top-24 space-y-7">
            {sections.map(sec => (
              <div key={sec.id}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-600 mb-2 px-3">
                  {sec.title}
                </p>
                <ul className="space-y-0.5">
                  {sec.items.map(item => (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveId(item.id)}
                        className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                          activeId === item.id
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
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
            <h1 className="text-2xl font-bold mb-8 tracking-tight">{active.title}</h1>
            <div className="space-y-4">{active.body}</div>
          </div>
        </main>
      </div>

      <PublicFooter />
    </div>
  )
}
