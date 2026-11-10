export type Product = 'HOTEL' | 'TRIP' | 'TRANSPORT' | 'CLUB';
export const PRODUCT_LABEL: Record<Product, string> = { HOTEL: 'Hotel', TRIP: 'Trip', TRANSPORT: 'Transport', CLUB: 'Club' };
export const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW'] as const;
export const PAY_STATUSES = ['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const;
export const SOURCES = ['ADMIN', 'WEBSITE', 'OTA', 'CONCIERGE', 'PHONE', 'WALK_IN'] as const;
export const CREATE_SOURCES = ['ADMIN', 'PHONE', 'WALK_IN', 'WEBSITE', 'CONCIERGE'] as const;
export const METHODS = ['CASH', 'BANK_TRANSFER', 'CARD', 'E_WALLET', 'QRIS', 'ROOM_CHARGE', 'OTHER'] as const;

export const money = (v: unknown, cur = 'IDR') => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return String(v ?? '');
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'IDR', maximumFractionDigits: cur === 'IDR' ? 0 : 2 }).format(n); } catch { return `${cur} ${n.toLocaleString()}`; }
};
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(new Date());
export const addDaysStr = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
export const dt = (v?: string | Date | null) => { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); };
export const day = (v?: string | Date | null) => { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10); };
export const hm = (v?: string | null) => (v ? String(v).slice(0, 5) : '');
const ACR = new Set(['OTA', 'QRIS', 'API', 'PMS', 'IN', 'OUT']);
export const label = (s?: string | null) => (s ? (ACR.has(s) ? s : s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())) : '');
export const statusTone = (s: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' =>
  ({ CONFIRMED: 'success', COMPLETED: 'info', PENDING: 'warning', CANCELLED: 'danger', EXPIRED: 'neutral', NO_SHOW: 'danger', PAID: 'success', PARTIAL: 'warning', UNPAID: 'danger', REFUNDED: 'neutral', PARTIALLY_REFUNDED: 'neutral' } as const)[s as 'PAID'] ?? 'neutral';
/** local datetime-local value → ISO with the browser's UTC offset (the API wants an offset). */
export const toIsoOffset = (local: string) => (local ? new Date(local).toISOString() : '');
