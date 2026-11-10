import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Pagination, Spinner, Table, Td, Th } from '../components/ui';
import { api } from '../lib/api';
import { useDebounced } from '../hooks/useDebounced';
import BookingDetail from './BookingDetail';
import { day, label, money, statusTone } from './fmt';
import { useAct, useGet, useList } from './hooks';

function CustomerCard({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useGet<any>(`/customers/${id}`); const [open, setOpen] = useState<string | null>(null);
  return <Modal open onClose={onClose} side title={q.data?.fullName ?? 'Customer'}>
    {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} /> : <div className="space-y-3 text-sm">
      <dl className="space-y-1"><div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{q.data.email}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd>{q.data.phone}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Country</dt><dd>{q.data.countryCode}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Lifetime spend</dt><dd>{money(q.data.lifetime?.total ?? q.data.totalSpent ?? 0)}</dd></div></dl>
      {q.data.notes && <p className="rounded-md bg-muted p-2">{q.data.notes}</p>}
      <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bookings</h3>
      <ul className="divide-y">{(q.data.bookings ?? []).map((b: any) => <li key={b.id}><button className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-accent/50" onClick={() => setOpen(b.id)}><span>{b.bookingNo} <span className="text-xs text-muted-foreground">{label(b.product)} · {day(b.startAt)}</span></span><Badge tone={statusTone(b.status)}>{label(b.status)}</Badge></button></li>)}</ul>
      {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}</div>}
  </Modal>;
}

export default function CustomersPage() {
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1); const [open, setOpen] = useState<string | null>(null); const [add, setAdd] = useState(false);
  const list = useList<any>('/customers', { page, limit: 20, q: dq || undefined });
  const [f, setF] = useState({ fullName: '', email: '', phone: '', countryCode: '' });
  const create = useAct(() => api('/customers', { method: 'POST', body: { fullName: f.fullName, email: f.email || null, phone: f.phone || null, countryCode: f.countryCode || null } }), 'Customer added', () => { setAdd(false); setF({ fullName: '', email: '', phone: '', countryCode: '' }); });
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-xl font-semibold">Customers</h1><p className="text-sm text-muted-foreground">{list.data?.meta ? `${list.data.meta.total} customers` : ' '}</p></div><Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" />Add customer</Button></div>
    <Input aria-label="Search customers" className="max-w-sm" placeholder="Name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
    {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : !list.data?.data.length ? <EmptyState title="No customers" /> :
      <Card><Table><thead><tr><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Country</Th><Th className="text-right">Bookings</Th></tr></thead><tbody>{list.data.data.map((c: any) => <tr key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setOpen(c.id)}><Td className="font-medium">{c.fullName}</Td><Td>{c.email}</Td><Td>{c.phone}</Td><Td>{c.countryCode}</Td><Td className="text-right">{c._count?.bookings ?? 0}</Td></tr>)}</tbody></Table>
        {list.data.meta && <Pagination page={list.data.meta.page} limit={list.data.meta.limit} total={list.data.meta.total} onPage={setPage} />}</Card>}
    {open && <CustomerCard id={open} onClose={() => setOpen(null)} />}
    {add && <Modal open onClose={() => setAdd(false)} title="Add customer" footer={<><Button variant="outline" onClick={() => setAdd(false)}>Cancel</Button><Button type="submit" form="cu" loading={create.isPending} disabled={!f.fullName.trim()}>Add</Button></>}>
      <form id="cu" className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <Field label="Full name" required>{(id) => <Input id={id} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
        <Field label="Country (2 letters)">{(id) => <Input id={id} maxLength={2} value={f.countryCode} onChange={(e) => setF({ ...f, countryCode: e.target.value.toUpperCase() })} />}</Field></form></Modal>}
  </div>;
}
