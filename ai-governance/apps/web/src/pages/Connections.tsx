import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { connectionsApi } from '../lib/api';

interface Connection {
  id: string;
  name: string;
  type: string;
  provider?: string;
  is_enabled: boolean;
  health_status?: string;
  last_health_check?: string;
  created_at: string;
}

const HEALTH_COLOR: Record<string, string> = {
  healthy:  'bg-green-500/20 text-green-400',
  degraded: 'bg-yellow-500/20 text-yellow-400',
  down:     'bg-red-500/20 text-red-400',
};

export default function Connections() {
  const { workspaceId } = useAuth();
  const [rows, setRows] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'api', provider: '', secret: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    if (!workspaceId) return;
    connectionsApi.list(workspaceId)
      .then(r => setRows(r.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workspaceId]);

  async function ping(id: string) {
    if (!workspaceId) return;
    setPinging(id);
    await connectionsApi.ping(workspaceId, id).catch(() => {});
    load();
    setPinging(null);
  }

  async function remove(id: string) {
    if (!workspaceId || !confirm('Delete this connection?')) return;
    await connectionsApi.delete(workspaceId, id);
    setRows(prev => prev.filter(c => c.id !== id));
  }

  async function save() {
    if (!workspaceId || !form.name || !form.type) return;
    setSaving(true);
    await connectionsApi.create(workspaceId, {
      name: form.name,
      type: form.type,
      provider: form.provider || undefined,
      secret: form.secret || undefined,
    }).catch(() => {});
    setForm({ name: '', type: 'api', provider: '', secret: '' });
    setShowForm(false);
    setSaving(false);
    load();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Connections</h1>
          <p className="text-sm text-gray-400 mt-1">Manage API keys and MCP server connections</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New Connection'}
        </button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-white">New Connection</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="My OpenAI Key" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="api">API Key</option>
                <option value="mcp">MCP Server</option>
              </select>
            </div>
            <div>
              <label className="label">Provider (optional)</label>
              <input className="input" placeholder="openai / anthropic / groq" value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
            </div>
            <div>
              <label className="label">Secret / API Key</label>
              <input className="input" type="password" placeholder="sk-…" value={form.secret}
                onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Connection'}
            </button>
          </div>
        </div>
      )}

      {loading
        ? <p className="text-gray-500 text-sm">Loading…</p>
        : rows.length === 0
          ? <div className="card text-center py-12 text-gray-500 text-sm">No connections yet.</div>
          : (
            <div className="card divide-y divide-gray-800 p-0 overflow-hidden">
              {rows.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      {c.type}{c.provider ? ` · ${c.provider}` : ''}
                      {c.last_health_check && ` · checked ${new Date(c.last_health_check).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.health_status && (
                      <span className={`badge ${HEALTH_COLOR[c.health_status] ?? 'bg-gray-700 text-gray-400'}`}>
                        {c.health_status}
                      </span>
                    )}
                    <button className="btn-ghost text-xs py-1 px-2"
                      onClick={() => ping(c.id)} disabled={pinging === c.id}>
                      {pinging === c.id ? '…' : 'Ping'}
                    </button>
                    <button className="btn-danger text-xs py-1 px-2" onClick={() => remove(c.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}
