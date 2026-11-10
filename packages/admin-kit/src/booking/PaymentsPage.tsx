import { useState } from 'react';
import { Badge, Card, EmptyState, ErrorState, Input, Pagination, Select, Spinner, Table, Td, Th } from '../components/ui';
import { dt, label, METHODS, money, PRODUCT_LABEL, statusTone, type Product } from './fmt';
import { useList } from './hooks';

export default function PaymentsPage({ product }: { product?: Product }) {
  const [page, setPage] = useState(1); const [f, setF] = useState({ kind: '', method: '', from: '', to: '' });
  const q = useList<any>('/payments', { page, limit: 25, product, kind: f.kind || undefined, method: f.method || undefined, from: f.from || undefined, to: f.to || undefined });
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Payments</h1><p className="text-sm text-muted-foreground">Every payment and refund recorded against a booking.</p></div>
    <Card className="grid gap-2 p-3 sm:grid-cols-4"><Select aria-label="Kind" value={f.kind} onChange={s('kind')}><option value="">Payments &amp; refunds</option><option value="PAYMENT">Payments</option><option value="REFUND">Refunds</option></Select>
      <Select aria-label="Method" value={f.method} onChange={s('method')}><option value="">All methods</option>{METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}</Select>
      <Input aria-label="From" type="date" value={f.from} onChange={s('from')} /><Input aria-label="To" type="date" value={f.to} onChange={s('to')} /></Card>
    {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.data.length ? <EmptyState title="No payments" /> :
      <Card><Table><thead><tr><Th>Paid</Th><Th>Booking</Th><Th>Guest</Th><Th>Kind</Th><Th>Method</Th><Th>Reference</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead><tbody>
        {q.data.data.map((p: any) => <tr key={p.id}><Td className="whitespace-nowrap text-xs">{dt(p.paidAt)}</Td><Td className="font-medium">{p.booking?.bookingNo}<div className="text-xs text-muted-foreground">{p.booking?.product && PRODUCT_LABEL[p.booking.product as Product]}</div></Td><Td>{p.booking?.guestName}</Td><Td>{label(p.kind)}</Td><Td>{label(p.method)}</Td><Td className="text-xs">{p.reference}</Td><Td><Badge tone={statusTone(p.txStatus === 'SUCCEEDED' ? 'PAID' : p.txStatus === 'PENDING' ? 'PARTIAL' : 'UNPAID')}>{label(p.txStatus)}</Badge></Td><Td className="text-right tabular-nums">{p.kind === 'REFUND' ? '−' : ''}{money(p.amount, p.currencyCode)}</Td></tr>)}
      </tbody></Table>{q.data.meta && <Pagination page={q.data.meta.page} limit={q.data.meta.limit} total={q.data.meta.total} onPage={setPage} />}</Card>}
  </div>;
}
