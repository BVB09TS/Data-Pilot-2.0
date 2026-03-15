import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import 'dotenv/config';
import { runMigrations } from './db/migrate.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { csrfProtection } from './middleware/csrf.js';
import { pool } from './db/pool.js';
import { getQuotaStatus } from './datapilot/llmGateway.js';
import { requestLogger } from './middleware/requestLogger.js';

import { buildGitHubStrategy } from './auth/github.strategy.js';
import { buildGoogleStrategy } from './auth/google.strategy.js';
import { buildGitLabStrategy } from './auth/gitlab.strategy.js';
import authRouter from './auth/routes.js';
import connectionsRouter from './routes/connections.js';
import nodesRouter from './routes/nodes.js';
import edgesRouter from './routes/edges.js';
import lineageRouter from './routes/lineage.js';
import environmentsRouter from './routes/environments.js';
import runsRouter from './routes/runs.js';
import policiesRouter from './routes/policies.js';
import auditLogRouter from './routes/auditLog.js';
import { webhookRouter, githubRouter } from './routes/github.js';
import { auditMiddleware } from './middleware/auditMiddleware.js';
import datapilotRouter from './routes/datapilot.js';
import chatRouter from './routes/chat.js';
import settingsRouter from './routes/settings.js';

// ── Startup env validation ────────────────────────────────────────────────────

const REQUIRED_ENV: string[] = ['DATABASE_URL', 'SERVER_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Copy apps/api/.env.example to apps/api/.env and fill in the values.\n');
  process.exit(1);
}

const anyLlmKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
if (!anyLlmKey) {
  console.warn('\n⚠️  No LLM API key found (GROQ_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY).');
  console.warn('   AI features (chat, audit agents) will be unavailable until a key is set.\n');
}

const app = express();
const PORT = process.env.PORT ?? 3000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ── Middleware ────────────────────────────────────────────────────────────────

// Request ID + structured logging
app.use(requestLogger);

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // disabled — CSP is the right defence
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
    );
  }
  next();
});

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// CSRF protection for cookie-authenticated state-mutating requests
app.use(csrfProtection);

// Rate limiting — auth routes get a tighter window (20 req/min)
app.use('/auth', rateLimiter({ windowMs: 60_000, max: 20 }));
app.use('/api/auth', rateLimiter({ windowMs: 60_000, max: 20 }));
// General API: 200 req/min
app.use('/api', rateLimiter({ windowMs: 60_000, max: 200 }));

// ── Passport (stateless — no session store) ───────────────────────────────────

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use('github', buildGitHubStrategy());
} else {
  console.warn('⚠️  GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set — GitHub OAuth disabled');
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use('google', buildGoogleStrategy());
} else {
  console.warn('⚠️  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google OAuth disabled');
}
if (process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET) {
  passport.use('gitlab', buildGitLabStrategy());
} else {
  console.warn('⚠️  GITLAB_CLIENT_ID / GITLAB_CLIENT_SECRET not set — GitLab OAuth disabled');
}
app.use(passport.initialize());

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Database check
  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // LLM provider checks (key present = provisioned; quota status included)
  checks.groq      = process.env.GROQ_API_KEY      ? 'ok' : 'error';
  checks.openai    = process.env.OPENAI_API_KEY     ? 'ok' : 'error';
  checks.anthropic = process.env.ANTHROPIC_API_KEY  ? 'ok' : 'error';

  const anyLlm = checks.groq === 'ok' || checks.openai === 'ok' || checks.anthropic === 'ok';

  const status = checks.database === 'ok' && anyLlm ? 'ok' : 'degraded';

  res.status(status === 'ok' ? 200 : 207).json({
    status,
    timestamp: new Date().toISOString(),
    checks,
    llmQuota: getQuotaStatus(),
  });
});

app.use('/auth', authRouter);
app.use('/api/auth', authRouter);

// GitHub webhook (public — no auth middleware, verified by HMAC)
app.use('/api', webhookRouter);

app.use('/api/workspaces/:workspaceId/connections',  auditMiddleware('connections'),  connectionsRouter);
app.use('/api/workspaces/:workspaceId/nodes',        auditMiddleware('nodes'),        nodesRouter);
app.use('/api/workspaces/:workspaceId/edges',        auditMiddleware('edges'),        edgesRouter);
app.use('/api/workspaces/:workspaceId/lineage',      lineageRouter);
app.use('/api/workspaces/:workspaceId/environments', auditMiddleware('environments'), environmentsRouter);
app.use('/api/workspaces/:workspaceId/runs',         auditMiddleware('runs'),         runsRouter);
app.use('/api/workspaces/:workspaceId/policies',     auditMiddleware('policies'),     policiesRouter);
app.use('/api/workspaces/:workspaceId/audit',        auditLogRouter);
app.use('/api/workspaces/:workspaceId/github',       githubRouter);
app.use('/api/workspaces/:workspaceId/datapilot',   datapilotRouter);
app.use('/api/workspaces/:workspaceId/chat',        chatRouter);
app.use('/api/workspaces/:workspaceId/settings',    settingsRouter);

// ── Start ─────────────────────────────────────────────────────────────────────

async function start() {
  try {
    await runMigrations();
  } catch {
    console.error('Startup aborted — migration failed');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`✅ API Server running on http://localhost:${PORT}\n`);
  });
}

start();
