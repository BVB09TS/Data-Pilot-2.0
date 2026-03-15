import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

interface SessionPayload {
  userId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      workspaceId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized', code: 'MISSING_TOKEN' });
    return;
  }

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, process.env.SERVER_SECRET ?? 'dev-secret') as SessionPayload;
  } catch {
    res.status(401).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
    return;
  }

  // Verify session still exists in DB (allows revocation)
  const session = await pool.query(
    `SELECT id FROM sessions WHERE token = $1 AND expires_at > now()`,
    [token]
  );
  if (session.rows.length === 0) {
    res.status(401).json({ error: 'Unauthorized', code: 'SESSION_EXPIRED' });
    return;
  }

  req.userId = payload.userId;

  // Attach first workspace the user belongs to
  const ws = await pool.query<{ id: string }>(
    `SELECT workspace_id AS id FROM workspace_members WHERE user_id = $1 LIMIT 1`,
    [payload.userId]
  );
  if (ws.rows.length > 0) {
    req.workspaceId = ws.rows[0].id;
  }

  next();
}
