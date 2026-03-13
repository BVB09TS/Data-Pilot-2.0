import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import 'dotenv/config';

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
import { auditMiddleware } from './middleware/auditMiddleware.js';

const app = express();
const PORT = process.env.PORT ?? 3000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/api/auth', authRouter);

app.use('/api/workspaces/:workspaceId/connections',  auditMiddleware('connections'),  connectionsRouter);
app.use('/api/workspaces/:workspaceId/nodes',        auditMiddleware('nodes'),        nodesRouter);
app.use('/api/workspaces/:workspaceId/edges',        auditMiddleware('edges'),        edgesRouter);
app.use('/api/workspaces/:workspaceId/lineage',      lineageRouter);
app.use('/api/workspaces/:workspaceId/environments', auditMiddleware('environments'), environmentsRouter);
app.use('/api/workspaces/:workspaceId/runs',         auditMiddleware('runs'),         runsRouter);
app.use('/api/workspaces/:workspaceId/policies',     auditMiddleware('policies'),     policiesRouter);
app.use('/api/workspaces/:workspaceId/audit',        auditLogRouter);

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅ API Server running on http://localhost:${PORT}\n`);
});
