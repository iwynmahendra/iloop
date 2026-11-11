import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from './config.js';
import { withDb } from './db.js';
import { logger } from './logger.js';
import { expireHolds } from './booking/lifecycle.js';
import { deliverEmails } from './booking/notify.js';
import { processEvents } from './integrations/worker.js';

/**
 * Serverless hosts (Vercel) have no background timers, so a scheduler (Supabase pg_cron) calls this once a minute.
 * Does one pass of the same three jobs server.ts runs on timers. Off (404) unless CRON_SECRET is set.
 */
export const cronRouter = Router();
cronRouter.all('/run', async (req, res, next) => {
  const want = config.CRON_SECRET ? Buffer.from(`Bearer ${config.CRON_SECRET}`) : null;
  const got = Buffer.from(req.get('authorization') ?? '');
  if (!want) return next();
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return res.status(401).json({ error: { message: 'Unauthorized' } });
  const out: Record<string, number | string> = {};
  const run = async (name: string, on: number, fn: () => Promise<number>) => {
    if (!on) return;
    try { out[name] = await fn(); } catch (err) { out[name] = 'failed'; logger.error({ err }, `Cron job ${name} failed`); }
  };
  await run('expiredHolds', config.HOLD_SWEEP_SECONDS, () => withDb({ role: 'SUPER_ADMIN', supplierId: null }, (tx) => expireHolds(tx)));
  await run('emailsSent', config.EMAIL_SEND_SECONDS, () => deliverEmails());
  await run('integrationEvents', config.INTEGRATION_WORKER_SECONDS, () => processEvents());
  res.json({ ok: true, ...out });
});
