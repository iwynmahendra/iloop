import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Upload as UploadIcon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useDebounced } from '@/hooks/useDebounced';
import { Button, Input, Modal, Spinner } from './ui';

export const MAX_MB = 5;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export interface Media { id: string; url: string; originalName: string; altText: string | null; folder: string | null; width: number | null; height: number | null; sizeBytes: number; deletedAt: string | null }

/** Drag-and-drop or pick images, preview them, validate type/size, then upload. */
export function UploadZone({ folder, onDone }: { folder?: string; onDone?: (m: Media[]) => void }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [busy, setBusy] = useState(false); const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);
  const add = (list: FileList | File[]) => {
    const good: { file: File; url: string }[] = [];
    for (const f of Array.from(list)) {
      if (!OK_TYPES.includes(f.type)) { toast.error(`${f.name}: only JPEG, PNG, WebP or GIF`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name}: larger than ${MAX_MB} MB`); continue; }
      good.push({ file: f, url: URL.createObjectURL(f) });
    }
    setFiles((p) => [...p, ...good].slice(0, 10));
  };
  const upload = async () => {
    setBusy(true);
    try {
      const fd = new FormData(); files.forEach((f) => fd.append('files', f.file)); if (folder) fd.set('folder', folder);
      const r = await api<Media[]>('/shared/media-assets/upload', { method: 'POST', form: fd });
      toast.success(`${r.data.length} image(s) uploaded`); setFiles([]); qc.invalidateQueries({ queryKey: ['media'] }); onDone?.(r.data);
    } catch (e) { toast.error((e as ApiError).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm ${over ? 'border-primary bg-primary/5' : 'border-input'}`}>
        <ImagePlus className="h-7 w-7 text-muted-foreground" aria-hidden />
        <p>Drag images here or <button type="button" className="text-primary underline" onClick={() => input.current?.click()}>browse</button></p>
        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF · up to {MAX_MB} MB each · up to 10 at a time</p>
        <input ref={input} type="file" multiple accept={OK_TYPES.join(',')} className="sr-only" aria-label="Choose images" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
      </div>
      {files.length > 0 && (
        <>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {files.map((f, i) => (
              <li key={f.url} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                <img src={f.url} alt={f.file.name} className="h-full w-full object-cover" />
                <button type="button" aria-label={`Remove ${f.file.name}`} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <Button onClick={upload} loading={busy}><UploadIcon className="h-4 w-4" />Upload {files.length} image{files.length > 1 ? 's' : ''}</Button>
        </>
      )}
    </div>
  );
}

export function MediaPicker({ open, onClose, onPick, exclude = [] }: { open: boolean; onClose: () => void; onPick: (m: Media[]) => void; exclude?: string[] }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q);
  const [sel, setSel] = useState<Media[]>([]);
  const list = useQuery({ queryKey: ['media', 'picker', dq], enabled: open, queryFn: () => api<Media[]>('/shared/media-assets', { query: { limit: 60, q: dq, sort: 'createdAt:desc' } }) });
  useEffect(() => { if (!open) setSel([]); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Choose images" wide footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!sel.length} onClick={() => { onPick(sel); onClose(); }}>Add {sel.length || ''} selected</Button></>}>
      <div className="space-y-4">
        <UploadZone onDone={(m) => setSel((p) => [...p, ...m])} />
        <Input placeholder="Search by file name or description" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
        {list.isLoading ? <Spinner /> : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {list.data?.data.filter((m) => !exclude.includes(m.id)).map((m) => {
              const on = sel.some((s) => s.id === m.id);
              return (
                <li key={m.id}><button type="button" aria-pressed={on} title={m.originalName} onClick={() => setSel((p) => on ? p.filter((s) => s.id !== m.id) : [...p, m])}
                  className={`relative aspect-square w-full overflow-hidden rounded-md border-2 ${on ? 'border-primary' : 'border-transparent'}`}><img src={m.url} alt={m.altText ?? m.originalName} loading="lazy" className="h-full w-full object-cover" />{on && <span className="absolute right-1 top-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">✓</span>}</button></li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
