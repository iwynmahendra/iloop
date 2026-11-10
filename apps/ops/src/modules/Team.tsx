import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select, Spinner, Switch, Textarea, api, dt, useAct, useAuth, useGet } from '@booking/admin-kit';
import { useState } from 'react';
import { DEPTS } from './Tasks';

export default function Team() {
  const { user } = useAuth(); const admin = user?.role !== 'SUPPLIER_STAFF';
  const staff = useGet<any[]>('/ops/staff'); const notes = useGet<any[]>('/ops/notes');
  const [n, setN] = useState({ name: '', department: 'Housekeeping' }); const [note, setNote] = useState('');
  const add = useAct(() => api('/ops/staff', { method: 'POST', body: n }), 'Added', () => setN({ ...n, name: '' }));
  const duty = useAct((s: any) => api(`/ops/staff/${s.id}`, { method: 'PATCH', body: { onDuty: !s.onDuty } }));
  const del = useAct((id: string) => api(`/ops/staff/${id}`, { method: 'DELETE' }), 'Removed');
  const post = useAct(() => api('/ops/notes', { method: 'POST', body: { body: note } }), 'Note saved', () => setNote(''));
  return <div className="space-y-6"><div><h1 className="text-xl font-semibold">Team &amp; handover</h1><p className="text-sm text-muted-foreground">Who is on duty, and what the next shift needs to know.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3"><h2 className="text-sm font-semibold">Staff</h2>
        {admin && <Card className="grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto]"><Input aria-label="Name" placeholder="Name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /><Select aria-label="Department" value={n.department} onChange={(e) => setN({ ...n, department: e.target.value })}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</Select><Button onClick={() => add.mutate()} loading={add.isPending} disabled={!n.name.trim()}>Add</Button></Card>}
        {staff.isLoading ? <Spinner /> : staff.isError ? <ErrorState error={staff.error} /> : !staff.data?.length ? <EmptyState title="No staff yet" /> : <Card><ul className="divide-y">{staff.data.map((s) => <li key={s.id} className="flex items-center justify-between gap-2 p-3 text-sm"><span><b>{s.name}</b> <span className="text-muted-foreground">{s.department}</span></span><span className="flex items-center gap-2"><Switch label={`${s.name} on duty`} checked={s.onDuty} onChange={() => duty.mutate(s)} />{admin && <Button size="sm" variant="ghost" onClick={() => del.mutate(s.id)}>Remove</Button>}</span></li>)}</ul></Card>}</div>
      <div className="space-y-3"><h2 className="text-sm font-semibold">Shift handover</h2>
        <Card className="space-y-2 p-3"><Field label="Note for the next shift">{(id) => <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />}</Field><div className="flex justify-end"><Button onClick={() => post.mutate()} loading={post.isPending} disabled={!note.trim()}>Save note</Button></div></Card>
        {notes.isLoading ? <Spinner /> : !notes.data?.length ? <EmptyState title="No notes yet" /> : <ul className="space-y-2">{notes.data.map((x) => <li key={x.id}><Card className="p-3 text-sm"><p className="whitespace-pre-line">{x.body}</p><p className="mt-1 text-xs text-muted-foreground">{x.author} · {dt(x.createdAt)}</p></Card></li>)}</ul>}</div></div></div>;
}
