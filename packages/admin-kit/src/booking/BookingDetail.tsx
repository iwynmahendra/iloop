import { useState } from 'react';
import { Badge, Button, ConfirmDialog, ErrorState, Modal, Spinner } from '../components/ui';
import { useAuth } from '../lib/auth';
import { AssignDialog, CancelDialog, ClubCheckInDialog, HotelCheckInDialog, NoteDialog, PaymentDialog, RefundDialog, TripCheckInDialog } from './dialogs';
import { day, dt, hm, label, money, PRODUCT_LABEL, statusTone, type Product } from './fmt';
import { post, useAct, useGet } from './hooks';

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => v === null || v === undefined || v === '' ? null : <div className="flex justify-between gap-4 py-1 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>;
const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;

function ItemInfo({ b }: { b: any }) {
  const items: any[] = b.items ?? [];
  return <>{items.map((i) => (
    <dl key={i.id} className="rounded-md border p-3">
      {b.product === 'HOTEL' && <><Row k="Hotel" v={i.hotel?.name} /><Row k="Room" v={`${i.roomType?.name ?? ''} × ${i.rooms}`} /><Row k="Rate plan" v={i.ratePlan?.name} /><Row k="Stay" v={`${day(i.checkIn)} → ${day(i.checkOut)} (${i.nights} nights)`} /><Row k="Guests" v={`${i.adults} adults, ${i.children} children`} /><Row k="Room number" v={i.roomNumber} /><Row k="Checked in" v={dt(i.checkedInAt)} /><Row k="Checked out" v={dt(i.checkedOutAt)} /></>}
      {b.product === 'TRIP' && <><Row k="Trip" v={i.trip?.title} /><Row k="Option" v={i.variant?.name} /><Row k="Departure" v={`${day(i.schedule?.date)} ${hm(i.schedule?.startTime)}`} /><Row k="Guests" v={`${i.adults} adults, ${i.children} children`} /><Row k="Meeting point" v={i.trip?.meetingPoint} /><Row k="Pickup" v={i.pickupAddress} /><Row k="Checked in" v={i.checkedInAt ? `${dt(i.checkedInAt)} (${i.participantsShown} showed)` : ''} /></>}
      {b.product === 'TRANSPORT' && <><Row k="Service" v={i.service?.name} /><Row k="Vehicle type" v={i.vehicleType?.name} /><Row k="Pickup" v={`${dt(i.pickupAt)}${i.isReturnLeg ? ' (return)' : ''}`} /><Row k="From" v={i.pickupAddress} /><Row k="To" v={i.dropoffAddress} /><Row k="Flight" v={i.flightNumber} /><Row k="Passengers" v={`${i.passengers} pax, ${i.luggage} bags`} /><Row k="Assignment" v={<Badge tone={i.assignmentStatus === 'UNASSIGNED' ? 'warning' : 'info'}>{label(i.assignmentStatus)}</Badge>} /><Row k="Driver" v={i.driver ? `${i.driver.name} ${i.driver.phone ?? ''}` : ''} /><Row k="Vehicle" v={i.vehicle?.plateNumber} /></>}
      {b.product === 'CLUB' && <><Row k="Club" v={i.club?.name} /><Row k="Event" v={i.event?.title} /><Row k="Product" v={i.ticketType?.name ?? i.tablePackage?.name} /><Row k="Date" v={`${day(i.visitDate)} ${i.arrivalTime ?? ''}`} /><Row k="Guests" v={`${i.guests} (qty ${i.quantity})`} /><Row k="Table" v={i.tableLabel} /><Row k="Checked in" v={i.checkedInAt ? `${i.checkedInCount} at ${dt(i.checkedInAt)}` : ''} /></>}
    </dl>
  ))}</>;
}

/** Side panel with the full booking and every action the API allows. */
export default function BookingDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuth();
  const q = useGet<any>(`/bookings/${id}`);
  const emails = useGet<any[]>(`/bookings/${id}/emails`);
  const [dlg, setDlg] = useState<null | 'pay' | 'note' | 'cancel' | 'refund' | 'checkin' | 'assign' | 'delete'>(null);
  const b = q.data;
  const status = useAct((to: string) => post(`/bookings/${id}/status`, { status: to }), 'Status updated');
  const checkout = useAct(() => post(`/bookings/${id}/check-out`), 'Checked out');
  const dispatch = useAct((s: string) => post(`/bookings/${id}/dispatch`, { status: s }), 'Dispatch updated');
  const restore = useAct(() => post(`/bookings/${id}/restore`), 'Booking restored');
  const del = useAct(() => import('../lib/api').then((m) => m.api(`/bookings/${id}`, { method: 'DELETE' })), 'Booking deleted', onClose);
  const resend = useAct((eid: string) => post(`/bookings/${id}/emails/${eid}/resend`), 'Email queued');
  const notStaff = user?.role !== 'SUPPLIER_STAFF';
  const open = b && ['PENDING', 'CONFIRMED'].includes(b.status);
  const item = b?.items?.[0];
  const close = () => setDlg(null);
  return (
    <Modal open onClose={onClose} side title={b ? `${PRODUCT_LABEL[b.product as Product]} booking ${b.bookingNo}` : 'Booking'}>
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : b && (
        <div>
          <div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(b.status)}>{label(b.status)}</Badge><Badge tone={statusTone(b.paymentStatus)}>{label(b.paymentStatus)}</Badge><Badge>{label(b.source)}</Badge>{b.deletedAt && <Badge tone="danger">Deleted</Badge>}
            {b.holdExpiresAt && b.status === 'PENDING' && <span className="text-xs text-warning">Hold expires {dt(b.holdExpiresAt)}</span>}</div>
          {b.deletedAt ? (notStaff && <div className="mt-3"><Button onClick={() => restore.mutate()} loading={restore.isPending}>Restore booking</Button></div>) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {b.status === 'PENDING' && <Button size="sm" onClick={() => status.mutate('CONFIRMED')} loading={status.isPending}>Confirm</Button>}
              {b.status === 'CONFIRMED' && b.product === 'HOTEL' && !item?.checkedInAt && <Button size="sm" onClick={() => setDlg('checkin')}>Check in</Button>}
              {b.status === 'CONFIRMED' && b.product === 'HOTEL' && item?.checkedInAt && !item?.checkedOutAt && <Button size="sm" onClick={() => checkout.mutate()} loading={checkout.isPending}>Check out</Button>}
              {b.status === 'CONFIRMED' && (b.product === 'TRIP' || b.product === 'CLUB') && <Button size="sm" onClick={() => setDlg('checkin')}>Check in</Button>}
              {b.status === 'CONFIRMED' && b.product === 'TRANSPORT' && <>
                <Button size="sm" variant="outline" onClick={() => setDlg('assign')}>Assign</Button>
                {['ASSIGNED', 'ON_THE_WAY', 'PICKED_UP'].includes(item?.assignmentStatus) && <Button size="sm" onClick={() => dispatch.mutate(({ ASSIGNED: 'ON_THE_WAY', ON_THE_WAY: 'PICKED_UP', PICKED_UP: 'DROPPED_OFF' } as any)[item.assignmentStatus])} loading={dispatch.isPending}>{({ ASSIGNED: 'On the way', ON_THE_WAY: 'Picked up', PICKED_UP: 'Dropped off' } as any)[item.assignmentStatus]}</Button>}</>}
              {b.status === 'CONFIRMED' && <Button size="sm" variant="outline" onClick={() => status.mutate('COMPLETED')}>Complete</Button>}
              {b.status === 'CONFIRMED' && <Button size="sm" variant="outline" onClick={() => status.mutate('NO_SHOW')}>No-show</Button>}
              {Number(b.balance) > 0 && !['CANCELLED', 'EXPIRED'].includes(b.status) && <Button size="sm" variant="outline" onClick={() => setDlg('pay')}>Record payment</Button>}
              {notStaff && Number(b.paidAmount) > 0 && <Button size="sm" variant="outline" onClick={() => setDlg('refund')}>Refund</Button>}
              <Button size="sm" variant="outline" onClick={() => setDlg('note')}>Add note</Button>
              {open && <Button size="sm" variant="destructive" onClick={() => setDlg('cancel')}>Cancel</Button>}
              {notStaff && <Button size="sm" variant="ghost" onClick={() => setDlg('delete')}>Delete</Button>}
            </div>
          )}
          <H>Guest</H>
          <dl><Row k="Name" v={b.guestName} /><Row k="Email" v={b.guestEmail} /><Row k="Phone" v={b.guestPhone} /><Row k="Country" v={b.guestCountryCode} /><Row k="Room (guest app)" v={b.roomNumber} /><Row k="Special requests" v={b.specialRequests} /><Row k="Internal notes" v={b.internalNotes} /><Row k="External ref" v={b.externalRef} />{b.supplier && <Row k="Supplier" v={`${b.supplier.code} · ${b.supplier.name}`} />}</dl>
          <H>Booking</H>
          <ItemInfo b={b} />
          <H>Charges</H>
          <table className="w-full text-sm"><tbody>
            {b.lines?.map((l: any) => <tr key={l.id}><td className="py-0.5">{l.description}{Number(l.quantity) !== 1 && <span className="text-muted-foreground"> × {Number(l.quantity)}</span>}</td><td className="py-0.5 text-right tabular-nums">{money(l.amount, b.currencyCode)}</td></tr>)}
            <tr className="border-t font-semibold"><td className="pt-1">Total</td><td className="pt-1 text-right tabular-nums">{money(b.totalAmount, b.currencyCode)}</td></tr>
            <tr><td>Paid</td><td className="text-right tabular-nums">{money(b.paidAmount, b.currencyCode)}</td></tr>
            <tr><td>Balance</td><td className="text-right tabular-nums">{money(b.balance, b.currencyCode)}</td></tr>
            {Number(b.commissionAmount) > 0 && <tr className="text-muted-foreground"><td>Commission</td><td className="text-right tabular-nums">{money(b.commissionAmount, b.currencyCode)}</td></tr>}
          </tbody></table>
          {b.policy && <p className="mt-2 text-xs text-muted-foreground">Policy {b.policy.name}: {b.policy.rules.map((r: any) => `${r.refundPercent}% ≥ ${r.hoursBeforeStart}h`).join(', ')}</p>}
          {!!b.payments?.length && <><H>Payments</H><ul className="space-y-1 text-sm">{b.payments.map((p: any) => <li key={p.id} className="flex justify-between gap-2"><span>{p.kind === 'REFUND' ? 'Refund' : 'Payment'} · {label(p.method)}{p.reference ? ` · ${p.reference}` : ''} <span className="text-xs text-muted-foreground">{dt(p.paidAt)}</span>{p.txStatus !== 'SUCCEEDED' && <Badge className="ml-1" tone="warning">{label(p.txStatus)}</Badge>}</span><span className="tabular-nums">{p.kind === 'REFUND' ? '−' : ''}{money(p.amount, p.currencyCode)}</span></li>)}</ul></>}
          {!!b.guests?.length && <><H>Guest list</H><ul className="text-sm">{b.guests.map((g: any) => <li key={g.id}>{g.fullName} <span className="text-xs text-muted-foreground">{label(g.guestType)}{g.isLead ? ' · lead' : ''}</span></li>)}</ul></>}
          {!!emails.data?.length && <><H>Emails</H><ul className="space-y-1 text-sm">{emails.data.map((m: any) => <li key={m.id} className="flex items-center justify-between gap-2"><span className="truncate">{m.subject} <span className="text-xs text-muted-foreground">→ {m.toEmail} · {label(m.status)}</span></span><Button size="sm" variant="ghost" onClick={() => resend.mutate(m.id)}>Resend</Button></li>)}</ul></>}
          <H>History</H>
          <ol className="space-y-1 text-sm">{[...(b.events ?? [])].reverse().map((e: any) => <li key={e.id}><span className="text-xs text-muted-foreground">{dt(e.createdAt)} · {e.actorName ?? 'system'}</span><br />{e.message ?? label(e.eventType)}</li>)}</ol>
          {dlg === 'pay' && <PaymentDialog bookingId={id} balance={Number(b.balance)} onClose={close} />}
          {dlg === 'note' && <NoteDialog bookingId={id} onClose={close} />}
          {dlg === 'cancel' && <CancelDialog bookingId={id} onClose={close} />}
          {dlg === 'refund' && <RefundDialog bookingId={id} payments={b.payments ?? []} onClose={close} />}
          {dlg === 'checkin' && b.product === 'HOTEL' && <HotelCheckInDialog bookingId={id} itemId={item?.id} room={b.roomNumber} onClose={close} />}
          {dlg === 'checkin' && b.product === 'TRIP' && <TripCheckInDialog bookingId={id} itemId={item?.id} expected={item ? item.adults + item.children : undefined} onClose={close} />}
          {dlg === 'checkin' && b.product === 'CLUB' && <ClubCheckInDialog bookingId={id} itemId={item?.id} expected={item?.guests} table={item?.tableLabel} onClose={close} />}
          {dlg === 'assign' && <AssignDialog bookingId={id} itemId={item?.id} driverId={item?.driver?.id} vehicleId={item?.vehicle?.id} pickupAt={item?.pickupAt} vehicleTypeId={item?.vehicleType?.id} onClose={close} />}
          <ConfirmDialog open={dlg === 'delete'} title="Delete booking" danger confirmLabel="Delete" message="The booking is hidden from lists and can be restored by an admin." loading={del.isPending} onConfirm={() => del.mutate()} onCancel={close} />
        </div>
      )}
    </Modal>
  );
}
