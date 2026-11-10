import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Spinner, Switch, Textarea, api, useAct, useAuth, useGet } from '@booking/admin-kit';
import { useState } from 'react';

/** Documents the guest assistant is allowed to answer from. */
export default function Knowledge() {
  const { user } = useAuth(); const admin = user?.role !== 'SUPPLIER_STAFF'; const q = useGet<any[]>('/ops/kb'); const [f, setF] = useState<any>(null);
  const save = useAct(() => f.id ? api(`/ops/kb/${f.id}`, { method: 'PATCH', body: { title: f.title, category: f.category, body: f.body, active: f.active } }) : api('/ops/kb', { method: 'POST', body: { title: f.title, category: f.category, body: f.body, active: f.active } }), 'Saved', () => setF(null));
  const del = useAct((id: string) => api(`/ops/kb/${id}`, { method: 'DELETE' }), 'Removed');
  const toggle = useAct((d: any) => api(`/ops/kb/${d.id}`, { method: 'PATCH', body: { active: !d.active } }));
  return <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Knowledge base</h1><p className="text-sm text-muted-foreground">What the guest assistant knows. It answers only from these documents and the guest's own stay.</p></div>{admin && <Button onClick={() => setF({ title: '', category: 'General', body: '', active: true })}>Add document</Button>}</div>
    {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title="No documents" hint="Add opening hours, policies, prices and local tips." /> :
      <div className="grid gap-3 md:grid-cols-2">{q.data.map((d) => <Card key={d.id} className="p-4 text-sm"><div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold">{d.title}</h2><Badge className="mt-1">{d.category}</Badge></div>{admin && <Switch label={`${d.title} visible to guests`} checked={d.active} onChange={() => toggle.mutate(d)} />}</div>
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-muted-foreground">{d.body}</p>{admin && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => setF({ ...d })}>Edit</Button><Button size="sm" variant="ghost" onClick={() => del.mutate(d.id)}>Remove</Button></div>}</Card>)}</div>}
    {f && <Modal open wide onClose={() => setF(null)} title={f.id ? 'Edit document' : 'Add document'} footer={<><Button variant="outline" onClick={() => setF(null)}>Cancel</Button><Button onClick={() => save.mutate()} loading={save.isPending} disabled={!f.title.trim() || !f.body.trim()}>Save</Button></>}>
      <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Title" required>{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} />}</Field><Field label="Category">{(id) => <Input id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} maxLength={40} />}</Field></div>
        <Field label="Content" hint="Plain text. Short paragraphs with a heading line work best." required>{(id) => <Textarea id={id} rows={12} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field></div></Modal>}</div>;
}
