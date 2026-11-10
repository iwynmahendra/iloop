import { useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea } from '../components/ui';
import { label, METHODS, toIsoOffset } from './fmt';
import { post, useAct, useGet } from './hooks';

const Footer = ({ onClose, busy, ok, danger, disabled }: { onClose: () => void; busy: boolean; ok: string; danger?: boolean; disabled?: boolean }) => (
  <><Button variant="outline" onClick={onClose}>Close</Button><Button type="submit" form="dlg" variant={danger ? 'destructive' : 'default'} loading={busy} disabled={disabled}>{ok}</Button></>
);
function Dlg({ title, onClose, onSubmit, busy, ok, danger, disabled, children }: { title: string; onClose: () => void; onSubmit: () => void; busy: boolean; ok: string; danger?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return <Modal open onClose={onClose} title={title} footer={<Footer onClose={onClose} busy={busy} ok={ok} danger={danger} disabled={disabled} />}><form id="dlg" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>{children}</form></Modal>;
}
interface Base { bookingId: string; itemId?: string; onClose: () => void }

export function HotelCheckInDialog({ bookingId, itemId, onClose, room }: Base & { room?: string | null }) {
  const [roomNumber, setRoom] = useState(room ?? '');
  const m = useAct(() => post(`/bookings/${bookingId}/check-in`, { roomNumber: roomNumber.trim(), itemId }), 'Guest checked in', onClose);
  return <Dlg title="Check in" onClose={onClose} onSubmit={() => m.mutate()} busy={m.isPending} ok="Check in" disabled={!roomNumber.trim()}>
    <Field label="Room number" required>{(id) => <Input id={id} autoFocus value={roomNumber} onChange={(e) => setRoom(e.target.value)} maxLength={20} />}</Field></Dlg>;
}
export function TripCheckInDialog({ bookingId, itemId, onClose, expected }: Base & { expected?: number }) {
  const [n, setN] = useState(String(expected ?? 1));
  const m = useAct(() => post(`/bookings/${bookingId}/check-in`, { participantsShown: Number(n), itemId }), 'Checked in', onClose);
  return <Dlg title="Check in participants" onClose={onClose} onSubmit={() => m.mutate()} busy={m.isPending} ok="Check in">
    <Field label="Participants who showed up" hint={expected != null ? `${expected} booked` : undefined}>{(id) => <Input id={id} type="number" min={0} value={n} onChange={(e) => setN(e.target.value)} />}</Field></Dlg>;
}
export function ClubCheckInDialog({ bookingId, itemId, onClose, expected, table }: Base & { expected?: number; table?: string | null }) {
  const [n, setN] = useState(String(expected ?? 1)); const [t, setT] = useState(table ?? '');
  const m = useAct(() => post(`/bookings/${bookingId}/check-in`, { count: Number(n), tableLabel: t.trim() || undefined, itemId }), 'Checked in', onClose);
  return <Dlg title="Door check-in" onClose={onClose} onSubmit={() => m.mutate()} busy={m.isPending} ok="Check in">
    <Field label="Guests arriving now">{(id) => <Input id={id} type="number" min={1} value={n} onChange={(e) => setN(e.target.value)} />}</Field>
    <Field label="Table (optional)">{(id) => <Input id={id} value={t} onChange={(e) => setT(e.target.value)} maxLength={20} />}</Field></Dlg>;
}
export function AssignDialog({ bookingId, itemId, onClose, driverId, vehicleId, pickupAt, vehicleTypeId }: Base & { driverId?: string | null; vehicleId?: string | null; pickupAt?: string; vehicleTypeId?: string }) {
  const [d, setD] = useState(driverId ?? ''); const [v, setV] = useState(vehicleId ?? ''); const [notes, setNotes] = useState('');
  const av = useGet<any>(pickupAt && vehicleTypeId ? '/availability/transport' : null, { vehicleTypeId, pickupAt });
  const m = useAct(() => post(`/bookings/${bookingId}/assign`, { driverId: d || null, vehicleId: v || null, driverNotes: notes || undefined, itemId }), 'Assignment saved', onClose);
  return <Dlg title="Assign driver & vehicle" onClose={onClose} onSubmit={() => m.mutate()} busy={m.isPending} ok="Save">
    <Field label="Driver" hint="Drivers marked busy have a job within the clash window">{(id) => <Select id={id} value={d} onChange={(e) => setD(e.target.value)}><option value="">Unassigned</option>{av.data?.drivers?.map((x: any) => <option key={x.id} value={x.id}>{x.name}{x.free ? '' : ' (busy)'}</option>)}</Select>}</Field>
    <Field label="Vehicle">{(id) => <Select id={id} value={v} onChange={(e) => setV(e.target.value)}><option value="">None</option>{av.data?.vehicles?.map((x: any) => <option key={x.id} value={x.id}>{x.plateNumber}{x.free ? '' : ' (busy)'}</option>)}</Select>}</Field>
    <Field label="Notes for the driver">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />}</Field></Dlg>;
}
export function PaymentDialog({ bookingId, balance, onClose }: { bookingId: string; balance: number; onClose: () => void }) {
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : ''); const [method, setMethod] = useState<string>('CASH'); const [ref, setRef] = useState(''); const [paidAt, setPaidAt] = useState('');
  const m = useAct(() => post(`/bookings/${bookingId}/payments`, { amount: Number(amount), method, reference: ref || undefined, paidAt: paidAt ? toIsoOffset(paidAt) : undefined }), 'Payment recorded', onClose);
  return <Dlg title="Record payment" onClose={onClose} onSubmit={() => m.mutate()} busy={m.isPending} ok="Record" disabled={!(Number(amount) > 0)}>
    <Field label="Amount" required>{(id) => <Input id={id} type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
    <Field label="Method">{(id) => <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select>}</Field>
    <Field label="Reference">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} />}</Field>
    <Field label="Paid at (optional)">{(id) => <Input id={id} type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />}</Field></Dlg>;
}
export function NoteDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [t, setT] = useState('');
  const m = useAct(() => post(`/bookings/${bookingId}/notes`, { message: t.trim() }), 'Note added', onClose);
  return <Dlg title="Add note" onClose={onClose} onSubmit={() => m.mutate()} busy={m.isPending} ok="Add" disabled={!t.trim()}>
    <Field label="Note">{(id) => <Textarea id={id} autoFocus rows={4} value={t} onChange={(e) => setT(e.target.value)} maxLength={2000} />}</Field></Dlg>;
}
export function CancelDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const prev = useGet<any>(`/bookings/${bookingId}/cancel-preview`);
  const [reason, setReason] = useState(''); const [refund, setRefund] = useState<string | null>(null);
  const suggested = prev.data?.refundable ?? 0;
  const m = useAct(() => post(`/bookings/${bookingId}/cancel`, { reason: reason.trim(), refundAmount: refund === null ? undefined : Number(refund) }), 'Booking cancelled', onClose);
  return <Dlg title="Cancel booking" danger onClose={onClose} onSubmit={() => m.mutate()} busy={m.isPending} ok="Cancel booking" disabled={reason.trim().length < 3}>
    {prev.data && <p className="rounded-md bg-muted p-3 text-sm">{prev.data.note}. Paid so far {prev.data.paid}; policy refund <strong>{prev.data.refundable}</strong>.</p>}
    <Field label="Reason" required>{(id) => <Textarea id={id} autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}</Field>
    <Field label="Refund amount" hint="Leave as suggested to follow the policy">{(id) => <Input id={id} type="number" min={0} step="any" value={refund ?? suggested} onChange={(e) => setRefund(e.target.value)} />}</Field></Dlg>;
}
export function RefundDialog({ bookingId, payments, onClose }: { bookingId: string; payments: any[]; onClose: () => void }) {
  const ok = payments.filter((p) => p.kind === 'PAYMENT' && p.txStatus === 'SUCCEEDED');
  const [pid, setPid] = useState(ok[0]?.id ?? ''); const [amount, setAmount] = useState(''); const [notes, setNotes] = useState('');
  const m = useAct(() => post(`/bookings/${bookingId}/refunds`, { paymentId: pid, amount: Number(amount), notes: notes || undefined }), 'Refund recorded', onClose);
  return <Dlg title="Refund a payment" danger onClose={onClose} onSubmit={() => m.mutate()} busy={m.isPending} ok="Refund" disabled={!pid || !(Number(amount) > 0)}>
    <Field label="Payment">{(id) => <Select id={id} value={pid} onChange={(e) => setPid(e.target.value)}>{ok.map((p) => <option key={p.id} value={p.id}>{label(p.method)} · {p.amount} · {String(p.paidAt).slice(0, 10)}</option>)}</Select>}</Field>
    <Field label="Amount" required>{(id) => <Input id={id} type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
    <Field label="Notes">{(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />}</Field></Dlg>;
}
