/**
 * LLM Gateway — multi-provider routing with quota tracking.
 *
 * Provider tiers:
 *   free     → Groq  (llama-3.1-8b-instant)
 *   standard → OpenAI (gpt-4o-mini)
 *   premium  → Anthropic (claude-3-5-haiku-latest)
 *
 * Fallback chain: premium → standard → free (if a key is missing).
 * Quota tracking is in-memory per process (reset on restart).
 * Set LLM_QUOTA_USD_PER_HOUR in env to cap spend. Default: $1.00/hr.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LLMTier = 'free' | 'standard' | 'premium';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  text: string;
  provider: string;
  model: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
}

export interface LLMRequestOptions {
  tier?: LLMTier;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

// ── Quota tracker ─────────────────────────────────────────────────────────────

const quotaLimitUsd = parseFloat(process.env.LLM_QUOTA_USD_PER_HOUR ?? '1.00');
let quotaWindowStart = Date.now();
let quotaUsedUsd = 0;

function checkQuota(estimatedCost: number): void {
  const now = Date.now();
  if (now - quotaWindowStart > 3_600_000) {
    // Reset window every hour
    quotaWindowStart = now;
    quotaUsedUsd = 0;
  }
  if (quotaUsedUsd + estimatedCost > quotaLimitUsd) {
    throw new Error(
      `LLM quota exceeded: $${quotaUsedUsd.toFixed(4)} used of $${quotaLimitUsd}/hr limit`,
    );
  }
}

function recordCost(cost: number): void {
  quotaUsedUsd += cost;
}

export function getQuotaStatus(): { used_usd: number; limit_usd: number; window_reset_at: string } {
  return {
    used_usd: quotaUsedUsd,
    limit_usd: quotaLimitUsd,
    window_reset_at: new Date(quotaWindowStart + 3_600_000).toISOString(),
  };
}

// ── Provider availability ─────────────────────────────────────────────────────

function availableProviders(): LLMTier[] {
  const available: LLMTier[] = [];
  if (process.env.GROQ_API_KEY) available.push('free');
  if (process.env.OPENAI_API_KEY) available.push('standard');
  if (process.env.ANTHROPIC_API_KEY) available.push('premium');
  return available;
}

function resolveTier(requested: LLMTier): LLMTier {
  const available = availableProviders();
  if (available.length === 0) {
    throw new Error('No LLM provider configured. Set GROQ_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.');
  }
  const order: LLMTier[] = ['premium', 'standard', 'free'];
  // Try from requested tier downward, then upward
  const startIdx = order.indexOf(requested);
  for (let i = startIdx; i < order.length; i++) {
    if (available.includes(order[i])) return order[i];
  }
  for (let i = startIdx - 1; i >= 0; i--) {
    if (available.includes(order[i])) return order[i];
  }
  throw new Error('No fallback provider available.');
}

// ── Cost estimation ───────────────────────────────────────────────────────────

// Rough cost per 1K tokens (input/output averaged) in USD
const COST_PER_1K: Record<string, number> = {
  'llama-3.1-8b-instant': 0.00005,
  'gpt-4o-mini':          0.00015,
  'claude-3-5-haiku-latest': 0.00025,
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = COST_PER_1K[model] ?? 0.0002;
  return ((inputTokens + outputTokens) / 1000) * rate;
}

// ── Provider implementations ─────────────────────────────────────────────────

async function callGroq(messages: LLMMessage[], opts: LLMRequestOptions): Promise<LLMResponse> {
  const model = 'llama-3.1-8b-instant';
  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.2,
    ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  return {
    text: data.choices[0].message.content,
    provider: 'groq',
    model,
    cost_usd: cost,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}

async function callOpenAI(messages: LLMMessage[], opts: LLMRequestOptions): Promise<LLMResponse> {
  const model = 'gpt-4o-mini';
  const body = {
    model,
    messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.2,
    ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  return {
    text: data.choices[0].message.content,
    provider: 'openai',
    model,
    cost_usd: cost,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}

async function callAnthropic(messages: LLMMessage[], opts: LLMRequestOptions): Promise<LLMResponse> {
  const model = 'claude-3-5-haiku-latest';
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
  const userMessages = messages.filter(m => m.role !== 'system');

  const body = {
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.2,
    system: systemMsg,
    messages: userMessages,
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  return {
    text: data.content.find(c => c.type === 'text')?.text ?? '',
    provider: 'anthropic',
    model,
    cost_usd: cost,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send messages to the appropriate LLM tier with automatic fallback.
 */
export async function llmCall(
  messages: LLMMessage[],
  opts: LLMRequestOptions = {},
): Promise<LLMResponse> {
  const tier = resolveTier(opts.tier ?? 'free');
  const estimated = 0.001; // conservative $0.001 pre-check
  checkQuota(estimated);

  let result: LLMResponse;

  if (tier === 'premium') {
    result = await callAnthropic(messages, opts);
  } else if (tier === 'standard') {
    result = await callOpenAI(messages, opts);
  } else {
    result = await callGroq(messages, opts);
  }

  recordCost(result.cost_usd);
  return result;
}

/**
 * Parse LLM response text as JSON, stripping markdown code fences if present.
 */
export function parseJsonResponse<T>(text: string): T {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Try extracting first {...} or [...] block
    const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[1]) as T;
    throw new Error(`Could not parse LLM JSON response: ${stripped.slice(0, 200)}`);
  }
}
