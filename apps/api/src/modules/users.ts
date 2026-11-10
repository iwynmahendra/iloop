import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { withDb, withSystem } from '../db.js';
import { conflict, forbidden, notFound, ok } from '../http.js';
import { notStaff } from '../middleware/auth.js';
import { auditCtx, writeAudit } from '../crud/audit.js';
import { idParam } from '../crud/core.js';
import { passwordSchema } from './auth.js';

const omit = { passwordHash: true } as const;
const tempPassword = () => `Tmp-${crypto.randomBytes(9).toString('base64url')}9`;
const email = z.string().email().max(254).transform((e) => e.toLowerCase().trim());

export const usersRouter = Router();
usersRouter.use(notStaff);

/** Non-super admins only ever see their own supplier's users (JWT), regardless of query params. */
const scopeWhere = (req: any) => {
  const s = req.scope!;
  if (s.role !== 'SUPER_ADMIN') return { supplierId: s.supplierId };
  const q = req.query.supplierId; return typeof q === 'string' && z.string().uuid().safeParse(q).success ? { supplierId: q } : s.supplierId ? { supplierId: s.supplierId } : {};
};
const revoke = (userId: string) => withSystem((tx) => tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }));

usersRouter.get('/', async (req, res) => {
  const q = req.query; const page = Math.max(1, Number(q.page) || 1), limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const where: any = { ...scopeWhere(req), deletedAt: q.deleted === 'only' ? { not: null } : null };
  if (typeof q.role === 'string' && ['SUPER_ADMIN', 'SUPPLIER_ADMIN', 'SUPPLIER_STAFF'].includes(q.role)) where.role = q.role;
  if (typeof q.status === 'string' && ['ACTIVE', 'DISABLED'].includes(q.status)) where.status = q.status;
  if (typeof q.q === 'string' && q.q.trim()) where.OR = ['name', 'email'].map((f) => ({ [f]: { contains: q.q!.toString().trim().slice(0, 100), mode: 'insensitive' } }));
  const [rows, total] = await withDb(req.scope!.db, (tx) => Promise.all([
    tx.user.findMany({ where, omit, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }), tx.user.count({ where })]));
  ok(res, rows, 'OK', { page, limit, total });
});

usersRouter.get('/:id', async (req, res) => {
  const row = await withDb(req.scope!.db, (tx) => tx.user.findFirst({ where: { id: idParam(req), ...scopeWhere(req) }, omit }));
  if (!row) throw notFound();
  ok(res, row);
});

usersRouter.post('/', async (req, res) => {
  const s = req.scope!;
  const body = z.object({ email, name: z.string().trim().min(1).max(120), role: z.enum(['SUPER_ADMIN', 'SUPPLIER_ADMIN', 'SUPPLIER_STAFF']), password: passwordSchema.optional(), supplierId: z.string().uuid().optional() }).strict().parse(req.body);
  if (body.role === 'SUPER_ADMIN' && s.role !== 'SUPER_ADMIN') throw forbidden('Only a super admin can create super admins');
  // Supplier comes from the JWT for supplier admins; the body value is only honoured for SUPER_ADMIN.
  const supplierId = body.role === 'SUPER_ADMIN' ? null : s.role === 'SUPER_ADMIN' ? (body.supplierId ?? s.supplierId) : s.supplierId;
  if (body.role !== 'SUPER_ADMIN' && !supplierId) throw conflict('Choose a supplier for this user');
  const password = body.password ?? tempPassword();
  const user = await withDb(s.db, async (tx) => {
    if (await tx.user.findUnique({ where: { email: body.email } })) throw conflict('A user with this email already exists');
    if (supplierId) { const sup = await tx.supplier.findFirst({ where: { id: supplierId, deletedAt: null, isPlatform: false } }); if (!sup) throw notFound('Supplier not found'); }
    const u = await tx.user.create({ data: { email: body.email, name: body.name, role: body.role, supplierId, passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true, createdBy: s.userId, updatedBy: s.userId }, omit });
    await writeAudit(tx, { action: 'CREATE', entityType: 'User', entityId: u.id, supplierId, after: u, ...auditCtx(req) });
    return u;
  });
  ok(res, { user, temporaryPassword: body.password ? undefined : password }, 'User created', undefined, 201);
});

const update = async (req: any, res: any) => {
  const s = req.scope!, id = idParam(req);
  const body = z.object({ name: z.string().trim().min(1).max(120), role: z.enum(['SUPPLIER_ADMIN', 'SUPPLIER_STAFF']), status: z.enum(['ACTIVE', 'DISABLED']) }).partial().strict().parse(req.body);
  if (id === s.userId && (body.role || body.status)) throw forbidden('You cannot change your own role or status');
  const row = await withDb(s.db, async (tx) => {
    const before = await tx.user.findFirst({ where: { id, deletedAt: null, ...scopeWhere(req) }, omit });
    if (!before) throw notFound();
    if (before.role === 'SUPER_ADMIN' && s.role !== 'SUPER_ADMIN') throw forbidden();
    if (before.role === 'SUPER_ADMIN' && body.role) throw conflict('Super admin role cannot be changed here');
    const after = await tx.user.update({ where: { id }, data: { ...body, updatedBy: s.userId }, omit });
    await writeAudit(tx, { action: 'UPDATE', entityType: 'User', entityId: id, supplierId: before.supplierId, before, after, ...auditCtx(req) });
    return after;
  });
  if (body.status === 'DISABLED') await revoke(id);
  ok(res, row, 'Updated');
};
usersRouter.patch('/:id', update);
usersRouter.put('/:id', update);

usersRouter.delete('/:id', async (req, res) => {
  const s = req.scope!, id = idParam(req);
  if (id === s.userId) throw forbidden('You cannot delete yourself');
  await withDb(s.db, async (tx) => {
    const before = await tx.user.findFirst({ where: { id, deletedAt: null, ...scopeWhere(req) }, omit });
    if (!before) throw notFound();
    if (before.role === 'SUPER_ADMIN' && s.role !== 'SUPER_ADMIN') throw forbidden();
    await tx.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'DISABLED', updatedBy: s.userId } });
    await writeAudit(tx, { action: 'DELETE', entityType: 'User', entityId: id, supplierId: before.supplierId, before, ...auditCtx(req) });
  });
  await revoke(id);
  ok(res, null, 'Deleted');
});

usersRouter.post('/:id/reset-password', async (req, res) => {
  const s = req.scope!, id = idParam(req);
  if (id === s.userId) throw forbidden('Use "change password" for your own account');
  const password = tempPassword();
  await withDb(s.db, async (tx) => {
    const u = await tx.user.findFirst({ where: { id, deletedAt: null, ...scopeWhere(req) } });
    if (!u) throw notFound();
    if (u.role === 'SUPER_ADMIN' && s.role !== 'SUPER_ADMIN') throw forbidden();
    await tx.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null, updatedBy: s.userId } });
    await writeAudit(tx, { action: 'PASSWORD_RESET', entityType: 'User', entityId: id, supplierId: u.supplierId, ...auditCtx(req) });
  });
  await revoke(id);
  ok(res, { temporaryPassword: password }, 'Password reset. Share the temporary password securely; the user must change it at next login.');
});
