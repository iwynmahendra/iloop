import { Router } from 'express';
import { z } from 'zod';
import { withDb } from '../db.js';
import { AppError, notFound, ok } from '../http.js';
import { notStaff } from '../middleware/auth.js';
import { idParam } from '../crud/core.js';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'ACTIVATE', 'DEACTIVATE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET', 'IMPORT', 'EXPORT'] as const;
const query = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25),
  entityType: z.string().max(60).optional(), entityId: z.string().uuid().optional(), action: z.enum(ACTIONS).optional(),
  userId: z.string().uuid().optional(), from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(),
  supplierId: z.string().uuid().optional(),
});

export const auditRouter = Router();
auditRouter.use(notStaff);

auditRouter.get('/', async (req, res) => {
  const s = req.scope!; const p = query.safeParse(req.query);
  if (!p.success) throw new AppError(422, 'Invalid query', p.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  const q = p.data;
  const where: any = {
    // supplier admins: their supplier only (also enforced by row level security). Super admin: any, or the switcher.
    ...(s.role !== 'SUPER_ADMIN' ? { supplierId: s.supplierId } : q.supplierId ? { supplierId: q.supplierId } : s.supplierId ? { supplierId: s.supplierId } : {}),
    ...(q.entityType && { entityType: q.entityType }), ...(q.entityId && { entityId: q.entityId }), ...(q.action && { action: q.action }), ...(q.userId && { userId: q.userId }),
    ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) } }),
  };
  const [rows, total] = await withDb(s.db, (tx) => Promise.all([
    tx.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit }), tx.auditLog.count({ where })]));
  ok(res, rows, 'OK', { page: q.page, limit: q.limit, total });
});

auditRouter.get('/:id', async (req, res) => {
  const s = req.scope!;
  const row = await withDb(s.db, (tx) => tx.auditLog.findFirst({ where: { id: idParam(req), ...(s.role !== 'SUPER_ADMIN' ? { supplierId: s.supplierId } : {}) } }));
  if (!row) throw notFound();
  ok(res, row);
});
