/** What every property management system connector must do. Apps never see a provider: they use these canonical shapes. */
export type StayStatus = 'RESERVED' | 'IN_HOUSE' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export interface PmsReservation { externalId: string; confirmationNo?: string; guestName: string; guestEmail?: string; guestPhone?: string; roomType?: string; roomNo?: string | null; arrival: string; departure: string; adults: number; children: number; status: StayStatus; rateCode?: string; balance?: number }
export interface PmsRoomState { roomNo: string; foStatus: 'VACANT' | 'OCCUPIED' | 'DUE_IN' | 'DUE_OUT'; hkStatus: 'CLEAN' | 'DIRTY' | 'INSPECTED' | 'OUT_OF_ORDER' }
export interface PmsCapabilities { pullReservations: boolean; roomStatus: boolean; checkInOut: boolean; postCharge: boolean; pushBooking: boolean; webhook: boolean }
export interface ConnectionCtx { id: string; supplierId: string; provider: string; config: Record<string, unknown>; secretRef: string | null }
export interface Charge { externalReservationId: string; code: string; amount: number; currency: string; description: string; idempotencyKey: string }

export interface PmsAdapter {
  readonly id: string;
  readonly capabilities: PmsCapabilities;
  testConnection(c: ConnectionCtx): Promise<{ ok: boolean; message: string }>;
  pullReservations(c: ConnectionCtx, w: { from: string; to: string; cursor?: string }): Promise<{ items: PmsReservation[]; cursor?: string }>;
  pullRoomStatus(c: ConnectionCtx): Promise<PmsRoomState[]>;
  checkIn(c: ConnectionCtx, externalId: string, roomNo: string): Promise<void>;
  checkOut(c: ConnectionCtx, externalId: string): Promise<void>;
  setHousekeeping(c: ConnectionCtx, roomNo: string, status: PmsRoomState['hkStatus']): Promise<void>;
  postCharge(c: ConnectionCtx, ch: Charge): Promise<{ externalId: string }>;
  pushBooking(c: ConnectionCtx, b: { bookingNo: string; guestName: string; arrival: string; departure: string; roomType?: string }): Promise<{ externalId: string }>;
}

export class AdapterError extends Error {
  constructor(message: string, public retryable = true) { super(message); }
}
const NONE = { pullReservations: false, roomStatus: false, checkInOut: false, postCharge: false, pushBooking: false, webhook: false };

/** For OPERA Cloud and VHP the real calls need the hotel's own credentials and the vendor's API specification.
 *  Until then they say so plainly instead of pretending. Planned mapping (confirm against the vendor documentation):
 *  OPERA Cloud (OHIP): reservations, housekeeping, cashiering charges. VHP: reservation, room status and posting interfaces. */
class NotConfigured implements PmsAdapter {
  capabilities = NONE;
  constructor(public id: string, private label: string) {}
  private no(): never { throw new AdapterError(`${this.label} is not set up. It needs the hotel's credentials and the vendor's API access.`, false); }
  async testConnection(c: ConnectionCtx) {
    if (!c.secretRef) return { ok: false, message: `Set the name of the server secret for ${this.label} first.` };
    if (!process.env[c.secretRef]) return { ok: false, message: `The server secret ${c.secretRef} is not set.` };
    return { ok: false, message: `${this.label} calls are not enabled in this build. The adapter needs the vendor's API specification and a test property.` };
  }
  async pullReservations(): Promise<never> { return this.no(); }
  async pullRoomStatus(): Promise<never> { return this.no(); }
  async checkIn(): Promise<never> { return this.no(); }
  async checkOut(): Promise<never> { return this.no(); }
  async setHousekeeping(): Promise<never> { return this.no(); }
  async postCharge(): Promise<never> { return this.no(); }
  async pushBooking(): Promise<never> { return this.no(); }
}
export const operaCloud = new NotConfigured('opera-cloud', 'OPERA Cloud');
export const vhp = new NotConfigured('vhp', 'VHP');
export const none = new NotConfigured('none', 'No PMS');
