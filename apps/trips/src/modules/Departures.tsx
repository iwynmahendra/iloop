import { Badge, BookingDetail, Button, Card, DatePager, EmptyState, ErrorState, Spinner, TripCheckInDialog, addDaysStr, hm, label, money, statusTone, today, useGet } from '@booking/admin-kit';
import { useState } from 'react';

/** Departure board: each departure with its manifest and a one-tap check-in. */
export default function Departures() {
  const [from, setFrom] = useState(today()); const to = addDaysStr(from, 6);
  const q = useGet<any>('/boards/trips', { from, to }, { refetchInterval: 60_000 });
  const [open, setOpen] = useState<string | null>(null); const [ci, setCi] = useState<any>(null);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Departures</h1><p className="text-sm text-muted-foreground">Seven days from the selected date, with the guest manifest.</p></div><DatePager value={from} onChange={setFrom} /></div>
    {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data.departures.length ? <EmptyState title="No departures in this range" /> :
      <div className="space-y-3">{q.data.departures.map((x: any) => <Card key={x.scheduleId}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3"><div><h2 className="font-semibold">{x.trip}</h2><p className="text-xs text-muted-foreground">{String(x.date).slice(0, 10)} · {hm(x.startTime)}{x.endTime ? `–${hm(x.endTime)}` : ''}</p></div>
          <div className="flex items-center gap-2 text-sm"><Badge tone="success">{x.confirmedGuests} confirmed</Badge>{x.pendingGuests > 0 && <Badge tone="warning">{x.pendingGuests} pending</Badge>}<span className="tabular-nums text-muted-foreground">{x.remaining}/{x.quota} seats left</span></div></div>
        {!x.bookings.length ? <p className="p-3 text-sm text-muted-foreground">No bookings yet.</p> : <ul className="divide-y">{x.bookings.map((b: any) => <li key={b.itemId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <div><button className="font-medium text-primary hover:underline" onClick={() => setOpen(b.id)}>{b.bookingNo}</button> · {b.guestName} · {b.adults}A {b.children}C<div className="text-xs text-muted-foreground">{b.pickupAddress ? `Pickup: ${b.pickupAddress}` : ''}{b.guestPhone ? ` · ${b.guestPhone}` : ''}</div></div>
          <div className="flex items-center gap-2"><Badge tone={statusTone(b.status)}>{label(b.status)}</Badge>{Number(b.balance) > 0 && <span className="text-xs text-warning">{money(b.balance, b.currencyCode)} due</span>}
            {b.checkedInAt ? <Badge tone="success">Checked in ({b.participantsShown})</Badge> : b.status === 'CONFIRMED' && <Button size="sm" onClick={() => setCi(b)}>Check in</Button>}</div></li>)}</ul>}
      </Card>)}</div>}
    {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
    {ci && <TripCheckInDialog bookingId={ci.id} itemId={ci.itemId} expected={ci.adults + ci.children} onClose={() => setCi(null)} />}
  </div>;
}
