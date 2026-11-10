import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, login, makeSupplier, PW, superSession, type Session } from './helpers.js';

let sup: Session; let s: Awaited<ReturnType<typeof makeSupplier>>;
beforeAll(async () => { sup = await superSession(); s = await makeSupplier(sup, 'auth'); });

describe('login', () => {
  it('returns a token, user and sets httpOnly refresh cookie', async () => {
    const r = await api().post('/api/v1/auth/login').send({ email: s.adminEmail, password: PW });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, errors: null });
    expect(r.body.data.user).toMatchObject({ role: 'SUPPLIER_ADMIN', supplierId: s.id });
    expect(JSON.stringify(r.body)).not.toContain('passwordHash');
    const refresh = (r.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refresh_token='))!;
    expect(refresh).toMatch(/HttpOnly/i); expect(refresh).toMatch(/SameSite=Strict/i);
  });
  it('gives the same answer for a wrong password and an unknown email', async () => {
    const a = await api().post('/api/v1/auth/login').send({ email: s.adminEmail, password: 'wrong-password-1' });
    const b = await api().post('/api/v1/auth/login').send({ email: 'nobody@example.test', password: 'wrong-password-1' });
    expect(a.status).toBe(401); expect(b.status).toBe(401); expect(a.body.message).toBe(b.body.message);
  });
  it('locks the account after 5 failed attempts, even for the right password', async () => {
    const t = await makeSupplier(sup, 'lock');
    for (let i = 0; i < 5; i++) expect((await api().post('/api/v1/auth/login').send({ email: t.staffEmail, password: 'bad-password-1' })).status).toBe(401);
    const r = await api().post('/api/v1/auth/login').send({ email: t.staffEmail, password: PW });
    expect(r.status).toBe(423);
  });
  it('refuses login when the supplier is suspended, and ends its sessions', async () => {
    const t = await makeSupplier(sup, 'susp');
    const r = await api().patch(`/api/v1/suppliers/${t.id}/status`).set(bearer(sup.token)).send({ status: 'SUSPENDED' });
    expect(r.status).toBe(200);
    expect((await api().post('/api/v1/auth/login').send({ email: t.adminEmail, password: PW })).status).toBe(403);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', t.admin.cookie).set('X-CSRF-Token', t.admin.csrf)).status).toBe(401);
  });
});

describe('tokens', () => {
  it('rejects missing, malformed and tampered tokens', async () => {
    expect((await api().get('/api/v1/hotel/hotels')).status).toBe(401);
    expect((await api().get('/api/v1/hotel/hotels').set(bearer('not.a.jwt'))).status).toBe(401);
    const [h, p, sig] = s.admin.token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p!, 'base64url').toString()), role: 'SUPER_ADMIN', supplierId: null })).toString('base64url');
    expect((await api().get('/api/v1/hotel/hotels').set(bearer(`${h}.${forged}.${sig}`))).status).toBe(401);
  });
  it('refresh needs the CSRF header, then rotates the token', async () => {
    const x = await login(s.adminEmail, PW);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', x.cookie)).status).toBe(403);
    const ok = await api().post('/api/v1/auth/refresh').set('Cookie', x.cookie).set('X-CSRF-Token', x.csrf);
    expect(ok.status).toBe(200); expect(ok.body.data.accessToken).toBeTruthy();
    const newRefresh = (ok.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refresh_token='))!.split(';')[0]!;
    expect(newRefresh).not.toBe(x.cookie.split('; ')[0]);
  });
  it('reusing an already-rotated refresh token revokes the whole session family', async () => {
    const x = await login(s.adminEmail, PW);
    const r1 = await api().post('/api/v1/auth/refresh').set('Cookie', x.cookie).set('X-CSRF-Token', x.csrf);
    const newCookie = `${(r1.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refresh_token='))!.split(';')[0]}; csrf_token=${x.csrf}`;
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', x.cookie).set('X-CSRF-Token', x.csrf)).status).toBe(401); // old token replayed
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', newCookie).set('X-CSRF-Token', x.csrf)).status).toBe(401); // family is dead
  });
  it('logout revokes the refresh token', async () => {
    const x = await login(s.adminEmail, PW);
    expect((await api().post('/api/v1/auth/logout').set('Cookie', x.cookie).set('X-CSRF-Token', x.csrf)).status).toBe(200);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', x.cookie).set('X-CSRF-Token', x.csrf)).status).toBe(401);
  });
});

describe('passwords', () => {
  it('forgot-password never reveals whether an email exists', async () => {
    const a = await api().post('/api/v1/auth/forgot-password').send({ email: s.adminEmail });
    const b = await api().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.test' });
    expect(a.status).toBe(200); expect(b.status).toBe(200); expect(a.body.message).toBe(b.body.message);
  });
  it('reset-password rejects an invalid token', async () => {
    expect((await api().post('/api/v1/auth/reset-password').send({ token: 'x'.repeat(43), password: 'NewPassw0rd!x' })).status).toBe(400);
  });
  it('enforces the password policy and the current password on change', async () => {
    const t = await makeSupplier(sup, 'pw');
    const weak = await api().post('/api/v1/auth/change-password').set(bearer(t.admin.token)).send({ currentPassword: PW, newPassword: 'short' });
    expect(weak.status).toBe(422);
    const wrong = await api().post('/api/v1/auth/change-password').set(bearer(t.admin.token)).send({ currentPassword: 'nope-nope-1', newPassword: 'BrandNew123!x' });
    expect(wrong.status).toBe(403);
    const ok = await api().post('/api/v1/auth/change-password').set(bearer(t.admin.token)).send({ currentPassword: PW, newPassword: 'BrandNew123!x' });
    expect(ok.status).toBe(200);
    expect((await api().post('/api/v1/auth/login').send({ email: t.adminEmail, password: PW })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: t.adminEmail, password: 'BrandNew123!x' })).status).toBe(200);
  });
});
