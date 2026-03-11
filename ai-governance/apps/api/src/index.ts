import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import 'dotenv/config';

import { buildGitHubStrategy } from './auth/github.strategy.js';
import { buildGoogleStrategy } from './auth/google.strategy.js';
import authRouter from './auth/routes.js';

const app = express();
const PORT = process.env.PORT ?? 3000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Passport (stateless — no session store) ───────────────────────────────────

passport.use('github', buildGitHubStrategy());
passport.use('google', buildGoogleStrategy());
app.use(passport.initialize());

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅ API Server running on http://localhost:${PORT}\n`);
});
