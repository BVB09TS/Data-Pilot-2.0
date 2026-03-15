import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Redirect to login on 401 — but never when already on the login page,
// and never for /auth/me (AuthContext handles that and falls back to localStorage)
api.interceptors.response.use(
  r => r,
  err => {
    const url: string = err.config?.url ?? '';
    if (
      err.response?.status === 401 &&
      !window.location.pathname.startsWith('/login') &&
      !url.includes('/auth/me')
    ) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Typed helpers ─────────────────────────────────────────────────────────────

export const connectionsApi = {
  list:   (wid: string) => api.get(`/workspaces/${wid}/connections`),
  get:    (wid: string, id: string) => api.get(`/workspaces/${wid}/connections/${id}`),
  create: (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/connections`, body),
  update: (wid: string, id: string, body: Record<string, unknown>) => api.patch(`/workspaces/${wid}/connections/${id}`, body),
  delete: (wid: string, id: string) => api.delete(`/workspaces/${wid}/connections/${id}`),
  ping:   (wid: string, id: string) => api.post(`/workspaces/${wid}/connections/${id}/ping`),
};

export const nodesApi = {
  list:   (wid: string, type?: string) => api.get(`/workspaces/${wid}/nodes`, { params: type ? { type } : {} }),
  get:    (wid: string, id: string) => api.get(`/workspaces/${wid}/nodes/${id}`),
  create: (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/nodes`, body),
  update: (wid: string, id: string, body: Record<string, unknown>) => api.patch(`/workspaces/${wid}/nodes/${id}`, body),
  delete: (wid: string, id: string) => api.delete(`/workspaces/${wid}/nodes/${id}`),
};

export const edgesApi = {
  list:   (wid: string) => api.get(`/workspaces/${wid}/edges`),
  create: (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/edges`, body),
  delete: (wid: string, id: string) => api.delete(`/workspaces/${wid}/edges/${id}`),
};

export const lineageApi = {
  graph:       (wid: string) => api.get(`/workspaces/${wid}/lineage`),
  manifest:    (wid: string) => api.get(`/workspaces/${wid}/lineage/manifest`),
  ancestors:   (wid: string, nodeId: string) => api.get(`/workspaces/${wid}/lineage/ancestors/${nodeId}`),
  descendants: (wid: string, nodeId: string) => api.get(`/workspaces/${wid}/lineage/descendants/${nodeId}`),
  columns:     (wid: string, nodeId: string) => api.get(`/workspaces/${wid}/lineage/columns/${nodeId}`),
};

export const runsApi = {
  list:       (wid: string, params?: Record<string, unknown>) => api.get(`/workspaces/${wid}/runs`, { params }),
  get:        (wid: string, id: string) => api.get(`/workspaces/${wid}/runs/${id}`),
  create:     (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/runs`, body),
  setStatus:  (wid: string, id: string, status: string) => api.patch(`/workspaces/${wid}/runs/${id}/status`, { status }),
  getLogs:    (wid: string, id: string) => api.get(`/workspaces/${wid}/runs/${id}/logs`),
  appendLogs: (wid: string, id: string, entries: unknown[]) => api.post(`/workspaces/${wid}/runs/${id}/logs`, entries),
};

export const environmentsApi = {
  list:   (wid: string) => api.get(`/workspaces/${wid}/environments`),
  create: (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/environments`, body),
  update: (wid: string, id: string, body: Record<string, unknown>) => api.patch(`/workspaces/${wid}/environments/${id}`, body),
  delete: (wid: string, id: string) => api.delete(`/workspaces/${wid}/environments/${id}`),
};

export const policiesApi = {
  list:        (wid: string) => api.get(`/workspaces/${wid}/policies`),
  get:         (wid: string, id: string) => api.get(`/workspaces/${wid}/policies/${id}`),
  create:      (wid: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/policies`, body),
  update:      (wid: string, id: string, body: Record<string, unknown>) => api.patch(`/workspaces/${wid}/policies/${id}`, body),
  delete:      (wid: string, id: string) => api.delete(`/workspaces/${wid}/policies/${id}`),
  evaluate:    (wid: string, id: string, body: Record<string, unknown>) => api.post(`/workspaces/${wid}/policies/${id}/evaluate`, body),
  evaluations: (wid: string, id: string) => api.get(`/workspaces/${wid}/policies/${id}/evaluations`),
};

export const auditApi = {
  list: (wid: string, params?: Record<string, unknown>) => api.get(`/workspaces/${wid}/audit`, { params }),
};

export const datapilotApi = {
  triggerAudit: (wid: string, body: { project_path: string; environment_id?: string; query_history?: Record<string, number> }) =>
    api.post(`/workspaces/${wid}/datapilot/audit`, body),
  listFindings: (wid: string, params?: { run_id?: string; type?: string; severity?: string; limit?: number; offset?: number }) =>
    api.get(`/workspaces/${wid}/datapilot/findings`, { params }),
  getFinding: (wid: string, findingId: string) =>
    api.get(`/workspaces/${wid}/datapilot/findings/${findingId}`),
  getQuota: (wid: string) =>
    api.get(`/workspaces/${wid}/datapilot/quota`),
};

export const settingsApi = {
  get:    (wid: string) => api.get<{
    groq_api_key: string | null;
    openai_api_key: string | null;
    anthropic_api_key: string | null;
    default_project_path: string | null;
    updated_at: string | null;
  }>(`/workspaces/${wid}/settings`),
  update: (wid: string, body: {
    groq_api_key?: string;
    openai_api_key?: string;
    anthropic_api_key?: string;
    default_project_path?: string;
  }) => api.patch(`/workspaces/${wid}/settings`, body),
};

export const chatApi = {
  send: (
    wid: string,
    body: {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      context_finding_id?: string;
      context_model_name?: string;
    }
  ) => api.post<{ reply: string; cost_usd: number; model: string }>(`/workspaces/${wid}/chat`, body),
};
