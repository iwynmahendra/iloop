import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui-style primitives: local components built with Tailwind + class-variance-authority.
const buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: { default: 'bg-primary text-primary-foreground hover:bg-primary/90', outline: 'border border-input bg-background hover:bg-accent', secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80', ghost: 'hover:bg-accent', destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90', link: 'text-primary underline-offset-4 hover:underline' },
    size: { default: 'h-9 px-4', sm: 'h-8 px-3 text-xs', icon: 'h-9 w-9' },
  }, defaultVariants: { variant: 'default', size: 'default' },
});
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, children, disabled, type = 'button', ...p }, ref) => (
  <button ref={ref} type={type} disabled={disabled || loading} className={cn(buttonVariants({ variant, size }), className)} {...p}>{loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}</button>
));

const field = 'flex w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(field, 'h-9', className)} {...p} />);
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, 'min-h-[80px] py-2', className)} {...p} />);
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(field, 'h-9 pr-8', className)} {...p} />);
export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label className={cn('text-sm font-medium leading-none', className)} {...p} />;

export function Field({ label, error, hint, required, children }: { label: string; error?: string; hint?: string; required?: boolean; children: (id: string, invalid: boolean) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required && <span className="text-destructive" aria-hidden> *</span>}</Label>
      {children(id, !!error)}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...p} />;

const badge = cva('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: { tone: { neutral: 'bg-secondary text-secondary-foreground', success: 'bg-success/15 text-success', warning: 'bg-warning/15 text-warning', danger: 'bg-destructive/15 text-destructive', info: 'bg-primary/15 text-primary' } }, defaultVariants: { tone: 'neutral' },
});
export const Badge = ({ tone, className, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) => <span className={cn(badge({ tone }), className)} {...p} />;
export const StatusBadge = ({ status, deleted }: { status: string; deleted?: boolean }) => deleted ? <Badge tone="danger">Deleted</Badge> : <Badge tone={status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' || status === 'DISABLED' ? 'danger' : 'neutral'}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;

export function Spinner({ label = 'Loading' }: { label?: string }) { return <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{label}…</div>; }
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-2 py-14 text-center"><Inbox className="h-9 w-9 text-muted-foreground" aria-hidden /><p className="font-medium">{title}</p>{hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}{action}</div>;
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div role="alert" className="flex flex-col items-center gap-2 py-12 text-center"><AlertCircle className="h-8 w-8 text-destructive" aria-hidden /><p className="text-sm">{(error as Error)?.message ?? 'Something went wrong'}</p>{retry && <Button variant="outline" size="sm" onClick={retry}>Try again</Button>}</div>;
}

/** Modal dialog (also used as a side drawer). Escape and backdrop click close it; focus moves into it. */
export function Modal({ open, onClose, title, children, footer, wide, side }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean; side?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={cn('relative z-10 flex max-h-full flex-col bg-card shadow-xl', side ? 'ml-auto h-full w-full max-w-xl' : cn('m-auto w-[calc(100%-2rem)] rounded-lg border', wide ? 'max-w-3xl' : 'max-w-lg'))}>
        <div className="flex items-center justify-between gap-2 border-b px-5 py-3"><h2 className="text-base font-semibold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button></div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, loading, onConfirm, onCancel }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return <Modal open={open} onClose={onCancel} title={title} footer={<><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant={danger ? 'destructive' : 'default'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}><div className="text-sm">{message}</div></Modal>;
}

export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-3 text-sm text-muted-foreground">
      <span>{total === 0 ? 'No results' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="px-2">Page {page} of {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export const Switch = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-primary' : 'bg-input')}>
    <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
  </button>
);

export const Table = ({ className, ...p }: React.TableHTMLAttributes<HTMLTableElement>) => <div className="overflow-x-auto"><table className={cn('w-full text-sm', className)} {...p} /></div>;
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn('whitespace-nowrap border-b bg-muted/50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)} {...p} />;
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('border-b px-3 py-2 align-middle', className)} {...p} />;
