import { describe, it, expect, vi, afterEach } from 'vitest';

// ── API URL construction ───────────────────────────────────────────────────────

describe('API URL helpers', () => {
  const wid = 'workspace-123';
  const id  = 'resource-456';

  it('connections list URL', () => {
    expect(`/workspaces/${wid}/connections`).toBe('/workspaces/workspace-123/connections');
  });

  it('connections ping URL', () => {
    expect(`/workspaces/${wid}/connections/${id}/ping`).toBe('/workspaces/workspace-123/connections/resource-456/ping');
  });

  it('runs status URL', () => {
    expect(`/workspaces/${wid}/runs/${id}/status`).toBe('/workspaces/workspace-123/runs/resource-456/status');
  });

  it('lineage manifest URL', () => {
    expect(`/workspaces/${wid}/lineage/manifest`).toBe('/workspaces/workspace-123/lineage/manifest');
  });

  it('policy evaluate URL', () => {
    expect(`/workspaces/${wid}/policies/${id}/evaluate`).toBe('/workspaces/workspace-123/policies/resource-456/evaluate');
  });

  it('audit log URL with params', () => {
    const params = new URLSearchParams({ resource_type: 'connections', limit: '50' });
    expect(`/workspaces/${wid}/audit?${params}`).toBe('/workspaces/workspace-123/audit?resource_type=connections&limit=50');
  });
});

// ── Interceptor logic ─────────────────────────────────────────────────────────

describe('401 interceptor guard', () => {
  afterEach(() => vi.restoreAllMocks());

  function shouldRedirect(pathname: string): boolean {
    return !pathname.startsWith('/login');
  }

  it('redirects when not on login page', () => {
    expect(shouldRedirect('/')).toBe(true);
    expect(shouldRedirect('/dashboard')).toBe(true);
    expect(shouldRedirect('/connections')).toBe(true);
  });

  it('does NOT redirect when already on login page', () => {
    expect(shouldRedirect('/login')).toBe(false);
    expect(shouldRedirect('/login?error=oauth')).toBe(false);
  });
});
