import React, { useEffect, useState } from 'react'
import type { IntegrationsResponse } from '../../types'

/* ─── Integration catalogue ─── */

interface IntegrationMeta {
  id:   string
  name: string
  desc: string
  icon: string
  docs: string
}

const INTEGRATIONS: IntegrationMeta[] = [
  {
    id:   'airflow',
    name: 'Apache Airflow',
    desc: 'Generate DAG definitions and trigger pipeline runs',
    icon: '🌊',
    docs: 'https://airflow.apache.org',
  },
  {
    id:   'snowflake',
    name: 'Snowflake',
    desc: 'Query history, cost analysis, warehouse connector',
    icon: '❄️',
    docs: 'https://snowflake.com',
  },
  {
    id:   'aws',
    name: 'AWS S3',
    desc: 'Upload reports to S3 and trigger Lambda functions',
    icon: '☁️',
    docs: 'https://aws.amazon.com/s3',
  },
  {
    id:   'azure',
    name: 'Azure Storage',
    desc: 'Blob storage export and Azure Identity auth',
    icon: '🔷',
    docs: 'https://azure.microsoft.com',
  },
  {
    id:   'gitlab',
    name: 'GitLab CI',
    desc: 'Push SARIF findings to GitLab Security Dashboard',
    icon: '🦊',
    docs: 'https://gitlab.com',
  },
  {
    id:   'kubernetes',
    name: 'Kubernetes',
    desc: 'Generate CronJob and Deployment manifests',
    icon: '⚙️',
    docs: 'https://kubernetes.io',
  },
  {
    id:   'powerbi',
    name: 'Power BI',
    desc: 'Push audit datasets to Power BI workspaces',
    icon: '📊',
    docs: 'https://powerbi.microsoft.com',
  },
  {
    id:   'dbt',
    name: 'dbt Cloud',
    desc: 'Trigger dbt Cloud jobs and sync metadata',
    icon: '🔆',
    docs: 'https://cloud.getdbt.com',
  },
  {
    id:   'kafka',
    name: 'Apache Kafka',
    desc: 'Stream findings events to a Kafka topic',
    icon: '🔁',
    docs: 'https://kafka.apache.org',
  },
  {
    id:   'webhook',
    name: 'Webhooks',
    desc: 'Send HTTP notifications to any endpoint',
    icon: '🔗',
    docs: '',
  },
]

const ENV_HINTS: Record<string, string> = {
  airflow:    'AIRFLOW_HOST, AIRFLOW_USER, AIRFLOW_PASS',
  snowflake:  'SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASS',
  aws:        'AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY',
  azure:      'AZURE_STORAGE_CONNECTION_STRING',
  gitlab:     'GITLAB_TOKEN, GITLAB_URL',
  kubernetes: 'KUBECONFIG or in-cluster service account',
  powerbi:    'POWERBI_TENANT_ID, POWERBI_CLIENT_ID, MSAL credentials',
  dbt:        'DBT_CLOUD_TOKEN, DBT_CLOUD_ACCOUNT_ID',
  kafka:      'KAFKA_BOOTSTRAP_SERVERS',
  webhook:    'WEBHOOK_URL',
}

/* ─── Main ─── */

export function IntegrationsTab() {
  const [data,    setData]    = useState<IntegrationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/integrations')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<IntegrationsResponse>
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load integrations'); setLoading(false) })
  }, [])

  const available  = data?.available  ?? []
  const configured = new Set(data?.configured ?? [])

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Integrations
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Connect DataPilot to your existing data stack. Set environment variables, then
            run{' '}
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
              datapilot integrations --check
            </code>{' '}
            to verify.
          </p>
        </div>

        {!loading && data && (
          <div className="flex items-center gap-3 shrink-0">
            <Pill label={`${available.length} available`}  cls="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900" />
            <Pill label={`${configured.size} configured`}  cls={
              configured.size > 0
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900'
                : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
            } />
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30
          border border-red-200 dark:border-red-900 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* ── Integration grid ── */}
      <div className="grid grid-cols-2 gap-4">
        {INTEGRATIONS.map(intg => {
          const isConfigured = configured.has(intg.id)
          const isAvailable  = loading || available.includes(intg.id)

          return (
            <IntegrationCard
              key={intg.id}
              meta={intg}
              configured={isConfigured}
              available={isAvailable}
              hint={ENV_HINTS[intg.id] ?? ''}
              loading={loading}
            />
          )
        })}
      </div>

      {/* ── LLM providers section ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          LLM Providers
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { id: 'groq',      name: 'Groq',      icon: '⚡', desc: 'Fast inference (Llama)',    env: 'GROQ_API_KEY',      tier: 'Free tier'     },
            { id: 'openai',    name: 'OpenAI',    icon: '🟢', desc: 'GPT-4o-mini / GPT-4o',     env: 'OPENAI_API_KEY',    tier: 'Standard tier' },
            { id: 'anthropic', name: 'Anthropic', icon: '🔴', desc: 'Claude Sonnet / Opus',      env: 'ANTHROPIC_API_KEY', tier: 'Premium tier'  },
          ].map(p => {
            const isSet = Boolean(
              /* runtime check not available in browser — just show env hint */
              false
            )
            return (
              <div key={p.id}
                className="bg-white dark:bg-slate-900 rounded-xl
                  border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.icon}</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {p.name}
                  </span>
                  <span className="ml-auto text-xs text-slate-400 dark:text-slate-600">
                    {p.tier}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500">{p.desc}</p>
                <code className="block text-xs font-mono bg-slate-50 dark:bg-slate-800
                  px-2 py-1 rounded text-slate-600 dark:text-slate-400 truncate">
                  {p.env}
                </code>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function IntegrationCard({
  meta, configured, available, hint, loading,
}: {
  meta: IntegrationMeta
  configured: boolean
  available: boolean
  hint: string
  loading: boolean
}) {
  return (
    <div className={`
      bg-white dark:bg-slate-900 rounded-xl p-4 space-y-3 transition-all
      border ${configured
        ? 'border-green-300 dark:border-green-800'
        : 'border-slate-200 dark:border-slate-800'}
    `}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl shrink-0">{meta.icon}</span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {meta.name}
          </span>
        </div>
        {loading
          ? <span className="w-16 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          : configured
            ? <StatusBadge label="Configured" cls="bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400" />
            : <StatusBadge label="Not configured" cls="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500" />
        }
      </div>

      {/* Description */}
      <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
        {meta.desc}
      </p>

      {/* Env hint */}
      {hint && (
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-400 dark:text-slate-600 mb-0.5 font-medium uppercase tracking-wide">
            Required env vars
          </p>
          <code className="text-xs font-mono text-slate-600 dark:text-slate-400 leading-relaxed">
            {hint}
          </code>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium
      px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
      <span className={`w-1 h-1 rounded-full ${
        label === 'Configured'
          ? 'bg-green-500'
          : 'bg-slate-400 dark:bg-slate-600'
      }`} />
      {label}
    </span>
  )
}

function Pill({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}
