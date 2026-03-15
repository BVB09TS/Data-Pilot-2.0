import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Installation {
  id: string;
  account_login: string;
  repo_full_name: string;
  webhook_id: number | null;
  is_active: boolean;
  created_at: string;
}

interface PRReview {
  id: string;
  repo_full_name: string;
  pr_number: number;
  pr_title: string;
  pr_author: string;
  base_branch: string;
  head_branch: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  summary: string;
  files_changed: number;
  dbt_files_found: number;
  finding_count: number;
  created_at: string;
  completed_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  running:   'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  completed: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  failed:    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Connect repo modal ────────────────────────────────────────────────────────

function ConnectRepoModal({ workspaceId, onClose, onConnected }: {
  workspaceId: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; webhook_secret?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post(`/workspaces/${workspaceId}/github/installations`, {
        repo_full_name: repo,
        token,
        webhook_url: webhookUrl || undefined,
      });
      setSuccess(data);
      onConnected();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to connect repository');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connect GitHub Repository</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-700 dark:text-green-400 text-sm">{success.message}</p>
            </div>

            {success.webhook_secret && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Webhook registered automatically.</p>
              </div>
            )}

            {!webhookUrl && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">Manual webhook setup required</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                  Go to your repo → Settings → Webhooks → Add webhook, then use these settings:
                </p>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex gap-2"><span className="text-amber-600 dark:text-amber-500 w-24 flex-shrink-0">Payload URL:</span><span className="text-amber-900 dark:text-amber-200">https://your-datapilot-url.com/api/github/webhook</span></div>
                  <div className="flex gap-2"><span className="text-amber-600 dark:text-amber-500 w-24 flex-shrink-0">Content type:</span><span className="text-amber-900 dark:text-amber-200">application/json</span></div>
                  <div className="flex gap-2"><span className="text-amber-600 dark:text-amber-500 w-24 flex-shrink-0">Events:</span><span className="text-amber-900 dark:text-amber-200">Pull requests, Issue comments</span></div>
                </div>
              </div>
            )}

            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Repository <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={repo}
                onChange={e => setRepo(e.target.value)}
                placeholder="owner/repo-name"
                required
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">e.g. <code>acme-corp/analytics</code></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                GitHub Personal Access Token <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="ghp_••••••••••••••••"
                required
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                Needs <code>repo</code> scope. <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="text-indigo-500 hover:text-indigo-400 underline">Create one here</a>.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Webhook URL <span className="text-gray-400 font-normal">(optional — auto-registers)</span>
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://your-datapilot-url.com/api/github/webhook"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">If omitted, you'll set up the webhook manually after connecting.</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium transition-colors">
                {loading ? 'Connecting…' : 'Connect repository'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PRReviews() {
  const { workspaceId } = useAuth();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [reviews, setReviews] = useState<PRReview[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function fetchData() {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [instRes, revRes] = await Promise.all([
        api.get(`/workspaces/${workspaceId}/github/installations`),
        api.get(`/workspaces/${workspaceId}/github/reviews?limit=20`),
      ]);
      setInstallations(instRes.data);
      setReviews(revRes.data.reviews);
      setTotalReviews(revRes.data.total);
    } catch {
      // handled gracefully
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, [workspaceId]);

  async function removeInstallation(id: string) {
    if (!workspaceId || !confirm('Disconnect this repository? This will delete all associated review history.')) return;
    setRemovingId(id);
    try {
      await api.delete(`/workspaces/${workspaceId}/github/installations/${id}`);
      await fetchData();
    } catch {
      alert('Failed to remove installation');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PR Reviews</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Automated dbt code review on every pull request — powered by DataPilot agents.
          </p>
        </div>
        <button
          onClick={() => setShowConnect(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-indigo-500/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Connect repo
        </button>
      </div>

      {/* How it works — shown when no repos connected */}
      {!loading && installations.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">AI-powered PR reviews for your dbt project</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Connect a GitHub repository to automatically review pull requests with 4 specialist agents.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '🔍', title: 'Linter', desc: 'Naming conventions, SELECT *, hardcoded literals' },
                { icon: '📋', title: 'Governor', desc: 'Missing docs, missing tests, no schema YAML' },
                { icon: '🌊', title: 'Impact Analyzer', desc: 'Downstream models and dashboards affected' },
                { icon: '⚡', title: 'Optimizer', desc: 'Duplicate refs, oversized models' },
              ].map(a => (
                <div key={a.title} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-white/10">
                  <div className="text-xl mb-2">{a.icon}</div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{a.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowConnect(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Connect your first repository
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connected repositories */}
      {installations.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Connected Repositories
          </h2>
          <div className="space-y-2">
            {installations.map(inst => (
              <div key={inst.id} className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10">
                <div className="w-9 h-9 rounded-lg bg-gray-900 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">{inst.repo_full_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                    Connected {timeAgo(inst.created_at)} · {inst.webhook_id ? 'Webhook active' : 'Manual webhook setup needed'}
                  </p>
                </div>
                <div className={`text-xs px-2.5 py-1 rounded-full border font-medium ${inst.is_active && inst.webhook_id ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'}`}>
                  {inst.is_active && inst.webhook_id ? 'Active' : 'Setup needed'}
                </div>
                <button
                  onClick={() => removeInstallation(inst.id)}
                  disabled={removingId === inst.id}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                  title="Disconnect"
                >
                  {removingId === inst.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PR Reviews list */}
      {reviews.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Recent Reviews
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-600">{totalReviews} total</span>
          </div>
          <div className="space-y-2">
            {reviews.map(r => (
              <div key={r.id} className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10">
                <div className="flex items-start gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 mt-0.5 ${STATUS_STYLES[r.status]}`}>
                    {r.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-500">{r.repo_full_name}#{r.pr_number}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.pr_title}</span>
                    </div>
                    {r.summary && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{r.summary}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-400 dark:text-gray-600">
                        {r.dbt_files_found} dbt file{r.dbt_files_found !== 1 ? 's' : ''} · {r.finding_count} finding{r.finding_count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-600">
                        {r.head_branch} → {r.base_branch}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-600 ml-auto">
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty reviews (repos connected but no reviews yet) */}
      {!loading && installations.length > 0 && reviews.length === 0 && (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No reviews yet</p>
          <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">Open a pull request on a connected repo to trigger your first review.</p>
        </div>
      )}

      {showConnect && (
        <ConnectRepoModal
          workspaceId={workspaceId!}
          onClose={() => setShowConnect(false)}
          onConnected={() => { setShowConnect(false); void fetchData(); }}
        />
      )}
    </div>
  );
}
