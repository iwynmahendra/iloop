import { config } from '../config.js';
import { withDb } from '../db.js';
import { logger } from '../logger.js';
import { expireHolds } from './lifecycle.js';

/** Expires overdue pending bookings in the background. Runs as SUPER_ADMIN so it sees every supplier. */
export function startSweeper() {
  if (config.NODE_ENV === 'test' || !config.HOLD_SWEEP_SECONDS) return () => {};
  let busy = false;
  const t = setInterval(async () => {
    if (busy) return; busy = true;
    try {
      const n = await withDb({ role: 'SUPER_ADMIN', supplierId: null }, (tx) => expireHolds(tx));
      if (n) logger.info({ expired: n }, 'Expired overdue booking holds');
    } catch (err) { logger.error({ err }, 'Hold sweeper failed'); } finally { busy = false; }
  }, config.HOLD_SWEEP_SECONDS * 1000);
  t.unref();
  return () => clearInterval(t);
}
