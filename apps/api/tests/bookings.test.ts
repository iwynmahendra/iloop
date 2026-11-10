import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deliverEmails } from '../src/booking/notify.js';
import { api, bearer, login, SEED_PASSWORD, superSession, type Session } from './helpers.js';

const B = '/api/v1/bookings';
let ubud: Session, ubudStaff: Session, semi: Session, sup: Session;
const day = (n: number) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10); // Bali date
const list = async (s: Session, path: string, q: object = {}) => (await api().get(`/api/v1/${path}`).set(bearer(s.token)).query({ limit: 100, ...q })).body.data as any[];
const post = (s: Session, url: string, body: object = {}) => api().post(url).set(bearer(s.token)).send(body);
const get = (s: Session, url: string, q: object = {}) => api().get(url).set(bearer(s.token)).query(q);
let pool: pg.Pool;
const sql = async (text: string, params: unknown[] = []) => { const c = await pool.connect(); try { await c.query("SELECT set_config('app.role','SUPER_ADMIN',false), set_config('app.supplier_id','',false)"); return (await c.query(text, params)).rows; } finally { c.release(); } };

// master data of the demo supplier "Ubud"
const M: any = {};
beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  [ubud, ubudStaff, semi, sup] = await Promise.all([login('admin@ubud.example', SEED_PASSWORD), login('staff@ubud.example', SEED_PASSWORD), login('admin@semi.example', SEED_PASSWORD), superSession()]);
  M.rt = (await list(ubud, 'hotel/room-types'))[0];
  M.trip = (await list(ubud, 'trips/trips'))[0];
  M.variant = (await list(ubud, 'trips/trip-variants', { tripId: M.trip.id }))[0] ?? (await list(ubud, 'trips/trip-variants'))[0];
  M.service = (await list(ubud, 'transport/transport-services'))[0];
  M.drivers = await list(ubud, 'transport/drivers'); M.vehicles = await list(ubud, 'transport/vehicles');
  M.club = (await list(ubud, 'club/clubs'))[0];
  M.ticket = (await list(ubud, 'club/club-ticket-types', { clubId: M.club.id }))[0] ?? (await list(ubud, 'club/club-ticket-types'))[0];
  M.table = (await list(ubud, 'club/club-table-packages'))[0];
});
afterAll(async () => { await pool.end(); });

const hotelBody = (o: object = {}) => ({ product: 'HOTEL', roomTypeId: M.rt.id, checkIn: day(10), checkOut: day(12), rooms: 1, adults: 2, guestName: 'Test Guest', guestEmail: 'tg@example.test', ...o });
const avail = async (ci: string, co: string) => (await get(ubud, `/api/v1/availability/hotel`, { hotelId: M.rt.hotelId, checkIn: ci, checkOut: co })).body.data.roomTypes.find((r: any) => r.roomTypeId === M.rt.id);

describe('hotel booking lifecycle', () => {
  let id: string; let total: number;
  it('prices from master data, takes stock and holds a pending booking', async () => {
    const before = (await avail(day(10), day(12))).available;
    const r = await post(ubud, B, hotelBody());
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    id = r.body.data.id; total = Number(r.body.data.totalAmount);
    expect(r.body.data.status).toBe('PENDING'); expect(r.body.data.bookingNo).toMatch(/^HTL-\d{4}-\d{4}$/); expect(r.body.data.holdExpiresAt).toBeTruthy();
    expect(total).toBeGreaterThan(0); expect(Number(r.body.data.commissionAmount)).toBeCloseTo(total * 12.5 / 100, 1);
    expect((await avail(day(10), day(12))).available).toBe(before - 1);
  });
  it('shows full detail with lines, guests, items and a timeline', async () => {
    const r = await get(ubud, `${B}/${id}`);
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.lines.length).toBeGreaterThan(0); expect(d.guests[0].isLead).toBe(true); expect(d.items[0].nights).toBe(2); expect(d.events[0].eventType).toBe('CREATED'); expect(d.balance).toBe(total);
    const sum = d.lines.reduce((a: number, l: any) => a + (l.lineType === 'DISCOUNT' ? -1 : 1) * Number(l.amount), 0);
    expect(sum).toBeCloseTo(total, 1);
  });
  it('lists and searches it', async () => {
    const r = await get(ubud, B, { q: 'Test Guest', product: 'HOTEL', status: 'PENDING', sort: 'createdAt', dir: 'desc' }); // newest first: older runs leave rows in a reused test database
    expect(r.body.data.some((b: any) => b.id === id)).toBe(true); expect(r.body.meta.total).toBeGreaterThan(0);
    expect(r.body.data.find((b: any) => b.id === id).summary.title).toContain(M.rt.name);
  });
  it('confirms, takes part payments, and the balance and status follow', async () => {
    expect((await post(ubud, `${B}/${id}/status`, { status: 'CONFIRMED' })).body.data.status).toBe('CONFIRMED');
    const half = Math.round(total / 2);
    let r = await post(ubud, `${B}/${id}/payments`, { amount: half, method: 'CASH' });
    expect(r.status, JSON.stringify(r.body)).toBe(201); expect(r.body.data.paymentStatus).toBe('PARTIAL');
    expect((await post(ubud, `${B}/${id}/payments`, { amount: total, method: 'CASH' })).status).toBe(422); // more than the balance
    r = await post(ubud, `${B}/${id}/payments`, { amount: total - half, method: 'BANK_TRANSFER' });
    expect(r.body.data.paymentStatus).toBe('PAID'); expect(r.body.data.balance).toBe(0);
  });
  it('previews and applies the cancellation policy, refunds and gives the room back', async () => {
    const pre = await get(ubud, `${B}/${id}/cancel-preview`);
    expect(pre.body.data.paid).toBeCloseTo(total, 1);
    const before = (await avail(day(10), day(12))).available;
    const r = await post(ubud, `${B}/${id}/cancel`, { reason: 'Guest changed plans' });
    expect(r.status, JSON.stringify(r.body)).toBe(200); expect(r.body.data.booking.status).toBe('CANCELLED');
    expect((await avail(day(10), day(12))).available).toBe(before + 1);
    const d = (await get(ubud, `${B}/${id}`)).body.data;
    expect(Number(d.paidAmount)).toBeCloseTo(total - r.body.data.refunded, 1);
    expect((await post(ubud, `${B}/${id}/status`, { status: 'COMPLETED' })).status).toBe(409); // final state
  });
});

describe('no overbooking', () => {
  it('refuses more rooms than are left and leaves stock unchanged', async () => {
    const before = (await avail(day(14), day(15))).available;
    const r = await post(ubud, B, hotelBody({ checkIn: day(14), checkOut: day(15), rooms: before + 1, adults: 2 }));
    expect([409, 422]).toContain(r.status);
    expect((await avail(day(14), day(15))).available).toBe(before);
  });
  it('lets only as many parallel requests through as there are rooms', async () => {
    const left = (await avail(day(16), day(17))).available;
    const n = left + 3;
    const rs = await Promise.all(Array.from({ length: n }, () => post(ubud, B, hotelBody({ checkIn: day(16), checkOut: day(17) }))));
    expect(rs.filter((r) => r.status === 201).length).toBe(left);
    expect((await avail(day(16), day(17))).available).toBe(0);
    for (const r of rs.filter((x) => x.status === 201)) await post(ubud, `${B}/${r.body.data.id}/cancel`, { reason: 'cleanup test' });
    expect((await avail(day(16), day(17))).available).toBe(left);
  });
});

describe('validation', () => {
  it('rejects a supplierId, a past date, a bad range and unknown fields', async () => {
    expect((await post(ubud, B, hotelBody({ supplierId: '00000000-0000-0000-0000-000000000000' }))).status).toBe(422);
    expect((await post(ubud, B, hotelBody({ checkIn: day(-3), checkOut: day(-1) }))).status).toBe(422);
    expect((await post(ubud, B, hotelBody({ checkIn: day(5), checkOut: day(5) }))).status).toBeGreaterThanOrEqual(400);
    expect((await post(ubud, B, { ...hotelBody(), totalAmount: 1 })).status).toBe(422);
  });
  it('cannot book a room type of another supplier', async () => {
    const r = await post(semi, B, hotelBody());
    expect(r.status).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
  });
});

describe('trips', () => {
  it('books a departure, takes quota and respects the cutoff for website sources', async () => {
    const dep = (await get(ubud, '/api/v1/availability/trips', { tripId: M.trip.id, from: day(3), pax: 2 })).body.data.departures.find((d: any) => d.canBook);
    expect(dep).toBeTruthy();
    const r = await post(ubud, B, { product: 'TRIP', scheduleId: dep.scheduleId, variantId: M.variant.id, adults: 2, children: 0, guestName: 'Trip Guest', confirm: true });
    expect(r.status, JSON.stringify(r.body)).toBe(201); expect(r.body.data.status).toBe('CONFIRMED'); expect(r.body.data.bookingNo).toMatch(/^TRP-/);
    const after = (await get(ubud, '/api/v1/availability/trips', { tripId: M.trip.id, from: day(3), pax: 1 })).body.data.departures.find((d: any) => d.scheduleId === dep.scheduleId);
    expect(after.remaining).toBe(dep.remaining - 2);
    const too = await post(ubud, B, { product: 'TRIP', scheduleId: dep.scheduleId, variantId: M.variant.id, adults: dep.remaining + 5, guestName: 'Too many' });
    expect([409, 422]).toContain(too.status);
    const board = await get(ubud, '/api/v1/boards/trips', { from: dep.date.slice(0, 10), tripId: M.trip.id });
    expect(board.body.data.departures.find((d: any) => d.scheduleId === dep.scheduleId).confirmedGuests).toBeGreaterThanOrEqual(2);
    await post(ubud, `${B}/${r.body.data.id}/cancel`, { reason: 'cleanup test' });
  });
});

describe('transport', () => {
  it('books a transfer, assigns a driver, blocks a clash and walks the dispatch steps', async () => {
    const pickupAt = new Date(Date.now() + 5 * 864e5).toISOString();
    const mk = (extra = {}) => post(ubud, B, { product: 'TRANSPORT', serviceId: M.service.id, pickupAt, pickupAddress: 'Ngurah Rai Airport', dropoffAddress: 'Ubud Rice Terrace Villa', passengers: 2, guestName: 'Transfer Guest', confirm: true, ...extra });
    const a = await mk(); expect(a.status, JSON.stringify(a.body)).toBe(201);
    const b = await mk(); expect(b.status).toBe(201);
    const vehicle = M.vehicles.find((v: any) => v.driverId) ?? M.vehicles[0]; const driver = M.drivers.find((d: any) => d.id === vehicle.driverId) ?? M.drivers[0];
    const as = await post(ubud, `${B}/${a.body.data.id}/assign`, { driverId: driver.id, vehicleId: vehicle.id });
    expect(as.status, JSON.stringify(as.body)).toBe(200);
    const clash = await post(ubud, `${B}/${b.body.data.id}/assign`, { driverId: driver.id, vehicleId: vehicle.id });
    expect(clash.status).toBe(409);
    for (const st of ['ON_THE_WAY', 'PICKED_UP', 'DROPPED_OFF']) expect((await post(ubud, `${B}/${a.body.data.id}/dispatch`, { status: st })).status, st).toBe(200);
    expect((await get(ubud, `${B}/${a.body.data.id}`)).body.data.status).toBe('COMPLETED');
    expect((await post(ubud, `${B}/${a.body.data.id}/dispatch`, { status: 'ON_THE_WAY' })).status).toBe(409);
    await post(ubud, `${B}/${b.body.data.id}/cancel`, { reason: 'cleanup test' });
  });
});

describe('club', () => {
  it('sells tickets, checks guests in at the door and cannot check in more than booked', async () => {
    const r = await post(ubud, B, { product: 'CLUB', clubId: M.club.id, ticketTypeId: M.ticket.id, visitDate: day(0), guestCount: 3, quantity: 3, guestName: 'Club Guest', confirm: true });
    expect(r.status, JSON.stringify(r.body)).toBe(201); expect(r.body.data.bookingNo).toMatch(/^CLB-/);
    const id = r.body.data.id;
    expect((await post(ubud, `${B}/${id}/check-in`, { count: 2 })).status).toBe(200);
    expect((await post(ubud, `${B}/${id}/check-in`, { count: 5 })).status).toBeGreaterThanOrEqual(400);
    const door = await get(ubud, '/api/v1/boards/club', { date: day(0) });
    expect(door.body.data.guestList.find((g: any) => g.id === id).checkedInCount).toBe(2);
    expect((await post(ubud, B, { product: 'CLUB', clubId: M.club.id, ticketTypeId: M.ticket.id, tablePackageId: M.table.id, visitDate: day(0), guestCount: 2, guestName: 'Both' })).status).toBe(422);
  });
});

describe('roles', () => {
  let id: string; let paymentId: string;
  beforeAll(async () => {
    const r = await post(ubud, B, hotelBody({ checkIn: day(20), checkOut: day(21), confirm: true }));
    id = r.body.data.id; const p = await post(ubud, `${B}/${id}/payments`, { amount: 100000, method: 'CASH' }); paymentId = p.body.data.payments[0].id;
  });
  it('staff can create, note and take payment', async () => {
    const r = await post(ubudStaff, B, hotelBody({ checkIn: day(22), checkOut: day(23) }));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await post(ubudStaff, `${B}/${r.body.data.id}/notes`, { message: 'Late arrival' })).status).toBe(201);
    expect((await post(ubudStaff, `${B}/${r.body.data.id}/payments`, { amount: 50000, method: 'CASH' })).status).toBe(201);
    expect((await post(ubudStaff, `${B}/${r.body.data.id}/cancel`, { reason: 'Guest asked' })).status).toBe(403); // paid: staff may only cancel unpaid pending
  });
  it('staff cannot discount, refund, void, delete or cancel a confirmed booking', async () => {
    expect((await post(ubudStaff, B, hotelBody({ checkIn: day(24), checkOut: day(25), discount: { amount: 1000, reason: 'friend' } }))).status).toBe(403);
    expect((await post(ubudStaff, `${B}/${id}/refunds`, { paymentId, amount: 1000 })).status).toBe(403);
    expect((await post(ubudStaff, `/api/v1/payments/${paymentId}/void`)).status).toBe(403);
    expect((await api().delete(`${B}/${id}`).set(bearer(ubudStaff.token))).status).toBe(403);
    expect((await post(ubudStaff, `${B}/${id}/cancel`, { reason: 'nope' })).status).toBe(403);
    expect((await get(ubudStaff, '/api/v1/reports/summary')).status).toBe(403);
  });
  it('admin can discount, refund and void', async () => {
    const d = await post(ubud, B, hotelBody({ checkIn: day(24), checkOut: day(25), discount: { amount: 10000, reason: 'loyalty' } }));
    expect(d.status).toBe(201); expect(Number(d.body.data.discountAmount)).toBe(10000);
    expect((await post(ubud, `${B}/${id}/refunds`, { paymentId, amount: 30000 })).status).toBe(201);
    expect((await post(ubud, `${B}/${id}/refunds`, { paymentId, amount: 80000 })).status).toBe(422); // only 70000 left
    expect((await post(ubud, `/api/v1/payments/${paymentId}/void`)).status).toBe(409); // refund first
  });
  it('a booking cannot be deleted while live, but can after cancelling, and then restored', async () => {
    expect((await api().delete(`${B}/${id}`).set(bearer(ubud.token))).status).toBe(409);
    expect((await post(ubud, `${B}/${id}/cancel`, { reason: 'test over' })).status).toBe(200);
    expect((await api().delete(`${B}/${id}`).set(bearer(ubud.token))).status).toBe(200);
    expect((await get(ubud, `${B}/${id}`)).status).toBe(404);
    expect((await post(ubud, `${B}/${id}/restore`)).status).toBe(200);
    expect((await get(ubud, `${B}/${id}`)).status).toBe(200);
  });
});

describe('isolation between suppliers', () => {
  let id: string;
  beforeAll(async () => { id = (await post(ubud, B, hotelBody({ checkIn: day(26), checkOut: day(27) }))).body.data.id; });
  it('hides bookings, customers and payments of another supplier', async () => {
    expect((await get(semi, `${B}/${id}`)).status).toBe(404);
    expect((await get(semi, `${B}/${id}/cancel-preview`)).status).toBe(404);
    expect((await post(semi, `${B}/${id}/status`, { status: 'CONFIRMED' })).status).toBe(404);
    expect((await post(semi, `${B}/${id}/payments`, { amount: 1000, method: 'CASH' })).status).toBe(404);
    expect((await post(semi, `${B}/${id}/cancel`, { reason: 'hack attempt' })).status).toBe(404);
    expect((await get(semi, B, { limit: 100 })).body.data.some((b: any) => b.id === id)).toBe(false);
    expect((await get(semi, B, { limit: 100 })).body.data.every((b: any) => b.supplierId === semi.user.supplierId)).toBe(true);
    expect((await get(semi, `${B}/export`)).text).not.toContain(id);
    const c = (await get(semi, '/api/v1/customers')).body.data; expect(c.every((x: any) => x.supplierId === semi.user.supplierId)).toBe(true);
    expect((await get(ubud, `${B}/${id}`)).body.data.status).toBe('PENDING');
  });
  it('ignores X-Supplier-Id from a supplier user', async () => {
    const r = await api().get(B).set(bearer(semi.token)).set('X-Supplier-Id', ubud.user.supplierId).query({ limit: 100 });
    expect(r.body.data.some((b: any) => b.id === id)).toBe(false);
  });
  it('lets the operator see all suppliers, and needs a supplier to write', async () => {
    const all = (await get(sup, B, { limit: 100, status: 'PENDING,CONFIRMED' })).body.data;
    expect(new Set(all.map((b: any) => b.supplierId)).size).toBe(2);
    const w = await post(sup, B, hotelBody({ checkIn: day(28), checkOut: day(29) }));
    expect(w.status).toBe(400);
    const ok = await api().post(B).set(bearer(sup.token)).set('X-Supplier-Id', ubud.user.supplierId).send(hotelBody({ checkIn: day(28), checkOut: day(29) }));
    expect(ok.status, JSON.stringify(ok.body)).toBe(201); expect(ok.body.data.supplierId).toBe(ubud.user.supplierId);
  });
});

describe('hold expiry', () => {
  it('expires an overdue pending booking and gives the room back', async () => {
    const before = (await avail(day(18), day(19))).available;
    const r = await post(ubud, B, hotelBody({ checkIn: day(18), checkOut: day(19) })); const id = r.body.data.id;
    expect((await avail(day(18), day(19))).available).toBe(before - 1);
    await sql("UPDATE bookings SET hold_expires_at = now() - interval '5 minutes' WHERE id = $1", [id]);
    expect((await post(ubud, `${B}/expire-holds`)).status).toBe(403); // operator only
    const e = await post(sup, `${B}/expire-holds`); expect(e.status).toBe(200); expect(e.body.data.expired).toBeGreaterThanOrEqual(1);
    expect((await get(ubud, `${B}/${id}`)).body.data.status).toBe('EXPIRED');
    expect((await avail(day(18), day(19))).available).toBe(before);
    expect((await post(ubud, `${B}/${id}/status`, { status: 'CONFIRMED' })).status).toBe(409);
  });
});

describe('boards, overview, customers and reports', () => {
  it('serves the overview and the hotel board', async () => {
    const o = await get(ubud, '/api/v1/booking-overview'); expect(o.status).toBe(200); expect(o.body.data).toHaveProperty('pending');
    const h = await get(ubud, '/api/v1/boards/hotel', { date: day(10) }); expect(h.status).toBe(200); expect(h.body.data.occupancy.totalUnits).toBeGreaterThan(0);
    const t = await get(ubud, '/api/v1/boards/transport'); expect(t.body.data.drivers.length).toBeGreaterThan(0);
  });
  it('creates, edits and finds a customer, and exports CSV safely', async () => {
    const c = await post(ubud, '/api/v1/customers', { fullName: '=HYPERLINK("http://x")', email: 'csv@example.test' });
    expect(c.status).toBe(201);
    expect((await api().patch(`/api/v1/customers/${c.body.data.id}`).set(bearer(ubud.token)).send({ phone: '+62 811 000' })).body.data.phone).toBe('+62 811 000');
    const b = await post(ubud, B, hotelBody({ customerId: c.body.data.id, guestName: undefined, checkIn: day(6), checkOut: day(7) }));
    expect(b.status, JSON.stringify(b.body)).toBe(201);
    const csv = (await get(ubud, `${B}/export`, { q: 'HYPERLINK' })).text; expect(csv).toContain("'=HYPERLINK");
    expect((await get(ubud, `/api/v1/customers/${c.body.data.id}`)).body.data.bookings.length).toBe(1);
    expect((await get(ubud, '/api/v1/customers', { q: 'csv@example' })).body.data[0].bookingCount).toBe(1);
  });
  it('edits guest details of a live booking', async () => {
    const b = (await list(ubud, 'bookings', { status: 'PENDING,CONFIRMED', product: 'HOTEL' }))[0];
    const r = await api().patch(`${B}/${b.id}`).set(bearer(ubud.token)).send({ specialRequests: 'High floor', guests: [{ fullName: 'A One', isLead: true }, { fullName: 'B Two' }] });
    expect(r.status, JSON.stringify(r.body)).toBe(200); expect(r.body.data.guests.length).toBe(2); expect(r.body.data.events.at(-1).eventType).toBe('EDITED');
    expect((await api().patch(`${B}/${b.id}`).set(bearer(ubud.token)).send({ status: 'COMPLETED' })).status).toBe(422);
  });
  it('gives admins summary, commission and payment reports', async () => {
    const s = await get(ubud, '/api/v1/reports/summary', { from: day(-30), to: day(0), groupBy: 'week' });
    expect(s.status, JSON.stringify(s.body)).toBe(200); expect(s.body.data.totals).toHaveProperty('cancellationRate');
    const c = (await get(sup, '/api/v1/reports/commission', { from: day(-400), to: day(60) })).body.data;
    expect(c.suppliers.length).toBe(2); expect(c.totals.commission).toBeGreaterThan(0);
    const mine = (await get(ubud, '/api/v1/reports/commission', { from: day(-400), to: day(60) })).body.data; expect(mine.suppliers.length).toBe(1);
    const p = (await get(ubud, '/api/v1/reports/payments', { from: day(-400), to: day(60) })).body.data; expect(p.net).toBeCloseTo(p.received - p.refunded, 1);
    const cal = await get(ubud, `${B}/calendar`, { from: day(0), to: day(30) }); expect(cal.body.data.length).toBeGreaterThan(0);
  });
  it('requires a login', async () => { expect((await api().get(B)).status).toBe(401); });
});

describe('guest concierge bookings', () => {
  it('stores a request as pending with the room number and a longer hold', async () => {
    const r = await post(ubudStaff, B, hotelBody({ checkIn: day(3), checkOut: day(4), source: 'CONCIERGE', roomNumber: '412' }));
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('PENDING');
    expect(r.body.data.source).toBe('CONCIERGE');
    expect(r.body.data.roomNumber).toBe('412');
    const mins = (new Date(r.body.data.holdExpiresAt).getTime() - Date.now()) / 6e4;
    expect(mins).toBeGreaterThan(400);
  });
  it('needs a room number and cannot be confirmed at creation', async () => {
    expect((await post(ubudStaff, B, hotelBody({ checkIn: day(5), checkOut: day(6), source: 'CONCIERGE' }))).status).toBe(400);
    expect((await post(ubudStaff, B, hotelBody({ checkIn: day(5), checkOut: day(6), source: 'CONCIERGE', roomNumber: '412', confirm: true }))).status).toBe(400);
  });
  it('no longer accepts OTA as a source, and lists concierge bookings by source', async () => {
    expect((await post(ubud, B, hotelBody({ checkIn: day(7), checkOut: day(8), source: 'OTA' }))).status).toBe(422);
    const rows = await list(ubud, 'bookings', { source: 'CONCIERGE' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((x) => x.source === 'CONCIERGE')).toBe(true);
  });
  it('lets staff confirm it and charge it to the room', async () => {
    const id = (await post(ubudStaff, B, hotelBody({ checkIn: day(8), checkOut: day(9), source: 'CONCIERGE', roomNumber: '305' }))).body.data.id;
    expect((await post(ubudStaff, `${B}/${id}/status`, { status: 'CONFIRMED' })).status).toBe(200);
    const total = (await get(ubudStaff, `${B}/${id}`)).body.data.totalAmount;
    const p = await post(ubudStaff, `${B}/${id}/payments`, { amount: Number(total), method: 'ROOM_CHARGE' });
    expect(p.status).toBe(201);
  });
});

describe('booking emails', () => {
  // own stock on days 60 to 71, so these tests never use up the rooms other tests rely on
  beforeAll(async () => {
    for (let n = 60; n <= 71; n++) await sql(`INSERT INTO room_inventory (supplier_id, room_type_id, date, total_units, available_units) VALUES ($1, $2, $3::date, 20, 20) ON CONFLICT DO NOTHING`, [M.rt.supplierId, M.rt.id, day(n)]);
  });
  const mails = async (s: Session, id: string) => (await get(s, `${B}/${id}/emails`)).body.data as any[];
  it('queues one email for the guest and one for the supplier on every new booking', async () => {
    const r = await post(ubud, B, hotelBody({ checkIn: day(60), checkOut: day(61), guestName: 'Mail Guest', guestEmail: 'mail.guest@example.test' }));
    expect(r.status).toBe(201);
    const m = await mails(ubud, r.body.data.id);
    expect(m.map((x) => x.recipientKind).sort()).toEqual(['GUEST', 'SUPPLIER']);
    expect(m.every((x) => x.status === 'QUEUED')).toBe(true);
    expect(m.find((x) => x.recipientKind === 'GUEST').toEmail).toBe('mail.guest@example.test');
    expect(m.find((x) => x.recipientKind === 'SUPPLIER').toEmail).toMatch(/@/);
    expect(m.find((x) => x.recipientKind === 'GUEST').subject).toContain(r.body.data.bookingNo);
    const ev = (await get(ubud, `${B}/${r.body.data.id}`)).body.data.events ?? [];
    if (ev.length) expect(ev.some((e: any) => e.eventType === 'NOTIFICATION')).toBe(true);
  });
  it('sends them, and marks them sent', async () => {
    const r = await post(ubud, B, hotelBody({ checkIn: day(62), checkOut: day(63), guestEmail: 'send.me@example.test' }));
    await deliverEmails(200);
    const m = await mails(ubud, r.body.data.id);
    expect(m.every((x) => x.status === 'SENT' && x.sentAt)).toBe(true);
  });
  it('covers every source, including guest concierge bookings', async () => {
    const r = await post(ubudStaff, B, hotelBody({ checkIn: day(64), checkOut: day(65), source: 'CONCIERGE', roomNumber: '412', guestEmail: 'room412@example.test' }));
    expect(r.status).toBe(201);
    const m = await mails(ubudStaff, r.body.data.id);
    expect(m).toHaveLength(2);
    expect(m.find((x) => x.recipientKind === 'SUPPLIER').subject).toContain('pending');
  });
  it('skips the guest email when there is no address, and the supplier is still told', async () => {
    const r = await post(ubud, B, hotelBody({ checkIn: day(66), checkOut: day(67), guestEmail: undefined }));
    const m = await mails(ubud, r.body.data.id);
    expect(m.find((x) => x.recipientKind === 'GUEST').status).toBe('SKIPPED');
    expect(m.find((x) => x.recipientKind === 'SUPPLIER').status).toBe('QUEUED');
    const g = m.find((x) => x.recipientKind === 'GUEST');
    expect((await post(ubud, `${B}/${r.body.data.id}/emails/${g.id}/resend`, {})).status).toBe(400);
    expect((await post(ubud, `${B}/${r.body.data.id}/emails/${g.id}/resend`, { toEmail: 'fixed@example.test' })).status).toBe(200);
    expect((await mails(ubud, r.body.data.id)).find((x) => x.id === g.id).status).toBe('QUEUED');
  });
  it('keeps a guest name from breaking the subject line', async () => {
    const r = await post(ubud, B, hotelBody({ checkIn: day(68), checkOut: day(69), guestName: 'Eve\r\nBcc: x@evil.test' }));
    expect(r.status).toBe(201);
    for (const x of await mails(ubud, r.body.data.id)) expect(/[\r\n]/.test(x.subject)).toBe(false);
  });
  it('does not show one supplier the emails of another', async () => {
    const r = await post(ubud, B, hotelBody({ checkIn: day(70), checkOut: day(71) }));
    expect((await get(semi, `${B}/${r.body.data.id}/emails`)).status).toBe(404);
  });
});
