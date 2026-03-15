/**
 * CSRF protection middleware.
 *
 * Strategy: For state-mutating requests (POST/PUT/PATCH/DELETE) that carry
 * a session cookie, verify that the Origin or Referer header matches the
 * allowed frontend origin. This is safe for same-site cookie sessions without
 * needing a synchroniser token because we control both the API and the frontend.
 *
 * SPA requests from a different origin that don't need cookies (e.g. webhook
 * endpoints) should be excluded from this middleware.
 */
import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Only check unsafe methods
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Skip if request has no session cookie (unauthenticated — let auth middleware handle it)
  if (!req.cookies?.token) {
    next();
    return;
  }

  const allowedOrigin = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');

  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;

  // Check Origin header first (most reliable)
  if (origin) {
    if (origin.replace(/\/$/, '') !== allowedOrigin) {
      res.status(403).json({ error: 'CSRF check failed: invalid origin' });
      return;
    }
    next();
    return;
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const refOrigin = `${refUrl.protocol}//${refUrl.host}`;
      if (refOrigin !== allowedOrigin) {
        res.status(403).json({ error: 'CSRF check failed: invalid referer' });
        return;
      }
      next();
      return;
    } catch {
      res.status(403).json({ error: 'CSRF check failed: malformed referer' });
      return;
    }
  }

  // Neither Origin nor Referer — block (conservative default)
  res.status(403).json({ error: 'CSRF check failed: missing origin header' });
}
