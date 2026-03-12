import { pool } from '../db/pool.js';

export interface AuditEvent {
  workspaceId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

/**
 * Append an event to the audit log.
 * Fire-and-forget — never throws, so it never breaks request handlers.
 */
export function auditLog(event: AuditEvent): void {
  pool.query(
    `INSERT INTO audit_events
       (workspace_id, user_id, action, resource_type, resource_id, meta, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      event.workspaceId,
      event.userId ?? null,
      event.action,
      event.resourceType,
      event.resourceId ?? null,
      event.meta ?? {},
      event.ip ?? null,
    ]
  ).catch(err => console.error('[audit] Failed to write event:', err));
}
