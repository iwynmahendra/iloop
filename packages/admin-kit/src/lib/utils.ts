import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...i: ClassValue[]) => twMerge(clsx(i));
export const debounceMs = 300;
export function fmtDate(v?: string | null, withTime = false) {
  if (!v) return '';
  const d = new Date(v); if (Number.isNaN(d.getTime())) return String(v);
  return withTime ? d.toLocaleString() : d.toISOString().slice(0, 10);
}
export function fmtNumber(v: unknown) {
  const n = Number(v); if (!Number.isFinite(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
export const humanize = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
