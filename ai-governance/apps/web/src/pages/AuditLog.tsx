import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auditApi } from '../lib/api';

interface AuditEvent {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

const RESOURCE_COLORS: Record<string, string> = {
  connections:  'bg-indigo-500/20 text-indigo-400',
  nodes:        'bg-purple-500/20 text-purple-400',
  edges:        'bg-blue-500/20 text-blue-400',
  runs:         'bg-cyan-500/20 text-cyan-400',
  policies:     'bg-orange-500/20 text-orange-400',
  environments: 'bg-teal-500/20 text-teal-400',
};

const PAGE_SIZE = 50;

export default function AuditLog() {
  const { workspaceId } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState({ resource_type: '', action: '' });
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const params: Record<string, unknown> = { limit: PAGE_SIZE, offset };
    if (filter.resource_type) params['resource_type'] = filter.resource_type;
    if (filter.action) params['action'] = filter.action;
    const r = await auditApi.list(workspaceId, params).catch(() => null);
    if (r) { setEvents(r.data.data); setTotal(r.data.total); }
    setLoading(false);
  }, [workspaceId, offset, filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-gray-400 mt-1">
          Immutable record of all workspace mutations · {total} total events
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input w-auto text-sm"
          value={filter.resource_type}
          onChange={e => { setFilter(f => ({ ...f, resource_type: e.target.value })); setOffset(0); }}>
          <option value="">All resources</option>
          {Object.keys(RESOURCE_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="input w-48 text-sm" placeholder="Filter by action…"
          value={filter.action}
          onChange={e => { setFilter(f => ({ ...f, action: e.target.value })); setOffset(0); }} />
        <button className="btn-ghost text-sm" onClick={() => { setFilter({ resource_type: '', action: '' }); setOffset(0); }}>
          Clear
        </button>
      </div>

      {/* Event list */}
      <div className="card p-0 overflow-hidden divide-y divide-gray-800">
        {loading
          ? <p className="p-5 text-sm text-gray-500">Loading…</p>
          : events.length === 0
            ? <p className="p-5 text-sm text-gray-500">No events found.</p>
            : events.map(e => (
              <div key={e.id}>
                <button
                  className="w-full text-left flex items-center gap-4 px-5 py-3 hover:bg-gray-800/50 transition-colors"
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                >
                  <span className={`badge flex-shrink-0 ${RESOURCE_COLORS[e.resource_type] ?? 'bg-gray-700 text-gray-400'}`}>
                    {e.resource_type}
                  </span>
                  <span className="text-sm text-white font-mono flex-1 truncate">{e.action}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {e.user_name ?? e.user_email ?? 'system'}
                  </span>
                  <span className="text-xs text-gray-600 flex-shrink-0 hidden sm:block">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </button>

                {expanded === e.id && (
                  <div className="px-5 pb-4 bg-gray-900/50 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-gray-400">
                      <div><span className="text-gray-600">Resource ID: </span>{e.resource_id ?? '—'}</div>
                      <div><span className="text-gray-600">IP: </span>{e.ip ?? '—'}</div>
                      <div><span className="text-gray-600">User: </span>{e.user_email ?? '—'}</div>
                      <div><span className="text-gray-600">Time: </span>{new Date(e.created_at).toISOString()}</div>
                    </div>
                    {e.meta && Object.keys(e.meta).length > 0 && (
                      <pre className="bg-gray-950 rounded p-3 text-gray-400 overflow-x-auto text-xs">
                        {JSON.stringify(e.meta, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))
        }
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" disabled={offset === 0}
              onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}>← Prev</button>
            <button className="btn-ghost text-xs" disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(o => o + PAGE_SIZE)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
