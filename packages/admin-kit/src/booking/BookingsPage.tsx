import { Download, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Pagination, Select, Spinner, Table, Td, Th } from '../components/ui';
import { download } from '../lib/api';
import { useDebounced } from '../hooks/useDebounced';
import BookingDetail from './BookingDetail';
import { dt, label, money, PAY_STATUSES, PRODUCT_LABEL, SOURCES, STATUSES, statusTone, type Product } from './fmt';
import { useList } from './hooks';

/** Bookings list for one product (or all products when `product` is omitted). Click a row to open the booking. */
export default function BookingsPage({ product, newPath = '/bookings/new', title = 'Bookings' }: { product?: Product; newPath?: string | null; title?: string }) {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounced(q, 300);
  const [f, setF] = useState({ status: sp.get('status') ?? '', paymentStatus: '', source: '', from: '', to: '', basis: 'created', deleted: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(sp.get('open'));
  const query = { page, limit: 20, q: dq || undefined, product, status: f.status || undefined, paymentStatus: f.paymentStatus || undefined, source: f.source || undefined, from: f.from || undefined, to: f.to || undefined, basis: f.from || f.to ? f.basis : undefined, deleted: f.deleted || undefined, sort: 'createdAt', dir: 'desc' };
  const list = useList<any>('/bookings', query);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };
  const close = () => { setOpen(null); if (sp.get('open')) { sp.delete('open'); setSp(sp, { replace: true }); } };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{list.data?.meta ? `${list.data.meta.total} found` : ' '}</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => download('/bookings/export', { ...query, page: undefined, limit: undefined }, 'bookings.csv')}><Download className="h-4 w-4" />Export CSV</Button>
          {newPath && <Link to={newPath}><Button><Plus className="h-4 w-4" />New booking</Button></Link>}
        </div>
      </div>
      <Card className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="relative sm:col-span-2"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden /><Input aria-label="Search bookings" className="pl-8" placeholder="Booking no, guest, email, phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Select aria-label="Status" value={f.status} onChange={set('status')}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Select aria-label="Payment" value={f.paymentStatus} onChange={set('paymentStatus')}><option value="">All payments</option>{PAY_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Select aria-label="Source" value={f.source} onChange={set('source')}><option value="">All sources</option>{SOURCES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        <Input aria-label="From date" type="date" value={f.from} onChange={set('from')} />
        <Input aria-label="To date" type="date" value={f.to} onChange={set('to')} />
        <Select aria-label="Date basis" value={f.basis} onChange={set('basis')}><option value="created">By created date</option><option value="start">By start date</option></Select>
        <Select aria-label="Deleted" value={f.deleted} onChange={set('deleted')}><option value="">Active only</option><option value="true">Deleted</option></Select>
      </Card>
      {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : !list.data?.data.length ? <EmptyState title="No bookings match" hint="Try clearing a filter." /> : (
        <Card>
          <Table>
            <thead><tr><Th>Booking</Th>{!product && <Th>Product</Th>}<Th>Guest</Th><Th>What</Th><Th>When</Th><Th>Status</Th><Th>Payment</Th><Th className="text-right">Total</Th><Th className="text-right">Balance</Th></tr></thead>
            <tbody>
              {list.data.data.map((b: any) => (
                <tr key={b.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setOpen(b.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(b.id)}>
                  <Td className="font-medium">{b.bookingNo}{b.deletedAt && <Badge tone="danger" className="ml-1">deleted</Badge>}</Td>
                  {!product && <Td>{PRODUCT_LABEL[b.product as Product]}</Td>}
                  <Td>{b.guestName}<div className="text-xs text-muted-foreground">{b.guestEmail ?? b.guestPhone ?? ''}</div></Td>
                  <Td className="max-w-[16rem]"><div className="truncate">{b.summary?.title}</div><div className="truncate text-xs text-muted-foreground">{b.summary?.detail}</div></Td>
                  <Td className="whitespace-nowrap">{dt(b.startAt)}</Td>
                  <Td><Badge tone={statusTone(b.status)}>{label(b.status)}</Badge></Td>
                  <Td><Badge tone={statusTone(b.paymentStatus)}>{label(b.paymentStatus)}</Badge></Td>
                  <Td className="text-right tabular-nums">{money(b.totalAmount, b.currencyCode)}</Td>
                  <Td className="text-right tabular-nums">{Number(b.balance) > 0 ? money(b.balance, b.currencyCode) : '–'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {list.data.meta && <Pagination page={list.data.meta.page} limit={list.data.meta.limit} total={list.data.meta.total} onPage={setPage} />}
        </Card>
      )}
      {open && <BookingDetail id={open} onClose={close} />}
    </div>
  );
}
