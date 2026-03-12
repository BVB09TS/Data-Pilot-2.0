import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkHealth } from './healthCheck.js';

// Stub global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

afterEach(() => vi.clearAllMocks());

function fakeResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

describe('checkHealth — type: api', () => {
  it('returns healthy for 200 from known provider', async () => {
    mockFetch.mockResolvedValue(fakeResponse(200));
    const result = await checkHealth('api', 'openai', 'sk-test', {});
    expect(result).toBe('healthy');
  });

  it('returns down for 401 (bad key)', async () => {
    mockFetch.mockResolvedValue(fakeResponse(401));
    const result = await checkHealth('api', 'openai', 'sk-bad', {});
    expect(result).toBe('down');
  });

  it('returns down for 403', async () => {
    mockFetch.mockResolvedValue(fakeResponse(403));
    const result = await checkHealth('api', 'groq', 'sk-bad', {});
    expect(result).toBe('down');
  });

  it('returns degraded for 500 (provider outage)', async () => {
    mockFetch.mockResolvedValue(fakeResponse(500));
    const result = await checkHealth('api', 'openai', 'sk-test', {});
    expect(result).toBe('degraded');
  });

  it('returns down when secret is missing', async () => {
    const result = await checkHealth('api', 'openai', undefined, {});
    expect(result).toBe('down');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns healthy for unknown provider with non-empty secret (no call made)', async () => {
    const result = await checkHealth('api', 'unknown-provider', 'key', {});
    expect(result).toBe('healthy');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns down when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await checkHealth('api', 'openai', 'sk-test', {});
    expect(result).toBe('down');
  });

  it('uses x-api-key header for anthropic', async () => {
    mockFetch.mockResolvedValue(fakeResponse(200));
    await checkHealth('api', 'anthropic', 'sk-ant-test', {});
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('checkHealth — type: mcp', () => {
  it('returns healthy for 200 from server_url', async () => {
    mockFetch.mockResolvedValue(fakeResponse(200));
    const result = await checkHealth('mcp', null, undefined, { server_url: 'http://mcp-server' });
    expect(result).toBe('healthy');
  });

  it('returns down when server_url is missing', async () => {
    const result = await checkHealth('mcp', null, undefined, {});
    expect(result).toBe('down');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns degraded for 500', async () => {
    mockFetch.mockResolvedValue(fakeResponse(500));
    const result = await checkHealth('mcp', null, undefined, { server_url: 'http://mcp-server' });
    expect(result).toBe('degraded');
  });

  it('returns down for non-ok non-5xx status', async () => {
    mockFetch.mockResolvedValue(fakeResponse(404));
    const result = await checkHealth('mcp', null, undefined, { server_url: 'http://mcp-server' });
    expect(result).toBe('down');
  });

  it('passes auth_token as Bearer header', async () => {
    mockFetch.mockResolvedValue(fakeResponse(200));
    await checkHealth('mcp', null, undefined, { server_url: 'http://mcp-server', auth_token: 'tok123' });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok123');
  });
});
