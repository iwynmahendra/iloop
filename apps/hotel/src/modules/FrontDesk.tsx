import { Badge, Button, Card, DatePager, EmptyState, ErrorState, Select, Spinner, Table, Td, Th, BookingDetail, HotelCheckInDialog, label, money, post, statusTone, today, useAct, useGet, useOptions } from '@booking/admin-kit';
import { useState } from 'react';

type Row = any;
function Section({ title, rows, kind, onOpen, onCheckIn, onCheckOut }: { title: string; rows: Row[]; kind: 'arr' | 'inh' | 'dep'; onOpen: (id: string) => void; onCheckIn: (r: Row) => void; onCheckOut: (r: Row) => void }) {
  return <Card><h2 className="flex items-center justify-between border-b p-3 text-sm font-semibold">{title}<Badge>{rows.length}</Badge></h2>
    {!rows.length ? <p className="p-4 text-sm text-muted-foreground">Nobody.</p> : <Table><thead><tr><Th>Booking</Th><Th>Guest</Th><Th>Room</Th><Th>Stay</Th><Th>Balance</Th><Th /></tr></thead><tbody>
      {rows.map((r) => <tr key={r.itemId}><Td><button className="font-medium text-primary hover:underline" onClick={() => onOpen(r.id)}>{r.bookingNo}</button><div><Badge tone={statusTone(r.status)}>{label(r.status)}</Badge></div></Td>
        <Td>{r.guestName}{r.specialRequests && <div className="max-w-[14rem] truncate text-xs text-muted-foreground" title={r.specialRequests}>{r.specialRequests}</div>}</Td>
        <Td>{r.roomType}{r.rooms > 1 ? ` ×${r.rooms}` : ''}<div className="text-xs text-muted-foreground">{r.roomNumber ? `Room ${r.roomNumber}` : 'Not assigned'}</div></Td>
        <Td className="whitespace-nowrap text-xs">{String(r.checkIn).slice(0, 10)} → {String(r.checkOut).slice(0, 10)}<div>{r.adults}A {r.children}C · {r.nights}n</div></Td>
        <Td className="tabular-nums">{Number(r.balance) > 0 ? <span className="text-warning">{money(r.balance, r.currencyCode)}</span> : 'Paid'}</Td>
        <Td className="text-right">{kind === 'arr' && !r.checkedInAt && r.status === 'CONFIRMED' && <Button size="sm" onClick={() => onCheckIn(r)}>Check in</Button>}
          {kind === 'arr' && r.checkedInAt && <Badge tone="success">In house</Badge>}
          {kind !== 'arr' && !r.checkedOutAt && r.checkedInAt && <Button size="sm" variant="outline" onClick={() => onCheckOut(r)}>Check out</Button>}
          {r.checkedOutAt && <Badge>Out</Badge>}</Td></tr>)}
    </tbody></Table>}</Card>;
}

export default function FrontDesk() {
  const [date, setDate] = useState(today()); const [hotelId, setHotel] = useState('');
  const hotels = useOptions('/hotel/hotels');
  const q = useGet<any>('/boards/hotel', { date, hotelId: hotelId || undefined }, { refetchInterval: 60_000 });
  const [open, setOpen] = useState<string | null>(null); const [ci, setCi] = useState<Row | null>(null);
  const out = useAct((r: Row) => post(`/bookings/${r.id}/check-out`, { itemId: r.itemId }), 'Checked out');
  const d = q.data;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Front desk</h1><p className="text-sm text-muted-foreground">Arrivals, in-house guests and departures for one day.</p></div>
      <div className="flex flex-wrap items-center gap-2"><Select aria-label="Hotel" className="w-48" value={hotelId} onChange={(e) => setHotel(e.target.value)}><option value="">All hotels</option>{hotels.options.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}</Select><DatePager value={date} onChange={setDate} /></div></div>
    {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !d ? <EmptyState title="No data" /> : <>
      <Card className="p-4"><div className="flex items-baseline justify-between"><h2 className="text-sm font-semibold">Occupancy</h2><span className="text-2xl font-semibold tabular-nums">{d.occupancy.percent}%</span></div>
        <div className="mt-2 h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={d.occupancy.percent} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, d.occupancy.percent)}%` }} /></div>
        <p className="mt-1 text-xs text-muted-foreground">{d.occupancy.sold} of {d.occupancy.totalUnits} rooms sold</p>
        {!!d.occupancy.byRoomType.length && <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{d.occupancy.byRoomType.map((r: any) => <li key={r.roomTypeId} className="flex justify-between"><span>{r.roomType}{r.stopSell && <Badge tone="danger" className="ml-1">stop sell</Badge>}</span><span className="tabular-nums text-muted-foreground">{r.available}/{r.total} left</span></li>)}</ul>}</Card>
      <Section title="Arrivals" kind="arr" rows={d.arrivals} onOpen={setOpen} onCheckIn={setCi} onCheckOut={(r) => out.mutate(r)} />
      <Section title="In house" kind="inh" rows={d.inHouse} onOpen={setOpen} onCheckIn={setCi} onCheckOut={(r) => out.mutate(r)} />
      <Section title="Departures" kind="dep" rows={d.departures} onOpen={setOpen} onCheckIn={setCi} onCheckOut={(r) => out.mutate(r)} />
    </>}
    {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
    {ci && <HotelCheckInDialog bookingId={ci.id} itemId={ci.itemId} room={ci.roomNumber} onClose={() => setCi(null)} />}
  </div>;
}
