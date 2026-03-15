/**
 * Request logger middleware.
 * Attaches a unique request ID to every request and logs structured JSON lines.
 *
 * Log format:
 *   {"level":"info","requestId":"...","method":"POST","path":"/api/...","status":200,"durationMs":12,"ts":"..."}
 */
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request type with requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const log = {
      level,
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
      ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.socket.remoteAddress,
      ts: new Date().toISOString(),
    };
    // Use stderr for errors so they appear in docker logs error stream
    if (level === 'error') {
      process.stderr.write(JSON.stringify(log) + '\n');
    } else {
      process.stdout.write(JSON.stringify(log) + '\n');
    }
  });

  next();
}

/** Structured logger scoped to a request (for use inside route handlers) */
export function logger(requestId: string) {
  return {
    info: (msg: string, meta?: Record<string, unknown>) =>
      process.stdout.write(JSON.stringify({ level: 'info', requestId, msg, ...meta, ts: new Date().toISOString() }) + '\n'),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      process.stdout.write(JSON.stringify({ level: 'warn', requestId, msg, ...meta, ts: new Date().toISOString() }) + '\n'),
    error: (msg: string, meta?: Record<string, unknown>) =>
      process.stderr.write(JSON.stringify({ level: 'error', requestId, msg, ...meta, ts: new Date().toISOString() }) + '\n'),
  };
}
