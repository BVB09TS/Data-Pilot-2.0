/**
 * Simple sliding-window in-memory rate limiter.
 * No external dependencies — uses a Map keyed by IP.
 *
 * Usage:
 *   app.use('/auth', rateLimiter({ windowMs: 60_000, max: 10 }));
 *   app.use('/api', rateLimiter());              // default 100 req/min
 */
import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  /** Window length in milliseconds. Default: 60 000 (1 minute) */
  windowMs?: number;
  /** Max requests per window per IP. Default: 100 */
  max?: number;
  /** HTTP status to return when limited. Default: 429 */
  status?: number;
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

export function rateLimiter(opts: RateLimitOptions = {}) {
  const { windowMs = 60_000, max = 100, status = 429 } = opts;
  const buckets = new Map<string, BucketEntry>();

  // Periodically purge expired entries to avoid unbounded memory growth
  const gc = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(key);
    }
  }, windowMs * 2);
  gc.unref(); // don't keep process alive

  return function limit(req: Request, res: Response, next: NextFunction): void {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
      req.socket.remoteAddress ??
      'unknown';

    const now = Date.now();
    let entry = buckets.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      buckets.set(ip, entry);
    } else {
      entry.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.status(status).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}
