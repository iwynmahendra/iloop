import { Prisma, type BookingProduct } from '@prisma/client';
import { z } from 'zod';
import { config } from '../config.js';
import type { Tx } from '../db.js';
import type { Scope } from '../types.js';
import { dateStr } from './util.js';
import { dayRange, round, supSql, todayStr, addDays, toDate, ymd } from './util.js';

export const reportQ = z.object({
  from: dateStr.optional(), to: dateStr.optional(),
  product: z.enum(['HOTEL', 'TRIP', 'TRANSPORT', 'CLUB']).optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});
type RQ = z.infer<typeof reportQ>;

function range(q: RQ) {
  const to = q.to ?? todayStr(), from = q.from ?? ymd(addDays(toDate(to), -29));
  return { from, to, start: dayRange(from)[0], end: dayRange(to)[1] };
}
const prod = (p?: BookingProduct) => (p ? Prisma.sql`AND b.product = ${p}::"BookingProduct"` : Prisma.empty);
const OFF = config.BOOKING_TZ_OFFSET_MINUTES;
type Row = Record<string, any>;
const n = (v: unknown) => Number(v ?? 0);

/** Revenue = CONFIRMED + COMPLETED bookings created in the range (local time). Everything money-like is cast to float for JSON. */
export async function summaryReport(tx: Tx, s: Scope, q: RQ) {
  const { from, to, start, end } = range(q), sup = supSql(s, 'b.supplier_id'), p = prod(q.product);
  const unit = Prisma.raw(`'${q.groupBy}'`);
  const base = Prisma.sql`FROM bookings b WHERE b.deleted_at IS NULL AND b.created_at >= ${start} AND b.created_at < ${end} ${sup} ${p}`;
  const [series, byProduct, byStatus, bySource, totals] = await Promise.all([
    tx.$queryRaw<Row[]>`SELECT to_char(date_trunc(${unit}, b.created_at + make_interval(mins => ${OFF}::int)), 'YYYY-MM-DD') AS bucket,
        count(*)::int AS bookings, count(*) FILTER (WHERE b.status IN ('CONFIRMED','COMPLETED'))::int AS confirmed,
        COALESCE(sum(b.total_amount) FILTER (WHERE b.status IN ('CONFIRMED','COMPLETED')),0)::float8 AS revenue
      ${base} GROUP BY 1 ORDER BY 1`,
    tx.$queryRaw<Row[]>`SELECT b.product::text AS product, count(*)::int AS bookings, COALESCE(sum(b.total_amount) FILTER (WHERE b.status IN ('CONFIRMED','COMPLETED')),0)::float8 AS revenue ${base} GROUP BY 1 ORDER BY 3 DESC`,
    tx.$queryRaw<Row[]>`SELECT b.status::text AS status, count(*)::int AS bookings, COALESCE(sum(b.total_amount),0)::float8 AS amount ${base} GROUP BY 1 ORDER BY 2 DESC`,
    tx.$queryRaw<Row[]>`SELECT b.source::text AS source, count(*)::int AS bookings, COALESCE(sum(b.total_amount) FILTER (WHERE b.status IN ('CONFIRMED','COMPLETED')),0)::float8 AS revenue ${base} GROUP BY 1 ORDER BY 2 DESC`,
    tx.$queryRaw<Row[]>`SELECT count(*)::int AS bookings,
        count(*) FILTER (WHERE b.status IN ('CONFIRMED','COMPLETED'))::int AS confirmed,
        count(*) FILTER (WHERE b.status = 'CANCELLED')::int AS cancelled,
        count(*) FILTER (WHERE b.status = 'EXPIRED')::int AS expired,
        count(*) FILTER (WHERE b.status = 'NO_SHOW')::int AS no_show,
        COALESCE(sum(b.total_amount) FILTER (WHERE b.status IN ('CONFIRMED','COMPLETED')),0)::float8 AS revenue,
        COALESCE(sum(b.paid_amount) FILTER (WHERE b.status IN ('CONFIRMED','COMPLETED')),0)::float8 AS collected,
        COALESCE(sum(b.commission_amount) FILTER (WHERE b.status IN ('CONFIRMED','COMPLETED')),0)::float8 AS commission ${base}`,
  ]);
  const t = totals[0] ?? {};
  const decided = n(t.confirmed) + n(t.cancelled) + n(t.no_show);
  return { from, to, groupBy: q.groupBy, product: q.product ?? null,
    totals: { bookings: n(t.bookings), confirmed: n(t.confirmed), cancelled: n(t.cancelled), expired: n(t.expired), noShow: n(t.no_show), revenue: n(t.revenue), collected: n(t.collected), outstanding: round(n(t.revenue) - n(t.collected), 2), commission: n(t.commission),
      averageBookingValue: n(t.confirmed) ? round(n(t.revenue) / n(t.confirmed), 2) : 0, cancellationRate: decided ? round(n(t.cancelled) / decided * 100, 1) : 0 },
    series, byProduct, byStatus, bySource };
}

/** Commission per supplier. Operator sees all suppliers, a supplier admin sees only its own row (RLS + the filter). */
export async function commissionReport(tx: Tx, s: Scope, q: RQ) {
  const { from, to, start, end } = range(q), sup = supSql(s, 'b.supplier_id'), p = prod(q.product);
  const rows = await tx.$queryRaw<Row[]>`SELECT sp.id AS "supplierId", sp.code, sp.name, sp.commission_pct::float8 AS "commissionPct", b.product::text AS product,
      count(*)::int AS bookings, COALESCE(sum(b.total_amount),0)::float8 AS gross, COALESCE(sum(b.commission_amount),0)::float8 AS commission, COALESCE(sum(b.paid_amount),0)::float8 AS collected
    FROM bookings b JOIN suppliers sp ON sp.id = b.supplier_id
    WHERE b.deleted_at IS NULL AND b.status IN ('CONFIRMED','COMPLETED') AND b.created_at >= ${start} AND b.created_at < ${end} ${sup} ${p}
    GROUP BY sp.id, sp.code, sp.name, sp.commission_pct, b.product ORDER BY sp.name, b.product`;
  const map = new Map<string, any>();
  for (const r of rows) {
    const e = map.get(r.supplierId) ?? { supplierId: r.supplierId, code: r.code, name: r.name, commissionPct: r.commissionPct, bookings: 0, gross: 0, commission: 0, collected: 0, netToSupplier: 0, byProduct: [] };
    e.bookings += r.bookings; e.gross = round(e.gross + r.gross); e.commission = round(e.commission + r.commission); e.collected = round(e.collected + r.collected);
    e.byProduct.push({ product: r.product, bookings: r.bookings, gross: r.gross, commission: r.commission });
    map.set(r.supplierId, e);
  }
  const suppliers = [...map.values()].map((e) => ({ ...e, netToSupplier: round(e.gross - e.commission) })).sort((a, b) => b.gross - a.gross);
  return { from, to, suppliers, totals: { bookings: suppliers.reduce((a, e) => a + e.bookings, 0), gross: round(suppliers.reduce((a, e) => a + e.gross, 0)), commission: round(suppliers.reduce((a, e) => a + e.commission, 0)) } };
}

export async function paymentsReport(tx: Tx, s: Scope, q: RQ) {
  const { from, to, start, end } = range(q), sup = supSql(s, 'p.supplier_id');
  const rows = await tx.$queryRaw<Row[]>`SELECT p.method::text AS method, p.kind::text AS kind, count(*)::int AS count, COALESCE(sum(p.amount),0)::float8 AS amount
    FROM payments p WHERE p.tx_status = 'SUCCEEDED' AND p.paid_at >= ${start} AND p.paid_at < ${end} ${sup} GROUP BY 1,2 ORDER BY 2,1`;
  const sum = (k: string) => round(rows.filter((r) => r.kind === k).reduce((a, r) => a + r.amount, 0));
  const received = sum('PAYMENT'), refunded = sum('REFUND');
  return { from, to, received, refunded, net: round(received - refunded), byMethod: rows };
}
