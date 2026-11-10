import { Router } from 'express';
import { z } from 'zod';
import { withDb } from '../db.js';
import { badRequest, conflict, notFound } from '../http.js';
import { auditCtx, writeAudit } from '../crud/audit.js';
import { idOf, needSupplier, uuidP } from '../booking/util.js';
import { notStaff } from '../middleware/auth.js';
import { appendLog, DEPARTMENTS, h, logEntry, ORDER_STATUS, ROOM_STATUS, SLA_MIN, TASK_STATUS, type T } from './shared.js';

export const opsRouter = Router();
const tx = <R>(req: Parameters<Parameters<typeof h>[0]>[0], fn: (t: T) => Promise<R>) => withDb(req.scope!.db, fn);
const sup = (req: any) => (req.scope.supplierId ? { supplierId: req.scope.supplierId } : {});
const who = (req: any) => req.auth.email as string;
const aud = (t: T, req: any, action: 'CREATE' | 'UPDATE' | 'DELETE', type: string, id: string, after?: unknown) => writeAudit(t, { action, entityType: type, entityId: id, supplierId: req.scope.supplierId, after, ...auditCtx(req) });
const dept = z.enum(DEPARTMENTS);
const page = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(200).default(50) });

/* ------------------------------------------------------------------ overview + alerts */
opsRouter.get('/ops/overview', h(async (req) => ({ data: await tx(req, async (t) => {
  const now = new Date(), s = sup(req);
  const [open, overdue, blocked, rooms, orders, oldOrders, staff] = await Promise.all([
    t.opsTask.findMany({ where: { ...s, status: { not: 'DONE' } }, select: { id: true, kind: true, department: true, status: true } }),
    t.opsTask.findMany({ where: { ...s, status: { not: 'DONE' }, dueAt: { lt: now } }, orderBy: { dueAt: 'asc' }, take: 20, select: { id: true, kind: true, title: true, roomNumber: true, department: true, dueAt: true, priority: true } }),
    t.opsTask.findMany({ where: { ...s, status: 'BLOCKED' }, take: 20, select: { id: true, title: true, department: true } }),
    t.opsRoom.groupBy({ by: ['status'], where: s, _count: true }),
    t.diningOrder.count({ where: { ...s, status: { in: ['NEW', 'PREPARING', 'ON_THE_WAY'] } } }),
    t.diningOrder.findMany({ where: { ...s, status: 'NEW', createdAt: { lt: new Date(now.getTime() - 15 * 60000) } }, take: 20, select: { id: true, ref: true, roomNumber: true, createdAt: true } }),
    t.opsStaff.findMany({ where: s, select: { id: true, name: true, department: true, onDuty: true } }),
  ]);
  const load = await t.opsTask.groupBy({ by: ['assigneeId'], where: { ...s, status: { not: 'DONE' }, assigneeId: { not: null } }, _count: true });
  const byDept = DEPARTMENTS.map((d) => ({ department: d, open: open.filter((x) => x.department === d).length }));
  return {
    open: open.length, openRequests: open.filter((x) => x.kind === 'REQUEST').length, unassigned: 0, overdueCount: overdue.length, blockedCount: blocked.length, openOrders: orders,
    rooms: Object.fromEntries(ROOM_STATUS.map((st) => [st, rooms.find((r) => r.status === st)?._count ?? 0])), byDept,
    staff: staff.map((x) => ({ ...x, open: load.find((l) => l.assigneeId === x.id)?._count ?? 0 })),
    alerts: [
      ...overdue.map((x) => ({ type: x.kind === 'REQUEST' ? 'REQUEST_PAST_TARGET' : 'TASK_OVERDUE', id: x.id, text: `${x.title}${x.roomNumber ? `, room ${x.roomNumber}` : ''}`, department: x.department, since: x.dueAt })),
      ...blocked.map((x) => ({ type: 'TASK_BLOCKED', id: x.id, text: x.title, department: x.department, since: null })),
      ...oldOrders.map((x) => ({ type: 'ORDER_WAITING', id: x.id, text: `Order ${x.ref}, room ${x.roomNumber} not started`, department: 'F&B', since: x.createdAt })),
    ],
  };
}) })));

/* ------------------------------------------------------------------ tasks and guest requests */
const taskQ = page.extend({ kind: z.enum(['TASK', 'REQUEST']).optional(), status: z.enum(TASK_STATUS).optional(), department: dept.optional(), assigneeId: uuidP.optional(), q: z.string().max(80).optional(), open: z.enum(['true', 'false']).optional() });
const pubTask = (x: any) => ({ ...x, assignee: x.assignee ? { id: x.assignee.id, name: x.assignee.name } : null, slaMinutes: x.priority === 'URGENT' ? SLA_MIN.URGENT : SLA_MIN.NORMAL, overdue: x.status !== 'DONE' && !!x.dueAt && x.dueAt < new Date() });
opsRouter.get('/ops/tasks', h(async (req) => {
  const q = taskQ.parse(req.query);
  const where: any = { ...sup(req), ...(q.kind && { kind: q.kind }), ...(q.status && { status: q.status }), ...(q.department && { department: q.department }), ...(q.assigneeId && { assigneeId: q.assigneeId }), ...(q.open === 'true' && { status: { not: 'DONE' } }),
    ...(q.q && { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { roomNumber: { contains: q.q, mode: 'insensitive' } }, { guestName: { contains: q.q, mode: 'insensitive' } }, { ref: { contains: q.q, mode: 'insensitive' } }] }) };
  const [rows, total] = await tx(req, (t) => Promise.all([t.opsTask.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], skip: (q.page - 1) * q.limit, take: q.limit, include: { assignee: true } }), t.opsTask.count({ where })]));
  return { data: rows.map(pubTask), meta: { page: q.page, limit: q.limit, total } };
}));
const taskIn = z.object({ title: z.string().trim().min(1).max(200), department: dept, priority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'), assigneeId: uuidP.nullable().optional(), roomNumber: z.string().trim().max(20).optional().nullable(), notes: z.string().trim().max(1000).optional().nullable(), dueAt: z.string().datetime({ offset: true }).optional().nullable() }).strict();
opsRouter.post('/ops/tasks', h(async (req) => {
  const sid = needSupplier(req.scope!), b = taskIn.parse(req.body);
  const row = await tx(req, async (t) => {
    const r = await t.opsTask.create({ data: { supplierId: sid, kind: 'TASK', title: b.title, department: b.department, priority: b.priority, assigneeId: b.assigneeId ?? null, roomNumber: b.roomNumber || null, notes: b.notes || null, dueAt: b.dueAt ? new Date(b.dueAt) : null, createdBy: who(req), log: [logEntry(who(req), 'Created')] }, include: { assignee: true } });
    await aud(t, req, 'CREATE', 'OpsTask', r.id, { title: r.title }); return r;
  });
  return { data: pubTask(row), message: 'Task created', status: 201 };
}));
const taskPatch = z.object({ status: z.enum(TASK_STATUS).optional(), assigneeId: uuidP.nullable().optional(), priority: z.enum(['NORMAL', 'URGENT']).optional(), notes: z.string().trim().max(1000).nullable().optional(), dueAt: z.string().datetime({ offset: true }).nullable().optional(), department: dept.optional() }).strict();
opsRouter.patch('/ops/tasks/:id', h(async (req) => {
  const id = idOf(req), b = taskPatch.parse(req.body);
  const row = await tx(req, async (t) => {
    const cur = await t.opsTask.findFirst({ where: { id, ...sup(req) }, include: { assignee: true } });
    if (!cur) throw notFound('Task not found');
    let log: any = cur.log; const msgs: string[] = [];
    if (b.status && b.status !== cur.status) msgs.push(`Status: ${b.status.replace('_', ' ').toLowerCase()}`);
    let assigneeName: string | undefined;
    if (b.assigneeId !== undefined && b.assigneeId !== cur.assigneeId) {
      if (b.assigneeId) { const st = await t.opsStaff.findFirst({ where: { id: b.assigneeId, supplierId: cur.supplierId } }); if (!st) throw badRequest('Unknown staff member'); assigneeName = st.name; }
      msgs.push(b.assigneeId ? `Assigned to ${assigneeName}` : 'Unassigned');
    }
    if (b.priority && b.priority !== cur.priority) msgs.push(`Priority: ${b.priority.toLowerCase()}`);
    for (const m of msgs) log = appendLog(log, logEntry(who(req), m));
    const done = b.status === 'DONE' ? new Date() : b.status ? null : undefined;
    const upd = await t.opsTask.update({ where: { id }, data: { ...(b.status && { status: b.status }), ...(done !== undefined && { doneAt: done }), ...(b.assigneeId !== undefined && { assigneeId: b.assigneeId }), ...(b.priority && { priority: b.priority }), ...(b.notes !== undefined && { notes: b.notes }), ...(b.dueAt !== undefined && { dueAt: b.dueAt ? new Date(b.dueAt) : null }), ...(b.department && { department: b.department }), log, updatedAt: new Date() }, include: { assignee: true } });
    await aud(t, req, 'UPDATE', 'OpsTask', id, b); return upd;
  });
  return { data: pubTask(row), message: 'Saved' };
}));
opsRouter.post('/ops/tasks/:id/notes', h(async (req) => {
  const id = idOf(req), b = z.object({ message: z.string().trim().min(1).max(500) }).strict().parse(req.body);
  const row = await tx(req, async (t) => { const cur = await t.opsTask.findFirst({ where: { id, ...sup(req) } }); if (!cur) throw notFound(); return t.opsTask.update({ where: { id }, data: { log: appendLog(cur.log, logEntry(who(req), b.message)) }, include: { assignee: true } }); });
  return { data: pubTask(row), message: 'Note added' };
}));
opsRouter.delete('/ops/tasks/:id', notStaff, h(async (req) => {
  const id = idOf(req);
  await tx(req, async (t) => { const r = await t.opsTask.deleteMany({ where: { id, ...sup(req) } }); if (!r.count) throw notFound(); await aud(t, req, 'DELETE', 'OpsTask', id); });
  return { data: { id }, message: 'Deleted' };
}));

/* ------------------------------------------------------------------ staff */
const staffIn = z.object({ name: z.string().trim().min(1).max(80), department: dept, onDuty: z.boolean().default(true) }).strict();
opsRouter.get('/ops/staff', h(async (req) => ({ data: await tx(req, (t) => t.opsStaff.findMany({ where: sup(req), orderBy: [{ department: 'asc' }, { name: 'asc' }] })) })));
opsRouter.post('/ops/staff', notStaff, h(async (req) => { const sid = needSupplier(req.scope!), b = staffIn.parse(req.body); return { data: await tx(req, async (t) => { const r = await t.opsStaff.create({ data: { supplierId: sid, ...b } }); await aud(t, req, 'CREATE', 'OpsStaff', r.id, b); return r; }), status: 201, message: 'Staff member added' }; }));
opsRouter.patch('/ops/staff/:id', notStaff, h(async (req) => { const id = idOf(req), b = staffIn.partial().strict().parse(req.body); return { data: await tx(req, async (t) => { const r = await t.opsStaff.updateMany({ where: { id, ...sup(req) }, data: b }); if (!r.count) throw notFound(); return t.opsStaff.findUnique({ where: { id } }); }) }; }));
opsRouter.delete('/ops/staff/:id', notStaff, h(async (req) => { const id = idOf(req); await tx(req, async (t) => { if (await t.opsTask.count({ where: { assigneeId: id, status: { not: 'DONE' } } })) throw conflict('This person still has open tasks. Reassign them first.'); const r = await t.opsStaff.deleteMany({ where: { id, ...sup(req) } }).catch(() => { throw conflict('This person is referenced by past tasks. Mark them off duty instead.'); }); if (!r.count) throw notFound(); }); return { data: { id }, message: 'Removed' }; }));

/* ------------------------------------------------------------------ rooms */
const roomIn = z.object({ roomNumber: z.string().trim().min(1).max(20), floor: z.string().trim().max(10).nullable().optional(), status: z.enum(ROOM_STATUS).default('CLEAN'), notes: z.string().trim().max(300).nullable().optional() }).strict();
opsRouter.get('/ops/rooms', h(async (req) => ({ data: await tx(req, (t) => t.opsRoom.findMany({ where: sup(req), orderBy: { roomNumber: 'asc' } })) })));
opsRouter.post('/ops/rooms', notStaff, h(async (req) => {
  const sid = needSupplier(req.scope!), b = z.union([roomIn, z.object({ rooms: z.array(roomIn).min(1).max(500) }).strict()]).parse(req.body);
  const list = 'rooms' in b ? b.rooms : [b];
  const n = await tx(req, async (t) => (await t.opsRoom.createMany({ data: list.map((r) => ({ supplierId: sid, ...r, floor: r.floor ?? null, notes: r.notes ?? null })), skipDuplicates: true })).count);
  return { data: { created: n }, message: `${n} room(s) added`, status: 201 };
}));
opsRouter.patch('/ops/rooms/:id', h(async (req) => {
  const id = idOf(req), b = z.object({ status: z.enum(ROOM_STATUS).optional(), dnd: z.boolean().optional(), notes: z.string().trim().max(300).nullable().optional() }).strict().parse(req.body);
  return { data: await tx(req, async (t) => { const r = await t.opsRoom.updateMany({ where: { id, ...sup(req) }, data: { ...b, updatedAt: new Date() } }); if (!r.count) throw notFound(); return t.opsRoom.findUnique({ where: { id } }); }) };
}));
opsRouter.delete('/ops/rooms/:id', notStaff, h(async (req) => { const id = idOf(req); await tx(req, async (t) => { const r = await t.opsRoom.deleteMany({ where: { id, ...sup(req) } }); if (!r.count) throw notFound(); }); return { data: { id }, message: 'Removed' }; }));

/* ------------------------------------------------------------------ dining */
const itemIn = z.object({ category: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120), description: z.string().trim().max(300).nullable().optional(), price: z.number().min(0).max(1e9), tags: z.array(z.string().trim().max(20)).max(8).default([]), available: z.boolean().default(true), sortOrder: z.number().int().default(0) }).strict();
opsRouter.get('/ops/dining/items', h(async (req) => ({ data: await tx(req, (t) => t.diningItem.findMany({ where: sup(req), orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] })) })));
opsRouter.post('/ops/dining/items', notStaff, h(async (req) => { const sid = needSupplier(req.scope!), b = itemIn.parse(req.body); return { data: await tx(req, (t) => t.diningItem.create({ data: { supplierId: sid, ...b } })), status: 201, message: 'Item added' }; }));
opsRouter.patch('/ops/dining/items/:id', h(async (req) => { const id = idOf(req), b = itemIn.partial().strict().parse(req.body); if (req.auth!.role === 'SUPPLIER_STAFF' && Object.keys(b).some((k) => k !== 'available')) throw badRequest('Staff can only mark items available or sold out'); return { data: await tx(req, async (t) => { const r = await t.diningItem.updateMany({ where: { id, ...sup(req) }, data: b }); if (!r.count) throw notFound(); return t.diningItem.findUnique({ where: { id } }); }) }; }));
opsRouter.delete('/ops/dining/items/:id', notStaff, h(async (req) => { const id = idOf(req); await tx(req, async (t) => { const r = await t.diningItem.deleteMany({ where: { id, ...sup(req) } }); if (!r.count) throw notFound(); }); return { data: { id }, message: 'Removed' }; }));
opsRouter.get('/ops/dining/orders', h(async (req) => {
  const q = page.extend({ status: z.enum(ORDER_STATUS).optional(), open: z.enum(['true']).optional() }).parse(req.query);
  const where: any = { ...sup(req), ...(q.status && { status: q.status }), ...(q.open && { status: { in: ['NEW', 'PREPARING', 'ON_THE_WAY'] } }) };
  const [rows, total] = await tx(req, (t) => Promise.all([t.diningOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }), t.diningOrder.count({ where })]));
  return { data: rows, meta: { page: q.page, limit: q.limit, total } };
}));
opsRouter.patch('/ops/dining/orders/:id', h(async (req) => {
  const id = idOf(req), b = z.object({ status: z.enum(ORDER_STATUS) }).strict().parse(req.body);
  return { data: await tx(req, async (t) => { const r = await t.diningOrder.updateMany({ where: { id, ...sup(req) }, data: { status: b.status, updatedAt: new Date() } }); if (!r.count) throw notFound(); return t.diningOrder.findUnique({ where: { id } }); }), message: 'Order updated' };
}));

/* ------------------------------------------------------------------ knowledge base + shift notes */
const kbIn = z.object({ title: z.string().trim().min(1).max(160), category: z.string().trim().min(1).max(40).default('General'), body: z.string().trim().min(1).max(20000), active: z.boolean().default(true) }).strict();
opsRouter.get('/ops/kb', h(async (req) => ({ data: await tx(req, (t) => t.kbDoc.findMany({ where: sup(req), orderBy: [{ category: 'asc' }, { title: 'asc' }] })) })));
opsRouter.post('/ops/kb', notStaff, h(async (req) => { const sid = needSupplier(req.scope!), b = kbIn.parse(req.body); return { data: await tx(req, async (t) => { const r = await t.kbDoc.create({ data: { supplierId: sid, ...b } }); await aud(t, req, 'CREATE', 'KbDoc', r.id, { title: b.title }); return r; }), status: 201, message: 'Document added' }; }));
opsRouter.patch('/ops/kb/:id', notStaff, h(async (req) => { const id = idOf(req), b = kbIn.partial().strict().parse(req.body); return { data: await tx(req, async (t) => { const r = await t.kbDoc.updateMany({ where: { id, ...sup(req) }, data: { ...b, updatedAt: new Date() } }); if (!r.count) throw notFound(); return t.kbDoc.findUnique({ where: { id } }); }), message: 'Saved' }; }));
opsRouter.delete('/ops/kb/:id', notStaff, h(async (req) => { const id = idOf(req); await tx(req, async (t) => { const r = await t.kbDoc.deleteMany({ where: { id, ...sup(req) } }); if (!r.count) throw notFound(); }); return { data: { id }, message: 'Removed' }; }));
opsRouter.get('/ops/notes', h(async (req) => ({ data: await tx(req, (t) => t.shiftNote.findMany({ where: sup(req), orderBy: { createdAt: 'desc' }, take: 50 })) })));
opsRouter.post('/ops/notes', h(async (req) => { const sid = needSupplier(req.scope!), b = z.object({ body: z.string().trim().min(1).max(2000) }).strict().parse(req.body); return { data: await tx(req, (t) => t.shiftNote.create({ data: { supplierId: sid, author: who(req), body: b.body } })), status: 201, message: 'Note saved' }; }));
