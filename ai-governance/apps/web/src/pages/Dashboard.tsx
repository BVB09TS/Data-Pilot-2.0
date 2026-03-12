import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { connectionsApi, nodesApi, runsApi } from '../lib/api';

interface Stats {
  connections: number;
  nodes: number;
  recentRuns: { id: string; status: string; created_at: string; node_name?: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-500/20 text-yellow-400',
  running:   'bg-blue-500/20 text-blue-400',
  success:   'bg-green-500/20 text-green-400',
  failed:    'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

export default function Dashboard() {
  const { workspaceId } = useAuth();
  const [stats, setStats] = useState<Stats>({ connections: 0, nodes: 0, recentRuns: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      connectionsApi.list(workspaceId),
      nodesApi.list(workspaceId),
      runsApi.list(workspaceId, { limit: 5 }),
    ]).then(([c, n, r]) => {
      setStats({
        connections: c.data.data.length,
        nodes: n.data.data.length,
        recentRuns: r.data.data,
      });
    }).finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Overview of your AI governance workspace</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Connections', value: stats.connections, color: 'text-indigo-400' },
          { label: 'Nodes',       value: stats.nodes,       color: 'text-purple-400' },
          { label: 'Recent Runs', value: stats.recentRuns.length, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="text-sm text-gray-400">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent runs */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Recent Runs</h2>
        {stats.recentRuns.length === 0
          ? <p className="text-sm text-gray-500">No runs yet.</p>
          : (
            <div className="divide-y divide-gray-800">
              {stats.recentRuns.map(r => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-white">{r.node_name ?? 'Unattached run'}</p>
                    <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`badge ${STATUS_COLOR[r.status] ?? 'bg-gray-700 text-gray-400'}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
