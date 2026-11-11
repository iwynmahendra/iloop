import { describe, expect, it } from 'vitest';

// Set before the app (and its config) loads; each test file runs in its own process.
const SECRET = 'cron-secret-cron-secret-cron-secret-1234';
process.env.CRON_SECRET = SECRET;
const { api } = await import('./helpers.js');

describe('cron endpoint (serverless jobs)', () => {
  it('refuses a missing or wrong secret', async () => {
    expect((await api().post('/api/v1/cron/run')).status).toBe(401);
    expect((await api().post('/api/v1/cron/run').set('Authorization', 'Bearer nope')).status).toBe(401);
    expect((await api().post('/api/v1/cron/run').set('Authorization', `Bearer ${SECRET}x`)).status).toBe(401);
  });
  it('runs one pass of the jobs with the right secret', async () => {
    const r = await api().get('/api/v1/cron/run').set('Authorization', `Bearer ${SECRET}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ ok: true });
    for (const k of ['expiredHolds', 'emailsSent', 'integrationEvents']) expect(typeof r.body[k]).toBe('number');
  });
});
