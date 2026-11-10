import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field, Input, Select, Switch, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { CREATE_SOURCES, label, PRODUCT_LABEL, type Product } from './fmt';
import { useAct, useList } from './hooks';

/** Lookup list for dropdowns: GET /<group>/<path>?limit=100 → [{id, label}] */
export function useOptions(path: string, labelKey = 'name') {
  const q = useList<any>(path, { limit: 100, sort: `${labelKey}:asc` });
  return { ...q, options: (q.data?.data ?? []) as any[] };
}

export interface GuestState { guestName: string; guestEmail: string; guestPhone: string; guestCountryCode: string; source: string; roomNumber: string; specialRequests: string; internalNotes: string; confirm: boolean }
export const emptyGuest: GuestState = { guestName: '', guestEmail: '', guestPhone: '', guestCountryCode: '', source: 'ADMIN', roomNumber: '', specialRequests: '', internalNotes: '', confirm: false };

/** Wraps a product form: guest block + submit. `build()` returns the product-specific body fields, or a string error. */
export default function NewBookingShell({ product, children, build, listPath = '/bookings', disabled }: { product: Product; children: ReactNode; build: () => Record<string, unknown> | string; listPath?: string; disabled?: boolean }) {
  const nav = useNavigate();
  const [g, setG] = useState<GuestState>(emptyGuest); const [err, setErr] = useState<string | null>(null);
  const create = useAct((body: Record<string, unknown>) => api<any>('/bookings', { method: 'POST', body }), 'Booking created', (r) => nav(`${listPath}?open=${r.data.id}`));
  const set = (k: keyof GuestState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setG({ ...g, [k]: e.target.value });
  const submit = () => {
    const p = build(); if (typeof p === 'string') { setErr(p); return; } setErr(null);
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    create.mutate({ product, ...p, guestName: g.guestName.trim(), guestEmail: opt(g.guestEmail), guestPhone: opt(g.guestPhone), guestCountryCode: opt(g.guestCountryCode), source: g.source, roomNumber: opt(g.roomNumber), specialRequests: opt(g.specialRequests), internalNotes: opt(g.internalNotes), confirm: g.confirm });
  };
  return (
    <form className="mx-auto max-w-3xl space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div><h1 className="text-xl font-semibold">New {PRODUCT_LABEL[product].toLowerCase()} booking</h1><p className="text-sm text-muted-foreground">Availability is checked when you save. Unconfirmed bookings hold the inventory for a limited time.</p></div>
      <Card className="space-y-4 p-4"><h2 className="text-sm font-semibold">{PRODUCT_LABEL[product]} details</h2>{children}</Card>
      <Card className="space-y-3 p-4"><h2 className="text-sm font-semibold">Guest</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" required>{(id) => <Input id={id} value={g.guestName} onChange={set('guestName')} maxLength={150} />}</Field>
          <Field label="Email">{(id) => <Input id={id} type="email" value={g.guestEmail} onChange={set('guestEmail')} />}</Field>
          <Field label="Phone">{(id) => <Input id={id} value={g.guestPhone} onChange={set('guestPhone')} />}</Field>
          <Field label="Country (2 letters)">{(id) => <Input id={id} maxLength={2} value={g.guestCountryCode} onChange={(e) => setG({ ...g, guestCountryCode: e.target.value.toUpperCase() })} />}</Field>
          <Field label="Source">{(id) => <Select id={id} value={g.source} onChange={set('source')}>{CREATE_SOURCES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}</Field>
          <Field label="Room number (in-house guests)">{(id) => <Input id={id} value={g.roomNumber} onChange={set('roomNumber')} maxLength={20} />}</Field>
        </div>
        <Field label="Special requests">{(id) => <Textarea id={id} rows={2} value={g.specialRequests} onChange={set('specialRequests')} maxLength={2000} />}</Field>
        <Field label="Internal notes">{(id) => <Textarea id={id} rows={2} value={g.internalNotes} onChange={set('internalNotes')} maxLength={2000} />}</Field>
        <div className="flex items-center gap-2 text-sm"><Switch label="Confirm immediately" checked={g.confirm} onChange={(v) => setG({ ...g, confirm: v })} /><span>Confirm immediately <span className="text-muted-foreground">(otherwise it stays pending with a hold)</span></span></div>
      </Card>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => nav(listPath)}>Cancel</Button><Button type="submit" loading={create.isPending} disabled={disabled || !g.guestName.trim()}>Create booking</Button></div>
    </form>
  );
}
