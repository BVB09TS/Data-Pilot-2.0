import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { connectionsApi, nodesApi, runsApi, datapilotApi } from '../lib/api';

interface Stats {
  connections: number;
  nodes: number;
  findings: number;
  criticalFindings: number;
  recentRuns: { id: string; status: string; created_at: string; node_name?: string }[];
}

const RUN_STATUS: Record<string, { cls: string }> = {
  pending:   { cls: 'status-warning' },
  running:   { cls: 'status-info' },
  success:   { cls: 'status-success' },
  failed:    { cls: 'status-error' },
  cancelled: { cls: 'status-neutral' },
};

function StatCard({ label, value, sub, iconPath }: { label: string; value: number; sub: string; iconPath: string }) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">{value}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { workspaceId, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    connections: 0, nodes: 0, findings: 0, criticalFindings: 0, recentRuns: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      connectionsApi.list(workspaceId),
      nodesApi.list(workspaceId),
      runsApi.list(workspaceId, { limit: 5 }),
      datapilotApi.listFindings(workspaceId, { limit: 1 }),
      datapilotApi.listFindings(workspaceId, { limit: 1, severity: 'critical' }),
    ]).then(([c, n, r, f, fc]) => {
      setStats({
        connections: c.data.data?.length ?? 0,
        nodes: n.data.data?.length ?? 0,
        recentRuns: r.data.data ?? [],
        findings: f.data.total ?? 0,
        criticalFindings: fc.data.total ?? 0,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [workspaceId]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-neutral-400">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Workspace overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => navigate('/findings')} className="btn-ghost shrink-0">
          Run audit
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Connections" value={stats.connections} sub="data sources"
          iconPath="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        <StatCard label="Models" value={stats.nodes} sub="in lineage graph"
          iconPath="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        <StatCard label="Findings" value={stats.findings} sub="total issues"
          iconPath="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        <StatCard label="Critical" value={stats.criticalFindings} sub={stats.criticalFindings > 0 ? 'need attention now' : 'all clear'}
          iconPath="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </div>

      {/* Critical alert banner */}
      {stats.criticalFindings > 0 && (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 cursor-pointer hover:bg-red-500/10 transition-colors"
          onClick={() => navigate('/findings')}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <p className="text-sm font-medium text-red-400">
              {stats.criticalFindings} critical finding{stats.criticalFindings !== 1 ? 's' : ''} require your attention
            </p>
          </div>
          <span className="text-xs text-red-500 shrink-0">View findings →</span>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600 mb-3">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { title: 'Explore lineage', desc: 'Visualize your data model graph', to: '/lineage',
              icon: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4' },
            { title: 'View findings', desc: 'Review audit issues and fixes', to: '/findings',
              icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
            { title: 'Configure AI', desc: 'Add API keys to enable Voro AI', to: '/settings',
              icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
          ].map(a => (
            <button
              key={a.to}
              onClick={() => navigate(a.to)}
              className="card text-left hover:border-neutral-400 dark:hover:border-neutral-600 transition-all duration-150 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 text-neutral-600 dark:text-neutral-400 group-hover:bg-neutral-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-neutral-900 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={a.icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">{a.title}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">{a.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent runs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600">
            Recent runs
          </h2>
          <button onClick={() => navigate('/runs')}
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
            View all →
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          {stats.recentRuns.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">No runs yet</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1 mb-4">
                Trigger your first audit to start seeing results here.
              </p>
              <button
                onClick={() => navigate('/findings')}
                className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors"
              >
                Run your first audit →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {stats.recentRuns.map(r => {
                const s = RUN_STATUS[r.status] ?? { cls: 'status-neutral' };
                return (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">
                          {r.node_name ?? 'Unattached run'}
                        </p>
                        <p className="text-xs text-neutral-400">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={s.cls}>{r.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
