import { Router, type Request, type RequestHandler } from 'express';
import { stringify } from 'csv-stringify/sync';
import { z } from 'zod';
import { config } from '../config.js';
import { withDb } from '../db.js';
import { badRequest, conflict, forbidden, notFound, ok } from '../http.js';
import { notStaff, superOnly } from '../middleware/auth.js';
import { writeAudit } from '../crud/audit.js';
import { createBooking } from './create.js';
import { deliverEmails } from './notify.js';
import * as L from './lifecycle.js';
import * as R from './read.js';
import { commissionReport, paymentsReport, reportQ, summaryReport } from './reports.js';
import * as S from './schemas.js';
import { actorOf, addEvent, audit, dateStr, dayRange, idOf, needSupplier, num, supFilter, todayStr, uuidP, addDays, toDate, ymd } from './util.js';

export const bookingRouter = Router();
type H = (req: Request) => Promise<{ data: unknown; message?: string; status?: number; meta?: { page: number; limit: number; total: number } }>;
/** One transaction per request with the row level security context; every handler returns its data. */
const h = (fn: H): RequestHandler => async (req, res, next) => {
  try { const r = await fn(req); ok(res, r.data, r.message ?? 'OK', r.meta, r.status ?? 200); } catch (e) { next(e); }
};
const tx = <T>(req: Request, fn: (t: Parameters<Parameters<typeof withDb>[1]>[0]) => Promise<T>) => withDb(req.scope!.db, fn);

/* ---------------------------------------------------------------- reads */
bookingRouter.get('/booking-overview', h(async (req) => {
  const product = z.enum(['HOTEL', 'TRIP', 'TRANSPORT', 'CLUB']).optional().parse(req.query.product);
  return { data: await tx(req, (t) => R.overview(t, req.scope!, product)) };
}));

bookingRouter.get('/bookings', h(async (req) => {
  const q = S.listBookingsQ.parse(req.query);
  const { rows, total } = await tx(req, (t) => R.listBookings(t, req.scope!, q));
  return { data: rows, meta: { page: q.page, limit: q.limit, total } };
}));

bookingRouter.get('/bookings/export', async (req, res, next) => {
  try {
    const q = S.listBookingsQ.parse(req.query);
    const rows = await tx(req, async (t) => {
      const data = await t.booking.findMany({ where: R.bookingWhere(req.scope!, q), orderBy: [{ [q.sort]: q.dir }, { id: 'asc' }], take: 5000,
        include: { ...{ hotelBookingItems: { take: 1, include: { hotel: { select: { name: true } }, roomType: { select: { name: true } } } }, tripBookingItems: { take: 1, include: { trip: { select: { title: true } }, variant: { select: { name: true } }, schedule: { select: { date: true, startTime: true } } } },
          transportBookingItems: { take: 1, orderBy: { pickupAt: 'asc' as const }, include: { vehicleType: { select: { name: true } } } }, clubBookingItems: { take: 1, include: { club: { select: { name: true } }, event: { select: { title: true } }, ticketType: { select: { name: true } }, tablePackage: { select: { name: true } } } } } } });
      { const a = actorOf(req); await writeAudit(t, { action: 'EXPORT', entityType: 'Booking', supplierId: req.scope!.supplierId, after: { rows: data.length }, userId: a.userId, userEmail: a.email, ip: a.ip, userAgent: a.userAgent, requestId: a.requestId }); }
      return data;
    });
    const safe = (v: unknown) => { const s = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s; };
    const head = ['Booking no', 'Product', 'Status', 'Payment', 'Source', 'Guest', 'Email', 'Phone', 'What', 'Details', 'Start', 'Currency', 'Total', 'Paid', 'Balance', 'Commission', 'Created'];
    const body = rows.map((b) => { const s = R.summarize(b); return [b.bookingNo, b.product, b.status, b.paymentStatus, b.source, b.guestName, b.guestEmail, b.guestPhone, s.title, s.detail, b.startAt.toISOString(), b.currencyCode, b.totalAmount, b.paidAmount, (num(b.totalAmount) - num(b.paidAmount)).toFixed(2), b.commissionAmount, b.createdAt.toISOString()].map(safe); });
    res.type('text/csv').attachment('bookings.csv').send(stringify([head, ...body]));
  } catch (e) { next(e); }
});

bookingRouter.get('/bookings/calendar', h(async (req) => {
  const q = z.object({ from: dateStr, to: dateStr, product: S.listBookingsQ.shape.product }).parse(req.query);
  const s = req.scope!;
  const rows = await tx(req, (t) => t.booking.findMany({ where: { ...supFilter(s), deletedAt: null, status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] }, ...(q.product ? { product: q.product } : {}), startAt: { lt: dayRange(q.to)[1] }, endAt: { gte: dayRange(q.from)[0] } },
    orderBy: { startAt: 'asc' }, take: 1000, include: { hotelBookingItems: { take: 1, include: { hotel: { select: { name: true } }, roomType: { select: { name: true } } } }, tripBookingItems: { take: 1, include: { trip: { select: { title: true } }, variant: { select: { name: true } }, schedule: { select: { date: true, startTime: true } } } },
      transportBookingItems: { take: 1, orderBy: { pickupAt: 'asc' }, include: { vehicleType: { select: { name: true } } } }, clubBookingItems: { take: 1, include: { club: { select: { name: true } }, event: { select: { title: true } }, ticketType: { select: { name: true } }, tablePackage: { select: { name: true } } } } } }));
  return { data: rows.map((b) => ({ id: b.id, bookingNo: b.bookingNo, product: b.product, status: b.status, paymentStatus: b.paymentStatus, guestName: b.guestName, startAt: b.startAt, endAt: b.endAt, ...R.summarize(b) })) };
}));

bookingRouter.get('/bookings/:id', h(async (req) => ({ data: await tx(req, (t) => R.getBookingDetail(t, req.scope!, idOf(req))) })));
bookingRouter.get('/bookings/:id/cancel-preview', h(async (req) => ({ data: await tx(req, async (t) => L.cancelPreview(t, await L.getBookingFor(t, req.scope!, idOf(req)))) })));

/* ---------------------------------------------------------------- writes */
bookingRouter.post('/bookings', h(async (req) => {
  const s = req.scope!, input = S.createBookingIn.parse(req.body), sid = needSupplier(s);
  const b = await tx(req, (t) => createBooking(t, s, actorOf(req), sid, input));
  if (config.NODE_ENV !== 'test') void deliverEmails().catch(() => {});
  return { data: b, message: 'Booking created', status: 201 };
}));

/** The emails sent for one booking: who, when, and whether they went out. */
bookingRouter.get('/bookings/:id/emails', h(async (req) => {
  const s = req.scope!, id = idOf(req);
  return { data: await tx(req, async (t) => { const b = await L.getBookingFor(t, s, id); return t.emailOutbox.findMany({ where: { bookingId: b.id, supplierId: b.supplierId }, orderBy: { createdAt: 'asc' }, select: { id: true, template: true, recipientKind: true, toEmail: true, subject: true, status: true, attempts: true, lastError: true, createdAt: true, sentAt: true } }); }) };
}));

/** Sends a failed or skipped email again, for example after the guest's address was fixed. */
bookingRouter.post('/bookings/:id/emails/:emailId/resend', h(async (req) => {
  const s = req.scope!, id = idOf(req), emailId = uuidP.parse(req.params.emailId), to = z.object({ toEmail: z.string().email().max(254).optional() }).strict().parse(req.body ?? {});
  const row = await tx(req, async (t) => {
    const b = await L.getBookingFor(t, s, id);
    const e = await t.emailOutbox.findFirst({ where: { id: emailId, bookingId: b.id, supplierId: b.supplierId } });
    if (!e) throw notFound('Email not found');
    if (e.status === 'SENT') throw conflict('This email was already sent');
    const addr = to.toEmail ?? e.toEmail;
    if (!addr) throw badRequest('There is no address to send to. Give toEmail.');
    return t.emailOutbox.update({ where: { id: e.id }, data: { toEmail: addr, status: 'QUEUED', attempts: 0, lastError: null } });
  });
  if (config.NODE_ENV !== 'test') void deliverEmails().catch(() => {});
  return { data: { id: row.id, status: row.status }, message: 'Email queued' };
}));

bookingRouter.patch('/bookings/:id', h(async (req) => {
  const s = req.scope!, id = idOf(req), body = S.patchBookingIn.parse(req.body), actor = actorOf(req);
  return { data: await tx(req, async (t) => {
    const b = await L.getBookingFor(t, s, id);
    if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') throw conflict(`A ${b.status.toLowerCase()} booking can no longer be edited`);
    const { guests, ...fields } = body;
    if (Object.keys(fields).length) { const n = await t.booking.updateMany({ where: { id }, data: { ...fields, updatedBy: actor.userId } }); if (n.count !== 1) throw forbidden(); }
    if (guests) {
      await t.bookingGuest.deleteMany({ where: { bookingId: id } });
      if (guests.length) await t.bookingGuest.createMany({ data: guests.map((g, i) => ({ supplierId: b.supplierId, bookingId: id, fullName: g.fullName, guestType: g.guestType, age: g.age ?? null, isLead: g.isLead || (i === 0 && !guests.some((x) => x.isLead)), documentNo: g.documentNo ?? null, notes: g.notes ?? null, createdBy: actor.userId })) });
    }
    await addEvent(t, actor, b, 'EDITED', { message: `Edited: ${[...Object.keys(fields), ...(guests ? ['guests'] : [])].join(', ') || 'nothing'}` });
    await audit(t, actor, 'UPDATE', 'Booking', id, b.supplierId, undefined, { ...fields, guests: guests?.length });
    return R.getBookingDetail(t, s, id);
  }), message: 'Booking updated' };
}));

bookingRouter.post('/bookings/:id/status', h(async (req) => {
  const body = S.statusIn.parse(req.body), s = req.scope!;
  await tx(req, (t) => L.changeStatus(t, s, actorOf(req), idOf(req), body.status, body.note));
  return { data: await tx(req, (t) => R.getBookingDetail(t, s, idOf(req))), message: `Booking ${body.status.toLowerCase().replace('_', '-')}` };
}));

bookingRouter.post('/bookings/:id/cancel', h(async (req) => {
  const body = S.cancelIn.parse(req.body), s = req.scope!, id = idOf(req);
  const r = await tx(req, async (t) => { const out = await L.cancelBooking(t, s, actorOf(req), id, body); return { refunded: out.refunded, preview: out.preview, booking: await R.getBookingDetail(t, s, id) }; });
  return { data: r, message: 'Booking cancelled' };
}));

bookingRouter.post('/bookings/:id/notes', h(async (req) => {
  const body = S.noteIn.parse(req.body), s = req.scope!, id = idOf(req), actor = actorOf(req);
  await tx(req, async (t) => { const b = await L.getBookingFor(t, s, id); await addEvent(t, actor, b, 'NOTE', { message: body.message }); });
  return { data: { ok: true }, message: 'Note added', status: 201 };
}));

bookingRouter.post('/bookings/:id/payments', h(async (req) => {
  const body = S.paymentIn.parse(req.body), s = req.scope!, id = idOf(req);
  return { data: await tx(req, async (t) => { await L.recordPayment(t, s, actorOf(req), id, body); return R.getBookingDetail(t, s, id); }), message: 'Payment recorded', status: 201 };
}));
bookingRouter.post('/bookings/:id/refunds', notStaff, h(async (req) => {
  const body = S.refundIn.parse(req.body), s = req.scope!, id = idOf(req);
  return { data: await tx(req, async (t) => { await L.issueRefund(t, s, actorOf(req), id, body); return R.getBookingDetail(t, s, id); }), message: 'Refund issued', status: 201 };
}));
bookingRouter.post('/payments/:id/void', notStaff, h(async (req) => {
  const s = req.scope!;
  await tx(req, (t) => L.voidPayment(t, s, actorOf(req), idOf(req)));
  return { data: { ok: true }, message: 'Payment voided' };
}));

/* operations */
const ops = (path: string, schema: z.ZodType<any>, fn: (t: any, s: any, a: any, id: string, b: any) => Promise<unknown>, msg: string) =>
  bookingRouter.post(`/bookings/:id/${path}`, h(async (req) => {
    const body = schema.parse(req.body ?? {}), s = req.scope!, id = idOf(req);
    return { data: await tx(req, async (t) => { await fn(t, s, actorOf(req), id, body); return R.getBookingDetail(t, s, id); }), message: msg };
  }));
ops('check-in', z.union([S.hotelCheckIn, S.tripCheckIn, S.clubCheckIn]), async (t, s, a, id, b) => {
  const bk = await L.getBookingFor(t, s, id);
  if (bk.product === 'HOTEL') return L.hotelCheckIn(t, s, a, id, S.hotelCheckIn.parse(b));
  if (bk.product === 'TRIP') return L.tripCheckIn(t, s, a, id, S.tripCheckIn.parse(b));
  if (bk.product === 'CLUB') return L.clubCheckIn(t, s, a, id, S.clubCheckIn.parse(b));
  throw badRequest('Use the dispatch endpoint for transport bookings');
}, 'Checked in');
ops('check-out', S.itemRef, (t, s, a, id, b) => L.hotelCheckOut(t, s, a, id, b), 'Checked out');
ops('assign', S.assignIn, (t, s, a, id, b) => L.assignTransport(t, s, a, id, b), 'Assignment saved');
ops('dispatch', S.dispatchIn, (t, s, a, id, b) => L.dispatchTransport(t, s, a, id, b), 'Dispatch updated');

bookingRouter.delete('/bookings/:id', notStaff, h(async (req) => {
  const s = req.scope!, id = idOf(req), actor = actorOf(req);
  await tx(req, async (t) => {
    const b = await L.getBookingFor(t, s, id);
    if (b.status === 'PENDING' || b.status === 'CONFIRMED') throw conflict('Cancel the booking before deleting it');
    const n = await t.booking.updateMany({ where: { id }, data: { deletedAt: new Date(), updatedBy: actor.userId } });
    if (n.count !== 1) throw forbidden();
    await audit(t, actor, 'DELETE', 'Booking', id, b.supplierId, { bookingNo: b.bookingNo });
  });
  return { data: { ok: true }, message: 'Booking deleted' };
}));
bookingRouter.post('/bookings/:id/restore', notStaff, h(async (req) => {
  const s = req.scope!, id = idOf(req), actor = actorOf(req);
  await tx(req, async (t) => {
    const b = await L.getBookingFor(t, s, id, { deleted: true });
    const n = await t.booking.updateMany({ where: { id }, data: { deletedAt: null, updatedBy: actor.userId } });
    if (n.count !== 1) throw forbidden();
    await audit(t, actor, 'RESTORE', 'Booking', id, b.supplierId, undefined, { bookingNo: b.bookingNo });
  });
  return { data: { ok: true }, message: 'Booking restored' };
}));
bookingRouter.post('/bookings/expire-holds', superOnly, h(async (req) => ({ data: { expired: await tx(req, (t) => L.expireHolds(t, actorOf(req), req.scope!.supplierId ?? undefined)) }, message: 'Done' })));

/* ---------------------------------------------------------------- payments list */
bookingRouter.get('/payments', h(async (req) => {
  const q = S.listBookingsQ.pick({ page: true, limit: true, from: true, to: true }).extend({ kind: z.enum(['PAYMENT', 'REFUND']).optional(), method: z.string().optional(), txStatus: z.enum(['SUCCEEDED', 'PENDING', 'FAILED', 'VOIDED']).optional(), product: S.listBookingsQ.shape.product }).parse(req.query);
  const s = req.scope!;
  const where = { ...supFilter(s), ...(q.kind ? { kind: q.kind } : {}), ...(q.method ? { method: q.method as any } : {}), ...(q.txStatus ? { txStatus: q.txStatus } : {}), ...(q.product ? { booking: { product: q.product } } : {}),
    ...(q.from || q.to ? { paidAt: { ...(q.from ? { gte: dayRange(q.from)[0] } : {}), ...(q.to ? { lt: dayRange(q.to)[1] } : {}) } } : {}) };
  const [rows, total] = await tx(req, (t) => Promise.all([t.payment.findMany({ where, orderBy: { paidAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { booking: { select: { bookingNo: true, product: true, guestName: true, supplierId: true } } } }), t.payment.count({ where })]));
  return { data: rows, meta: { page: q.page, limit: q.limit, total } };
}));

/* ---------------------------------------------------------------- customers */
bookingRouter.get('/customers', h(async (req) => {
  const q = S.listBookingsQ.pick({ page: true, limit: true }).extend({ q: z.string().trim().max(100).optional(), deleted: z.enum(['exclude', 'only']).default('exclude') }).parse(req.query);
  const c = q.q ? { contains: q.q, mode: 'insensitive' as const } : undefined;
  const where = { ...supFilter(req.scope!), deletedAt: q.deleted === 'only' ? { not: null } : null, ...(c ? { OR: [{ fullName: c }, { email: c }, { phone: c }] } : {}) };
  const [rows, total] = await tx(req, (t) => Promise.all([t.customer.findMany({ where, orderBy: { fullName: 'asc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { _count: { select: { bookings: true } } } }), t.customer.count({ where })]));
  return { data: rows.map(({ _count, ...r }) => ({ ...r, bookingCount: _count.bookings })), meta: { page: q.page, limit: q.limit, total } };
}));
bookingRouter.get('/customers/:id', h(async (req) => {
  const id = idOf(req);
  return { data: await tx(req, async (t) => {
    const c = await t.customer.findFirst({ where: { id, ...supFilter(req.scope!) } });
    if (!c) throw notFound('Customer not found');
    const [bookings, agg] = await Promise.all([t.booking.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { startAt: 'desc' }, take: 50, select: { id: true, bookingNo: true, product: true, status: true, paymentStatus: true, startAt: true, totalAmount: true, currencyCode: true } }),
      t.booking.aggregate({ where: { customerId: id, deletedAt: null, status: { in: ['CONFIRMED', 'COMPLETED'] } }, _sum: { totalAmount: true }, _count: true })]);
    return { ...c, bookings, lifetime: { bookings: agg._count, spend: num(agg._sum.totalAmount) } };
  }) };
}));
bookingRouter.post('/customers', h(async (req) => {
  const s = req.scope!, body = S.customerIn.parse(req.body), sid = needSupplier(s), actor = actorOf(req);
  return { data: await tx(req, async (t) => { const c = await t.customer.create({ data: { ...body, supplierId: sid, createdBy: actor.userId } }); await audit(t, actor, 'CREATE', 'Customer', c.id, sid, undefined, body); return c; }), message: 'Customer created', status: 201 };
}));
bookingRouter.patch('/customers/:id', h(async (req) => {
  const s = req.scope!, id = idOf(req), body = S.customerPatch.parse(req.body), actor = actorOf(req);
  return { data: await tx(req, async (t) => {
    const c = await t.customer.findFirst({ where: { id, deletedAt: null, ...supFilter(s) } });
    if (!c) throw notFound('Customer not found');
    const n = await t.customer.updateMany({ where: { id }, data: { ...body, updatedBy: actor.userId } });
    if (n.count !== 1) throw forbidden();
    await audit(t, actor, 'UPDATE', 'Customer', id, c.supplierId, undefined, body);
    return t.customer.findUniqueOrThrow({ where: { id } });
  }), message: 'Customer updated' };
}));
bookingRouter.delete('/customers/:id', notStaff, h(async (req) => {
  const s = req.scope!, id = idOf(req), actor = actorOf(req);
  await tx(req, async (t) => {
    const c = await t.customer.findFirst({ where: { id, deletedAt: null, ...supFilter(s) } });
    if (!c) throw notFound('Customer not found');
    const n = await t.customer.updateMany({ where: { id }, data: { deletedAt: new Date(), updatedBy: actor.userId } });
    if (n.count !== 1) throw forbidden();
    await audit(t, actor, 'DELETE', 'Customer', id, c.supplierId);
  });
  return { data: { ok: true }, message: 'Customer deleted' };
}));

/* ---------------------------------------------------------------- availability and boards */
const A = Router();
A.get('/hotel', h(async (req) => {
  const q = z.object({ hotelId: uuidP, checkIn: dateStr, checkOut: dateStr, rooms: z.coerce.number().int().min(1).max(20).default(1) }).parse(req.query);
  if (q.checkOut <= q.checkIn) throw badRequest('Check-out must be after check-in');
  return { data: await tx(req, (t) => R.hotelAvailability(t, req.scope!, q.hotelId, q.checkIn, q.checkOut, q.rooms)) };
}));
A.get('/trips', h(async (req) => {
  const q = z.object({ tripId: uuidP, from: dateStr.default(todayStr()), to: dateStr.optional(), pax: z.coerce.number().int().min(1).max(200).default(1) }).parse(req.query);
  return { data: await tx(req, (t) => R.tripAvailability(t, req.scope!, q.tripId, q.from, q.to ?? ymd(addDays(toDate(q.from), 60)), q.pax)) };
}));
A.get('/transport', h(async (req) => {
  const q = z.object({ vehicleTypeId: uuidP, pickupAt: z.string().datetime({ offset: true }) }).parse(req.query);
  return { data: await tx(req, (t) => R.transportAvailability(t, req.scope!, q.vehicleTypeId, new Date(q.pickupAt), config.TRANSPORT_CLASH_MINUTES)) };
}));
A.get('/club', h(async (req) => {
  const q = z.object({ clubId: uuidP, date: dateStr }).parse(req.query);
  return { data: await tx(req, (t) => R.clubAvailability(t, req.scope!, q.clubId, q.date)) };
}));
bookingRouter.use('/availability', A);

const B = Router();
B.get('/hotel', h(async (req) => { const q = z.object({ date: dateStr.default(todayStr()), hotelId: uuidP.optional() }).parse(req.query); return { data: await tx(req, (t) => R.hotelBoard(t, req.scope!, q.date, q.hotelId)) }; }));
B.get('/trips', h(async (req) => { const q = z.object({ from: dateStr.default(todayStr()), to: dateStr.optional(), tripId: uuidP.optional() }).parse(req.query); return { data: await tx(req, (t) => R.tripsBoard(t, req.scope!, q.from, q.to ?? q.from, q.tripId)) }; }));
B.get('/transport', h(async (req) => { const q = z.object({ date: dateStr.default(todayStr()), days: z.coerce.number().int().min(1).max(14).default(2) }).parse(req.query); return { data: await tx(req, (t) => R.transportBoard(t, req.scope!, q.date, q.days)) }; }));
B.get('/club', h(async (req) => { const q = z.object({ date: dateStr.default(todayStr()), clubId: uuidP.optional() }).parse(req.query); return { data: await tx(req, (t) => R.clubBoard(t, req.scope!, q.date, q.clubId)) }; }));
bookingRouter.use('/boards', B);

/* ---------------------------------------------------------------- reports (admins and operator only) */
const P = Router();
P.use(notStaff);
P.get('/summary', h(async (req) => ({ data: await tx(req, (t) => summaryReport(t, req.scope!, reportQ.parse(req.query))) })));
P.get('/commission', h(async (req) => ({ data: await tx(req, (t) => commissionReport(t, req.scope!, reportQ.parse(req.query))) })));
P.get('/payments', h(async (req) => ({ data: await tx(req, (t) => paymentsReport(t, req.scope!, reportQ.parse(req.query))) })));
bookingRouter.use('/reports', P);
