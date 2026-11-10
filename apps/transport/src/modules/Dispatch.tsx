import { AssignDialog, Badge, BookingDetail, Button, Card, DatePager, EmptyState, ErrorState, Select, Spinner, dt, label, post, today, useAct, useGet } from '@booking/admin-kit';
import { useState } from 'react';

const NEXT: Record<string, [string, string]> = { ASSIGNED: ['ON_THE_WAY', 'On the way'], ON_THE_WAY: ['PICKED_UP', 'Picked up'], PICKED_UP: ['DROPPED_OFF', 'Dropped off'] };
const tone = (s: string) => (({ UNASSIGNED: 'warning', ASSIGNED: 'info', ON_THE_WAY: 'info', PICKED_UP: 'info', DROPPED_OFF: 'success' }) as const)[s as 'ASSIGNED'] ?? 'neutral';

/** Dispatch board: every pickup in the window; assign a driver and vehicle, then move the job along. */
export default function Dispatch() {
  const [date, setDate] = useState(today()); const [days, setDays] = useState(1);
  const q = useGet<any>('/boards/transport', { date, days }, { refetchInterval: 30_000 });
  const [open, setOpen] = useState<string | null>(null); const [as, setAs] = useState<any>(null);
  const move = useAct((v: { id: string; itemId: string; status: string }) => post(`/bookings/${v.id}/dispatch`, { status: v.status, itemId: v.itemId }), 'Job updated');
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Dispatch</h1><p className="text-sm text-muted-foreground">{q.data ? `${q.data.jobs.length} jobs · ${q.data.unassigned} unassigned` : ' '}</p></div>
      <div className="flex items-center gap-2"><Select aria-label="Days" className="w-32" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>1 day</option><option value={2}>2 days</option><option value={7}>7 days</option></Select><DatePager value={date} onChange={setDate} /></div></div>
    {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data.jobs.length ? <EmptyState title="No pickups in this window" /> :
      <div className="grid gap-3 lg:grid-cols-2">{q.data.jobs.map((j: any) => <Card key={j.itemId} className={`p-4 ${j.assignmentStatus === 'UNASSIGNED' && j.status === 'CONFIRMED' ? 'border-warning' : ''}`}>
        <div className="flex items-start justify-between gap-2"><div><p className="text-lg font-semibold tabular-nums">{dt(j.pickupAt)}</p><button className="text-sm font-medium text-primary hover:underline" onClick={() => setOpen(j.id)}>{j.bookingNo}</button> · {j.guestName}</div><div className="flex flex-col items-end gap-1"><Badge tone={tone(j.assignmentStatus)}>{label(j.assignmentStatus)}</Badge>{j.status !== 'CONFIRMED' && <Badge tone="warning">{label(j.status)}</Badge>}</div></div>
        <p className="mt-2 text-sm">{j.pickupAddress} <span className="text-muted-foreground">→</span> {j.dropoffAddress}</p>
        <p className="mt-1 text-xs text-muted-foreground">{j.vehicleType} · {j.passengers} pax · {j.luggage} bags{j.flightNumber ? ` · flight ${j.flightNumber}` : ''}{j.isReturnLeg ? ' · return' : ''}{j.guestPhone ? ` · ${j.guestPhone}` : ''}</p>
        {(j.driver || j.vehicle) && <p className="mt-1 text-sm">{j.driver?.name} {j.vehicle ? `· ${j.vehicle.plateNumber}` : ''}</p>}
        {j.status === 'CONFIRMED' && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => setAs(j)}>{j.driver ? 'Reassign' : 'Assign'}</Button>{NEXT[j.assignmentStatus] && <Button size="sm" loading={move.isPending && move.variables?.itemId === j.itemId} onClick={() => move.mutate({ id: j.id, itemId: j.itemId, status: NEXT[j.assignmentStatus]![0] })}>{NEXT[j.assignmentStatus]![1]}</Button>}</div>}
      </Card>)}</div>}
    {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
    {as && <AssignDialog bookingId={as.id} itemId={as.itemId} driverId={as.driver?.id} vehicleId={as.vehicle?.id} pickupAt={as.pickupAt} vehicleTypeId={as.vehicleTypeId} onClose={() => setAs(null)} />}
  </div>;
}
