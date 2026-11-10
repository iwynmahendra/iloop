import type { Tx } from '../db.js';

export const TOPICS = ['booking.created', 'booking.status_changed', 'stay.checked_in', 'stay.checked_out', 'room.status_changed', 'charge.posted', 'request.created', 'inventory.changed', 'rate.changed', 'payment.succeeded'] as const;
export const PMS_COMMANDS = ['pms.post_charge', 'pms.push_booking', 'pms.check_in', 'pms.check_out', 'pms.room_status'] as const;

/** Queues one OUT event per active webhook that listens to the topic. Runs inside the caller's transaction, so an
 *  event exists if and only if the change committed. Repeating the same key does nothing. */
export async function emit(tx: Tx, supplierId: string, topic: string, payload: object, key: string) {
  const hooks = await tx.webhookEndpoint.findMany({ where: { supplierId, active: true, OR: [{ topics: { has: topic } }, { topics: { has: '*' } }] }, select: { id: true } });
  if (!hooks.length) return 0;
  const r = await tx.integrationEvent.createMany({ data: hooks.map((h) => ({ supplierId, webhookId: h.id, direction: 'OUT' as const, topic, idempotencyKey: `${key}:${h.id}`, payload })), skipDuplicates: true });
  return r.count;
}

/** Queues a command for every connected, enabled PMS connection that has it switched on in its config. */
export async function queuePms(tx: Tx, supplierId: string, command: (typeof PMS_COMMANDS)[number], payload: object, key: string, flag?: string) {
  const conns = await tx.integrationConnection.findMany({ where: { supplierId, kind: 'PMS', enabled: true, status: 'CONNECTED' } });
  const use = conns.filter((c) => !flag || (c.config as Record<string, unknown>)[flag] === true);
  if (!use.length) return 0;
  const r = await tx.integrationEvent.createMany({ data: use.map((c) => ({ supplierId, connectionId: c.id, direction: 'OUT' as const, topic: command, idempotencyKey: `${key}:${c.id}`, payload })), skipDuplicates: true });
  return r.count;
}

export const backoffSeconds = (attempts: number) => 30 * 2 ** Math.min(attempts, 8);
export const MAX_EVENT_ATTEMPTS = 6;
