import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { UploadZone, type Media } from '@/components/Upload';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Pagination, Select, Spinner } from '@/components/ui';
import { useDebounced } from '@/hooks/useDebounced';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const LIMIT = 24;
export default function MediaLibrary() {
  const { user, can, scopeSupplier } = useAuth(); const qc = useQueryClient();
  const [page, setPage] = useState(1); const [q, setQ] = useState(''); const dq = useDebounced(q); const [deleted, setDeleted] = useState('exclude');
  const needSupplier = user?.role === 'SUPER_ADMIN' && !scopeSupplier;
  const list = useQuery({ queryKey: ['media', page, dq, deleted, scopeSupplier], queryFn: () => api<Media[]>('/shared/media-assets', { query: { page, limit: LIMIT, q: dq, deleted, sort: 'createdAt:desc' } }), placeholderData: (p) => p });
  const [edit, setEdit] = useState<Media | null>(null); const [alt, setAlt] = useState(''); const [folder, setFolder] = useState(''); const [del, setDel] = useState<Media | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['media'] });
  const save = async (e: FormEvent) => { e.preventDefault(); try { await api(`/shared/media-assets/${edit!.id}`, { method: 'PATCH', body: { altText: alt || null, folder: folder || null } }); toast.success('Saved'); setEdit(null); refresh(); } catch (x) { toast.error((x as Error).message); } };
  const remove = useMutation({ mutationFn: (id: string) => api(`/shared/media-assets/${id}`, { method: 'DELETE' }), onSuccess: () => { toast.success('Image deleted'); setDel(null); refresh(); }, onError: (e: Error) => { toast.error(e.message); setDel(null); } });
  const restore = useMutation({ mutationFn: (id: string) => api(`/shared/media-assets/${id}/restore`, { method: 'POST' }), onSuccess: () => { toast.success('Restored'); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const rows = list.data?.data ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Media library</h1>
      {needSupplier ? <p role="note" className="rounded-md bg-warning/10 p-2.5 text-sm">Choose a supplier in the top bar to upload images for it. You are viewing all suppliers.</p> : <Card className="p-4"><UploadZone /></Card>}
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input className="pl-8" aria-label="Search" placeholder="Search file name, description, folder" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          {can.remove && <Select aria-label="Deleted" className="w-36" value={deleted} onChange={(e) => { setDeleted(e.target.value); setPage(1); }}><option value="exclude">Not deleted</option><option value="only">Deleted only</option></Select>}
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : rows.length === 0 ? <EmptyState title="No images yet" hint="Upload images above, then attach them to hotels, rooms, trips, vehicles and clubs." /> : (
          <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {rows.map((m) => (
              <li key={m.id} className="group overflow-hidden rounded-md border">
                <div className="aspect-square bg-muted"><img src={m.url} alt={m.altText ?? m.originalName} loading="lazy" className={`h-full w-full object-cover ${m.deletedAt ? 'opacity-40' : ''}`} /></div>
                <div className="flex items-center justify-between gap-1 p-2"><span className="min-w-0"><span className="block truncate text-xs font-medium" title={m.originalName}>{m.originalName}</span><span className="block text-xs text-muted-foreground">{m.width}×{m.height} · {Math.round(m.sizeBytes / 1024)} KB</span></span>
                  <span className="flex shrink-0">
                    {!m.deletedAt && <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${m.originalName}`} onClick={() => { setEdit(m); setAlt(m.altText ?? ''); setFolder(m.folder ?? ''); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {can.remove && (m.deletedAt ? <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Restore ${m.originalName}`} onClick={() => restore.mutate(m.id)}><RotateCcw className="h-3.5 w-3.5" /></Button> : <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete ${m.originalName}`} onClick={() => setDel(m)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>)}
                  </span></div>
              </li>))}
          </ul>
        )}
        {(list.data?.meta?.total ?? 0) > 0 && <div className="border-t px-3"><Pagination page={page} limit={LIMIT} total={list.data!.meta!.total} onPage={setPage} /></div>}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit image details" footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" form="media-form">Save</Button></>}>
        <form id="media-form" onSubmit={save} className="space-y-4">
          {edit && <img src={edit.url} alt="" className="mx-auto max-h-48 rounded" />}
          <Field label="Description (alt text)" hint="Read aloud by screen readers and shown if the image fails to load.">{(id) => <Input id={id} maxLength={255} value={alt} onChange={(e) => setAlt(e.target.value)} />}</Field>
          <Field label="Folder">{(id) => <Input id={id} maxLength={120} value={folder} onChange={(e) => setFolder(e.target.value)} />}</Field>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} danger title="Delete image?" confirmLabel="Delete" loading={remove.isPending} message={<>“{del?.originalName}” will be hidden from the library. It can be restored later. Galleries that already use it keep showing it.</>} onCancel={() => setDel(null)} onConfirm={() => remove.mutate(del!.id)} />
    </div>
  );
}
