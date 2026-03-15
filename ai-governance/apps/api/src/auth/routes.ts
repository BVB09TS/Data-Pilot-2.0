import { Router, Request, Response, NextFunction, IRouter } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { validate, required, isString, minLen, maxLen } from '../middleware/validate.js';

const BCRYPT_ROUNDS = 12;

const router: IRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const SERVER_SECRET = process.env.SERVER_SECRET ?? 'dev-secret';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function issueSessionCookie(res: Response, userId: string): void {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const token = jwt.sign({ userId }, SERVER_SECRET, { expiresIn: '7d' });

  // Persist to sessions table for revocation support
  pool.query(
    `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  ).catch((err: unknown) => console.error('Failed to persist session:', err));

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
  });
}

// ── GitHub ────────────────────────────────────────────────────────────────────

router.get('/github', (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=provider_disabled`);
  }
  passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get(
  '/github/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('github', { session: false }, (err: Error | null, user: Express.User | false) => {
      if (err || !user) return res.redirect(`${FRONTEND_URL}/login?error=oauth`);
      const u = user as { id: string };
      issueSessionCookie(res, u.id);
      res.redirect(`${FRONTEND_URL}/dashboard`);
    })(req, res, next);
  }
);

// ── Google ────────────────────────────────────────────────────────────────────

router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=provider_disabled`);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', { session: false }, (err: Error | null, user: Express.User | false) => {
      if (err || !user) return res.redirect(`${FRONTEND_URL}/login?error=oauth`);
      const u = user as { id: string };
      issueSessionCookie(res, u.id);
      res.redirect(`${FRONTEND_URL}/dashboard`);
    })(req, res, next);
  }
);

// ── GitLab ────────────────────────────────────────────────────────────────────

router.get('/gitlab', (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GITLAB_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=provider_disabled`);
  }
  passport.authenticate('gitlab', { scope: ['read_user'] })(req, res, next);
});

router.get(
  '/gitlab/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('gitlab', { session: false }, (err: Error | null, user: Express.User | false) => {
      if (err || !user) return res.redirect(`${FRONTEND_URL}/login?error=oauth`);
      const u = user as { id: string };
      issueSessionCookie(res, u.id);
      res.redirect(`${FRONTEND_URL}/dashboard`);
    })(req, res, next);
  }
);

// ── Local email/password register ─────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

  const errors = validate(req.body as Record<string, unknown>, {
    email: [required, isString, maxLen(320)],
    password: [required, isString, minLen(8), maxLen(128)],
  });
  if (errors.length) {
    res.status(400).json({ errors });
    return;
  }

  const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password!, BCRYPT_ROUNDS);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (email, name, provider, provider_id, password_hash)
     VALUES ($1, $2, 'local', $1, $3)
     RETURNING id`,
    [email, name ?? null, passwordHash]
  );

  const userId = result.rows[0]!.id;
  const slug = `ws-${userId.slice(0, 8)}`;
  const ws = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (name, slug, owner_id) VALUES ($1, $2, $3) RETURNING id`,
    [`${(name ?? email!).split('@')[0]}'s Workspace`, slug, userId]
  );
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [ws.rows[0].id, userId]
  );

  issueSessionCookie(res, userId);
  res.status(201).json({ ok: true });
});

// ── Local email/password login ─────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  const errors = validate(req.body as Record<string, unknown>, {
    email: [required, isString, maxLen(320)],
    password: [required, isString, maxLen(128)],
  });
  if (errors.length) {
    res.status(400).json({ errors });
    return;
  }

  const result = await pool.query<{ id: string; password_hash: string | null }>(
    `SELECT id, password_hash FROM users WHERE email = $1 AND provider = 'local'`,
    [email]
  );

  if (result.rows.length === 0 || !result.rows[0].password_hash) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password!, result.rows[0].password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  issueSessionCookie(res, result.rows[0].id);
  res.json({ ok: true });
});

// ── Dev login (development only — not registered in production) ───────────────

if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-login', async (_req: Request, res: Response): Promise<void> => {
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name, provider, provider_id)
       VALUES ('dev@localhost', 'Dev User', 'dev', 'dev')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      []
    );
    const userId = userResult.rows[0].id;

    const wsResult = await pool.query<{ id: string }>(
      `INSERT INTO workspaces (name, slug)
       VALUES ('Dev Workspace', 'dev')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      []
    );
    const workspaceId = wsResult.rows[0].id;

    await pool.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [workspaceId, userId]
    );

    issueSessionCookie(res, userId);
    res.json({ ok: true });
  });
}

// ── Logout ────────────────────────────────────────────────────────────────────

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.token as string | undefined;
  if (token) {
    await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
  }
  res.clearCookie('token');
  res.json({ ok: true });
});

// ── Me ────────────────────────────────────────────────────────────────────────

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', code: 'MISSING_TOKEN' });
    return;
  }

  let userId: string;
  try {
    const payload = jwt.verify(token, SERVER_SECRET) as { userId: string };
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
    return;
  }

  const userResult = await pool.query<{
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    provider: string;
    created_at: string;
  }>(
    `SELECT id, email, name, avatar_url, provider, created_at FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  const memberships = await pool.query<{
    workspace_id: string;
    workspace_name: string;
    slug: string;
    role: string;
  }>(
    `SELECT wm.workspace_id, w.name AS workspace_name, w.slug, wm.role
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.user_id = $1`,
    [userId]
  );

  res.json({
    user: userResult.rows[0],
    workspaces: memberships.rows,
  });
});

export default router;
