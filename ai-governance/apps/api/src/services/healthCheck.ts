/**
 * Health check service.
 * Makes lightweight test calls to verify a connection is reachable.
 * Returns: 'healthy' | 'degraded' | 'down'
 */

type HealthStatus = 'healthy' | 'degraded' | 'down';

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai:    'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/models',
  groq:      'https://api.groq.com/openai/v1/models',
  cohere:    'https://api.cohere.ai/v1/models',
};

export async function checkHealth(
  type: string,
  provider: string | null,
  secret: string | undefined,
  config: Record<string, unknown>
): Promise<HealthStatus> {
  try {
    if (type === 'api') {
      return await checkApiHealth(provider, secret);
    } else if (type === 'mcp') {
      return await checkMcpHealth(config);
    }
    return 'unknown' as HealthStatus;
  } catch {
    return 'down';
  }
}

async function checkApiHealth(
  provider: string | null,
  secret: string | undefined
): Promise<HealthStatus> {
  if (!secret) return 'down';

  const url = provider ? PROVIDER_ENDPOINTS[provider.toLowerCase()] : undefined;
  if (!url) {
    // Unknown provider — treat a non-empty secret as healthy (can't verify)
    return 'healthy';
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${secret}`,
  };

  // Anthropic uses a different auth header
  if (provider?.toLowerCase() === 'anthropic') {
    headers['x-api-key'] = secret;
    headers['anthropic-version'] = '2023-06-01';
    delete headers['Authorization'];
  }

  const res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(5000) });

  if (res.ok) return 'healthy';
  if (res.status === 401 || res.status === 403) return 'down';   // bad key
  if (res.status >= 500) return 'degraded';                       // provider issue
  return 'degraded';
}

async function checkMcpHealth(config: Record<string, unknown>): Promise<HealthStatus> {
  const serverUrl = config['server_url'] as string | undefined;
  if (!serverUrl) return 'down';

  const authToken = config['auth_token'] as string | undefined;
  const headers: Record<string, string> = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  const res = await fetch(serverUrl, { method: 'GET', headers, signal: AbortSignal.timeout(5000) });

  if (res.ok) return 'healthy';
  if (res.status >= 500) return 'degraded';
  return 'down';
}
