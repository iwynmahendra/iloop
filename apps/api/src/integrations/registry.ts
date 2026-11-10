import { type PmsAdapter, none, operaCloud, vhp } from './adapter.js';
import { mockPms } from './mock.js';

export const PMS_PROVIDERS = ['mock', 'opera-cloud', 'vhp', 'none'] as const;
export const pmsFor = (provider: string): PmsAdapter => (provider === 'mock' ? mockPms : provider === 'opera-cloud' ? operaCloud : provider === 'vhp' ? vhp : none);

/** Non-secret settings per provider. Unknown keys are refused, so nobody pastes a password into config by mistake. */
export const CONFIG_KEYS: Record<string, string[]> = {
  pms: ['baseUrl', 'hotelCode', 'chainCode', 'postCharges', 'writeBack', 'ratesMaster', 'syncDaysBack', 'syncDaysAhead'],
  other: ['baseUrl', 'accountId', 'mode'],
};
export const SECRETISH = /pass|secret|token|key|pwd|credential/i;
