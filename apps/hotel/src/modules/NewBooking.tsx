import { Card, EmptyState, Field, Input, NewBookingShell, Select, Spinner, addDaysStr, money, today, useGet, useOptions } from '@booking/admin-kit';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function NewBooking() {
  const [sp] = useSearchParams();
  const hotels = useOptions('/hotel/hotels');
  const [hotelId, setHotel] = useState(sp.get('hotelId') ?? ''); const [checkIn, setIn] = useState(sp.get('checkIn') ?? today()); const [checkOut, setOut] = useState(sp.get('checkOut') ?? addDaysStr(today(), 1));
  const [rooms, setRooms] = useState(Number(sp.get('rooms') ?? 1)); const [adults, setAdults] = useState(2); const [children, setChildren] = useState(0);
  const [roomTypeId, setRT] = useState(sp.get('roomTypeId') ?? ''); const [ratePlanId, setRP] = useState('');
  const hid = hotelId || hotels.options[0]?.id; const ok = !!hid && checkOut > checkIn;
  const av = useGet<any>(ok ? '/availability/hotel' : null, { hotelId: hid, checkIn, checkOut, rooms });
  const rt = av.data?.roomTypes.find((r: any) => r.roomTypeId === roomTypeId);
  const plan = rt?.ratePlans.find((p: any) => p.id === ratePlanId) ?? rt?.ratePlans[0];
  return <NewBookingShell product="HOTEL" disabled={!rt?.canBook}
    build={() => !rt ? 'Choose a room type' : !rt.canBook ? 'That room type is not available for these dates' : adults + children > (rt.maxAdults + rt.maxChildren) * rooms ? 'Too many guests for the selected rooms' : { roomTypeId, ratePlanId: plan?.id, checkIn, checkOut, rooms, adults, children }}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Hotel">{(id) => <Select id={id} value={hid ?? ''} onChange={(e) => { setHotel(e.target.value); setRT(''); }}>{hotels.options.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select>}</Field>
      <Field label="Rooms">{(id) => <Input id={id} type="number" min={1} max={20} value={rooms} onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))} />}</Field>
      <Field label="Check-in">{(id) => <Input id={id} type="date" value={checkIn} onChange={(e) => setIn(e.target.value)} />}</Field>
      <Field label="Check-out" error={checkOut <= checkIn ? 'Must be after check-in' : undefined}>{(id) => <Input id={id} type="date" value={checkOut} onChange={(e) => setOut(e.target.value)} />}</Field>
      <Field label="Adults">{(id) => <Input id={id} type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />}</Field>
      <Field label="Children">{(id) => <Input id={id} type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />}</Field></div>
    {!ok ? <EmptyState title="Check the dates" /> : av.isLoading ? <Spinner /> : <fieldset className="space-y-2"><legend className="mb-1 text-sm font-medium">Room type</legend>
      {av.data?.roomTypes.map((r: any) => <label key={r.roomTypeId} className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 text-sm ${roomTypeId === r.roomTypeId ? 'border-primary bg-primary/5' : ''} ${r.canBook ? '' : 'opacity-50'}`}>
        <span className="flex items-center gap-2"><input type="radio" name="rt" disabled={!r.canBook} checked={roomTypeId === r.roomTypeId} onChange={() => { setRT(r.roomTypeId); setRP(''); }} />{r.name}</span>
        <span className="text-xs text-muted-foreground">{r.canBook ? `${r.available} left · ${r.ratePlans[0] ? money(r.ratePlans[0].total, r.ratePlans[0].currencyCode) : money(r.basePrice, r.currencyCode)}` : 'sold out'}</span></label>)}</fieldset>}
    {rt && !!rt.ratePlans.length && <Field label="Rate plan">{(id) => <Select id={id} value={plan?.id ?? ''} onChange={(e) => setRP(e.target.value)}>{rt.ratePlans.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {p.mealPlan} · {money(p.total, p.currencyCode)}</option>)}</Select>}</Field>}
    {rt && <Card className="bg-muted/40 p-3 text-sm">Total for {av.data.nights} night(s): <strong>{plan ? money(plan.total, plan.currencyCode) : `from ${money(Number(rt.basePrice) * av.data.nights * rooms, rt.currencyCode)}`}</strong></Card>}
  </NewBookingShell>;
}
