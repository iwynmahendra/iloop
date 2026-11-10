import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Select, Spinner, Textarea, api, dt, errText, post, useAct, useGet, useList } from '@booking/admin-kit';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export const DEPTS = ['Housekeeping', 'Maintenance', 'Front desk', 'F&B', 'Security', 'Spa'];
const COLS: [string, string][] = [['TODO', 'To do'], ['IN_PROGRESS', 'In progress'], ['BLOCKED', 'Blocked'], ['DONE', 'Done']];
const NEXT: Record<string, string> = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'DONE', BLOCKED: 'IN_PROGRESS' };
export const useStaff = () => useGet<any[]>('/ops/staff');
const mins = (iso?: string | null) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 60000) : null);
export const timer = (t: any) => { if (t.status === 'DONE') return t.doneAt ? `Done in ${Math.round((new Date(t.doneAt).getTime() - new Date(t.createdAt).getTime()) / 60000)} min` : 'Done'; const m = mins(t.dueAt); if (m === null) return ''; return m >= 0 ? `${m} min left` : `${-m} min past target`; };

function NewTask({ onClose }: { onClose: () => void }) {
  const staff = useStaff(); const [f, setF] = useState({ title: '', department: 'Housekeeping', priority: 'NORMAL', assigneeId: '', roomNumber: '', notes: '' });
  const m = useAct(() => api('/ops/tasks', { method: 'POST', body: { title: f.title, department: f.department, priority: f.priority, assigneeId: f.assigneeId || null, roomNumber: f.roomNumber || null, notes: f.notes || null } }), 'Task created', onClose);
  return <Modal open onClose={onClose} title="New task" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="nt" loading={m.isPending} disabled={!f.title.trim()}>Create</Button></>}>
    <form id="nt" className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <Field label="What needs doing?" required>{(id) => <Input id={id} autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Department">{(id) => <Select id={id} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value, assigneeId: '' })}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</Select>}</Field>
        <Field label="Priority">{(id) => <Select id={id} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="NORMAL">Normal</option><option value="URGENT">Urgent</option></Select>}</Field>
        <Field label="Assign to">{(id) => <Select id={id} value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}><option value="">Unassigned</option>{staff.data?.filter((s) => s.department === f.department && s.onDuty).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field>
        <Field label="Room">{(id) => <Input id={id} value={f.roomNumber} onChange={(e) => setF({ ...f, roomNumber: e.target.value })} maxLength={20} />}</Field></div>
      <Field label="Notes">{(id) => <Textarea id={id} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} />}</Field></form></Modal>;
}

function Detail({ t, onClose }: { t: any; onClose: () => void }) {
  const [note, setNote] = useState('');
  const add = useAct(() => post(`/ops/tasks/${t.id}/notes`, { message: note.trim() }), 'Note added', () => { setNote(''); onClose(); });
  return <Modal open side onClose={onClose} title={t.ref ?? 'Task'}>
    <h3 className="font-semibold">{t.title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{t.department}{t.roomNumber ? ` · room ${t.roomNumber}` : ''}{t.guestName ? ` · ${t.guestName}` : ''} · {t.source === 'GUEST_APP' ? 'from the guest app' : 'by staff'}</p>
    {t.details?.answers && Object.keys(t.details.answers).length > 0 && <dl className="mt-3 rounded-md bg-muted p-3 text-sm">{Object.entries(t.details.answers).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd>{String(v)}</dd></div>)}</dl>}
    {t.notes && <p className="mt-3 text-sm">{t.notes}</p>}
    <h4 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</h4>
    <ol className="space-y-1 text-sm">{[...(t.log ?? [])].reverse().map((l: any, i: number) => <li key={i}><span className="text-xs text-muted-foreground">{dt(l.at)} · {l.by}</span><br />{l.message}</li>)}</ol>
    <div className="mt-4 flex gap-2"><Input aria-label="Add a note" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} /><Button onClick={() => add.mutate()} disabled={!note.trim()} loading={add.isPending}>Add</Button></div>
  </Modal>;
}

/** Board of internal tasks (kind=TASK) or guest requests (kind=REQUEST). */
export default function Tasks({ kind }: { kind: 'TASK' | 'REQUEST' }) {
  const [dept, setDept] = useState(''); const [assignee, setAssignee] = useState(''); const [q, setQ] = useState(''); const [add, setAdd] = useState(false); const [open, setOpen] = useState<any>(null);
  const staff = useStaff();
  const list = useList<any>('/ops/tasks', { kind, department: dept || undefined, assigneeId: assignee || undefined, q: q || undefined, limit: 200 });
  const upd = useAct((v: { id: string; body: object }) => api(`/ops/tasks/${v.id}`, { method: 'PATCH', body: v.body }));
  const rows: any[] = list.data?.data ?? [];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">{kind === 'TASK' ? 'Tasks' : 'Guest requests'}</h1><p className="text-sm text-muted-foreground">{rows.filter((r) => r.status !== 'DONE').length} open{kind === 'REQUEST' ? ` · ${rows.filter((r) => r.overdue).length} past target` : ''}</p></div>
      {kind === 'TASK' && <Button onClick={() => setAdd(true)}><Plus className="h-4 w-4" />New task</Button>}</div>
    <Card className="grid gap-2 p-3 sm:grid-cols-4"><Input aria-label="Search" placeholder="Search title, room or guest" value={q} onChange={(e) => setQ(e.target.value)} />
      <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}</Select>
      <Select aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Anyone</option>{staff.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Card>
    {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : !rows.length ? <EmptyState title={kind === 'TASK' ? 'No tasks' : 'No guest requests'} /> :
      <div className="grid gap-3 lg:grid-cols-4">{COLS.map(([st, name]) => { const col = rows.filter((r) => r.status === st); return <div key={st} className="space-y-2"><h2 className="flex items-center justify-between text-sm font-semibold">{name}<Badge>{col.length}</Badge></h2>
        {col.map((t) => <Card key={t.id} className={`p-3 text-sm ${t.priority === 'URGENT' || t.overdue ? 'border-destructive/60' : ''}`}>
          <button className="text-left font-medium hover:underline" onClick={() => setOpen(t)}>{t.title}</button>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"><span>{t.department}</span>{t.priority === 'URGENT' && <Badge tone="danger">Urgent</Badge>}{t.vip && <Badge tone="warning">VIP</Badge>}{t.source === 'GUEST_APP' && <Badge tone="info">Guest app</Badge>}</div>
          {timer(t) && <p className={`mt-1 text-xs ${t.overdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>{timer(t)}</p>}
          <div className="mt-2 flex items-center gap-1">
            <Select aria-label={`Assign ${t.title}`} className="h-8 flex-1 text-xs" value={t.assigneeId ?? ''} onChange={(e) => upd.mutate({ id: t.id, body: { assigneeId: e.target.value || null } })}><option value="">Unassigned</option>{staff.data?.filter((s) => s.department === t.department || s.id === t.assigneeId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            {NEXT[t.status] && <Button size="sm" onClick={() => upd.mutate({ id: t.id, body: { status: NEXT[t.status] } })}>{t.status === 'IN_PROGRESS' ? 'Done' : 'Start'}</Button>}
            {t.status === 'IN_PROGRESS' && <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: t.id, body: { status: 'BLOCKED' } })}>Block</Button>}
          </div></Card>)}</div>; })}</div>}
    {add && <NewTask onClose={() => setAdd(false)} />}
    {open && <Detail t={open} onClose={() => setOpen(null)} />}
  </div>;
}
