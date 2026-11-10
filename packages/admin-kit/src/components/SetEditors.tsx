import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, GripVertical, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ResourceDef, SetDef } from '../generated/resources';
import { api } from '../lib/api';
import { Button, Input, Spinner } from './ui';
import { MediaPicker, type Media } from './Upload';

const SCOPE: Record<string, string> = { Hotel: 'HOTEL', RoomType: 'ROOM', VehicleType: 'VEHICLE', Club: 'CLUB' };
type Img = { mediaId: string; caption: string; isCover: boolean; url: string; alt: string };

export function AmenitiesEditor({ def, id, items, canWrite, onSaved }: { def: ResourceDef; id: string; items: any[]; canWrite: boolean; onSaved: () => void }) {
  const scope = SCOPE[def.name];
  const all = useQuery({ queryKey: ['amenities', scope], queryFn: () => api<any[]>('/shared/amenities', { query: { limit: 100, scope, sort: 'name:asc' } }) });
  const initial = items.map((i) => i.amenityId as string);
  const [sel, setSel] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSel(initial), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = sel.length !== initial.length || sel.some((x) => !initial.includes(x));
  const save = async () => {
    setBusy(true);
    try { await api(`/${def.group}/${def.path}/${id}/amenities`, { method: 'PUT', body: { amenityIds: sel } }); toast.success('Amenities saved'); onSaved(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  if (all.isLoading) return <Spinner />;
  return (
    <fieldset disabled={!canWrite} className="space-y-3">
      <legend className="sr-only">Amenities</legend>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {all.data?.data.map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={sel.includes(a.id)} onChange={(e) => setSel((p) => e.target.checked ? [...p, a.id] : p.filter((x) => x !== a.id))} />{a.name}</label>
        ))}
        {!all.data?.data.length && <p className="text-sm text-muted-foreground">No amenities defined for this type yet (Shared data → Amenities).</p>}
      </div>
      {canWrite && <Button size="sm" onClick={save} loading={busy} disabled={!dirty}>Save amenities</Button>}
    </fieldset>
  );
}

export function ImagesEditor({ def, id, items, canWrite, onSaved }: { def: ResourceDef; id: string; items: any[]; canWrite: boolean; onSaved: () => void }) {
  const toState = (rows: any[]): Img[] => rows.map((r) => ({ mediaId: r.mediaId, caption: r.caption ?? '', isCover: r.isCover, url: r.media?.url, alt: r.media?.altText ?? r.media?.originalName ?? '' }));
  const [imgs, setImgs] = useState<Img[]>(toState(items));
  const [pick, setPick] = useState(false); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => setImgs(toState(items)), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (from: number, to: number) => setImgs((p) => { if (to < 0 || to >= p.length) return p; const n = [...p]; n.splice(to, 0, n.splice(from, 1)[0]!); return n; });
  const save = async () => {
    setBusy(true);
    try {
      await api(`/${def.group}/${def.path}/${id}/images`, { method: 'PUT', body: { items: imgs.map((i) => ({ mediaId: i.mediaId, caption: i.caption || null, isCover: i.isCover })) } });
      toast.success('Gallery saved'); onSaved();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const orig = JSON.stringify(toState(items).map(({ mediaId, caption, isCover }) => ({ mediaId, caption, isCover })));
  const dirty = JSON.stringify(imgs.map(({ mediaId, caption, isCover }) => ({ mediaId, caption, isCover }))) !== orig;
  return (
    <div className="space-y-3">
      {imgs.length === 0 && <p className="text-sm text-muted-foreground">No images yet.</p>}
      <ul className="space-y-2">
        {imgs.map((im, i) => (
          <li key={im.mediaId} draggable={canWrite} onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }}
            className="flex items-center gap-2 rounded-md border bg-background p-2">
            {canWrite && <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />}
            <img src={im.url} alt={im.alt} className="h-14 w-14 shrink-0 rounded object-cover" />
            <Input aria-label="Caption" placeholder="Caption" disabled={!canWrite} value={im.caption} onChange={(e) => setImgs((p) => p.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))} />
            {canWrite && (<>
              <Button variant={im.isCover ? 'secondary' : 'ghost'} size="icon" aria-label={im.isCover ? 'Cover image' : 'Set as cover'} aria-pressed={im.isCover} onClick={() => setImgs((p) => p.map((x, j) => ({ ...x, isCover: j === i })))}><Star className={`h-4 w-4 ${im.isCover ? 'fill-current text-warning' : ''}`} /></Button>
              <Button variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Move down" disabled={i === imgs.length - 1} onClick={() => move(i, i + 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Remove image" onClick={() => setImgs((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </>)}
          </li>
        ))}
      </ul>
      {canWrite && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPick(true)}><Plus className="h-4 w-4" />Add images</Button>
          <Button size="sm" onClick={save} loading={busy} disabled={!dirty}>Save gallery</Button>
        </div>
      )}
      <MediaPicker open={pick} onClose={() => setPick(false)} exclude={imgs.map((i) => i.mediaId)} onPick={(m: Media[]) => setImgs((p) => [...p, ...m.map((x) => ({ mediaId: x.id, caption: '', isCover: p.length === 0 && x === m[0], url: x.url, alt: x.altText ?? x.originalName }))])} />
    </div>
  );
}

export function SetSection({ def, set, id, items, canWrite }: { def: ResourceDef; set: SetDef; id: string; items: any[]; canWrite: boolean }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['detail', def.path, id] });
  return set.kind === 'join' ? <AmenitiesEditor def={def} id={id} items={items} canWrite={canWrite} onSaved={refresh} /> : <ImagesEditor def={def} id={id} items={items} canWrite={canWrite} onSaved={refresh} />;
}
