import { Card, EmptyState, Field, Input, NewBookingShell, Select, Spinner, addDaysStr, hm, money, today, useGet, useOptions } from '@booking/admin-kit';
import { useState } from 'react';

export default function NewBooking() {
  const trips = useOptions('/trips/trips', 'title');
  const [tripId, setTrip] = useState(''); const [from, setFrom] = useState(today());
  const [adults, setAdults] = useState(2); const [children, setChildren] = useState(0);
  const [scheduleId, setSch] = useState(''); const [variantId, setVar] = useState(''); const [pickup, setPickup] = useState(''); const [addons, setAddons] = useState<Record<string, number>>({});
  const tid = tripId || trips.options[0]?.id;
  const av = useGet<any>(tid ? '/availability/trips' : null, { tripId: tid, from, to: addDaysStr(from, 30), pax: adults + children });
  const variant = av.data?.variants.find((v: any) => v.id === variantId) ?? av.data?.variants[0];
  const sch = av.data?.departures.find((d: any) => d.scheduleId === scheduleId);
  const est = variant ? Number(variant.adultPrice ?? 0) * adults + Number(variant.childPrice ?? variant.adultPrice ?? 0) * children + (av.data?.addons ?? []).reduce((a: number, x: any) => a + (addons[x.id] ?? 0) * Number(x.price ?? 0), 0) : 0;
  return <NewBookingShell product="TRIP" listPath="/bookings" disabled={!sch?.canBook}
    build={() => !sch ? 'Choose a departure' : !sch.canBook ? 'Not enough seats on that departure' : !variant ? 'Choose an option' : { scheduleId, variantId: variant.id, adults, children, addons: Object.entries(addons).filter(([, n]) => n > 0).map(([addonId, quantity]) => ({ addonId, quantity })), pickupAddress: pickup.trim() || undefined }}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Trip">{(id) => <Select id={id} value={tid ?? ''} onChange={(e) => { setTrip(e.target.value); setSch(''); setVar(''); }}>{trips.options.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>}</Field>
      <Field label="Show departures from">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
      <Field label="Adults">{(id) => <Input id={id} type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />}</Field>
      <Field label="Children">{(id) => <Input id={id} type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />}</Field></div>
    {av.isLoading ? <Spinner /> : !av.data?.departures.length ? <EmptyState title="No departures in the next 30 days" /> : <fieldset className="space-y-2"><legend className="mb-1 text-sm font-medium">Departure</legend>
      {av.data.departures.map((d: any) => <label key={d.scheduleId} className={`flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm ${scheduleId === d.scheduleId ? 'border-primary bg-primary/5' : ''} ${d.canBook ? '' : 'opacity-50'}`}>
        <span className="flex items-center gap-2"><input type="radio" name="dep" disabled={!d.canBook} checked={scheduleId === d.scheduleId} onChange={() => setSch(d.scheduleId)} />{String(d.date).slice(0, 10)} · {hm(d.startTime)}</span><span className="text-xs text-muted-foreground">{d.remaining} seats left</span></label>)}</fieldset>}
    {!!av.data?.variants.length && <Field label="Option">{(id) => <Select id={id} value={variant?.id ?? ''} onChange={(e) => setVar(e.target.value)}>{av.data.variants.map((v: any) => <option key={v.id} value={v.id}>{v.name} · {money(v.adultPrice, v.currencyCode)} adult</option>)}</Select>}</Field>}
    {!!av.data?.addons.length && <fieldset className="space-y-1"><legend className="mb-1 text-sm font-medium">Add-ons</legend>{av.data.addons.map((a: any) => <div key={a.id} className="flex items-center justify-between gap-3 text-sm"><span>{a.name} <span className="text-xs text-muted-foreground">{money(a.price, a.currencyCode)}</span></span><Input aria-label={`${a.name} quantity`} className="w-20" type="number" min={0} value={addons[a.id] ?? 0} onChange={(e) => setAddons({ ...addons, [a.id]: Math.max(0, Number(e.target.value) || 0) })} /></div>)}</fieldset>}
    <Field label="Pickup address">{(id) => <Input id={id} value={pickup} onChange={(e) => setPickup(e.target.value)} maxLength={500} />}</Field>
    {variant && <Card className="bg-muted/40 p-3 text-sm">Estimated total: <strong>{money(est, variant.currencyCode)}</strong> <span className="text-muted-foreground">(final price is calculated by the server)</span></Card>}
  </NewBookingShell>;
}
