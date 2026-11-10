import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, hotelBody, makeSupplier, superSession, uniq, type Session } from './helpers.js';

let T: Awaited<ReturnType<typeof makeSupplier>>; let tok: Record<string, string>; let sup: Session;
beforeAll(async () => { sup = await superSession(); T = await makeSupplier(sup, 'crud'); tok = bearer(T.admin.token); });

describe('response format and validation', () => {
  it('uses the standard envelope with pagination meta', async () => {
    for (let i = 0; i < 3; i++) await api().post('/api/v1/hotel/hotels').set(tok).send(hotelBody());
    const r = await api().get('/api/v1/hotel/hotels').set(tok).query({ limit: 2, page: 1, sort: 'createdAt:desc' });
    expect(r.body).toMatchObject({ success: true, errors: null, meta: { page: 1, limit: 2, total: 3 } }); expect(r.body.data).toHaveLength(2);
  });
  it('validates input with field-level errors', async () => {
    const r = await api().post('/api/v1/hotel/hotels').set(tok).send({ code: 'X', name: '', countryCode: 'INDONESIA', currencyCode: 'IDR', starRating: 9 });
    expect(r.status).toBe(422); expect(r.body.success).toBe(false);
    const fields = r.body.errors.map((e: any) => e.field); expect(fields).toEqual(expect.arrayContaining(['name', 'countryCode']));
  });
  it('rejects bad sort and filter values instead of passing them to the database', async () => {
    expect((await api().get('/api/v1/hotel/hotels').set(tok).query({ sort: 'passwordHash:asc' })).status).toBe(422);
    expect((await api().get('/api/v1/hotel/hotels').set(tok).query({ limit: 5000 })).status).toBe(422);
  });
  it('survives SQL-injection-looking input (parameterised queries)', async () => {
    const r = await api().get('/api/v1/hotel/hotels').set(tok).query({ q: "'; DROP TABLE hotels; --" });
    expect(r.status).toBe(200);
    expect((await api().get('/api/v1/hotel/hotels').set(tok)).body.meta.total).toBeGreaterThan(0);
  });
  it('stores markup as text and returns it unchanged (output escaping is the UI\'s job)', async () => {
    const r = await api().post('/api/v1/hotel/hotels').set(tok).send({ ...hotelBody(), name: '<img src=x onerror=alert(1)>' });
    expect(r.status).toBe(201); expect(r.body.data.name).toBe('<img src=x onerror=alert(1)>');
  });
  it('returns 404 JSON for unknown routes and malformed ids', async () => {
    expect((await api().get('/api/v1/nope').set(tok)).status).toBe(404);
    expect((await api().get('/api/v1/hotel/hotels/not-a-uuid').set(tok)).status).toBe(404);
  });
});

describe('codes, soft delete and restore', () => {
  it('keeps codes unique per supplier, including soft-deleted rows', async () => {
    const code = uniq('U');
    const a = await api().post('/api/v1/hotel/hotels').set(tok).send(hotelBody(code)); expect(a.status).toBe(201);
    expect((await api().post('/api/v1/hotel/hotels').set(tok).send(hotelBody(code))).status).toBe(409);
    await api().delete(`/api/v1/hotel/hotels/${a.body.data.id}`).set(tok);
    expect((await api().post('/api/v1/hotel/hotels').set(tok).send(hotelBody(code))).status).toBe(409);
    // another supplier may reuse the same code
    const other = await makeSupplier(sup, 'crud2');
    expect((await api().post('/api/v1/hotel/hotels').set(bearer(other.admin.token)).send(hotelBody(code))).status).toBe(201);
  });
  it('hides deleted rows by default and restores them', async () => {
    const c = await api().post('/api/v1/hotel/hotels').set(tok).send(hotelBody()); const id = c.body.data.id;
    expect((await api().delete(`/api/v1/hotel/hotels/${id}`).set(tok)).status).toBe(200);
    expect((await api().get(`/api/v1/hotel/hotels/${id}`).set(tok).query({})).body.data.deletedAt).toBeTruthy();
    const def = await api().get('/api/v1/hotel/hotels').set(tok).query({ limit: 100 });
    expect(def.body.data.map((h: any) => h.id)).not.toContain(id);
    const only = await api().get('/api/v1/hotel/hotels').set(tok).query({ deleted: 'only' });
    expect(only.body.data.map((h: any) => h.id)).toContain(id);
    expect((await api().post(`/api/v1/hotel/hotels/${id}/restore`).set(tok)).status).toBe(200);
    expect((await api().patch(`/api/v1/hotel/hotels/${id}/status`).set(tok).send({ status: 'INACTIVE' })).body.data.status).toBe('INACTIVE');
  });
  it('writes an audit row with before and after for an update', async () => {
    const c = await api().post('/api/v1/hotel/hotels').set(tok).send(hotelBody()); const id = c.body.data.id;
    await api().patch(`/api/v1/hotel/hotels/${id}`).set(tok).send({ name: 'Changed' });
    const a = await api().get('/api/v1/audit-logs').set(tok).query({ entityId: id, action: 'UPDATE' });
    expect(a.body.data).toHaveLength(1);
    expect(a.body.data[0].before.name).not.toBe('Changed'); expect(a.body.data[0].after.name).toBe('Changed'); expect(a.body.data[0].userEmail).toBe(T.adminEmail);
  });
});

describe('data rules enforced by the database', () => {
  it('rejects overlapping rate plans and reversed dates with a clear status', async () => {
    const h = (await api().post('/api/v1/hotel/hotels').set(tok).send(hotelBody())).body.data;
    const rt = (await api().post('/api/v1/hotel/room-types').set(tok).send({ hotelId: h.id, code: 'R', name: 'R', basePrice: 100, currencyCode: 'IDR' })).body.data;
    const plan = (code: string, from: string, to: string) => api().post('/api/v1/hotel/rate-plans').set(tok).send({ roomTypeId: rt.id, code, name: code, dateFrom: from, dateTo: to, price: 10, currencyCode: 'IDR' });
    expect((await plan('P1', '2027-03-01', '2027-03-10')).status).toBe(201);
    expect((await plan('P2', '2027-03-05', '2027-03-15')).status).toBe(409);
    expect((await plan('P3', '2027-04-10', '2027-04-01')).status).toBe(422);
  });
  it('replaces amenities and gallery sets, rejecting foreign ids', async () => {
    const h = (await api().post('/api/v1/hotel/hotels').set(tok).send(hotelBody())).body.data;
    const am = await api().get('/api/v1/shared/amenities').set(tok).query({ scope: 'HOTEL', limit: 3 });
    const ids = am.body.data.map((a: any) => a.id);
    const put = await api().put(`/api/v1/hotel/hotels/${h.id}/amenities`).set(tok).send({ amenityIds: ids });
    expect(put.status).toBe(200); expect(put.body.data).toHaveLength(ids.length);
    expect((await api().put(`/api/v1/hotel/hotels/${h.id}/amenities`).set(tok).send({ amenityIds: ['3f2a8b1c-1111-4111-8111-111111111111'] })).status).toBe(422);
  });
});

describe('uploads and import', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  it('accepts a real image and refuses SVG/HTML renamed to .png', async () => {
    const ok = await api().post('/api/v1/shared/media-assets/upload').set(tok).attach('files', png, { filename: 'a.png', contentType: 'image/png' });
    expect(ok.status).toBe(201); expect(ok.body.data[0]).toMatchObject({ mimeType: 'image/png', width: 1, height: 1 });
    const bad = await api().post('/api/v1/shared/media-assets/upload').set(tok).attach('files', Buffer.from('<svg onload=alert(1)>'), { filename: 'b.png', contentType: 'image/png' });
    expect(bad.status).toBe(415);
  });
  it('imports CSV all-or-nothing', async () => {
    const h = (await api().post('/api/v1/hotel/hotels').set(tok).send(hotelBody())).body.data;
    const c1 = uniq('I1'), c2 = uniq('I2');
    const good = `hotelId,code,name,basePrice,currencyCode\n${h.id},${c1},One,10,IDR\n${h.id},${c2},Two,20,IDR\n`;
    expect((await api().post('/api/v1/hotel/room-types/import').query({ dryRun: 'true' }).set(tok).attach('file', Buffer.from(good), 'a.csv')).status).toBe(200);
    expect((await api().post('/api/v1/hotel/room-types/import').set(tok).attach('file', Buffer.from(good), 'a.csv')).status).toBe(201);
    const c3 = uniq('I3');
    const bad = `hotelId,code,name,basePrice,currencyCode\n${h.id},${c3},Ok,10,IDR\n${h.id},${uniq('I4')},Bad,-x,IDRR\n`;
    const r = await api().post('/api/v1/hotel/room-types/import').set(tok).attach('file', Buffer.from(bad), 'b.csv');
    expect(r.status).toBe(422);
    expect((await api().get('/api/v1/hotel/room-types').set(tok).query({ q: c3 })).body.meta.total).toBe(0);
  });
});
