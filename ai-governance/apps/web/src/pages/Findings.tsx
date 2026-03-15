import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { datapilotApi } from '../lib/api';

interface Finding {
  id: string;
  run_id: string;
  node_id: string | null;
  model_name: string | null;
  type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string | null;
  cost_usd: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  low:      'bg-blue-500/20 text-blue-400 border border-blue-500/30',
};

const TYPE_LABEL: Record<string, string> = {
  dead_model:         'Dead Model',
  orphan:             'Orphan',
  broken_ref:         'Broken Ref',
  duplicate_metric:   'Duplicate Metric',
  grain_join:         'Grain Join',
  logic_drift:        'Logic Drift',
  missing_tests:      'Missing Tests',
  deprecated_source:  'Deprecated Source',
};

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const TYPES = Object.keys(TYPE_LABEL);

export default function Findings() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();

  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Finding | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Audit trigger
  const [projectPath, setProjectPath] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');

  function load() {
    if (!workspaceId) return;
    setLoading(true);
    datapilotApi.listFindings(workspaceId, {
      severity: severityFilter || undefined,
      type: typeFilter || undefined,
      limit,
      offset,
    })
      .then(r => {
        setFindings(r.data.findings);
        setTotal(r.data.total);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workspaceId, severityFilter, typeFilter, offset]);

  async function triggerAudit() {
    if (!workspaceId || !projectPath.trim()) return;
    setTriggering(true);
    setTriggerMsg('');
    try {
      const r = await datapilotApi.triggerAudit(workspaceId, { project_path: projectPath.trim() });
      setTriggerMsg(`Audit started — run ID: ${r.data.run_id}. Refresh in a moment.`);
      setProjectPath('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to trigger audit';
      setTriggerMsg(`Error: ${msg}`);
    } finally {
      setTriggering(false);
    }
  }

  const pages = Math.ceil(total / limit);
  const page  = Math.floor(offset / limit);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Findings</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">DataPilot audit results — {total} total findings</p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 text-neutral-900 dark:text-white transition"
        >
          Refresh
        </button>
      </div>

      {/* Trigger Audit */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">Run New Audit</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">
            Provide the absolute path to your project directory. The audit runs all 8 AI agents in parallel.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={projectPath}
            onChange={e => setProjectPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') triggerAudit(); }}
            placeholder="/absolute/path/to/project"
            className="flex-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-sm text-neutral-900 dark:text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition"
          />
          <button
            onClick={triggerAudit}
            disabled={triggering || !projectPath.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition shrink-0"
          >
            {triggering ? 'Starting…' : 'Run Audit'}
          </button>
        </div>
        {triggerMsg && (
          <p className={`text-xs ${triggerMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
            {triggerMsg}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={severityFilter}
          onChange={e => { setSeverityFilter(e.target.value); setOffset(0); }}
          className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
        >
          <option value="">All severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setOffset(0); }}
          className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
        >
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>

        {(severityFilter || typeFilter) && (
          <button
            onClick={() => { setSeverityFilter(''); setTypeFilter(''); setOffset(0); }}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Clear filters ✕
          </button>
        )}

        {total > 0 && (
          <span className="ml-auto text-xs text-neutral-500">{total} finding{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-neutral-500 dark:text-neutral-400 font-medium">Severity</th>
              <th className="text-left px-4 py-3 text-neutral-500 dark:text-neutral-400 font-medium">Type</th>
              <th className="text-left px-4 py-3 text-neutral-500 dark:text-neutral-400 font-medium">Title</th>
              <th className="text-left px-4 py-3 text-neutral-500 dark:text-neutral-400 font-medium">Model</th>
              <th className="text-left px-4 py-3 text-neutral-500 dark:text-neutral-400 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center py-8 text-neutral-500 dark:text-neutral-500">Loading…</td></tr>
            )}
            {!loading && findings.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm text-neutral-500 dark:text-neutral-500">No findings found.</p>
                    <p className="text-xs text-neutral-600">{severityFilter || typeFilter ? 'Try adjusting your filters.' : 'Run an audit above to get started.'}</p>
                  </div>
                </td>
              </tr>
            )}
            {findings.map(f => (
              <tr
                key={f.id}
                onClick={() => setSelected(f)}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition"
              >
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLOR[f.severity] ?? 'bg-gray-500/20 text-neutral-500 dark:text-neutral-400'}`}>
                    {f.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">{TYPE_LABEL[f.type] ?? f.type}</td>
                <td className="px-4 py-3 text-neutral-900 dark:text-white font-medium max-w-xs truncate">{f.title}</td>
                <td className="px-4 py-3">
                  {f.model_name ? (
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/lineage?focus=${encodeURIComponent(f.model_name!)}`); }}
                      className="font-mono text-neutral-700 dark:text-neutral-300 hover:text-indigo-300 hover:underline transition-colors"
                      title="View in lineage graph"
                    >
                      {f.model_name}
                    </button>
                  ) : <span className="text-neutral-500 dark:text-neutral-500">—</span>}
                </td>
                <td className="px-4 py-3 text-neutral-500 dark:text-neutral-500 whitespace-nowrap">
                  {new Date(f.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
          <span>Page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 transition"
            >← Prev</button>
            <button
              disabled={page >= pages - 1}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 transition"
            >Next →</button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg h-full bg-white dark:bg-neutral-900 border-l border-white/10 overflow-y-auto p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLOR[selected.severity] ?? ''}`}>
                {selected.severity}
              </span>
              <button onClick={() => setSelected(null)} className="text-neutral-500 dark:text-neutral-500 hover:text-white text-lg">✕</button>
            </div>

            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{selected.title}</h2>

            <div className="space-y-1 text-sm">
              <p className="text-neutral-500 dark:text-neutral-400">Type: <span className="text-neutral-900 dark:text-white">{TYPE_LABEL[selected.type] ?? selected.type}</span></p>
              {selected.model_name && (
                <p className="text-neutral-500 dark:text-neutral-400">Model:{' '}
                  <button
                    onClick={() => navigate(`/lineage?focus=${encodeURIComponent(selected.model_name!)}`)}
                    className="text-neutral-700 dark:text-neutral-300 hover:text-indigo-300 font-mono hover:underline transition-colors"
                    title="View in lineage graph"
                  >
                    {selected.model_name}
                  </button>
                  <span className="ml-2 text-gray-600 text-xs">↗ view in lineage</span>
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">{selected.description}</p>
            </div>

            {selected.recommendation && (
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 uppercase tracking-wider mb-1">Recommendation</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">{selected.recommendation}</p>
              </div>
            )}

            {Object.keys(selected.metadata ?? {}).length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 uppercase tracking-wider mb-1">Metadata</p>
                <pre className="text-xs text-neutral-500 dark:text-neutral-400 bg-white/5 rounded p-3 overflow-x-auto">
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </div>
            )}

            <p className="text-xs text-gray-600">Run: {selected.run_id}</p>
          </div>
        </div>
      )}
    </div>
  );
}
