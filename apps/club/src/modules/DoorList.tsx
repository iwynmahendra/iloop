import { Badge, BookingDetail, Button, Card, ClubCheckInDialog, DatePager, EmptyState, ErrorState, Input, Select, Spinner, hm, label, money, statusTone, today, useGet, useOptions } from '@booking/admin-kit';
import { useState } from 'react';

/** Door list for tonight: who is expected, who is in, and one-tap check-in. */
export default function DoorList() {
  const [date, setDate] = useState(today()); const [clubId, setClub] = useState(''); const [find, setFind] = useState('');
  const clubs = useOptions('/club/clubs');
  const q = useGet<any>('/boards/club', { date, clubId: clubId || undefined }, { refetchInterval: 30_000 });
  const [open, setOpen] = useState<string | null>(null); const [ci, setCi] = useState<any>(null);
  const rows = (q.data?.guestList ?? []).filter((g: any) => !find || `${g.guestName} ${g.bookingNo}`.toLowerCase().includes(find.toLowerCase()));
  const t = q.data?.totals;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Door list</h1><p className="text-sm text-muted-foreground">{q.data?.events?.map((e: any) => e.title).join(' · ') || 'No event on this date'}</p></div>
      <div className="flex flex-wrap items-center gap-2"><Select aria-label="Club" className="w-44" value={clubId} onChange={(e) => setClub(e.target.value)}><option value="">All clubs</option>{clubs.options.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select><DatePager value={date} onChange={setDate} /></div></div>
    {t && <div className="grid grid-cols-3 gap-3"><Card className="p-3"><p className="text-xs text-muted-foreground">Expected</p><p className="text-2xl font-semibold tabular-nums">{t.guestsExpected}</p></Card><Card className="p-3"><p className="text-xs text-muted-foreground">Checked in</p><p className="text-2xl font-semibold tabular-nums">{t.checkedIn}</p></Card><Card className="p-3"><p className="text-xs text-muted-foreground">Tables</p><p className="text-2xl font-semibold tabular-nums">{t.tables}</p></Card></div>}
    <Input aria-label="Find a guest" className="max-w-sm" placeholder="Find by name or booking no" value={find} onChange={(e) => setFind(e.target.value)} />
    {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !rows.length ? <EmptyState title="Nobody on the list" /> : <Card><ul className="divide-y">{rows.map((g: any) => <li key={g.itemId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <div><button className="font-medium text-primary hover:underline" onClick={() => setOpen(g.id)}>{g.guestName}</button> <span className="text-muted-foreground">{g.bookingNo}</span><div className="text-xs text-muted-foreground">{g.product}{g.isTable ? ` · table ${g.tableLabel ?? 'unassigned'}` : ''} · {g.guests} guests{g.arrivalTime ? ` · ${hm(g.arrivalTime)}` : ''}{g.event ? ` · ${g.event}` : ''}</div></div>
      <div className="flex items-center gap-2"><Badge tone={statusTone(g.status)}>{label(g.status)}</Badge>{Number(g.balance) > 0 && <span className="text-xs text-warning">{money(g.balance, g.currencyCode)} due</span>}
        {g.checkedInCount >= g.guests ? <Badge tone="success">All in</Badge> : g.status === 'CONFIRMED' && <Button size="sm" onClick={() => setCi(g)}>{g.checkedInCount ? `In ${g.checkedInCount}/${g.guests} · add` : 'Check in'}</Button>}</div></li>)}</ul></Card>}
    {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
    {ci && <ClubCheckInDialog bookingId={ci.id} itemId={ci.itemId} expected={Math.max(1, ci.guests - ci.checkedInCount)} table={ci.tableLabel} onClose={() => setCi(null)} />}
  </div>;
}
