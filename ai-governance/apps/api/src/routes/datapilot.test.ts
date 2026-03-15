/**
 * T-4 + T-5: DataPilot API route tests — happy path + negative/edge cases.
 * Uses in-memory mocks for DB pool and pipeline.
 * Uses Node.js built-in http + fetch (no supertest required).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'http';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQuery = vi.fn();
vi.mock('../db/pool.js', () => ({
  pool: { query: mockQuery },
}));

vi.mock('../datapilot/runPipeline.js', () => ({
  runPipeline: vi.fn().mockResolvedValue({ findings: [] }),
}));

vi.mock('../datapilot/llmGateway.js', () => ({
  getQuotaStatus: vi.fn().mockReturnValue({ usedUsd: 0, limitUsd: 1, remainingUsd: 1 }),
}));

// Mock requireAuth to inject a userId
vi.mock('../middleware/requireAuth.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { userId: string }).userId = 'user-1';
    next();
  },
}));

// ── Test server helpers ────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

async function startServer() {
  const { default: datapilotRouter } = await import('./datapilot.js');
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/workspaces/:workspaceId/datapilot', datapilotRouter);

  return new Promise<void>((resolve) => {
    server = http.createServer(app).listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

function apiRequest(method: string, path: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'token=test',
      // Satisfy CSRF check — same origin
      Origin: 'http://localhost:5173',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /datapilot/audit', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await startServer();
    // workspace member check passes, then run insert
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ws-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] });
  });

  afterEach(stopServer);

  it('returns 202 with run_id for valid request', async () => {
    const res = await apiRequest('POST', '/api/workspaces/ws-1/datapilot/audit', {
      project_path: '/dbt_projects/myproject',
    });
    expect(res.status).toBe(202);
    const body = await res.json() as Record<string, unknown>;
    expect(body.run_id).toBe('run-1');
    expect(body.status).toBe('pending');
  });

  it('returns 400 when project_path is missing', async () => {
    const res = await apiRequest('POST', '/api/workspaces/ws-1/datapilot/audit', {});
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.errors).toBeDefined();
  });

  it('returns 400 when project_path contains path traversal', async () => {
    const res = await apiRequest('POST', '/api/workspaces/ws-1/datapilot/audit', {
      project_path: '../etc/passwd',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when project_path exceeds 512 chars', async () => {
    const res = await apiRequest('POST', '/api/workspaces/ws-1/datapilot/audit', {
      project_path: '/dbt/' + 'a'.repeat(520),
    });
    expect(res.status).toBe(400);
  });

  it('returns 403 when user is not a workspace member', async () => {
    mockQuery.mockReset().mockResolvedValueOnce({ rows: [] }); // no membership
    const res = await apiRequest('POST', '/api/workspaces/ws-1/datapilot/audit', {
      project_path: '/dbt_projects/myproject',
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /datapilot/findings', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await startServer();
  });

  afterEach(stopServer);

  it('returns paginated findings', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ws-1' }] }) // workspace access
      .mockResolvedValueOnce({ rows: [{ id: 'f-1', type: 'dead_model', severity: 'high', title: 'Dead model' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await apiRequest('GET', '/api/workspaces/ws-1/datapilot/findings');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body.findings as unknown[]).length).toBe(1);
    expect(body.total).toBe(1);
  });

  it('returns 403 when not a workspace member', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await apiRequest('GET', '/api/workspaces/ws-1/datapilot/findings');
    expect(res.status).toBe(403);
  });
});

describe('GET /datapilot/quota', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await startServer();
    mockQuery.mockResolvedValue({ rows: [{ id: 'ws-1' }] });
  });

  afterEach(stopServer);

  it('returns quota status', async () => {
    const res = await apiRequest('GET', '/api/workspaces/ws-1/datapilot/quota');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('usedUsd');
    expect(body).toHaveProperty('limitUsd');
  });
});
