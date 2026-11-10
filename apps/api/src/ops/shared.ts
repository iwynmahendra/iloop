import type { Request, RequestHandler } from 'express';
import { withDb } from '../db.js';
import { ok } from '../http.js';

export type T = Parameters<Parameters<typeof withDb>[1]>[0];
type H = (req: Request) => Promise<{ data: unknown; message?: string; status?: number; meta?: { page: number; limit: number; total: number } }>;
export const h = (fn: H): RequestHandler => async (req, res, next) => { try { const r = await fn(req); ok(res, r.data, r.message ?? 'OK', r.meta, r.status ?? 200); } catch (e) { next(e); } };

export const DEPARTMENTS = ['Housekeeping', 'Maintenance', 'Front desk', 'F&B', 'Security', 'Spa'] as const;
export const ROOM_STATUS = ['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'OUT_OF_ORDER'] as const;
export const TASK_STATUS = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const;
export const ORDER_STATUS = ['NEW', 'PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'] as const;
/** Minutes a guest request may stay open before it is "past target". */
export const SLA_MIN = { URGENT: 15, NORMAL: 30 } as const;

/** What a guest can ask for. `dept` decides who gets the task, `flow` is the progress the guest sees. */
export interface Service { key: string; icon: string; name: string; dept: (typeof DEPARTMENTS)[number]; fields: { label: string; type: 'select' | 'text' | 'time'; options?: string[] }[]; flow: string[] }
const STD = ['Received', 'Assigned', 'In progress', 'Done'];
export const SERVICES: Service[] = [
  { key: 'towels', icon: '🧺', name: 'Extra towels', dept: 'Housekeeping', fields: [{ label: 'Quantity', type: 'select', options: ['1', '2', '3', '4'] }, { label: 'Note', type: 'text' }], flow: STD },
  { key: 'pillows', icon: '🛏️', name: 'Pillows and blankets', dept: 'Housekeeping', fields: [{ label: 'What do you need?', type: 'select', options: ['Extra pillow', 'Firm pillow', 'Extra blanket'] }, { label: 'Note', type: 'text' }], flow: STD },
  { key: 'cleaning', icon: '✨', name: 'Room cleaning', dept: 'Housekeeping', fields: [{ label: 'When', type: 'select', options: ['Now', 'In 1 hour', 'This afternoon', 'Tomorrow morning'] }], flow: STD },
  { key: 'laundry', icon: '👔', name: 'Laundry pickup', dept: 'Housekeeping', fields: [{ label: 'Pickup time', type: 'time' }, { label: 'Note', type: 'text' }], flow: STD },
  { key: 'wakeup', icon: '⏰', name: 'Wake-up call', dept: 'Front desk', fields: [{ label: 'Time', type: 'time' }], flow: STD },
  { key: 'late-checkout', icon: '🧳', name: 'Late checkout', dept: 'Front desk', fields: [{ label: 'Leave by', type: 'select', options: ['13:00', '14:00', '15:00', '16:00'] }], flow: ['Pending approval', 'Approved'] },
  { key: 'transfer', icon: '🚐', name: 'Airport transfer', dept: 'Front desk', fields: [{ label: 'Pickup time', type: 'time' }, { label: 'Passengers', type: 'select', options: ['1', '2', '3', '4', '5+'] }, { label: 'Flight number', type: 'text' }], flow: ['Requested', 'Driver assigned', 'Confirmed'] },
  { key: 'problem', icon: '🔧', name: 'Report a problem', dept: 'Maintenance', fields: [{ label: "What's wrong?", type: 'text' }], flow: STD },
  { key: 'cot', icon: '👶', name: 'Baby cot', dept: 'Housekeeping', fields: [{ label: 'Note', type: 'text' }], flow: STD },
  { key: 'concierge', icon: '💬', name: 'Ask the concierge', dept: 'Front desk', fields: [{ label: 'Your question', type: 'text' }], flow: ['Sent', 'Concierge replied'] },
];
/** Which step of a service's flow the guest should see for a task. */
export function guestStep(flow: string[], status: string, assigned: boolean) {
  const n = flow.length;
  if (status === 'DONE') return n - 1;
  if (n === 4) return status === 'IN_PROGRESS' ? 2 : assigned ? 1 : 0;
  return status === 'IN_PROGRESS' ? Math.min(1, n - 1) : 0;
}

export const newRef = (prefix: string) => `${prefix}-${new Date().toISOString().slice(2, 4)}${new Date().toISOString().slice(5, 7)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export const logEntry = (by: string, message: string) => ({ at: new Date().toISOString(), by, message });
export const appendLog = (log: unknown, e: ReturnType<typeof logEntry>) => [...(Array.isArray(log) ? log : []), e].slice(-100);
