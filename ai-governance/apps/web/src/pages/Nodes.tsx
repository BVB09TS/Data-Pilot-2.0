import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { nodesApi } from '../lib/api';

interface Node {
  id: string;
  name: string;
  type: string;
  description?: string;
  created_at: string;
}

export default function Nodes() {
  const { workspaceId } = useAuth();
  const [rows, setRows] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'model', description: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    if (!workspaceId) return;
    nodesApi.list(workspaceId).then(r => setRows(r.data.data)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workspaceId]);

  async function save() {
    if (!workspaceId || !form.name || !form.type) return;
    setSaving(true);
    await nodesApi.create(workspaceId, {
      name: form.name,
      type: form.type,
      description: form.description || undefined,
    }).catch(() => {});
    setForm({ name: '', type: 'model', description: '' });
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function remove(id: string) {
    if (!workspaceId || !confirm('Delete this node? All connected edges will also be removed.')) return;
    await nodesApi.delete(workspaceId, id);
    setRows(prev => prev.filter(n => n.id !== id));
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Nodes</h1>
          <p className="text-sm text-gray-400 mt-1">AI models and pipeline components</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New Node'}
        </button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-white">New Node</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="gpt-4o-classifier" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="model">Model</option>
                <option value="agent">Agent</option>
                <option value="tool">Tool</option>
                <option value="pipeline">Pipeline</option>
                <option value="datasource">Data Source</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description (optional)</label>
              <input className="input" placeholder="Brief description…" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Node'}
            </button>
          </div>
        </div>
      )}

      {loading
        ? <p className="text-gray-500 text-sm">Loading…</p>
        : rows.length === 0
          ? <div className="card text-center py-12 text-gray-500 text-sm">No nodes yet.</div>
          : (
            <div className="card divide-y divide-gray-800 p-0 overflow-hidden">
              {rows.map(n => (
                <div key={n.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{n.name}</p>
                    <p className="text-xs text-gray-500">
                      {n.type}{n.description ? ` · ${n.description}` : ''}
                    </p>
                  </div>
                  <button className="btn-danger text-xs py-1 px-2 flex-shrink-0" onClick={() => remove(n.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}
