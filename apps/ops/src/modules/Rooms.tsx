import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Spinner, api, useAct, useAuth, useGet } from '@booking/admin-kit';
import { useState } from 'react';

const ST: [string, string, string][] = [['DIRTY', 'Dirty', 'bg-destructive/15 text-destructive'], ['CLEANING', 'Cleaning', 'bg-warning/15 text-warning'], ['CLEAN', 'Clean', 'bg-primary/15 text-primary'], ['INSPECTED', 'Inspected', 'bg-success/15 text-success'], ['OUT_OF_ORDER', 'Out of order', 'bg-muted text-muted-foreground line-through']];
const NEXT: Record<string, string> = { DIRTY: 'CLEANING', CLEANING: 'CLEAN', CLEAN: 'INSPECTED', INSPECTED: 'DIRTY', OUT_OF_ORDER: 'DIRTY' };

export default function Rooms() {
  const { user } = useAuth(); const q = useGet<any[]>('/ops/rooms', undefined, { refetchInterval: 30_000 });
  const upd = useAct((v: { id: string; body: object }) => api(`/ops/rooms/${v.id}`, { method: 'PATCH', body: v.body }));
  const [add, setAdd] = useState(false); const [spec, setSpec] = useState({ floor: '1', from: '1', to: '10' });
  const bulk = useAct(() => api('/ops/rooms', { method: 'POST', body: { rooms: Array.from({ length: Math.max(0, Number(spec.to) - Number(spec.from) + 1) }, (_, i) => ({ roomNumber: `${spec.floor}${String(Number(spec.from) + i).padStart(2, '0')}`, floor: spec.floor })) } }), undefined, () => setAdd(false));
  const rooms = q.data ?? []; const floors = [...new Set(rooms.map((r) => r.floor ?? '–'))].sort();
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Rooms</h1><p className="text-sm text-muted-foreground">Tap a room to move it along: dirty, cleaning, clean, inspected.</p></div>{user?.role !== 'SUPPLIER_STAFF' && <Button variant="outline" onClick={() => setAdd(true)}>Add rooms</Button>}</div>
    <div className="flex flex-wrap gap-2 text-xs">{ST.map(([k, l, c]) => <span key={k} className={`rounded-full px-2.5 py-1 ${c}`}>{l}: <b>{rooms.filter((r) => r.status === k).length}</b></span>)}<span className="rounded-full bg-secondary px-2.5 py-1">Do not disturb: <b>{rooms.filter((r) => r.dnd).length}</b></span></div>
    {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !rooms.length ? <EmptyState title="No rooms yet" hint="Add your room numbers to start tracking housekeeping." /> : floors.map((f) => <Card key={f} className="p-3"><h2 className="mb-2 text-sm font-semibold">Floor {f}</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">{rooms.filter((r) => (r.floor ?? '–') === f).map((r) => { const s = ST.find((x) => x[0] === r.status)!; return <div key={r.id} className={`rounded-md p-2 text-center text-sm ${s[2]}`}>
        <button className="block w-full font-semibold" aria-label={`Room ${r.roomNumber}, ${s[1]}. Move to ${NEXT[r.status]}`} onClick={() => upd.mutate({ id: r.id, body: { status: NEXT[r.status] } })}>{r.roomNumber}<span className="block text-[11px] font-normal">{s[1]}</span></button>
        <label className="mt-1 flex items-center justify-center gap-1 text-[11px]"><input type="checkbox" checked={r.dnd} onChange={(e) => upd.mutate({ id: r.id, body: { dnd: e.target.checked } })} />DND</label></div>; })}</div></Card>)}
    {add && <Modal open onClose={() => setAdd(false)} title="Add rooms" footer={<><Button variant="outline" onClick={() => setAdd(false)}>Cancel</Button><Button onClick={() => bulk.mutate()} loading={bulk.isPending}>Add</Button></>}>
      <p className="mb-3 text-sm text-muted-foreground">Creates a run of rooms on one floor, e.g. floor 2, rooms 1 to 12 gives 201 to 212. Existing numbers are skipped.</p>
      <div className="grid grid-cols-3 gap-3"><Field label="Floor">{(id) => <Input id={id} value={spec.floor} onChange={(e) => setSpec({ ...spec, floor: e.target.value })} />}</Field><Field label="From">{(id) => <Input id={id} type="number" value={spec.from} onChange={(e) => setSpec({ ...spec, from: e.target.value })} />}</Field><Field label="To">{(id) => <Input id={id} type="number" value={spec.to} onChange={(e) => setSpec({ ...spec, to: e.target.value })} />}</Field></div></Modal>}
  </div>;
}
