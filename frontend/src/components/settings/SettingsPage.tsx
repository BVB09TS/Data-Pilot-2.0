import React, { useEffect, useState, useCallback } from 'react'

/* ─── Types ─── */

interface LlmKey {
  provider: string
  label:    string
  envKey:   string
  prefix:   string
  docsUrl:  string
}

interface McpConnection {
  id:    string
  name:  string
  url:   string
  token: string
}

interface SettingsData {
  llm_configured:  Record<string, boolean>
  llm_keys:        Record<string, string>
  mcp_connections: McpConnection[]
  project_root:    string
}

const LLM_PROVIDERS: LlmKey[] = [
  { provider: 'groq',      label: 'Groq',      envKey: 'GROQ_API_KEY',      prefix: 'gsk_',   docsUrl: 'https://console.groq.com/keys' },
  { provider: 'anthropic', label: 'Anthropic',  envKey: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-', docsUrl: 'https://console.anthropic.com/settings/api-keys' },
  { provider: 'openai',    label: 'OpenAI',     envKey: 'OPENAI_API_KEY',    prefix: 'sk-',    docsUrl: 'https://platform.openai.com/api-keys' },
]

/* ─── SettingsPage ─── */

export function SettingsPage() {
  const [data,    setData]    = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  // Local editable state
  const [llmKeys,   setLlmKeys]   = useState<Record<string, string>>({})
  const [mcpConns,  setMcpConns]  = useState<McpConnection[]>([])
  const [testState, setTestState] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({})

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json() as Promise<SettingsData>)
      .then(d => {
        setData(d)
        setLlmKeys(d.llm_keys ?? {})
        setMcpConns(d.mcp_connections ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ llm_keys: llmKeys, mcp_connections: mcpConns }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }, [llmKeys, mcpConns])

  const handleTestKey = useCallback(async (provider: string, envKey: string) => {
    setTestState(s => ({ ...s, [provider]: 'testing' }))
    const key = llmKeys[envKey] ?? ''
    const r = await fetch('/api/settings/test-key', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ provider, key }),
    })
    const j = await r.json()
    setTestState(s => ({ ...s, [provider]: j.ok ? 'ok' : 'fail' }))
  }, [llmKeys])

  const addMcp = () => setMcpConns(c => [
    ...c,
    { id: crypto.randomUUID(), name: '', url: '', token: '' },
  ])

  const removeMcp = (id: string) => setMcpConns(c => c.filter(x => x.id !== id))

  const updateMcp = (id: string, field: keyof McpConnection, value: string) =>
    setMcpConns(c => c.map(x => x.id === id ? { ...x, [field]: value } : x))

  if (loading) return <SettingsLoading />

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure LLM providers, MCP connections, and integrations.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`
              flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium
              transition-all duration-150
              ${saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'}
            `}
          >
            {saving ? <Spinner /> : saved ? <CheckIcon /> : <SaveIcon />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>

        {/* Project Info */}
        {data?.project_root && (
          <Section title="Project" icon={<FolderIcon />}>
            <InfoRow label="Project Root" value={data.project_root} mono />
          </Section>
        )}

        {/* LLM Providers */}
        <Section title="LLM Providers" icon={<KeyIcon />}
          description="API keys used for AI analysis agents. Keys are stored in your .env file.">
          <div className="space-y-4">
            {LLM_PROVIDERS.map(p => {
              const currentVal = llmKeys[p.envKey] ?? ''
              const isConfigured = data?.llm_configured[p.envKey] ?? false
              const ts = testState[p.provider] ?? 'idle'

              return (
                <div key={p.provider}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-white dark:bg-slate-900">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        {p.label}
                      </span>
                      <StatusBadge configured={isConfigured} />
                    </div>
                    <a href={p.docsUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-500 hover:underline">
                      Get API key ↗
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder={`${p.prefix}…`}
                      value={currentVal}
                      onChange={e => setLlmKeys(k => ({ ...k, [p.envKey]: e.target.value }))}
                      className="flex-1 font-mono text-xs px-3 py-2 rounded-lg
                        border border-slate-200 dark:border-slate-700
                        bg-slate-50 dark:bg-slate-800
                        text-slate-800 dark:text-slate-200
                        placeholder:text-slate-400 outline-none
                        focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20
                        transition-colors"
                    />
                    <button
                      onClick={() => handleTestKey(p.provider, p.envKey)}
                      disabled={ts === 'testing' || !currentVal || currentVal.startsWith('****')}
                      className={`
                        px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                        disabled:opacity-40
                        ${ts === 'ok'   ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : ts === 'fail' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}
                      `}
                    >
                      {ts === 'testing' ? <Spinner small /> : ts === 'ok' ? '✓ Valid' : ts === 'fail' ? '✗ Invalid' : 'Test'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* MCP Connections */}
        <Section title="MCP Connections" icon={<PlugIcon />}
          description="Connect Model Context Protocol servers for extended AI capabilities."
          action={
            <button onClick={addMcp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400
                hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
              <PlusIcon /> Add Connection
            </button>
          }>
          {mcpConns.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-sm">
              No MCP connections configured.
            </div>
          ) : (
            <div className="space-y-3">
              {mcpConns.map(conn => (
                <div key={conn.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-white dark:bg-slate-900">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                      <input
                        value={conn.name}
                        onChange={e => updateMcp(conn.id, 'name', e.target.value)}
                        placeholder="e.g. My MCP Server"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Server URL</label>
                      <input
                        value={conn.url}
                        onChange={e => updateMcp(conn.id, 'url', e.target.value)}
                        placeholder="https://…"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-2 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Auth Token</label>
                        <input
                          type="password"
                          value={conn.token}
                          onChange={e => updateMcp(conn.id, 'token', e.target.value)}
                          placeholder="Bearer token (optional)"
                          className={inputCls}
                        />
                      </div>
                      <button
                        onClick={() => removeMcp(conn.id)}
                        className="px-3 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50
                          dark:hover:bg-red-900/20 transition-colors mb-0.5">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}

/* ─── Shared input class ─── */

const inputCls = `
  w-full text-xs px-3 py-2 rounded-lg
  border border-slate-200 dark:border-slate-700
  bg-slate-50 dark:bg-slate-800
  text-slate-800 dark:text-slate-200
  placeholder:text-slate-400 outline-none
  focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20
  transition-colors font-mono
`

/* ─── Sub-components ─── */

function Section({
  title, icon, description, action, children,
}: {
  title:        string
  icon:         React.ReactNode
  description?: string
  action?:      React.ReactNode
  children:     React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 dark:text-slate-500">{icon}</span>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
        </div>
        {action}
      </div>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{description}</p>
      )}
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl
      bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
      <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
      <span className={`text-xs text-slate-700 dark:text-slate-300 truncate ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
      ${configured
        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'}
    `}>
      <span className={`w-1.5 h-1.5 rounded-full ${configured ? 'bg-green-500' : 'bg-slate-400'}`} />
      {configured ? 'Configured' : 'Not set'}
    </span>
  )
}

function SettingsLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
}

/* ─── Icons ─── */

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3"/>
    </svg>
  )
}

function PlugIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22v-5M9 7V3M15 7V3M9 12H5a2 2 0 0 1-2-2V7h18v3a2 2 0 0 1-2 2h-4"/>
      <rect x="9" y="12" width="6" height="5" rx="1"/>
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

function Spinner({ small }: { small?: boolean }) {
  const s = small ? 10 : 14
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}
