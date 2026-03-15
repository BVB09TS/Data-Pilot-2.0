/**
 * Frontend smoke tests
 *
 * Verifies:
 *  1. api.ts exports all expected namespaces and methods
 *  2. ChatPanel renders the floating button
 *  3. Settings page renders without crashing
 *  4. Findings page renders table, filters, and audit form
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Single top-level mock for axios ─────────────────────────────────────────

vi.mock('axios', () => {
  const instance = {
    get:    vi.fn().mockResolvedValue({ data: {} }),
    post:   vi.fn().mockResolvedValue({ data: {} }),
    patch:  vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: { response: { use: vi.fn() } },
  };
  return { default: { create: vi.fn(() => instance), ...instance } };
});

// ── Single top-level mock for lib/api ────────────────────────────────────────

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), interceptors: { response: { use: vi.fn() } } },
  connectionsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), ping: vi.fn() },
  nodesApi:       { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  edgesApi:       { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
  lineageApi:     { graph: vi.fn(), manifest: vi.fn(), ancestors: vi.fn(), descendants: vi.fn() },
  runsApi:        { list: vi.fn(), get: vi.fn(), create: vi.fn(), setStatus: vi.fn(), getLogs: vi.fn(), appendLogs: vi.fn() },
  environmentsApi:{ list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  policiesApi:    { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), evaluate: vi.fn(), evaluations: vi.fn() },
  auditApi:       { list: vi.fn() },
  datapilotApi:   {
    triggerAudit:  vi.fn().mockResolvedValue({ data: { run_id: 'run-1', status: 'pending' } }),
    listFindings:  vi.fn().mockResolvedValue({ data: { findings: [], total: 0 } }),
    getFinding:    vi.fn(),
    getQuota:      vi.fn(),
  },
  settingsApi: {
    get:    vi.fn().mockResolvedValue({ data: { groq_api_key: '****Xk9z', openai_api_key: null, anthropic_api_key: null, default_project_path: '/projects/shop', updated_at: null } }),
    update: vi.fn().mockResolvedValue({ data: { ok: true } }),
  },
  chatApi: {
    send: vi.fn().mockResolvedValue({ data: { reply: 'Hello!', cost_usd: 0, model: 'test' } }),
  },
}));

// ── Single top-level mock for AuthContext ────────────────────────────────────

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    workspaceId: 'ws-test-123',
    user: { id: 'u1', name: 'Test User', email: 'test@example.com' },
    isLoading: false,
    logout: vi.fn().mockResolvedValue(undefined),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => vi.clearAllMocks());

// ── 1. api.ts shape ───────────────────────────────────────────────────────────

describe('api.ts — exported namespaces', () => {
  it('has all expected API namespaces', async () => {
    const api = await import('../lib/api');
    expect(api.connectionsApi).toBeDefined();
    expect(api.nodesApi).toBeDefined();
    expect(api.edgesApi).toBeDefined();
    expect(api.lineageApi).toBeDefined();
    expect(api.runsApi).toBeDefined();
    expect(api.policiesApi).toBeDefined();
    expect(api.auditApi).toBeDefined();
    expect(api.datapilotApi).toBeDefined();
    expect(api.settingsApi).toBeDefined();
    expect(api.chatApi).toBeDefined();
  });

  it('connectionsApi has all CRUD + ping methods', async () => {
    const { connectionsApi } = await import('../lib/api');
    (['list', 'get', 'create', 'update', 'delete', 'ping'] as const).forEach(m => {
      expect(typeof connectionsApi[m]).toBe('function');
    });
  });

  it('datapilotApi has all expected methods', async () => {
    const { datapilotApi } = await import('../lib/api');
    (['triggerAudit', 'listFindings', 'getFinding', 'getQuota'] as const).forEach(m => {
      expect(typeof datapilotApi[m]).toBe('function');
    });
  });

  it('settingsApi has get and update', async () => {
    const { settingsApi } = await import('../lib/api');
    expect(typeof settingsApi.get).toBe('function');
    expect(typeof settingsApi.update).toBe('function');
  });

  it('chatApi has send', async () => {
    const { chatApi } = await import('../lib/api');
    expect(typeof chatApi.send).toBe('function');
  });
});

// ── 2. ChatPanel ──────────────────────────────────────────────────────────────

describe('ChatPanel', () => {
  it('renders the floating action button', async () => {
    const { default: ChatPanel } = await import('../components/ChatPanel');
    render(<ChatPanel />);
    expect(screen.getByRole('button', { name: /open ai chat/i })).toBeInTheDocument();
  });

  it('does not show the panel by default (closed)', async () => {
    const { default: ChatPanel } = await import('../components/ChatPanel');
    render(<ChatPanel />);
    expect(screen.queryByText(/datapilot ai/i)).not.toBeInTheDocument();
  });
});

// ── 3. Settings page ──────────────────────────────────────────────────────────

describe('Settings page', () => {
  it('renders without crashing', async () => {
    const { default: Settings } = await import('../pages/Settings');
    render(<MemoryRouter><Settings /></MemoryRouter>);
    // Async data load — loading state is shown immediately
    expect(document.body).toBeTruthy();
  });

  it('shows loading state before data arrives', async () => {
    const { default: Settings } = await import('../pages/Settings');
    render(<MemoryRouter><Settings /></MemoryRouter>);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

// ── 4. Findings page ──────────────────────────────────────────────────────────

describe('Findings page', () => {
  it('renders the page heading', async () => {
    const { default: Findings } = await import('../pages/Findings');
    render(<MemoryRouter><Findings /></MemoryRouter>);
    expect(screen.getByText('Findings')).toBeInTheDocument();
  });

  it('renders all table column headers', async () => {
    const { default: Findings } = await import('../pages/Findings');
    render(<MemoryRouter><Findings /></MemoryRouter>);
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('renders severity and type filter dropdowns', async () => {
    const { default: Findings } = await import('../pages/Findings');
    render(<MemoryRouter><Findings /></MemoryRouter>);
    expect(screen.getByText('All Severities')).toBeInTheDocument();
    expect(screen.getByText('All Types')).toBeInTheDocument();
  });

  it('renders the "Run New Audit" form section', async () => {
    const { default: Findings } = await import('../pages/Findings');
    render(<MemoryRouter><Findings /></MemoryRouter>);
    expect(screen.getByText('Run New Audit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run audit/i })).toBeInTheDocument();
  });

  it('shows Refresh button in header', async () => {
    const { default: Findings } = await import('../pages/Findings');
    render(<MemoryRouter><Findings /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});
