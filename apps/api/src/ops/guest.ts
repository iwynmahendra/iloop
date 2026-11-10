import { Router, type NextFunction, type Request, type Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { withDb, withSystem } from '../db.js';
import { badRequest, conflict, ok, unauthorized } from '../http.js';
import { emit } from '../integrations/events.js';
import { logger } from '../logger.js';
import { searchKb } from './kb.js';
import { guestStep, h, logEntry, newRef, SERVICES, SLA_MIN, type T } from './shared.js';

export interface GuestCtx { bookingId: string; supplierId: string; hotelId: string | null; name: string }
export const guestRouter = Router();
const key = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
const ISS = 'booking-admin', AUD = 'booking-admin-guest';
const gtx = <R>(req: Request, fn: (t: T) => Promise<R>) => withDb({ role: 'SUPPLIER_STAFF', supplierId: req.guest!.supplierId }, fn);

async function guestAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const a = req.get('authorization');
    if (!a?.startsWith('Bearer ')) throw new Error('no token');
    const { payload } = await jwtVerify(a.slice(7), key, { issuer: ISS, audience: AUD, algorithms: ['HS256'] });
    req.guest = { bookingId: String(payload.sub), supplierId: String(payload.sid), hotelId: (payload.hid as string) || null, name: String(payload.name ?? '') };
    next();
  } catch { next(unauthorized('Please sign in again')); }
}

/** Always read the live stay: the room is assigned at check-in and the guest may have checked out since signing in. */
async function stay(t: T, g: GuestCtx) {
  const b = await t.booking.findFirst({ where: { id: g.bookingId, deletedAt: null }, include: { hotelBookingItems: { include: { hotel: { select: { id: true, name: true, address: true, contactPhone: true, contactEmail: true, checkInTime: true } } }, take: 1 } } });
  const i = b?.hotelBookingItems[0];
  if (!b || !i || b.status !== 'CONFIRMED' || i.checkOut < new Date(new Date().toISOString().slice(0, 10))) throw unauthorized('Your stay is no longer active');
  return { b, i, room: i.roomNumber ?? b.roomNumber ?? null };
}

/* ------------------------------------------------------------------ sign in (public) */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, skip: () => config.NODE_ENV === 'test' });
guestRouter.post('/guest/auth', authLimiter, async (req, res, next) => {
  try {
    const b = z.object({ bookingNo: z.string().trim().min(4).max(30), lastName: z.string().trim().min(2).max(80) }).strict().parse(req.body);
    const rows = await withSystem((t) => t.$queryRaw<{ booking_id: string; supplier_id: string; guest_name: string; room_number: string | null; hotel_id: string | null }[]>`SELECT * FROM guest_find_stay(${b.bookingNo}, ${b.lastName})`);
    const r = rows[0];
    if (!r) throw unauthorized('We could not find a current stay with those details');
    const token = await new SignJWT({ sid: r.supplier_id, hid: r.hotel_id ?? '', name: r.guest_name }).setProtectedHeader({ alg: 'HS256' }).setSubject(r.booking_id).setIssuer(ISS).setAudience(AUD).setIssuedAt().setExpirationTime(`${config.GUEST_TOKEN_HOURS}h`).sign(key);
    ok(res, { token, name: r.guest_name, room: r.room_number }, 'Welcome');
  } catch (e) { next(e); }
});
guestRouter.use('/guest', guestAuth);

/* ------------------------------------------------------------------ stay, services, menu */
guestRouter.get('/guest/me', h(async (req) => ({ data: await gtx(req, async (t) => {
  const { b, i, room } = await stay(t, req.guest!);
  const rm = room ? await t.opsRoom.findFirst({ where: { supplierId: b.supplierId, roomNumber: room } }) : null;
  return { bookingNo: b.bookingNo, guestName: b.guestName, room, dnd: rm?.dnd ?? false, checkIn: i.checkIn, checkOut: i.checkOut, nights: i.nights, hotel: i.hotel, total: b.totalAmount, paid: b.paidAmount, balance: Number(b.totalAmount) - Number(b.paidAmount), currencyCode: b.currencyCode, canRequest: !!room };
}) })));
guestRouter.get('/guest/services', h(async () => ({ data: SERVICES.map(({ key, icon, name, fields, flow }) => ({ key, icon, name, fields, flow })) })));
guestRouter.get('/guest/menu', h(async (req) => ({ data: await gtx(req, (t) => t.diningItem.findMany({ where: { supplierId: req.guest!.supplierId, available: true }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] })) })));
guestRouter.patch('/guest/dnd', h(async (req) => {
  const b = z.object({ dnd: z.boolean() }).strict().parse(req.body);
  return { data: await gtx(req, async (t) => { const { b: bk, room } = await stay(t, req.guest!); if (!room) throw conflict('Do not disturb is available once you are checked in'); await t.opsRoom.upsert({ where: { supplierId_roomNumber: { supplierId: bk.supplierId, roomNumber: room } }, create: { supplierId: bk.supplierId, roomNumber: room, dnd: b.dnd }, update: { dnd: b.dnd, updatedAt: new Date() } }); return { dnd: b.dnd }; }) };
}));

/* ------------------------------------------------------------------ requests */
guestRouter.post('/guest/requests', h(async (req) => {
  const b = z.object({ service: z.string().max(40), answers: z.record(z.string().max(60), z.string().max(300)).default({}), note: z.string().trim().max(500).optional(), urgent: z.boolean().default(false) }).strict().parse(req.body);
  const svc = SERVICES.find((s) => s.key === b.service);
  if (!svc) throw badRequest('Unknown service');
  const row = await gtx(req, async (t) => {
    const { b: bk, room } = await stay(t, req.guest!);
    if (!room) throw conflict('Please check in at the front desk first. Requests need a room number.');
    const open = await t.opsTask.count({ where: { supplierId: bk.supplierId, bookingId: bk.id, kind: 'REQUEST', status: { not: 'DONE' } } });
    if (open >= 15) throw conflict('You have many open requests. Please wait for some to finish or call the front desk.');
    const pr = b.urgent ? 'URGENT' : 'NORMAL', sla = SLA_MIN[pr];
    const details = { service: svc.key, answers: b.answers, ...(b.note ? { note: b.note } : {}) };
    const r = await t.opsTask.create({ data: { supplierId: bk.supplierId, kind: 'REQUEST', ref: newRef('RQ'), title: `${svc.name}, room ${room} (${bk.guestName})`, department: svc.dept, priority: pr, roomNumber: room, guestName: bk.guestName, requestType: svc.name, details, notes: b.note ?? null, bookingId: bk.id, source: 'GUEST_APP', dueAt: new Date(Date.now() + sla * 60000), createdBy: 'guest', log: [logEntry('guest', 'Requested from the guest app')] } });
    await emit(t, bk.supplierId, 'request.created', { ref: r.ref, service: svc.name, room, bookingNo: bk.bookingNo, details }, `request:${r.id}`);
    return r;
  });
  return { data: { ref: row.ref, service: svc.name, step: 0, flow: svc.flow }, message: 'Request sent', status: 201 };
}));
guestRouter.get('/guest/requests', h(async (req) => ({ data: await gtx(req, async (t) => {
  const rows = await t.opsTask.findMany({ where: { supplierId: req.guest!.supplierId, bookingId: req.guest!.bookingId, kind: 'REQUEST' }, orderBy: { createdAt: 'desc' }, take: 50 });
  return rows.map((r) => { const svc = SERVICES.find((s) => s.name === r.requestType); const flow = svc?.flow ?? ['Received', 'Assigned', 'In progress', 'Done']; return { ref: r.ref, service: r.requestType, createdAt: r.createdAt, status: r.status, flow, step: guestStep(flow, r.status, !!r.assigneeId), note: r.notes }; });
}) })));

/* ------------------------------------------------------------------ room dining */
guestRouter.post('/guest/orders', h(async (req) => {
  const b = z.object({ items: z.array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(20) }).strict()).min(1).max(30), note: z.string().trim().max(500).optional(), when: z.string().max(30).default('ASAP') }).strict().parse(req.body);
  const row = await gtx(req, async (t) => {
    const { b: bk, room } = await stay(t, req.guest!);
    if (!room) throw conflict('Please check in at the front desk first. Orders need a room number.');
    const menu = await t.diningItem.findMany({ where: { supplierId: bk.supplierId, id: { in: b.items.map((i) => i.id) }, available: true } });
    const lines = b.items.map((i) => { const m = menu.find((x) => x.id === i.id); if (!m) throw badRequest('An item in your order is no longer available'); return { id: m.id, name: m.name, qty: i.qty, price: Number(m.price) }; });
    const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
    return t.diningOrder.create({ data: { supplierId: bk.supplierId, ref: newRef('FD'), bookingId: bk.id, roomNumber: room, guestName: bk.guestName, items: lines, total, currencyCode: bk.currencyCode, note: b.note ?? null, deliverWhen: b.when } });
  });
  return { data: { ref: row.ref, total: row.total, status: row.status }, message: 'Order sent to the kitchen', status: 201 };
}));
guestRouter.get('/guest/orders', h(async (req) => ({ data: await gtx(req, (t) => t.diningOrder.findMany({ where: { supplierId: req.guest!.supplierId, bookingId: req.guest!.bookingId }, orderBy: { createdAt: 'desc' }, take: 30, select: { ref: true, items: true, total: true, currencyCode: true, status: true, createdAt: true, deliverWhen: true } })) })));

/* ------------------------------------------------------------------ the guest's other bookings */
guestRouter.get('/guest/bookings', h(async (req) => ({ data: await gtx(req, async (t) => {
  const me = await t.booking.findFirst({ where: { id: req.guest!.bookingId } });
  if (!me) return [];
  const rows = await t.booking.findMany({ where: { supplierId: me.supplierId, deletedAt: null, OR: [{ id: me.id }, ...(me.customerId ? [{ customerId: me.customerId }] : []), ...(me.guestEmail ? [{ guestEmail: me.guestEmail }] : [])] }, orderBy: { startAt: 'desc' }, take: 30, select: { bookingNo: true, product: true, status: true, startAt: true, totalAmount: true, paidAmount: true, currencyCode: true } });
  return rows;
}) })));

/* ------------------------------------------------------------------ knowledge base and assistant */
guestRouter.get('/guest/kb', h(async (req) => {
  const q = z.object({ q: z.string().trim().min(2).max(200) }).parse(req.query);
  const docs = await gtx(req, (t) => t.kbDoc.findMany({ where: { supplierId: req.guest!.supplierId, active: true } }));
  return { data: searchKb(docs, q.q).map((x) => ({ id: x.doc.id, title: x.doc.title, category: x.doc.category, snippet: x.snippet })) };
}));

export async function askModel(system: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': config.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: config.ASSISTANT_MODEL, max_tokens: 700, system, messages }), signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`model ${r.status}`);
  const j: any = await r.json();
  return (j.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
}
guestRouter.post('/guest/assistant', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, skip: () => config.NODE_ENV === 'test', keyGenerator: (r) => r.guest?.bookingId ?? 'x', validate: false }), h(async (req) => {
  const b = z.object({ message: z.string().trim().min(1).max(1000), history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1500) })).max(8).default([]) }).strict().parse(req.body);
  const out = await gtx(req, async (t) => {
    const { b: bk, i, room } = await stay(t, req.guest!);
    const docs = await t.kbDoc.findMany({ where: { supplierId: bk.supplierId, active: true } });
    return { docs, ctx: `Guest: ${bk.guestName}. Room: ${room ?? 'not assigned yet'}. Stay: ${i.checkIn.toISOString().slice(0, 10)} to ${i.checkOut.toISOString().slice(0, 10)}. Hotel: ${i.hotel.name}${i.hotel.contactPhone ? `, front desk ${i.hotel.contactPhone}` : ''}. Check-in time ${i.hotel.checkInTime}.` };
  });
  const hits = searchKb(out.docs, b.message, 4);
  const sources = hits.map((x) => x.doc.title);
  if (config.ANTHROPIC_API_KEY) {
    try {
      // keyword search cannot match a question written in another language, so the model gets every document (best hits first, within a size budget) and does the reading
      const ordered = [...hits.map((x) => x.doc), ...out.docs.filter((d) => !hits.some((x) => x.doc.id === d.id))];
      let budget = 24000; const parts: string[] = [];
      for (const d of ordered) { const t = `## ${d.title}\n${d.body.slice(0, 3000)}`; if (t.length > budget) break; budget -= t.length; parts.push(t); }
      const context = parts.join('\n\n');
      const system = `You are the guest assistant of a hotel. Answer only from the stay details and hotel documents below. If the answer is not there, say you are not sure and suggest asking the front desk or sending a request in the app. Reply in the same language as the guest's message. Keep it short and friendly. Never invent prices, hours or policies.\n\nSTAY\n${out.ctx}\n\nHOTEL DOCUMENTS\n${context || '(none)'}`;
      const answer = await askModel(system, [...b.history, { role: 'user' as const, content: b.message }]);
      if (answer) return { data: { answer, sources, mode: 'ai' } };
    } catch (e) { logger.warn({ err: (e as Error).message }, 'assistant model call failed, falling back to search'); }
  }
  const answer = hits.length ? hits.map((x) => `${x.doc.title}: ${x.snippet}`).join('\n\n') : "I could not find that in the hotel's information. Please ask the front desk or send a request from the Services tab.";
  return { data: { answer, sources, mode: 'search' } };
}));
