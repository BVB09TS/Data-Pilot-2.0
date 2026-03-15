import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { policiesApi } from '../lib/api';

interface Rule {
  id: string;
  type: string;
  field?: string;
  value?: unknown;
  threshold?: number;
  message: string;
  severity: 'error' | 'warn';
}

interface Policy {
  id: string;
  name: string;
  description?: string;
  status: string;
  rules: Rule[];
  created_at: string;
}

interface Evaluation {
  id: string;
  result: string;
  violations: { ruleId: string; message: string; severity: string }[];
  evaluated_at: string;
  node_name?: string;
}

const STATUS_COLOR: Record<string, string> = {
  active:   'bg-green-500/20 text-green-400',
  draft:    'bg-yellow-500/20 text-yellow-400',
  inactive: 'bg-gray-500/20 text-neutral-500 dark:text-neutral-400',
};

const RESULT_COLOR: Record<string, string> = {
  pass: 'bg-green-500/20 text-green-400',
  fail: 'bg-red-500/20 text-red-400',
  warn: 'bg-yellow-500/20 text-yellow-400',
  skip: 'bg-gray-500/20 text-neutral-500 dark:text-neutral-400',
};

const RULE_TYPES = ['require_field', 'deny_value', 'require_connection', 'max_runs'];

export default function Policies() {
  const { workspaceId } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Policy | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: 'draft' });
  const [rules, setRules] = useState<Rule[]>([]);
  const [saving, setSaving] = useState(false);

  function load() {
    if (!workspaceId) return;
    policiesApi.list(workspaceId).then(r => setPolicies(r.data.data)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workspaceId]);

  async function selectPolicy(p: Policy) {
    setSelected(p);
    if (!workspaceId) return;
    const r = await policiesApi.evaluations(workspaceId, p.id);
    setEvaluations(r.data.data);
  }

  async function save() {
    if (!workspaceId || !form.name) return;
    setSaving(true);
    await policiesApi.create(workspaceId, { ...form, rules }).catch(() => {});
    setForm({ name: '', description: '', status: 'draft' });
    setRules([]);
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function toggleStatus(p: Policy) {
    if (!workspaceId) return;
    const next = p.status === 'active' ? 'inactive' : 'active';
    await policiesApi.update(workspaceId, p.id, { status: next });
    load();
    if (selected?.id === p.id) setSelected({ ...p, status: next });
  }

  async function remove(id: string) {
    if (!workspaceId || !confirm('Delete this policy?')) return;
    await policiesApi.delete(workspaceId, id);
    setPolicies(prev => prev.filter(p => p.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  function addRule() {
    setRules(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'require_field',
      field: '',
      message: '',
      severity: 'error',
    }]);
  }

  function updateRule(idx: number, patch: Partial<Rule>) {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Policies</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Define and enforce AI governance rules</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New Policy'}
        </button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">New Policy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="Require test coverage" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <input className="input" placeholder="What does this policy enforce?" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          {/* Rules builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Rules</p>
              <button className="btn-ghost text-xs py-1 px-2" onClick={addRule}>+ Add Rule</button>
            </div>
            {rules.map((rule, idx) => (
              <div key={rule.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                <select className="input text-xs" value={rule.type}
                  onChange={e => updateRule(idx, { type: e.target.value as Rule['type'] })}>
                  {RULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {(rule.type === 'require_field' || rule.type === 'deny_value') && (
                  <input className="input text-xs" placeholder="field path" value={rule.field ?? ''}
                    onChange={e => updateRule(idx, { field: e.target.value })} />
                )}
                <input className="input text-xs" placeholder="message" value={rule.message}
                  onChange={e => updateRule(idx, { message: e.target.value })} />
                <div className="flex gap-2">
                  <select className="input text-xs flex-1" value={rule.severity}
                    onChange={e => updateRule(idx, { severity: e.target.value as Rule['severity'] })}>
                    <option value="error">error</option>
                    <option value="warn">warn</option>
                  </select>
                  <button className="btn-danger text-xs px-2"
                    onClick={() => setRules(prev => prev.filter((_, i) => i !== idx))}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Policy'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Policy list */}
        <div className="lg:col-span-3 card p-0 overflow-hidden divide-y divide-gray-800">
          {loading
            ? <p className="p-5 text-sm text-neutral-500 dark:text-neutral-500">Loading…</p>
            : policies.length === 0
              ? <p className="p-5 text-sm text-neutral-500 dark:text-neutral-500">No policies yet.</p>
              : policies.map(p => (
                <div key={p.id}
                  className={`flex items-center justify-between gap-4 px-5 py-4 cursor-pointer transition-colors ${selected?.id === p.id ? 'bg-gray-800' : 'hover:bg-gray-800/50'}`}
                  onClick={() => selectPolicy(p)}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{p.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-500">{p.rules.length} rule{p.rules.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge ${STATUS_COLOR[p.status] ?? ''}`}>{p.status}</span>
                    <button className="btn-ghost text-xs py-1 px-2" onClick={e => { e.stopPropagation(); toggleStatus(p); }}>
                      {p.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn-danger text-xs py-1 px-2" onClick={e => { e.stopPropagation(); remove(p.id); }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
          }
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{selected.name}</h2>
                {selected.description && <p className="text-xs text-neutral-500 dark:text-neutral-400">{selected.description}</p>}
                <div className="space-y-1.5">
                  {selected.rules.map(r => (
                    <div key={r.id} className="text-xs bg-neutral-100 dark:bg-neutral-800 rounded px-3 py-2">
                      <span className={`badge mr-2 ${r.severity === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {r.severity}
                      </span>
                      <span className="text-neutral-600 dark:text-neutral-300">{r.type}</span>
                      {r.field && <span className="text-neutral-500 dark:text-neutral-500"> · {r.field}</span>}
                      <p className="text-neutral-500 dark:text-neutral-500 mt-0.5">{r.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card space-y-2">
                <h2 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">Recent Evaluations</h2>
                {evaluations.length === 0
                  ? <p className="text-xs text-neutral-500 dark:text-neutral-500">No evaluations yet.</p>
                  : evaluations.map(e => (
                    <div key={e.id} className="flex items-start justify-between gap-2 text-xs">
                      <div>
                        <p className="text-neutral-500 dark:text-neutral-400">{e.node_name ?? 'Manual'}</p>
                        <p className="text-gray-600">{new Date(e.evaluated_at).toLocaleString()}</p>
                        {e.violations.map((v, i) => (
                          <p key={i} className="text-red-400 mt-0.5">✕ {v.message}</p>
                        ))}
                      </div>
                      <span className={`badge flex-shrink-0 ${RESULT_COLOR[e.result] ?? ''}`}>{e.result}</span>
                    </div>
                  ))
                }
              </div>
            </>
          ) : (
            <div className="card text-center py-10 text-sm text-neutral-500 dark:text-neutral-500">
              Select a policy to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
