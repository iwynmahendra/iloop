import { Router, type Request } from 'express';
import { z } from 'zod';
import { withDb, type Tx } from '../db.js';
import { AppError, notFound, ok, forbidden, badRequest } from '../http.js';
import { notStaff, superOnly } from '../middleware/auth.js';
import { auditCtx, writeAudit, type AuditAction } from './audit.js';
import { checkRefs, getPlatformId, idParam, parseListQuery, readSupplierFilter, schemasFor, toPrisma, writeSupplier, writeSupplierFilter } from './core.js';
import type { ResourceDef } from './types.js';
import { mountImportExport } from './importExport.js';

const model = (tx: Tx, def: ResourceDef) => (tx as any)[def.delegate];

export function crudRouter(def: ResourceDef) {
  const r = Router();
  const { create: createSchema, update: updateSchema } = schemasFor(def);
  // Global reference data (countries, currencies) is written by SUPER_ADMIN only.
  const write = def.tenant ? [] : [superOnly];
  const remove = def.tenant ? [notStaff] : [superOnly];
  const audit = (req: Request, tx: Tx, action: AuditAction, id: string, supplierId: string | null, before?: unknown, after?: unknown) =>
    writeAudit(tx, { action, entityType: def.name, entityId: id, supplierId, before, after, ...auditCtx(req) });

  /** A single live row the caller may change, or 404. Never leaks existence of other suppliers' rows. */
  async function findWritable(req: Request, tx: Tx, id: string, deleted = false) {
    const platform = def.sharedRead ? await getPlatformId() : undefined;
    const row = await model(tx, def).findFirst({ where: { id, deletedAt: deleted ? { not: null } : null, ...writeSupplierFilter(def, req.scope!, platform) } });
    if (!row) throw notFound();
    return row;
  }

  mountImportExport(r, def, write);

  r.get('/', async (req, res) => {
    const s = req.scope!;
    const { where, orderBy, page, limit, skip } = parseListQuery(def, req.query);
    const [rows, total] = await withDb(s.db, async (tx) => {
      const w = { ...where, ...(await readSupplierFilter(def, s)) };
      return Promise.all([model(tx, def).findMany({ where: w, orderBy, skip, take: limit }), model(tx, def).count({ where: w })]);
    });
    ok(res, rows, 'OK', { page, limit, total });
  });

  r.post('/bulk', async (req, res) => {
    const s = req.scope!;
    const body = z.object({ action: z.enum(['activate', 'deactivate', 'delete', 'restore']), ids: z.array(z.string().uuid()).min(1).max(200) }).strict().parse(req.body);
    if ((body.action === 'delete' || body.action === 'restore') && s.role === 'SUPPLIER_STAFF') throw forbidden('Staff cannot delete or restore records');
    if (!def.tenant && s.role !== 'SUPER_ADMIN') throw forbidden();
    const affected = await withDb(s.db, async (tx) => {
      const platform = def.sharedRead ? await getPlatformId() : undefined;
      const restoring = body.action === 'restore';
      const rows = await model(tx, def).findMany({ where: { id: { in: body.ids }, deletedAt: restoring ? { not: null } : null, ...writeSupplierFilter(def, s, platform) }, select: { id: true, supplierId: def.tenant } });
      if (!rows.length) return 0;
      const data = body.action === 'delete' ? { deletedAt: new Date() } : restoring ? { deletedAt: null } : { status: body.action === 'activate' ? 'ACTIVE' : 'INACTIVE' };
      await model(tx, def).updateMany({ where: { id: { in: rows.map((x: any) => x.id) } }, data: { ...data, updatedBy: s.userId } });
      const action: AuditAction = ({ activate: 'ACTIVATE', deactivate: 'DEACTIVATE', delete: 'DELETE', restore: 'RESTORE' } as const)[body.action];
      for (const x of rows) await audit(req, tx, action, x.id, x.supplierId ?? null, undefined, { bulk: true });
      return rows.length;
    });
    ok(res, { affected }, `${affected} record(s) updated`);
  });

  r.get('/:id', async (req, res) => {
    const s = req.scope!, id = idParam(req);
    const row = await withDb(s.db, async (tx) => {
      const base = await model(tx, def).findFirst({ where: { id, ...(await readSupplierFilter(def, s)) } });
      if (!base) return null;
      const extra: Record<string, unknown> = {};
      for (const set of def.sets) {
        extra[set.path] = await (tx as any)[set.delegate].findMany({
          where: { [set.parentField]: id }, include: { [set.relation]: true },
          orderBy: set.kind === 'image' ? { sortOrder: 'asc' } : { createdAt: 'asc' },
        });
      }
      return { ...base, ...extra };
    });
    if (!row) throw notFound();
    ok(res, row);
  });

  r.post('/', ...write, async (req, res) => {
    const s = req.scope!;
    const body = createSchema.parse(req.body);
    const supplierId = await writeSupplier(def, s);
    const row = await withDb(s.db, async (tx) => {
      await checkRefs(tx, def, body, supplierId);
      const created = await model(tx, def).create({ data: { ...toPrisma(def, body), ...(def.tenant ? { supplierId } : {}), createdBy: s.userId, updatedBy: s.userId } });
      await audit(req, tx, 'CREATE', created.id, supplierId, undefined, created);
      return created;
    });
    ok(res, row, 'Created', undefined, 201);
  });

  const update = async (req: Request, res: any) => {
    const s = req.scope!, id = idParam(req);
    const body = updateSchema.parse(req.body);
    const row = await withDb(s.db, async (tx) => {
      const before = await findWritable(req, tx, id);
      await checkRefs(tx, def, body, def.tenant ? before.supplierId : null);
      const after = await model(tx, def).update({ where: { id }, data: { ...toPrisma(def, body), updatedBy: s.userId } });
      const action: AuditAction = body.status && body.status !== before.status && Object.keys(body).length === 1 ? (body.status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE') : 'UPDATE';
      await audit(req, tx, action, id, before.supplierId ?? null, before, after);
      return after;
    });
    ok(res, row, 'Updated');
  };
  r.patch('/:id', ...write, update);
  r.put('/:id', ...write, update);

  r.patch('/:id/status', ...write, async (req, res) => {
    const s = req.scope!, id = idParam(req);
    const { status } = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }).strict().parse(req.body);
    const row = await withDb(s.db, async (tx) => {
      const before = await findWritable(req, tx, id);
      const after = await model(tx, def).update({ where: { id }, data: { status, updatedBy: s.userId } });
      await audit(req, tx, status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE', id, before.supplierId ?? null, { status: before.status }, { status });
      return after;
    });
    ok(res, row, 'Status updated');
  });

  r.delete('/:id', ...remove, async (req, res) => {
    const s = req.scope!, id = idParam(req);
    await withDb(s.db, async (tx) => {
      const before = await findWritable(req, tx, id);
      await model(tx, def).update({ where: { id }, data: { deletedAt: new Date(), updatedBy: s.userId } });
      await audit(req, tx, 'DELETE', id, before.supplierId ?? null, before);
    });
    ok(res, null, 'Deleted');
  });

  r.post('/:id/restore', ...remove, async (req, res) => {
    const s = req.scope!, id = idParam(req);
    const row = await withDb(s.db, async (tx) => {
      const before = await findWritable(req, tx, id, true);
      const after = await model(tx, def).update({ where: { id }, data: { deletedAt: null, updatedBy: s.userId } });
      await audit(req, tx, 'RESTORE', id, before.supplierId ?? null, { deletedAt: before.deletedAt }, { deletedAt: null });
      return after;
    });
    ok(res, row, 'Restored');
  });

  // ---- amenity / image sets on a parent (hotel amenities, hotel gallery ...) ----
  for (const set of def.sets) {
    const body = set.kind === 'join'
      ? z.object({ amenityIds: z.array(z.string().uuid()).max(200) }).strict()
      : z.object({ items: z.array(z.object({ mediaId: z.string().uuid(), caption: z.string().max(255).nullish(), isCover: z.boolean().optional() }).strict()).max(50) }).strict();
    r.get(`/:id/${set.path}`, async (req, res) => {
      const s = req.scope!, id = idParam(req);
      const rows = await withDb(s.db, async (tx) => {
        const parent = await model(tx, def).findFirst({ where: { id, ...(await readSupplierFilter(def, s)) }, select: { id: true } });
        if (!parent) throw notFound();
        return (tx as any)[set.delegate].findMany({ where: { [set.parentField]: id }, include: { [set.relation]: true }, orderBy: set.kind === 'image' ? { sortOrder: 'asc' } : { createdAt: 'asc' } });
      });
      ok(res, rows);
    });
    r.put(`/:id/${set.path}`, ...write, async (req, res) => {
      const s = req.scope!, id = idParam(req);
      const b: any = body.parse(req.body);
      const out = await withDb(s.db, async (tx) => {
        const parent = await findWritable(req, tx, id);
        const ids: string[] = set.kind === 'join' ? b.amenityIds : b.items.map((i: any) => i.mediaId);
        if (new Set(ids).size !== ids.length) throw new AppError(422, 'Duplicate entries');
        if (ids.length) {
          const platform = set.kind === 'join' ? await getPlatformId() : null;
          const found = await (tx as any)[set.refDelegate].findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, supplierId: true } });
          const good = found.filter((x: any) => x.supplierId === parent.supplierId || x.supplierId === platform);
          if (good.length !== ids.length) throw new AppError(422, 'Validation failed', [{ field: set.path, message: 'One or more items were not found' }]);
        }
        await (tx as any)[set.delegate].deleteMany({ where: { [set.parentField]: id } });
        const base = { supplierId: parent.supplierId, [set.parentField]: id, createdBy: s.userId, updatedBy: s.userId };
        if (set.kind === 'join') await (tx as any)[set.delegate].createMany({ data: ids.map((x) => ({ ...base, [set.childField]: x })) });
        else {
          const cover = b.items.findIndex((i: any) => i.isCover);
          await (tx as any)[set.delegate].createMany({ data: b.items.map((i: any, n: number) => ({ ...base, mediaId: i.mediaId, caption: i.caption ?? null, sortOrder: n, isCover: cover === -1 ? n === 0 : n === cover })) });
        }
        await audit(req, tx, 'UPDATE', id, parent.supplierId, undefined, { [set.path]: set.kind === 'join' ? ids : b.items });
        return (tx as any)[set.delegate].findMany({ where: { [set.parentField]: id }, include: { [set.relation]: true }, orderBy: set.kind === 'image' ? { sortOrder: 'asc' } : { createdAt: 'asc' } });
      });
      ok(res, out, 'Saved');
    });
  }
  return r;
}
