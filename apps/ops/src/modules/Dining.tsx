import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Spinner, Switch, api, dt, label, money, post, useAct, useAuth, useGet } from '@booking/admin-kit';
import { useState } from 'react';

const FLOW: Record<string, [string, string]> = { NEW: ['PREPARING', 'Start preparing'], PREPARING: ['ON_THE_WAY', 'Out for delivery'], ON_THE_WAY: ['DELIVERED', 'Delivered'] };

function Orders() {
  const q = useGet<any>('/ops/dining/orders', { open: 'true', limit: 100 }, { refetchInterval: 15_000 });
  const upd = useAct((v: { id: string; status: string }) => api(`/ops/dining/orders/${v.id}`, { method: 'PATCH', body: { status: v.status } }));
  if (q.isLoading) return <Spinner />; if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const rows: any[] = Array.isArray(q.data) ? q.data : q.data?.data ?? [];
  return !rows.length ? <EmptyState title="No open orders" hint="New orders from the guest app appear here." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((o) => <Card key={o.id} className="p-4 text-sm">
    <div className="flex items-start justify-between"><div><p className="font-semibold">Room {o.roomNumber} <span className="font-normal text-muted-foreground">· {o.guestName}</span></p><p className="text-xs text-muted-foreground">{o.ref} · {dt(o.createdAt)} · {o.deliverWhen}</p></div><Badge tone={o.status === 'NEW' ? 'warning' : 'info'}>{label(o.status)}</Badge></div>
    <ul className="mt-2 space-y-0.5">{(o.items as any[]).map((i, n) => <li key={n} className="flex justify-between"><span>{i.qty} × {i.name}</span><span className="tabular-nums text-muted-foreground">{money(i.qty * i.price, o.currencyCode)}</span></li>)}</ul>
    {o.note && <p className="mt-2 rounded bg-muted p-2 text-xs">{o.note}</p>}
    <div className="mt-3 flex items-center justify-between"><span className="font-semibold tabular-nums">{money(o.total, o.currencyCode)}</span><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => upd.mutate({ id: o.id, status: 'CANCELLED' })}>Cancel</Button>{FLOW[o.status] && <Button size="sm" onClick={() => upd.mutate({ id: o.id, status: FLOW[o.status]![0] })}>{FLOW[o.status]![1]}</Button>}</div></div></Card>)}</div>;
}

function Menu() {
  const { user } = useAuth(); const q = useGet<any[]>('/ops/dining/items'); const admin = user?.role !== 'SUPPLIER_STAFF';
  const [f, setF] = useState<any>(null);
  const toggle = useAct((i: any) => api(`/ops/dining/items/${i.id}`, { method: 'PATCH', body: { available: !i.available } }));
  const save = useAct(() => api('/ops/dining/items', { method: 'POST', body: { category: f.category, name: f.name, description: f.description || null, price: Number(f.price) } }), 'Item added', () => setF(null));
  const del = useAct((id: string) => api(`/ops/dining/items/${id}`, { method: 'DELETE' }), 'Item removed');
  if (q.isLoading) return <Spinner />; if (q.isError) return <ErrorState error={q.error} />;
  const cats = [...new Set((q.data ?? []).map((i) => i.category))];
  return <div className="space-y-3">{admin && <div className="flex justify-end"><Button onClick={() => setF({ category: cats[0] ?? 'Mains', name: '', description: '', price: '' })}>Add item</Button></div>}
    {cats.map((c) => <Card key={c}><h3 className="border-b p-3 text-sm font-semibold">{c}</h3><ul className="divide-y">{q.data!.filter((i) => i.category === c).map((i) => <li key={i.id} className="flex items-center justify-between gap-3 p-3 text-sm"><div><p className={i.available ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>{i.name}</p><p className="text-xs text-muted-foreground">{i.description}</p></div>
      <div className="flex items-center gap-3"><span className="tabular-nums">{money(i.price)}</span><Switch label={`${i.name} available`} checked={i.available} onChange={() => toggle.mutate(i)} />{admin && <Button size="sm" variant="ghost" onClick={() => del.mutate(i.id)}>Remove</Button>}</div></li>)}</ul></Card>)}
    {f && <Modal open onClose={() => setF(null)} title="Add menu item" footer={<><Button variant="outline" onClick={() => setF(null)}>Cancel</Button><Button onClick={() => save.mutate()} loading={save.isPending} disabled={!f.name.trim() || !(Number(f.price) >= 0) || f.price === ''}>Add</Button></>}>
      <div className="space-y-3"><Field label="Category">{(id) => <Input id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />}</Field><Field label="Name" required>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field><Field label="Description">{(id) => <Input id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field><Field label="Price" required>{(id) => <Input id={id} type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />}</Field></div></Modal>}</div>;
}

export default function Dining() {
  const [tab, setTab] = useState<'o' | 'm'>('o');
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Room dining</h1><p className="text-sm text-muted-foreground">Orders from the guest app, and the menu guests can order from.</p></div>
    <div role="tablist" className="flex gap-1 border-b">{([['o', 'Open orders'], ['m', 'Menu']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}>{l}</button>)}</div>
    {tab === 'o' ? <Orders /> : <Menu />}</div>;
}
