import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { edgesApi, nodesApi } from '../lib/api';

interface Node {
  id: string;
  name: string;
  type: string;
}

interface Edge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_name: string;
  target_name: string;
  label?: string;
  created_at: string;
}

export default function Edges() {
  const { workspaceId } = useAuth();
  const [edges, setEdges] = useState<Edge[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ source_node_id: '', target_node_id: '', label: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!workspaceId) return;
    Promise.all([
      edgesApi.list(workspaceId),
      nodesApi.list(workspaceId),
    ]).then(([e, n]) => {
      setEdges(e.data.data);
      setNodes(n.data.data);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workspaceId]);

  async function save() {
    if (!workspaceId || !form.source_node_id || !form.target_node_id) return;
    if (form.source_node_id === form.target_node_id) {
      setError('Source and target must be different nodes.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await edgesApi.create(workspaceId, {
        source_node_id: form.source_node_id,
        target_node_id: form.target_node_id,
        label: form.label || undefined,
      });
      setForm({ source_node_id: '', target_node_id: '', label: '' });
      setShowForm(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to create edge.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!workspaceId || !confirm('Delete this edge?')) return;
    await edgesApi.delete(workspaceId, id);
    setEdges(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Edges</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Connections between nodes in your pipeline</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(v => !v); setError(null); }}>
          {showForm ? 'Cancel' : '+ New Edge'}
        </button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">New Edge</h2>
          {nodes.length < 2 && (
            <p className="text-xs text-amber-400">You need at least 2 nodes to create an edge.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Source Node</label>
              <select className="input" value={form.source_node_id}
                onChange={e => setForm(f => ({ ...f, source_node_id: e.target.value }))}>
                <option value="">Select…</option>
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>{n.name} ({n.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Target Node</label>
              <select className="input" value={form.target_node_id}
                onChange={e => setForm(f => ({ ...f, target_node_id: e.target.value }))}>
                <option value="">Select…</option>
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>{n.name} ({n.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Label (optional)</label>
              <input className="input" placeholder="e.g. calls, feeds, triggers" value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end">
            <button className="btn-primary" onClick={save}
              disabled={saving || !form.source_node_id || !form.target_node_id}>
              {saving ? 'Saving…' : 'Save Edge'}
            </button>
          </div>
        </div>
      )}

      {loading
        ? <p className="text-neutral-500 dark:text-neutral-500 text-sm">Loading…</p>
        : edges.length === 0
          ? <div className="card text-center py-12 text-neutral-500 dark:text-neutral-500 text-sm">No edges yet.</div>
          : (
            <div className="card divide-y divide-gray-800 p-0 overflow-hidden">
              {edges.map(e => (
                <div key={e.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">{e.source_name}</span>
                    <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">{e.target_name}</span>
                    {e.label && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full flex-shrink-0">
                        {e.label}
                      </span>
                    )}
                  </div>
                  <button className="btn-danger text-xs py-1 px-2 flex-shrink-0" onClick={() => remove(e.id)}>
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
