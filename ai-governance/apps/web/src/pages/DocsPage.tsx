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
      { id: 'cli-audit', label: 'voro audit' },
      { id: 'cli-serve', label: 'voro serve' },
      { id: 'cli-integrations', label: 'voro integrations' },
      { id: 'cli-generate-dag', label: 'voro generate-dag' },
    ],
  },
  {
    id: 'api-reference',
    title: 'API Reference',
    items: [
      { id: 'api-overview', label: 'Overview' },
      { id: 'api-auth', label: 'Authentication' },
      { id: 'api-endpoints', label: 'Endpoints' },
    ],
  },
  {
    id: 'agent-reference',
    title: 'Agent Reference',
    items: [
      { id: 'agent-dead-models', label: 'Dead Models' },
      { id: 'agent-orphans', label: 'Orphans' },
      { id: 'agent-broken-refs', label: 'Broken Refs' },
      { id: 'agent-grain-joins', label: 'Grain Joins' },
      { id: 'agent-duplicate-metrics', label: 'Duplicate Metrics' },
      { id: 'agent-missing-tests', label: 'Missing Tests' },
    ],
  },
  {
    id: 'deployment',
    title: 'Deployment',
    items: [
      { id: 'deploy-docker', label: 'Docker' },
      { id: 'deploy-kubernetes', label: 'Kubernetes' },
      { id: 'deploy-env', label: 'Environment Variables' },
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
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    items: [
      { id: 'faq', label: 'FAQ' },
      { id: 'common-errors', label: 'Common Errors' },
    ],
  },
]

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-white/[0.08] text-gray-300 text-[13px] px-1.5 py-0.5 rounded font-mono">
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

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.03]">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-400 text-sm">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const content: Record<string, { title: string; body: React.ReactNode }> = {
  intro: {
    title: 'Introduction',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          VORO is an AI-powered governance platform for data teams. It connects to your data projects,
          builds a complete lineage graph, and deploys 8 specialist AI agents to surface quality issues,
          cost waste, and governance risks — in minutes, not weeks.
        </p>
        <p className="text-gray-300 leading-relaxed">
          The platform works as both a CLI tool and a full web application. Run ad-hoc audits from your
          terminal or use the dashboard for continuous governance across your team.
        </p>
        <h3 className="text-white font-semibold text-base pt-2">What VORO detects</h3>
        <ul className="space-y-3">
          {[
            ['Dead models', 'Models with 0 queries in the past 90 days — compute you\'re paying for but nobody uses'],
            ['Orphaned models', 'Models with no downstream consumers — dead ends in your lineage graph'],
            ['Broken refs', 'References to models that no longer exist — silent errors in your pipeline'],
            ['Wrong grain joins', 'Joins across incompatible data grains — a common cause of corrupted metrics'],
            ['Duplicate metrics', 'The same metric computed with different logic — prevents a single source of truth'],
            ['Missing tests', 'Models lacking data quality tests — unvalidated assumptions in production'],
            ['Deprecated sources', 'Source chains feeding deprecated models — tech debt hidden in lineage'],
            ['Logic drift', 'Business logic that has diverged from source definitions — model rot over time'],
          ].map(([name, desc]) => (
            <li key={name} className="flex gap-3 text-sm">
              <span className="text-white/40 mt-0.5 shrink-0">—</span>
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
        <p className="text-gray-300">Install the VORO CLI via pip. Python 3.10+ is required.</p>
        <Block>
          <p className="text-gray-600"># Core install</p>
          <p className="text-green-400">pip install datapilot</p>
          <p className="text-gray-600 mt-3"># With optional integrations</p>
          <p className="text-green-400">pip install "datapilot[airflow,snowflake,azure,aws]"</p>
          <p className="text-gray-600 mt-3"># Development install (from source)</p>
          <p className="text-green-400">git clone https://github.com/voro-ai/voro</p>
          <p className="text-green-400">cd voro && pip install -e ".[dev]"</p>
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
          <p className="text-green-400">voro audit --project ./my_project --output ./output</p>
          <p className="text-gray-600 mt-4"># Open the web dashboard</p>
          <p className="text-green-400">voro serve --report ./output/voro_report.json</p>
          <p className="text-gray-600 mt-4"># Audit + serve in one command</p>
          <p className="text-green-400">voro audit --project ./my_project --serve --port 5000</p>
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
          VORO is configured via <Code>datapilot.yaml</Code> in your project root.
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
          VORO builds a directed acyclic graph (DAG) of your entire data project. Each node is a model
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
          VORO runs 8 specialist AI agents in parallel. Each agent combines deterministic graph analysis
          with LLM-assisted reasoning. LLM calls are routed automatically by task complexity.
        </p>
        <Table
          headers={['Agent', 'LLM tier']}
          rows={[
            [<span className="font-mono text-gray-300 text-xs">dead_models</span>, 'Standard'],
            [<span className="font-mono text-gray-300 text-xs">orphans</span>, 'Standard'],
            [<span className="font-mono text-gray-300 text-xs">broken_refs</span>, 'Free'],
            [<span className="font-mono text-gray-300 text-xs">deprecated_sources</span>, 'Free'],
            [<span className="font-mono text-gray-300 text-xs">missing_tests</span>, 'Free'],
            [<span className="font-mono text-gray-300 text-xs">duplicate_metrics</span>, 'Premium'],
            [<span className="font-mono text-gray-300 text-xs">grain_joins</span>, 'Premium'],
            [<span className="font-mono text-gray-300 text-xs">logic_drift</span>, 'Standard'],
          ]}
        />
        <p className="text-gray-500 text-sm">
          Tier routing: <strong className="text-gray-300">Free</strong> — Groq Llama, <strong className="text-gray-300">Standard</strong> — GPT-4o-mini, <strong className="text-gray-300">Premium</strong> — Claude / GPT-4o. Automatic fallback to lower tier if a key is missing.
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
        <Table
          headers={['Finding type', 'Severity']}
          rows={[
            [<span className="font-mono text-gray-300 text-xs">broken_lineage</span>, <span className="text-red-400 font-medium">Critical</span>],
            [<span className="font-mono text-gray-300 text-xs">wrong_grain_join</span>, <span className="text-red-400 font-medium">Critical</span>],
            [<span className="font-mono text-gray-300 text-xs">dead_model</span>, <span className="text-orange-400 font-medium">High</span>],
            [<span className="font-mono text-gray-300 text-xs">duplicate_metric</span>, <span className="text-orange-400 font-medium">High</span>],
            [<span className="font-mono text-gray-300 text-xs">orphaned_model</span>, <span className="text-yellow-400 font-medium">Medium</span>],
            [<span className="font-mono text-gray-300 text-xs">missing_tests</span>, <span className="text-yellow-400 font-medium">Medium</span>],
            [<span className="font-mono text-gray-300 text-xs">logic_drift</span>, <span className="text-yellow-400 font-medium">Medium</span>],
            [<span className="font-mono text-gray-300 text-xs">deprecated_source</span>, <span className="text-gray-400 font-medium">Low</span>],
          ]}
        />
        <h3 className="text-white font-semibold text-base pt-2">Finding structure</h3>
        <Block>
          <p className="text-gray-600">{'// Example finding JSON'}</p>
          <p className="text-white">{'{'}</p>
          <p className="pl-4"><span className="text-violet-400">"id"</span><span className="text-white">: "finding_abc123",</span></p>
          <p className="pl-4"><span className="text-violet-400">"type"</span><span className="text-white">: "dead_model",</span></p>
          <p className="pl-4"><span className="text-violet-400">"severity"</span><span className="text-white">: "high",</span></p>
          <p className="pl-4"><span className="text-violet-400">"model"</span><span className="text-white">: "stg_orders_v2",</span></p>
          <p className="pl-4"><span className="text-violet-400">"title"</span><span className="text-white">: "Model unused for 97 days",</span></p>
          <p className="pl-4"><span className="text-violet-400">"recommended_action"</span><span className="text-white">: "Archive or remove the model.",</span></p>
          <p className="pl-4"><span className="text-violet-400">"cost_usd"</span><span className="text-white">: 280.50,</span></p>
          <p className="pl-4"><span className="text-violet-400">"confidence"</span><span className="text-white">: 0.95</span></p>
          <p className="text-white">{'}'}</p>
        </Block>
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
        <Table
          headers={['Rule type', 'Description']}
          rows={[
            [<Code>require_field</Code>, 'Assert that a specific metadata field is present on all models'],
            [<Code>deny_value</Code>, 'Reject runs where a field contains a prohibited value'],
            [<Code>require_connection</Code>, 'Ensure a named connection is healthy before allowing a run'],
            [<Code>max_runs</Code>, 'Cap the number of concurrent or total runs for a pipeline'],
          ]}
        />
        <h3 className="text-white font-semibold text-base pt-2">Policy evaluation response</h3>
        <Block>
          <p className="text-gray-600">{'// Evaluation result shape'}</p>
          <p className="text-white">{'{'}</p>
          <p className="pl-4"><span className="text-violet-400">"policy_id"</span><span className="text-white">: "pol_xyz",</span></p>
          <p className="pl-4"><span className="text-violet-400">"passed"</span><span className="text-white">: false,</span></p>
          <p className="pl-4"><span className="text-violet-400">"violations"</span><span className="text-white">: [</span></p>
          <p className="pl-8 text-white">{'{'}</p>
          <p className="pl-12"><span className="text-violet-400">"rule"</span><span className="text-white">: "require_field",</span></p>
          <p className="pl-12"><span className="text-violet-400">"field"</span><span className="text-white">: "owner",</span></p>
          <p className="pl-12"><span className="text-violet-400">"message"</span><span className="text-white">: "Field 'owner' missing on 3 models"</span></p>
          <p className="pl-8 text-white">{'}'}</p>
          <p className="pl-4 text-white">{']'}</p>
          <p className="text-white">{'}'}</p>
        </Block>
        <p className="text-gray-400 text-sm leading-relaxed">
          Policies are managed from the <strong className="text-white">Policies</strong> page in the dashboard.
          Each policy supports multiple rules and can be activated or deactivated independently.
        </p>
      </div>
    ),
  },
  'cli-audit': {
    title: 'voro audit',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Run a full audit on a data project.</p>
        <Block>
          <p className="text-green-400">voro audit [OPTIONS]</p>
        </Block>
        <Table
          headers={['Option', 'Default', 'Description']}
          rows={[
            [<Code>--project</Code>, './', 'Path to project root'],
            [<Code>--output</Code>, './output', 'Output directory for reports'],
            [<Code>--serve</Code>, 'false', 'Start web dashboard after audit'],
            [<Code>--port</Code>, '5000', 'Dashboard port (with --serve)'],
            [<Code>--config</Code>, 'datapilot.yaml', 'Config file path'],
          ]}
        />
      </div>
    ),
  },
  'cli-serve': {
    title: 'voro serve',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Serve a previously generated report on the web dashboard.</p>
        <Block>
          <p className="text-green-400">voro serve --report ./output/voro_report.json</p>
          <p className="text-green-400">voro serve --report ./output/voro_report.json --port 8080</p>
        </Block>
        <p className="text-gray-400 text-sm">Opens the interactive lineage explorer and findings table. No re-analysis — uses the cached report.</p>
      </div>
    ),
  },
  'cli-integrations': {
    title: 'voro integrations',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Check health of all configured integrations.</p>
        <Block>
          <p className="text-green-400">voro integrations --check</p>
          <p className="text-gray-600 mt-3"># Example output</p>
          <p className="text-green-400">  snowflake       connected</p>
          <p className="text-green-400">  azure_storage   connected</p>
          <p className="text-yellow-400">  airflow         degraded — API returned 503</p>
          <p className="text-red-400">  gitlab          failed — invalid token</p>
        </Block>
      </div>
    ),
  },
  'cli-generate-dag': {
    title: 'voro generate-dag',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Generate an Airflow DAG that runs VORO on a schedule.</p>
        <Block>
          <p className="text-green-400">voro generate-dag --schedule "0 6 * * *"</p>
          <p className="text-green-400">voro generate-dag --schedule "0 6 * * *" --output ./dags/voro.py</p>
        </Block>
        <p className="text-gray-400 text-sm">
          The generated DAG runs <Code>voro audit</Code> and uploads the SARIF report to configured storage.
          Use <Code>voro generate-k8s</Code> to generate Kubernetes manifests instead.
        </p>
      </div>
    ),
  },
  'api-overview': {
    title: 'API Overview',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          VORO exposes a REST API under <Code>/api/v1</Code>. All requests must be authenticated with a JWT
          token issued at login. The API uses JSON for request and response bodies.
        </p>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm">
          <p className="text-white font-medium mb-1">Base URL</p>
          <p className="text-gray-400 font-mono">https://your-voro-instance.com/api/v1</p>
        </div>
        <h3 className="text-white font-semibold text-base">Response format</h3>
        <p className="text-gray-400 text-sm">All successful responses return <Code>200 OK</Code> with a JSON body. Errors follow this shape:</p>
        <Block>
          <p className="text-white">{'{'}</p>
          <p className="pl-4"><span className="text-violet-400">"error"</span><span className="text-white">: "Description of what went wrong"</span></p>
          <p className="text-white">{'}'}</p>
        </Block>
        <h3 className="text-white font-semibold text-base">Workspace scoping</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          Most endpoints are scoped to a workspace: <Code>/api/workspaces/:workspaceId/...</Code>.
          Your workspace ID is returned in the session object after login and available in the Settings page.
        </p>
      </div>
    ),
  },
  'api-auth': {
    title: 'Authentication',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          VORO uses JWT tokens stored in an <Code>HttpOnly</Code> cookie. After logging in via email or OAuth,
          the cookie is set automatically. All subsequent API requests include it via the browser's cookie jar.
        </p>
        <h3 className="text-white font-semibold text-base">OAuth providers</h3>
        <Table
          headers={['Provider', 'Endpoint']}
          rows={[
            ['GitHub', <Code>/auth/github</Code>],
            ['GitLab', <Code>/auth/gitlab</Code>],
            ['Google', <Code>/auth/google</Code>],
          ]}
        />
        <h3 className="text-white font-semibold text-base pt-2">Email login</h3>
        <Block>
          <p className="text-gray-600">POST /auth/login</p>
          <p className="text-white mt-2">{'{'}</p>
          <p className="pl-4"><span className="text-violet-400">"email"</span><span className="text-white">: "you@company.com",</span></p>
          <p className="pl-4"><span className="text-violet-400">"password"</span><span className="text-white">: "..."</span></p>
          <p className="text-white">{'}'}</p>
        </Block>
        <p className="text-gray-400 text-sm">
          CSRF protection is active. The API validates <Code>Origin</Code> and <Code>Referer</Code> headers on all state-mutating requests.
        </p>
      </div>
    ),
  },
  'api-endpoints': {
    title: 'Endpoints',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Complete list of available REST endpoints. All workspace-scoped endpoints require authentication.</p>
        <h3 className="text-white font-semibold text-base">Health</h3>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', <Code>/health</Code>, 'Liveness check — returns 200 OK'],
          ]}
        />
        <h3 className="text-white font-semibold text-base pt-2">Audit</h3>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['POST', <Code>/api/workspaces/:id/datapilot/audit</Code>, 'Trigger a new audit run'],
            ['GET', <Code>/api/workspaces/:id/datapilot/findings</Code>, 'List all findings for workspace'],
            ['GET', <Code>/api/workspaces/:id/datapilot/findings/:findingId</Code>, 'Get a single finding'],
            ['GET', <Code>/api/workspaces/:id/datapilot/quota</Code>, 'Get audit quota and usage'],
          ]}
        />
        <h3 className="text-white font-semibold text-base pt-2">Lineage</h3>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', <Code>/api/workspaces/:id/lineage</Code>, 'Full lineage graph as adjacency list'],
            ['GET', <Code>/api/workspaces/:id/lineage/manifest</Code>, 'Portable JSON manifest'],
            ['GET', <Code>/api/workspaces/:id/lineage/ancestors/:nodeId</Code>, 'Upstream ancestors of a node'],
            ['GET', <Code>/api/workspaces/:id/lineage/descendants/:nodeId</Code>, 'Downstream descendants of a node'],
          ]}
        />
        <h3 className="text-white font-semibold text-base pt-2">Governance</h3>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', <Code>/api/workspaces/:id/policies</Code>, 'List policies'],
            ['POST', <Code>/api/workspaces/:id/policies</Code>, 'Create policy'],
            ['POST', <Code>/api/workspaces/:id/policies/:policyId/evaluate</Code>, 'Evaluate policy against latest run'],
            ['GET', <Code>/api/workspaces/:id/audit-log</Code>, 'Read-only audit event log'],
          ]}
        />
        <h3 className="text-white font-semibold text-base pt-2">Connections & Runs</h3>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', <Code>/api/workspaces/:id/connections</Code>, 'List data connections'],
            ['POST', <Code>/api/workspaces/:id/connections</Code>, 'Create connection'],
            ['POST', <Code>/api/workspaces/:id/connections/:connectionId/ping</Code>, 'Health check connection'],
            ['GET', <Code>/api/workspaces/:id/runs</Code>, 'List audit runs'],
            ['GET', <Code>/api/workspaces/:id/runs/:runId/logs</Code>, 'Stream run logs'],
          ]}
        />
      </div>
    ),
  },
  'agent-dead-models': {
    title: 'Agent: Dead Models',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Identifies models with zero queries over the past 90 days by cross-referencing the lineage DAG
          with <Code>query_history.json</Code>. LLM reasoning adds context about whether the model may
          have been intentionally retired or is genuinely unused.
        </p>
        <h3 className="text-white font-semibold text-base">Detection logic</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          {[
            'Parse query_history.json for per-model query counts over 90-day window',
            'Cross-reference with all model nodes in the lineage DAG',
            'Models with count = 0 are flagged as candidates',
            'LLM agent adds reasoning: is this model referenced by dashboards, APIs, or scheduled jobs outside dbt?',
            'Confidence score 0.7–1.0 based on data recency and LLM certainty',
          ].map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="text-gray-600 shrink-0 mt-0.5">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ul>
        <h3 className="text-white font-semibold text-base pt-2">Tuning</h3>
        <p className="text-gray-400 text-sm">Change the lookback window in <Code>datapilot.yaml</Code>:</p>
        <Block>
          <p><span className="text-violet-400">pipeline</span><span className="text-white">:</span></p>
          <p className="pl-4"><span className="text-violet-400">dead_model_days</span><span className="text-white">: 60   </span><span className="text-gray-600"># default 90</span></p>
        </Block>
      </div>
    ),
  },
  'agent-orphans': {
    title: 'Agent: Orphans',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Finds models with no downstream consumers in the lineage DAG. An orphaned model produces output
          that nothing reads — indicating either a dead end or a missing connection.
        </p>
        <h3 className="text-white font-semibold text-base">Detection logic</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          {[
            'Traverse the lineage DAG and compute out-degree for every node',
            'Nodes with out-degree = 0 that are not explicitly marked as final are flagged',
            'Exclude models tagged with config(materialized="view") in some pipeline configurations',
            'LLM validates whether the model is intentionally terminal (e.g. a mart layer)',
          ].map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="text-gray-600 shrink-0 mt-0.5">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  'agent-broken-refs': {
    title: 'Agent: Broken Refs',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Detects <Code>ref()</Code> calls that point to models which do not exist in the project. These
          cause silent pipeline failures and are often left behind after model renames or deletions.
        </p>
        <h3 className="text-white font-semibold text-base">Detection logic</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          {[
            'Parse all SQL files and extract ref() calls using sqlglot',
            'Check each ref() target against the set of known model names',
            'Unresolved refs are immediately flagged as critical severity',
            'LLM suggests the most likely correct model name (edit-distance matching)',
          ].map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="text-gray-600 shrink-0 mt-0.5">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ul>
        <p className="text-gray-400 text-sm">This agent always runs first as broken refs invalidate downstream analysis.</p>
      </div>
    ),
  },
  'agent-grain-joins': {
    title: 'Agent: Grain Joins',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Identifies SQL joins that combine tables at incompatible data grains — for example, joining a
          daily aggregate directly to a transaction-level table without an explicit aggregation step.
          This is a common cause of metric inflation and silent data corruption.
        </p>
        <h3 className="text-white font-semibold text-base">How grain is inferred</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          {[
            'Parse GROUP BY clauses to infer the grain of each CTE and subquery',
            'Track grain through the lineage DAG as models reference each other',
            'Identify JOIN operations where the left and right grains are incompatible',
            'LLM confirms the finding and suggests the correct fix (add aggregation, use a bridge table, etc.)',
          ].map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="text-gray-600 shrink-0 mt-0.5">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ul>
        <p className="text-gray-400 text-sm">Severity is always <strong className="text-red-400">critical</strong> — grain join errors produce incorrect numbers in dashboards.</p>
      </div>
    ),
  },
  'agent-duplicate-metrics': {
    title: 'Agent: Duplicate Metrics',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Finds cases where the same business metric (e.g. monthly revenue, conversion rate) is computed
          in multiple models using different SQL logic. This creates a single-source-of-truth problem where
          different dashboards report different numbers.
        </p>
        <h3 className="text-white font-semibold text-base">Detection approach</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          This is a premium-tier LLM task. VORO sends column names, aliases, and aggregation logic from
          all analytics-layer models to Claude or GPT-4o, which identifies semantic duplicates even when
          the SQL is written differently.
        </p>
        <Block>
          <p className="text-gray-600"># Example finding</p>
          <p className="text-white">monthly_revenue defined in:</p>
          <p className="pl-4 text-gray-400">analytics.revenue_summary — SUM(amount) WHERE status = 'paid'</p>
          <p className="pl-4 text-gray-400">analytics.finance_kpis   — SUM(net_amount) WHERE paid = true</p>
        </Block>
      </div>
    ),
  },
  'agent-missing-tests': {
    title: 'Agent: Missing Tests',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300 leading-relaxed">
          Identifies models that lack dbt data quality tests. Missing <Code>not_null</Code>, <Code>unique</Code>,
          or <Code>accepted_values</Code> tests on key columns means data quality issues can silently enter
          production without any alerting.
        </p>
        <h3 className="text-white font-semibold text-base">What is checked</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          {[
            'Primary key columns with no not_null + unique test pair',
            'Foreign key columns with no relationships test',
            'Models with no tests at all (highest priority)',
            'Core and analytics layer models with lower test coverage than source layer models',
          ].map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="text-gray-600 shrink-0 mt-0.5">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ul>
        <p className="text-gray-400 text-sm">LLM suggests which specific tests to add for each flagged column based on the column name and type.</p>
      </div>
    ),
  },
  'deploy-docker': {
    title: 'Docker',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Run VORO as a Docker container — includes the CLI, web dashboard, and REST API.</p>
        <Block>
          <p className="text-gray-600"># Build the image</p>
          <p className="text-green-400">docker build -t voro:latest .</p>
          <p className="text-gray-600 mt-4"># Run with environment variables</p>
          <p className="text-green-400">docker run -p 5000:5000 \</p>
          <p className="text-green-400 pl-4">  -e GROQ_API_KEY=$GROQ_API_KEY \</p>
          <p className="text-green-400 pl-4">  -v $(pwd)/my_project:/app/project:ro \</p>
          <p className="text-green-400 pl-4">  -v $(pwd)/output:/app/output \</p>
          <p className="text-green-400 pl-4">  voro:latest</p>
        </Block>
        <h3 className="text-white font-semibold text-base">Docker Compose</h3>
        <p className="text-gray-400 text-sm">For local development with optional Redis caching:</p>
        <Block>
          <p className="text-green-400">docker compose up</p>
          <p className="text-gray-600 mt-2"># With Redis enabled</p>
          <p className="text-green-400">docker compose --profile full up</p>
        </Block>
      </div>
    ),
  },
  'deploy-kubernetes': {
    title: 'Kubernetes',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">VORO ships with Kubernetes manifests for production deployments.</p>
        <h3 className="text-white font-semibold text-base">Manifest overview</h3>
        <Table
          headers={['Resource', 'Description']}
          rows={[
            ['CronJob', 'Runs voro audit daily at 06:00 UTC'],
            ['Deployment', 'Serves the web dashboard continuously'],
            ['PVC', '1Gi persistent volume for output files'],
            ['Secret', 'Holds LLM API keys'],
          ]}
        />
        <h3 className="text-white font-semibold text-base pt-2">Generate manifests</h3>
        <Block>
          <p className="text-green-400">voro generate-k8s --image voro:latest</p>
          <p className="text-gray-600 mt-2"># Output: deploy/k8s/voro-deployment.yaml</p>
        </Block>
        <h3 className="text-white font-semibold text-base pt-2">Apply to cluster</h3>
        <Block>
          <p className="text-green-400">kubectl apply -f deploy/k8s/</p>
          <p className="text-green-400">kubectl get pods -l app=voro</p>
        </Block>
      </div>
    ),
  },
  'deploy-env': {
    title: 'Environment Variables',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Complete reference of all environment variables.</p>
        <h3 className="text-white font-semibold text-base">CLI / Python package</h3>
        <Table
          headers={['Variable', 'Required', 'Description']}
          rows={[
            [<Code>GROQ_API_KEY</Code>, 'Yes', 'Groq API key — free tier LLM (Llama 3.3 70B)'],
            [<Code>ANTHROPIC_API_KEY</Code>, 'No', 'Anthropic Claude — premium tier analysis'],
            [<Code>OPENAI_API_KEY</Code>, 'No', 'OpenAI GPT-4o — standard/premium analysis'],
            [<Code>SNOWFLAKE_PASSWORD</Code>, 'No', 'Snowflake integration password'],
            [<Code>GITLAB_TOKEN</Code>, 'No', 'GitLab personal access token'],
            [<Code>GITHUB_WEBHOOK_SECRET</Code>, 'No', 'GitHub webhook HMAC secret'],
          ]}
        />
        <h3 className="text-white font-semibold text-base pt-2">TypeScript API (ai-governance)</h3>
        <Table
          headers={['Variable', 'Required', 'Description']}
          rows={[
            [<Code>DATABASE_URL</Code>, 'Yes', 'PostgreSQL connection string'],
            [<Code>JWT_SECRET</Code>, 'Yes', '64-char hex secret for JWT signing'],
            [<Code>FRONTEND_URL</Code>, 'Yes', 'CORS allowed origin (e.g. http://localhost:5173)'],
            [<Code>NODE_ENV</Code>, 'Yes', '"development" or "production"'],
            [<Code>DBT_PROJECTS_DIR</Code>, 'No', 'Restricts audit project paths in production'],
          ]}
        />
      </div>
    ),
  },
  'int-snowflake': {
    title: 'Snowflake',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Connect VORO to Snowflake to enrich audit findings with live query history and table statistics.</p>
        <Block>
          <p className="text-gray-600"># datapilot.yaml</p>
          <p><span className="text-violet-400">integrations</span><span className="text-white">:</span></p>
          <p className="pl-4"><span className="text-violet-400">snowflake</span><span className="text-white">:</span></p>
          <p className="pl-8"><span className="text-violet-400">account</span><span className="text-white">: myorg.us-east-1</span></p>
          <p className="pl-8"><span className="text-violet-400">user</span><span className="text-white">: voro_svc</span></p>
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
        <p className="text-gray-500 text-sm">The GitLab integration enables the MR review bot. VORO posts structured findings as review comments and proposes inline fixes.</p>
      </div>
    ),
  },
  'int-github': {
    title: 'GitHub',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Connect GitHub to enable the PR review bot and upload SARIF findings to GitHub Advanced Security.</p>
        <p className="text-gray-400 text-sm leading-relaxed">
          Configure a webhook in your GitHub repository settings pointing to your VORO API endpoint.
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
          <p className="pl-8"><span className="text-violet-400">container</span><span className="text-white">: voro-reports</span></p>
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
        <p className="text-gray-300">Schedule VORO audits as Airflow DAG tasks and trigger audits via the Airflow REST API.</p>
        <Block>
          <p className="text-green-400">voro generate-dag \</p>
          <p className="text-green-400 pl-4">  --schedule "0 6 * * *" \</p>
          <p className="text-green-400 pl-4">  --output ./dags/voro_audit.py</p>
        </Block>
        <p className="text-gray-400 text-sm leading-relaxed">
          The generated DAG uses the <Code>BashOperator</Code> to run <Code>voro audit</Code> and
          the <Code>S3HookOperator</Code> or <Code>AzureBlobStorageHook</Code> to upload reports.
        </p>
        <p className="text-gray-500 text-sm">Install with <Code>pip install "datapilot[airflow]"</Code>.</p>
      </div>
    ),
  },
  faq: {
    title: 'FAQ',
    body: (
      <div className="space-y-6">
        {[
          {
            q: 'Do I need an LLM API key to use VORO?',
            a: 'Yes — at minimum a Groq API key (free tier). Groq provides access to Llama 3.3 70B with a generous free quota. Anthropic and OpenAI keys are optional and unlock premium-tier agents.',
          },
          {
            q: 'What dbt adapters are supported?',
            a: 'All major adapters: dbt-duckdb, dbt-snowflake, dbt-bigquery, dbt-redshift, dbt-spark, dbt-databricks. VORO parses your project files directly — no live database connection is required for the audit.',
          },
          {
            q: 'How does VORO handle sensitive data?',
            a: 'VORO never reads your actual data. It only parses dbt project metadata: model names, SQL structure, lineage relationships, and test definitions. Raw column values and table contents are never accessed.',
          },
          {
            q: 'Can I run VORO on a private network without internet access?',
            a: 'Yes. Use a self-hosted LLM compatible with the Groq API format (e.g. Ollama with the OpenAI-compatible endpoint). Set the base URL in datapilot.yaml under llm_providers.',
          },
          {
            q: 'How does the PR review bot decide which PRs to review?',
            a: 'The bot triggers on any PR that modifies files matching the dbt model path pattern (models/**/*.sql, *.yml). You can configure path filters in the GitHub/GitLab webhook settings.',
          },
          {
            q: 'What is the pass threshold for the sample ShopMesh project?',
            a: 'VORO must detect at least 20 of 28 planted problems (70%) to pass validation. Run python scripts/answer_key.py after an audit to check the score.',
          },
          {
            q: 'Can I extend VORO with custom agents?',
            a: 'Yes. Add a new function to datapilot/agents/analyst.py following the existing agent pattern, register it in the AuditPipeline, and add a severity mapping in reporter.py.',
          },
          {
            q: 'How are LLM costs estimated?',
            a: 'Each finding includes a cost_usd estimate based on the Snowflake query cost (if connected) or a heuristic compute estimate. These are estimates only — actual costs depend on your warehouse configuration.',
          },
        ].map(item => (
          <div key={item.q} className="bg-gray-900/60 border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-white font-medium mb-2 text-sm">{item.q}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    ),
  },
  'common-errors': {
    title: 'Common Errors',
    body: (
      <div className="space-y-6">
        <p className="text-gray-300">Solutions to frequently encountered errors.</p>
        {[
          {
            error: 'No LLM key configured',
            solution: 'Set GROQ_API_KEY in your .env file. Get a free key at console.groq.com. VORO requires at least one LLM provider to run the AI agents.',
          },
          {
            error: 'ProjectPathError: path outside allowed directory',
            solution: 'If DBT_PROJECTS_DIR is set, all project paths must be inside that directory. In development, unset this variable. In production, move your project into the allowed directory.',
          },
          {
            error: 'sqlglot.ParseError on a specific model',
            solution: 'The model contains SQL syntax that sqlglot cannot parse (e.g. database-specific functions). Add the model to the skip_models list in datapilot.yaml to exclude it from parsing.',
          },
          {
            error: 'Rate limit exceeded (429 from LLM provider)',
            solution: 'VORO retries automatically with exponential backoff via tenacity. If rate limits persist, reduce max_workers in pipeline config (default 4) or add a second LLM provider key as a fallback.',
          },
          {
            error: 'Audit finds 0 dead models despite having unused models',
            solution: 'Check that query_history.json exists in your project root and covers the expected date range. If the file is missing, dead model detection falls back to heuristics only.',
          },
          {
            error: 'CSRF validation failed (403 on API)',
            solution: 'Ensure FRONTEND_URL matches the actual origin of the frontend (including port). In development this is typically http://localhost:5173. CORS and CSRF protection both use this value.',
          },
          {
            error: 'Migration error on startup: column already exists',
            solution: 'Migrations run in lexicographic order. If you added a migration file with a non-sequential number, it may conflict with existing schema. Rename the file to the next sequential number.',
          },
        ].map(item => (
          <div key={item.error} className="border border-white/[0.08] rounded-xl p-5">
            <p className="font-mono text-red-400 text-xs mb-3">{item.error}</p>
            <p className="text-gray-400 text-sm leading-relaxed">{item.solution}</p>
          </div>
        ))}
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
          <div className="sticky top-24 space-y-7 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
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
                            ? 'bg-white/10 text-white font-medium'
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
