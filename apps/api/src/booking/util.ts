import type { Request } from 'express';
import { z } from 'zod';
import { Prisma, type BookingEventType, type BookingProduct, type BookingStatus } from '@prisma/client';
import { config } from '../config.js';
import type { Tx } from '../db.js';
import { badRequest, notFound } from '../http.js';
import { writeAudit, type AuditAction } from '../crud/audit.js';
import type { Scope } from '../types.js';

export const PREFIX: Record<BookingProduct, string> = { HOTEL: 'HTL', TRIP: 'TRP', TRANSPORT: 'TRN', CLUB: 'CLB' };
/** Statuses that still hold stock or a seat. */
export const LIVE_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'];
export const OPEN_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED'];

export const uuidP = z.string().uuid();
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((v) => !Number.isNaN(Date.parse(v)), 'Not a valid date');
export const idOf = (req: Request, name = 'id') => { const p = uuidP.safeParse(req.params[name]); if (!p.success) throw notFound(); return p.data; };

/** Supplier filter for queries. Non-super users always have it (from the JWT); super admin only after choosing one. */
export const supFilter = (s: Scope) => (s.supplierId ? { supplierId: s.supplierId } : {});
export const supSql = (s: Scope, col = 'supplier_id') => (s.supplierId ? Prisma.sql`AND ${Prisma.raw(col)} = ${s.supplierId}::uuid` : Prisma.empty);
export const needSupplier = (s: Scope) => { if (!s.supplierId) throw badRequest('Choose a supplier first (send X-Supplier-Id).'); return s.supplierId; };

export const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const round = (n: number, dec = 2) => { const f = 10 ** dec; return Math.round((n + Number.EPSILON) * f) / f; };
const TZ = config.BOOKING_TZ_OFFSET_MINUTES;
/** Local (Bali) "today" as YYYY-MM-DD. */
export const todayStr = () => ymd(new Date(Date.now() + TZ * 6e4));
/** UTC instant for a local date + HH:MM. */
export const localInstant = (date: string, hhmm = '00:00') => { const [h, m] = hhmm.split(':').map(Number); return new Date(toDate(date).getTime() + ((h ?? 0) * 60 + (m ?? 0) - TZ) * 6e4); };
export const dayRange = (date: string) => { const s = localInstant(date); return [s, new Date(s.getTime() + 864e5)] as const; };
export const num = (d: unknown) => (d == null ? 0 : Number(d));

export interface Actor { userId: string | null; email: string; ip?: string | null; userAgent?: string | null; requestId?: string | null }
export const SYSTEM_ACTOR: Actor = { userId: null, email: 'system' };
export const actorOf = (req: Request): Actor => ({ userId: req.auth!.userId, email: req.auth!.email, ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, requestId: req.requestId ?? null });

export const audit = (tx: Tx, a: Actor, action: AuditAction, entityType: string, entityId: string, supplierId: string, before?: unknown, after?: unknown) =>
  writeAudit(tx, { action, entityType, entityId, supplierId, before, after, userId: a.userId, userEmail: a.email, ip: a.ip, userAgent: a.userAgent, requestId: a.requestId });

export async function addEvent(tx: Tx, a: Actor, b: { id: string; supplierId: string }, type: BookingEventType, o: { from?: BookingStatus; to?: BookingStatus; message?: string; data?: object } = {}) {
  await tx.bookingEvent.create({ data: { supplierId: b.supplierId, bookingId: b.id, eventType: type, fromStatus: o.from, toStatus: o.to, message: o.message, data: o.data ?? {}, actorId: a.userId, actorName: a.email } });
}

/** BOOK-YYMM-0001, counted per supplier, product and month. One atomic upsert, so concurrent bookings never share a number. */
export async function nextBookingNo(tx: Tx, supplierId: string, product: BookingProduct) {
  const d = new Date();
  const period = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const rows = await tx.$queryRaw<{ last_value: number }[]>`INSERT INTO booking_sequences (supplier_id, product, period, last_value) VALUES (${supplierId}::uuid, ${product}::"BookingProduct", ${period}, 1)
    ON CONFLICT (supplier_id, product, period) DO UPDATE SET last_value = booking_sequences.last_value + 1, updated_at = CURRENT_TIMESTAMP RETURNING last_value`;
  return `${PREFIX[product]}-${period}-${String(rows[0]!.last_value).padStart(4, '0')}`;
}

/** Pagination + sort helper for query strings. */
export const listQ = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const dir = z.enum(['asc', 'desc']).default('desc');
