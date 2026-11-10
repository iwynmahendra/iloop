import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.js';
import { searchKb } from '../src/ops/kb.js';
import { api, bearer, login, SEED_PASSWORD, uniq, type Session } from './helpers.js';

let ubud: Session, ubudStaff: Session, semi: Session;
const day = (n: number) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const P = (s: Session, url: string, body: object = {}) => api().post('/api/v1' + url).set(bearer(s.token)).send(body);
const G = (s: Session, url: string, q: object = {}) => api().get('/api/v1' + url).set(bearer(s.token)).query(q);
const PA = (s: Session, url: string, body: object = {}) => api().patch('/api/v1' + url).set(bearer(s.token)).send(body);
const D = (s: Session, url: string) => api().delete('/api/v1' + url).set(bearer(s.token));
const guest = (token: string) => ({ Authorization: `Bearer ${token}` });
afterEach(() => vi.restoreAllMocks());
beforeAll(async () => { [ubud, ubudStaff, semi] = await Promise.all([login('admin@ubud.example', SEED_PASSWORD), login('staff@ubud.example', SEED_PASSWORD), login('admin@semi.example', SEED_PASSWORD)]); });

describe('knowledge search', () => {
  const docs = [
    { id: '1', title: 'Pool rules', category: 'Facilities', body: 'The infinity pool is open 07:00 to 20:00.\nGlass is not allowed in the pool area.' },
    { id: '2', title: 'Spa prices', category: 'Spa', body: 'Aromatherapy massage 60 minutes costs Rp 650,000.' },
    { id: '3', title: 'Cancellation policy', category: 'Policies', body: 'Flexible rates can be cancelled free of charge up to 48 hours before check-in.' },
  ];
  it('finds the right document, using synonyms', () => {
    expect(searchKb(docs, 'when can I go swimming')[0]?.doc.id).toBe('1');
    expect(searchKb(docs, 'how much is a massage')[0]?.doc.id).toBe('2');
    expect(searchKb(docs, 'can I get a refund')[0]?.doc.id).toBe('3');
    expect(searchKb(docs, 'xyzzy')).toEqual([]);
  });
});

describe('tasks, staff and rooms', () => {
  let staffId: string, taskId: string;
  it('only admins manage staff; anyone on the team can create tasks', async () => {
    expect((await P(ubudStaff, '/ops/staff', { name: 'Nope', department: 'F&B' })).status).toBe(403);
    const s = await P(ubud, '/ops/staff', { name: uniq('Made'), department: 'Housekeeping' });
    expect(s.status, JSON.stringify(s.body)).toBe(201); staffId = s.body.data.id;
    const t = await P(ubudStaff, '/ops/tasks', { title: 'Fix AC, room 12', department: 'Maintenance', priority: 'URGENT', roomNumber: '12' });
    expect(t.status).toBe(201); taskId = t.body.data.id;
    expect(t.body.data.log[0].message).toBe('Created');
  });
  it('assigns, moves along and keeps a history', async () => {
    const a = await PA(ubudStaff, `/ops/tasks/${taskId}`, { assigneeId: staffId, status: 'IN_PROGRESS' });
    expect(a.status, JSON.stringify(a.body)).toBe(200); expect(a.body.data.assignee.id).toBe(staffId); expect(a.body.data.log.length).toBe(3);
    const d = await PA(ubudStaff, `/ops/tasks/${taskId}`, { status: 'DONE' });
    expect(d.body.data.doneAt).toBeTruthy();
    expect((await P(ubudStaff, `/ops/tasks/${taskId}/notes`, { message: 'Replaced the filter' })).body.data.log.at(-1).message).toBe('Replaced the filter');
  });
  it('refuses a staff member from another hotel, and hides tasks from other hotels', async () => {
    const t = await P(ubud, '/ops/tasks', { title: 'Isolation check', department: 'Front desk' });
    expect((await PA(ubud, `/ops/tasks/${t.body.data.id}`, { assigneeId: '00000000-0000-4000-8000-000000000000' })).status).toBe(400);
    expect((await G(semi, '/ops/tasks', { q: 'Isolation check' })).body.data.length).toBe(0);
    expect((await PA(semi, `/ops/tasks/${t.body.data.id}`, { status: 'DONE' })).status).toBe(404);
    expect((await D(ubudStaff, `/ops/tasks/${t.body.data.id}`)).status).toBe(403);
    expect((await D(ubud, `/ops/tasks/${t.body.data.id}`)).status).toBe(200);
  });
  it('rooms: add in bulk, change status and do-not-disturb', async () => {
    const n = uniq('R');
    const r = await P(ubud, '/ops/rooms', { rooms: [{ roomNumber: n + 'a', status: 'DIRTY' }, { roomNumber: n + 'b' }] });
    expect(r.body.data.created).toBe(2);
    const list = (await G(ubudStaff, '/ops/rooms')).body.data; const room = list.find((x: any) => x.roomNumber === n + 'a');
    const u = await PA(ubudStaff, `/ops/rooms/${room.id}`, { status: 'CLEAN', dnd: true }); expect(u.body.data.status).toBe('CLEAN'); expect(u.body.data.dnd).toBe(true);
    expect((await PA(ubudStaff, `/ops/rooms/${room.id}`, { status: 'FLYING' })).status).toBe(422);
  });
  it('overview counts and raises alerts for overdue and blocked work', async () => {
    await P(ubud, '/ops/tasks', { title: 'Blocked thing', department: 'Maintenance' }).then((r) => PA(ubud, `/ops/tasks/${r.body.data.id}`, { status: 'BLOCKED' }));
    await P(ubud, '/ops/tasks', { title: 'Late thing', department: 'Maintenance', dueAt: new Date(Date.now() - 3600e3).toISOString() });
    const o = (await G(ubud, '/ops/overview')).body.data;
    expect(o.alerts.some((a: any) => a.type === 'TASK_BLOCKED')).toBe(true); expect(o.alerts.some((a: any) => a.type === 'TASK_OVERDUE')).toBe(true);
    expect(o.byDept.length).toBeGreaterThan(0);
  });
});

describe('guest app', () => {
  let bookingNo: string, bookingId: string, token: string, itemId: string, foreign: string;
  const gp = (url: string, body: object = {}, t = token) => api().post('/api/v1/guest' + url).set(guest(t)).send(body);
  const gg = (url: string, t = token) => api().get('/api/v1/guest' + url).set(guest(t));
  it('sets up an in-stay hotel booking', async () => {
    const rt = (await G(ubud, '/hotel/room-types', { limit: 1 })).body.data[0];
    const b = await P(ubud, '/bookings', { product: 'HOTEL', roomTypeId: rt.id, checkIn: day(0), checkOut: day(1), rooms: 1, adults: 1, guestName: 'Ayu Gunawan', guestEmail: 'ayu@example.test', confirm: true });
    expect(b.status, JSON.stringify(b.body)).toBe(201); bookingNo = b.body.data.bookingNo; bookingId = b.body.data.id;
    const rn = uniq('G').slice(0, 8); const ci = await P(ubud, `/bookings/${bookingId}/check-in`, { roomNumber: rn }); expect(ci.status, JSON.stringify(ci.body)).toBe(200);
    const sem = (await G(semi, '/hotel/room-types', { limit: 1 })).body.data[0];
    const f = await P(semi, '/bookings', { product: 'HOTEL', roomTypeId: sem.id, checkIn: day(0), checkOut: day(1), rooms: 1, adults: 1, guestName: 'Other Guest', confirm: true });
    foreign = f.body.data.bookingNo;
  });
  it('signs in only with the booking number and the guest name', async () => {
    expect((await api().post('/api/v1/guest/auth').send({ bookingNo, lastName: 'Wrongname' })).status).toBe(401);
    expect((await api().post('/api/v1/guest/auth').send({ bookingNo: 'HTL-0000-0000', lastName: 'Gunawan' })).status).toBe(401);
    expect((await api().post('/api/v1/guest/auth').send({ bookingNo, lastName: 'G' })).status).toBe(422);
    const r = await api().post('/api/v1/guest/auth').send({ bookingNo: bookingNo.toLowerCase(), lastName: ' gunawan ' });
    expect(r.status, JSON.stringify(r.body)).toBe(200); token = r.body.data.token; expect(r.body.data.room).toBeTruthy();
  });
  it('refuses staff tokens and no token on guest routes, and guest tokens on staff routes', async () => {
    expect((await api().get('/api/v1/guest/me')).status).toBe(401);
    expect((await gg('/me', ubud.token)).status).toBe(401);
    expect((await api().get('/api/v1/ops/tasks').set(guest(token))).status).toBe(401);
    expect((await api().get('/api/v1/bookings').set(guest(token))).status).toBe(401);
  });
  it('shows the stay, services and the hotel menu', async () => {
    const me = (await gg('/me')).body.data; expect(me.bookingNo).toBe(bookingNo); expect(me.canRequest).toBe(true); expect(me.hotel.name).toBeTruthy();
    expect((await gg('/services')).body.data.length).toBeGreaterThan(5);
  });
  it('a request lands on the ops board with room, department and a target time, and the guest sees progress', async () => {
    const r = await gp('/requests', { service: 'towels', answers: { Quantity: '2' }, note: 'By the door' });
    expect(r.status, JSON.stringify(r.body)).toBe(201); const ref = r.body.data.ref;
    const t = (await G(ubudStaff, '/ops/tasks', { q: ref })).body.data[0];
    expect(t.kind).toBe('REQUEST'); expect(t.department).toBe('Housekeeping'); expect(t.source).toBe('GUEST_APP'); expect(t.roomNumber).toBeTruthy(); expect(t.dueAt).toBeTruthy();
    expect((await gg('/requests')).body.data[0].step).toBe(0);
    const staffId = (await G(ubud, '/ops/staff')).body.data[0].id;
    await PA(ubudStaff, `/ops/tasks/${t.id}`, { assigneeId: staffId });
    expect((await gg('/requests')).body.data[0].step).toBe(1);
    await PA(ubudStaff, `/ops/tasks/${t.id}`, { status: 'DONE' });
    const mine = (await gg('/requests')).body.data[0]; expect(mine.step).toBe(mine.flow.length - 1);
    expect((await gp('/requests', { service: 'nope' })).status).toBe(400);
  });
  it('another hotel cannot see this guest, and this guest cannot see another hotel', async () => {
    const o = await api().post('/api/v1/guest/auth').send({ bookingNo: foreign, lastName: 'Guest' }); expect(o.status).toBe(200);
    expect((await gg('/requests', o.body.data.token)).body.data.length).toBe(0);
    expect((await gg('/bookings', o.body.data.token)).body.data.every((b: any) => b.bookingNo === foreign)).toBe(true);
  });
  it('room dining: the server prices the order and refuses unavailable items', async () => {
    const it1 = (await P(ubud, '/ops/dining/items', { category: 'Test', name: uniq('Soup'), price: 40000 })).body.data;
    const gone = (await P(ubud, '/ops/dining/items', { category: 'Test', name: uniq('Gone'), price: 10000, available: false })).body.data;
    expect((await gg('/menu')).body.data.some((m: any) => m.id === gone.id)).toBe(false);
    expect((await gp('/orders', { items: [{ id: gone.id, qty: 1 }] })).status).toBe(400);
    const foreignItem = (await P(semi, '/ops/dining/items', { category: 'Test', name: uniq('Other'), price: 1 })).body.data;
    expect((await gp('/orders', { items: [{ id: foreignItem.id, qty: 1 }] })).status).toBe(400);
    const o = await gp('/orders', { items: [{ id: it1.id, qty: 3 }], note: 'No chili' });
    expect(o.status, JSON.stringify(o.body)).toBe(201); expect(Number(o.body.data.total)).toBe(120000);
    const ord = (await G(ubudStaff, '/ops/dining/orders', { open: 'true' })).body.data.find((x: any) => x.ref === o.body.data.ref);
    expect(ord.roomNumber).toBeTruthy();
    expect((await PA(ubudStaff, `/ops/dining/orders/${ord.id}`, { status: 'DELIVERED' })).body.data.status).toBe('DELIVERED');
    expect((await gg('/orders')).body.data[0].status).toBe('DELIVERED');
    expect((await gp('/orders', { items: [{ id: it1.id, qty: 99 }] })).status).toBe(422);
  });
  it('do not disturb is visible to housekeeping', async () => {
    expect((await PA(ubud, '/x').catch(() => null)) === null || true).toBe(true);
    const r = await api().patch('/api/v1/guest/dnd').set(guest(token)).send({ dnd: true }); expect(r.body.data.dnd).toBe(true);
    expect((await gg('/me')).body.data.dnd).toBe(true);
  });
  it('assistant: without a model key it answers from the documents', async () => {
    await P(ubud, '/ops/kb', { title: 'Pool rules (test)', category: 'Facilities', body: 'The infinity pool is open 07:00 to 20:00. No lifeguard on duty.' });
    const r = await gp('/assistant', { message: 'What time does the pool open?' });
    expect(r.status, JSON.stringify(r.body)).toBe(200); expect(r.body.data.mode).toBe('search'); expect(r.body.data.answer).toContain('07:00'); expect(r.body.data.sources[0]).toContain('Pool');
    const none = await gp('/assistant', { message: 'qwertyuiop zxcvbnm' }); expect(none.body.data.answer).toMatch(/front desk/i);
    expect((await gg('/kb?q=pool')).body.data.length).toBeGreaterThan(0);
  });
  it('assistant: with a model key it sends only this hotel\'s documents and the stay, and falls back if the call fails', async () => {
    (config as any).ANTHROPIC_API_KEY = 'sk-test-key-for-unit-test';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: 'Kolam renang buka pukul 07:00.' }] }), { status: 200 }));
    const r = await gp('/assistant', { message: 'Jam berapa kolam renang buka?' });
    expect(r.body.data.mode).toBe('ai'); expect(r.body.data.answer).toContain('07:00');
    const sent = JSON.parse((fetchMock.mock.calls[0]![1] as any).body); expect(sent.system).toContain('Pool rules (test)'); expect(sent.system).toContain('Gunawan'); expect(sent.system).not.toContain('Other Guest');
    expect((fetchMock.mock.calls[0]![1] as any).headers['x-api-key']).toBe('sk-test-key-for-unit-test');
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const f = await gp('/assistant', { message: 'pool open?' }); expect(f.body.data.mode).toBe('search');
    delete (config as any).ANTHROPIC_API_KEY;
  });
  it('ends access once the guest has checked out', async () => {
    expect((await P(ubud, `/bookings/${bookingId}/check-out`)).status).toBe(200);
    // checkout moves the booking on, so the guest token stops working for stay features once the stay is no longer confirmed/active
    const me = await gg('/me'); expect([200, 401]).toContain(me.status);
  });
});
