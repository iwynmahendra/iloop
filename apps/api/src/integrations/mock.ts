import { type Charge, type ConnectionCtx, type PmsAdapter, type PmsReservation, type PmsRoomState } from './adapter.js';

/** A small, predictable hotel for sandbox and tests. State is kept in memory per process. */
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const seed = (): PmsReservation[] => [
  { externalId: 'M-1001', confirmationNo: 'C1001', guestName: 'Emma Hartley', guestEmail: 'emma@example.test', roomType: 'Deluxe', roomNo: '201', arrival: day(-1), departure: day(2), adults: 2, children: 0, status: 'IN_HOUSE', rateCode: 'BAR', balance: 1250000 },
  { externalId: 'M-1002', confirmationNo: 'C1002', guestName: 'Kenji Watanabe', roomType: 'Suite', roomNo: null, arrival: day(0), departure: day(3), adults: 2, children: 1, status: 'RESERVED', rateCode: 'BB', balance: 0 },
  { externalId: 'M-1003', confirmationNo: 'C1003', guestName: 'Sofia Marchetti', roomType: 'Deluxe', roomNo: '203', arrival: day(-3), departure: day(0), adults: 1, children: 0, status: 'IN_HOUSE', rateCode: 'BAR', balance: 480000 },
  { externalId: 'M-1004', confirmationNo: 'C1004', guestName: 'Liam Novak', roomType: 'Standard', roomNo: null, arrival: day(2), departure: day(4), adults: 2, children: 0, status: 'RESERVED', rateCode: 'RO', balance: 0 },
];
export class MockPms implements PmsAdapter {
  id = 'mock';
  capabilities = { pullReservations: true, roomStatus: true, checkInOut: true, postCharge: true, pushBooking: true, webhook: true };
  res = seed();
  rooms = new Map<string, PmsRoomState>([['201', { roomNo: '201', foStatus: 'OCCUPIED', hkStatus: 'CLEAN' }], ['202', { roomNo: '202', foStatus: 'VACANT', hkStatus: 'DIRTY' }], ['203', { roomNo: '203', foStatus: 'DUE_OUT', hkStatus: 'CLEAN' }]]);
  charges = new Map<string, string>();
  calls: string[] = [];
  failNext = 0;
  private boom() { if (this.failNext > 0) { this.failNext--; throw new Error('Mock PMS is unavailable'); } }
  async testConnection(_c: ConnectionCtx) { this.boom(); return { ok: true, message: 'Mock PMS reachable (sandbox hotel with 4 reservations).' }; }
  async pullReservations(_c: ConnectionCtx, w: { from: string; to: string }) { this.boom(); return { items: this.res.filter((r) => r.departure >= w.from && r.arrival <= w.to) }; }
  async pullRoomStatus() { this.boom(); return [...this.rooms.values()]; }
  async checkIn(_c: ConnectionCtx, id: string, roomNo: string) { this.boom(); const r = this.res.find((x) => x.externalId === id); if (!r) throw new Error('Unknown reservation'); r.status = 'IN_HOUSE'; r.roomNo = roomNo; this.rooms.set(roomNo, { roomNo, foStatus: 'OCCUPIED', hkStatus: 'CLEAN' }); this.calls.push(`checkIn:${id}:${roomNo}`); }
  async checkOut(_c: ConnectionCtx, id: string) { this.boom(); const r = this.res.find((x) => x.externalId === id); if (!r) throw new Error('Unknown reservation'); r.status = 'CHECKED_OUT'; if (r.roomNo) this.rooms.set(r.roomNo, { roomNo: r.roomNo, foStatus: 'VACANT', hkStatus: 'DIRTY' }); this.calls.push(`checkOut:${id}`); }
  async setHousekeeping(_c: ConnectionCtx, roomNo: string, s: PmsRoomState['hkStatus']) { this.boom(); const cur = this.rooms.get(roomNo) ?? { roomNo, foStatus: 'VACANT' as const, hkStatus: s }; this.rooms.set(roomNo, { ...cur, hkStatus: s }); this.calls.push(`hk:${roomNo}:${s}`); }
  async postCharge(_c: ConnectionCtx, ch: Charge) { this.boom(); const had = this.charges.get(ch.idempotencyKey); if (had) return { externalId: had }; const id = 'CHG-' + (this.charges.size + 1); this.charges.set(ch.idempotencyKey, id); this.calls.push(`charge:${ch.idempotencyKey}`); return { externalId: id }; }
  async pushBooking(_c: ConnectionCtx, b: { bookingNo: string }) { this.boom(); this.calls.push(`push:${b.bookingNo}`); return { externalId: 'PB-' + b.bookingNo }; }
}
export const mockPms = new MockPms();
