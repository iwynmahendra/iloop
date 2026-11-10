import { Field, Input, NewBookingShell, Select, money, today, useGet, useOptions } from '@booking/admin-kit';
import { useState } from 'react';

export default function NewBooking() {
  const clubs = useOptions('/club/clubs');
  const [clubId, setClub] = useState(''); const [visitDate, setDate] = useState(today()); const [kind, setKind] = useState<'ticket' | 'table'>('ticket');
  const [productId, setProd] = useState(''); const [eventId, setEvent] = useState(''); const [guestCount, setGuests] = useState(2); const [quantity, setQty] = useState(1); const [arrivalTime, setArr] = useState(''); const [tableLabel, setTable] = useState('');
  const cid = clubId || clubs.options[0]?.id;
  const av = useGet<any>(cid ? '/availability/club' : null, { clubId: cid, date: visitDate });
  const list: any[] = (kind === 'ticket' ? av.data?.tickets : av.data?.tables) ?? [];
  const chosen = list.find((x) => x.id === productId);
  return <NewBookingShell product="CLUB" disabled={!chosen}
    build={() => !chosen ? 'Choose a ticket or table' : chosen.left != null && chosen.left < quantity ? `Only ${chosen.left} left` : { clubId: cid, eventId: eventId || undefined, ...(kind === 'ticket' ? { ticketTypeId: chosen.id } : { tablePackageId: chosen.id }), visitDate, arrivalTime: arrivalTime || undefined, guestCount, quantity, tableLabel: kind === 'table' ? tableLabel || undefined : undefined }}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Club">{(id) => <Select id={id} value={cid ?? ''} onChange={(e) => { setClub(e.target.value); setProd(''); }}>{clubs.options.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
      <Field label="Date">{(id) => <Input id={id} type="date" value={visitDate} onChange={(e) => { setDate(e.target.value); setProd(''); }} />}</Field>
      {!!av.data?.events.length && <Field label="Event">{(id) => <Select id={id} value={eventId} onChange={(e) => setEvent(e.target.value)}><option value="">No specific event</option>{av.data.events.map((e: any) => <option key={e.id} value={e.id}>{e.title}</option>)}</Select>}</Field>}
      <Field label="Arrival time">{(id) => <Input id={id} type="time" value={arrivalTime} onChange={(e) => setArr(e.target.value)} />}</Field></div>
    <div role="radiogroup" aria-label="Product type" className="flex gap-4 text-sm">{(['ticket', 'table'] as const).map((k) => <label key={k} className="flex items-center gap-1.5"><input type="radio" checked={kind === k} onChange={() => { setKind(k); setProd(''); }} />{k === 'ticket' ? 'Entry ticket' : 'Table package'}</label>)}</div>
    <fieldset className="space-y-2"><legend className="sr-only">Choose one</legend>{!list.length ? <p className="text-sm text-muted-foreground">Nothing on sale for this date.</p> : list.map((x) => {
      const soldOut = x.left != null && x.left <= 0;
      return <label key={x.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 text-sm ${productId === x.id ? 'border-primary bg-primary/5' : ''} ${soldOut ? 'opacity-50' : ''}`}><span className="flex items-center gap-2"><input type="radio" name="prod" disabled={soldOut} checked={productId === x.id} onChange={() => setProd(x.id)} />{x.name}{x.capacity ? <span className="text-xs text-muted-foreground">(seats {x.capacity})</span> : null}</span><span className="text-xs text-muted-foreground">{money(x.price, x.currencyCode)} · {x.left == null ? 'open' : soldOut ? 'sold out' : `${x.left} left`}</span></label>; })}</fieldset>
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Guests">{(id) => <Input id={id} type="number" min={1} value={guestCount} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} />}</Field>
      <Field label="Quantity">{(id) => <Input id={id} type="number" min={1} value={quantity} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />}</Field>
      {kind === 'table' && <Field label="Table label">{(id) => <Input id={id} value={tableLabel} onChange={(e) => setTable(e.target.value)} maxLength={20} />}</Field>}</div>
  </NewBookingShell>;
}
