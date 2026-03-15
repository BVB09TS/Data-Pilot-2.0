import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { runsApi } from '../lib/api';

interface Run {
  id: string;
  status: string;
  node_name?: string;
  environment_name?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

interface LogEntry { ts: string; level: string; message: string; }

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-500/20 text-yellow-400',
  running:   'bg-blue-500/20 text-blue-400',
  success:   'bg-green-500/20 text-green-400',
  failed:    'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-neutral-500 dark:text-neutral-400',
};

const NEXT_STATUS: Record<string, string[]> = {
  pending: ['running', 'cancelled'],
  running: ['success', 'failed', 'cancelled'],
};

export default function Runs() {
  const { workspaceId } = useAuth();
  const [rows, setRows] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [transitioning, setTransitioning] = useState(false);

  function load() {
    if (!workspaceId) return;
    runsApi.list(workspaceId, { limit: 50 })
      .then(r => setRows(r.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [workspaceId]);

  async function openRun(id: string) {
    if (!workspaceId) return;
    setSelected(id);
    const r = await runsApi.getLogs(workspaceId, id);
    setLogs(r.data.data);
  }

  async function transition(runId: string, status: string) {
    if (!workspaceId) return;
    setTransitioning(true);
    await runsApi.setStatus(workspaceId, runId, status).catch(() => {});
    setTransitioning(false);
    load();
  }

  async function createRun() {
    if (!workspaceId) return;
    await runsApi.create(workspaceId, {});
    load();
  }

  const selectedRun = rows.find(r => r.id === selected);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Runs</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Pipeline execution history</p>
        </div>
        <button className="btn-primary" onClick={createRun}>+ New Run</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Run list */}
        <div className="lg:col-span-3 card p-0 overflow-hidden divide-y divide-gray-800">
          {loading
            ? <p className="p-5 text-sm text-neutral-500 dark:text-neutral-500">Loading…</p>
            : rows.length === 0
              ? <p className="p-5 text-sm text-neutral-500 dark:text-neutral-500">No runs yet.</p>
              : rows.map(r => (
                <button
                  key={r.id}
                  onClick={() => openRun(r.id)}
                  className={`w-full text-left flex items-center justify-between gap-4 px-5 py-4 transition-colors ${
                    selected === r.id ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      {r.node_name ?? 'Unattached'}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-500">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${STATUS_COLOR[r.status] ?? ''}`}>{r.status}</span>
                </button>
              ))
          }
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2 space-y-4">
          {selectedRun ? (
            <>
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Run detail</h2>
                  <span className={`badge ${STATUS_COLOR[selectedRun.status] ?? ''}`}>{selectedRun.status}</span>
                </div>
                <dl className="text-xs space-y-1.5">
                  <div className="flex justify-between"><dt className="text-neutral-500 dark:text-neutral-500">Node</dt><dd className="text-neutral-600 dark:text-neutral-300">{selectedRun.node_name ?? '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500 dark:text-neutral-500">Environment</dt><dd className="text-neutral-600 dark:text-neutral-300">{selectedRun.environment_name ?? '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500 dark:text-neutral-500">Started</dt><dd className="text-neutral-600 dark:text-neutral-300">{selectedRun.started_at ? new Date(selectedRun.started_at).toLocaleString() : '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500 dark:text-neutral-500">Finished</dt><dd className="text-neutral-600 dark:text-neutral-300">{selectedRun.finished_at ? new Date(selectedRun.finished_at).toLocaleString() : '—'}</dd></div>
                </dl>
                {NEXT_STATUS[selectedRun.status] && (
                  <div className="flex gap-2 pt-1">
                    {NEXT_STATUS[selectedRun.status].map(s => (
                      <button key={s} disabled={transitioning}
                        className={s === 'cancelled' ? 'btn-ghost text-xs' : 'btn-primary text-xs'}
                        onClick={() => transition(selectedRun.id, s)}>
                        → {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="card space-y-2">
                <h2 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">Logs ({logs.length})</h2>
                <div className="bg-gray-950 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                  {logs.length === 0
                    ? <p className="text-gray-600">No logs.</p>
                    : logs.map((l, i) => (
                      <div key={i} className={
                        l.level === 'error' ? 'text-red-400'
                        : l.level === 'warn' ? 'text-yellow-400'
                        : 'text-neutral-500 dark:text-neutral-400'
                      }>
                        <span className="text-gray-600">{new Date(l.ts).toLocaleTimeString()} </span>
                        {l.message}
                      </div>
                    ))
                  }
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-10 text-sm text-neutral-500 dark:text-neutral-500">
              Select a run to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
