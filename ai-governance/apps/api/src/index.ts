import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import 'dotenv/config';

import { buildGitHubStrategy } from './auth/github.strategy.js';
import { buildGoogleStrategy } from './auth/google.strategy.js';
import authRouter from './auth/routes.js';
import connectionsRouter from './routes/connections.js';
import nodesRouter from './routes/nodes.js';
import edgesRouter from './routes/edges.js';
import lineageRouter from './routes/lineage.js';
import environmentsRouter from './routes/environments.js';
import runsRouter from './routes/runs.js';

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
app.use(passport.initialize());

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/api/workspaces/:workspaceId/connections', connectionsRouter);
app.use('/api/workspaces/:workspaceId/nodes', nodesRouter);
app.use('/api/workspaces/:workspaceId/edges', edgesRouter);
app.use('/api/workspaces/:workspaceId/lineage', lineageRouter);
app.use('/api/workspaces/:workspaceId/environments', environmentsRouter);
app.use('/api/workspaces/:workspaceId/runs', runsRouter);

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅ API Server running on http://localhost:${PORT}\n`);
});
