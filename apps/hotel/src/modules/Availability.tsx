import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select, Spinner, addDaysStr, money, today, useGet, useOptions } from '@booking/admin-kit';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Availability() {
  const hotels = useOptions('/hotel/hotels');
  const [hotelId, setHotel] = useState(''); const [checkIn, setIn] = useState(today()); const [checkOut, setOut] = useState(addDaysStr(today(), 2)); const [rooms, setRooms] = useState(1);
  const hid = hotelId || hotels.options[0]?.id;
  const ok = !!hid && checkOut > checkIn;
  const q = useGet<any>(ok ? '/availability/hotel' : null, { hotelId: hid, checkIn, checkOut, rooms });
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Availability</h1><p className="text-sm text-muted-foreground">What can be sold for a stay, night by night.</p></div>
    <Card className="grid gap-3 p-3 sm:grid-cols-4">
      <Field label="Hotel">{(id) => <Select id={id} value={hid ?? ''} onChange={(e) => setHotel(e.target.value)}>{hotels.options.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select>}</Field>
      <Field label="Check-in">{(id) => <Input id={id} type="date" value={checkIn} onChange={(e) => setIn(e.target.value)} />}</Field>
      <Field label="Check-out" error={checkOut <= checkIn ? 'Must be after check-in' : undefined}>{(id) => <Input id={id} type="date" value={checkOut} onChange={(e) => setOut(e.target.value)} />}</Field>
      <Field label="Rooms">{(id) => <Input id={id} type="number" min={1} max={20} value={rooms} onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))} />}</Field></Card>
    {!ok ? <EmptyState title="Choose a hotel and valid dates" /> : q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <div className="grid gap-3 lg:grid-cols-2">
      {q.data.roomTypes.map((rt: any) => <Card key={rt.roomTypeId} className="p-4">
        <div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold">{rt.name}</h2><p className="text-xs text-muted-foreground">Up to {rt.maxAdults} adults, {rt.maxChildren} children · from {money(rt.basePrice, rt.currencyCode)}</p></div><Badge tone={rt.canBook ? 'success' : 'danger'}>{rt.canBook ? `${rt.available} available` : 'Not available'}</Badge></div>
        <div className="mt-3 flex flex-wrap gap-1" aria-label="Units per night">{rt.days.map((d: any) => <span key={d.date} title={d.stopSell ? 'Stop sell' : ''} className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${d.available > 0 ? 'bg-secondary' : 'bg-destructive/15 text-destructive'}`}>{d.date.slice(5)}: {d.stopSell ? 'x' : d.available}</span>)}</div>
        <ul className="mt-3 space-y-1 text-sm">{rt.ratePlans.length ? rt.ratePlans.map((p: any) => <li key={p.id} className="flex justify-between"><span>{p.name} <span className="text-xs text-muted-foreground">{p.mealPlan}</span></span><span className="tabular-nums">{money(p.total, p.currencyCode)}</span></li>) : <li className="text-muted-foreground">No rate plan covers these dates.</li>}</ul>
        {rt.canBook && <Link to={`/bookings/new?roomTypeId=${rt.roomTypeId}&hotelId=${hid}&checkIn=${checkIn}&checkOut=${checkOut}&rooms=${rooms}`} className="mt-3 inline-block"><Button size="sm">Book this</Button></Link>}
      </Card>)}</div>}
  </div>;
}
