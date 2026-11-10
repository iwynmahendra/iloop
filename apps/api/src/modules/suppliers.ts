import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { withDb, withSystem } from '../db.js';
import { AppError, badRequest, conflict, forbidden, notFound, ok } from '../http.js';
import { superOnly } from '../middleware/auth.js';
import { auditCtx, writeAudit } from '../crud/audit.js';
import { idParam } from '../crud/core.js';
import { saveImage } from '../storage.js';
import { passwordSchema } from './auth.js';

const SELECT = undefined;
const base = {
  name: z.string().trim().min(1).max(200), legalName: z.string().trim().max(200).nullish(), email: z.string().email().max(254),
  phone: z.string().trim().max(40).nullish(), address: z.string().trim().max(2000).nullish(), countryCode: z.string().length(2).transform((s) => s.toUpperCase()).nullish(),
  taxId: z.string().trim().max(60).nullish(), commissionPct: z.union([z.number(), z.string().regex(/^\d{1,3}(\.\d{1,2})?$/)]).refine((v) => Number(v) >= 0 && Number(v) <= 100, 'Between 0 and 100'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
};
const createSchema = z.object({ ...base, commissionPct: base.commissionPct.optional(), status: base.status.optional() }).strict();
const updateSchema = z.object(base).partial().strict();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });
const tempPassword = () => `Tmp-${crypto.randomBytes(9).toString('base64url')}9`;

export const suppliersRouter = Router();

// Supplier users can read their own supplier (name, logo) for the UI header.
suppliersRouter.get('/current', async (req, res) => {
  const s = req.scope!;
  if (!s.supplierId) return ok(res, null);
  const row = await withDb(s.db, (tx) => tx.supplier.findFirst({ where: { id: s.supplierId!, deletedAt: null } }));
  if (!row) throw notFound();
  ok(res, row);
});

suppliersRouter.use(superOnly);

suppliersRouter.get('/', async (req, res) => {
  const q = req.query;
  const page = Math.max(1, Number(q.page) || 1), limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const where: any = { deletedAt: q.deleted === 'only' ? { not: null } : q.deleted === 'include' ? undefined : null };
  if (typeof q.status === 'string' && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(q.status)) where.status = q.status;
  if (typeof q.q === 'string' && q.q.trim()) where.OR = ['name', 'code', 'email', 'legalName'].map((f) => ({ [f]: { contains: q.q!.toString().trim().slice(0, 100), mode: 'insensitive' } }));
  const sortField = ['name', 'code', 'status', 'createdAt', 'commissionPct'].includes(String(q.sort).split(':')[0]) ? String(q.sort).split(':')[0] : 'createdAt';
  const dir = String(q.sort).endsWith(':asc') ? 'asc' : 'desc';
  const [rows, total] = await withDb(req.scope!.db, (tx) => Promise.all([
    tx.supplier.findMany({ where, orderBy: [{ [sortField]: dir }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }), tx.supplier.count({ where })]));
  ok(res, rows, 'OK', { page, limit, total });
});

suppliersRouter.get('/:id', async (req, res) => {
  const row = await withDb(req.scope!.db, (tx) => tx.supplier.findFirst({ where: { id: idParam(req) } }));
  if (!row) throw notFound();
  ok(res, row);
});

suppliersRouter.post('/', async (req, res) => {
  const body = createSchema.parse(req.body); const s = req.scope!;
  const row = await withDb(s.db, async (tx) => {
    const created = await tx.supplier.create({ data: { ...body, createdBy: s.userId, updatedBy: s.userId } }); // code SUP-xxxx comes from the database
    await writeAudit(tx, { action: 'CREATE', entityType: 'Supplier', entityId: created.id, supplierId: created.id, after: created, ...auditCtx(req) });
    return created;
  });
  ok(res, row, 'Created', undefined, 201);
});

const revokeSessions = (supplierId: string) => withSystem(async (tx) => {
  const users = await tx.user.findMany({ where: { supplierId }, select: { id: true } });
  await tx.refreshToken.updateMany({ where: { userId: { in: users.map((u) => u.id) }, revokedAt: null }, data: { revokedAt: new Date() } });
});

const doUpdate = async (req: any, res: any) => {
  const body = updateSchema.parse(req.body); const s = req.scope!, id = idParam(req);
  const row = await withDb(s.db, async (tx) => {
    const before = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw notFound();
    if (before.isPlatform && body.status && body.status !== 'ACTIVE') throw conflict('The platform supplier cannot be deactivated');
    const after = await tx.supplier.update({ where: { id }, data: { ...body, updatedBy: s.userId } });
    await writeAudit(tx, { action: 'UPDATE', entityType: 'Supplier', entityId: id, supplierId: id, before, after, ...auditCtx(req) });
    return after;
  });
  if (body.status && body.status !== 'ACTIVE') await revokeSessions(id);
  ok(res, row, 'Updated');
};
suppliersRouter.patch('/:id', doUpdate);
suppliersRouter.put('/:id', doUpdate);

suppliersRouter.patch('/:id/status', async (req, res) => {
  req.body = z.object({ status: base.status }).strict().parse(req.body);
  await doUpdate(req, res);
});

suppliersRouter.delete('/:id', async (req, res) => {
  const s = req.scope!, id = idParam(req);
  await withDb(s.db, async (tx) => {
    const before = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw notFound();
    if (before.isPlatform) throw conflict('The platform supplier cannot be deleted');
    await tx.supplier.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: s.userId } });
    await writeAudit(tx, { action: 'DELETE', entityType: 'Supplier', entityId: id, supplierId: id, before, ...auditCtx(req) });
  });
  await revokeSessions(id);
  ok(res, null, 'Deleted');
});

suppliersRouter.post('/:id/restore', async (req, res) => {
  const s = req.scope!, id = idParam(req);
  const row = await withDb(s.db, async (tx) => {
    const before = await tx.supplier.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!before) throw notFound();
    const after = await tx.supplier.update({ where: { id }, data: { deletedAt: null, updatedBy: s.userId } });
    await writeAudit(tx, { action: 'RESTORE', entityType: 'Supplier', entityId: id, supplierId: id, ...auditCtx(req) });
    return after;
  });
  ok(res, row, 'Restored (status is still inactive: activate it when ready)');
});

suppliersRouter.post('/:id/logo', upload.single('file'), async (req, res) => {
  const s = req.scope!, id = idParam(req);
  if (!req.file) throw badRequest('Attach an image in the "file" field');
  const img = await saveImage(req.file.buffer, id);
  const row = await withDb(s.db, async (tx) => {
    const before = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw notFound();
    const after = await tx.supplier.update({ where: { id }, data: { logoUrl: img.url, updatedBy: s.userId } });
    await writeAudit(tx, { action: 'UPDATE', entityType: 'Supplier', entityId: id, supplierId: id, before: { logoUrl: before.logoUrl }, after: { logoUrl: img.url }, ...auditCtx(req) });
    return after;
  });
  ok(res, row, 'Logo updated');
});

/** Create the first (or another) SUPPLIER_ADMIN for a supplier. A temporary password is returned once if none is given. */
suppliersRouter.post('/:id/admin', async (req, res) => {
  const s = req.scope!, id = idParam(req);
  const body = z.object({ email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()), name: z.string().trim().min(1).max(120), password: passwordSchema.optional() }).strict().parse(req.body);
  const password = body.password ?? tempPassword();
  const user = await withDb(s.db, async (tx) => {
    const sup = await tx.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!sup) throw notFound();
    if (sup.isPlatform) throw conflict('The platform supplier has no admin users');
    if (await tx.user.findUnique({ where: { email: body.email } })) throw conflict('A user with this email already exists');
    const u = await tx.user.create({ data: { supplierId: id, email: body.email, name: body.name, role: 'SUPPLIER_ADMIN', passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true, createdBy: s.userId, updatedBy: s.userId },
      omit: { passwordHash: true } });
    await writeAudit(tx, { action: 'CREATE', entityType: 'User', entityId: u.id, supplierId: id, after: u, ...auditCtx(req) });
    return u;
  });
  ok(res, { user, temporaryPassword: body.password ? undefined : password }, 'Supplier admin created', undefined, 201);
});
void SELECT; void forbidden; void AppError;
