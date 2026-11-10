import type { Tx } from '../db.js';
import type { Request } from 'express';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'ACTIVATE' | 'DEACTIVATE' | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'PASSWORD_RESET' | 'IMPORT' | 'EXPORT';

export interface AuditInput {
  action: AuditAction; entityType: string; entityId?: string | null;
  supplierId?: string | null; userId?: string | null; userEmail?: string | null;
  before?: unknown; after?: unknown; ip?: string | null; userAgent?: string | null; requestId?: string | null;
}

/** Same transaction as the change, so a change and its audit row commit or roll back together. */
export async function writeAudit(tx: Tx, a: AuditInput) {
  const clean = (v: unknown) => (v === undefined || v === null ? undefined : JSON.parse(JSON.stringify(v, (k, x) => (k === 'passwordHash' || k === 'tokenHash' ? undefined : x))));
  await tx.auditLog.create({ data: {
    action: a.action, entityType: a.entityType, entityId: a.entityId ?? null, supplierId: a.supplierId ?? null,
    userId: a.userId ?? null, userEmail: a.userEmail ?? null, before: clean(a.before), after: clean(a.after),
    ip: a.ip ?? null, userAgent: a.userAgent?.slice(0, 500) ?? null, requestId: a.requestId ?? null,
  } });
}

export const auditCtx = (req: Request) => ({
  userId: req.auth?.userId ?? null, userEmail: req.auth?.email ?? null,
  ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, requestId: req.requestId ?? null,
});
