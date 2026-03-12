import { Request, Response, NextFunction } from 'express';
import { auditLog } from '../services/audit.js';

/**
 * Automatically logs mutating requests (POST/PATCH/DELETE) to the audit log
 * for workspace-scoped routes.
 */
export function auditMiddleware(resourceType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only log mutations
    if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      const statusCode = res.statusCode;

      // Only audit successful mutations
      if (statusCode >= 200 && statusCode < 300) {
        const resourceId =
          (body as Record<string, Record<string, string>>)?.data?.id
          ?? req.params['id']
          ?? undefined;

        const action = buildAction(req.method, req.path, resourceType);

        auditLog({
          workspaceId: req.params['workspaceId'] ?? '',
          userId: req.userId,
          action,
          resourceType,
          resourceId,
          meta: req.method !== 'DELETE' ? sanitize(req.body) : undefined,
          ip: req.ip,
        });
      }

      return originalJson(body);
    };

    next();
  };
}

function buildAction(method: string, path: string, resourceType: string): string {
  if (path.includes('/ping'))       return `${resourceType}.ping`;
  if (path.includes('/status'))     return `${resourceType}.status.update`;
  if (path.includes('/logs'))       return `${resourceType}.logs.append`;
  if (path.includes('/evaluate'))   return `${resourceType}.evaluate`;
  if (method === 'POST')   return `${resourceType}.create`;
  if (method === 'PATCH')  return `${resourceType}.update`;
  if (method === 'DELETE') return `${resourceType}.delete`;
  return `${resourceType}.mutate`;
}

/** Remove sensitive fields before storing in audit log */
function sanitize(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const safe = { ...body as Record<string, unknown> };
  delete safe['secret'];
  delete safe['password'];
  delete safe['token'];
  delete safe['encrypted_secret'];
  return safe;
}
