import { Field, Input, NewBookingShell, Select, Textarea, toIsoOffset, useOptions } from '@booking/admin-kit';
import { useState } from 'react';

export default function NewBooking() {
  const services = useOptions('/transport/transport-services'); const zones = useOptions('/transport/transport-zones'); const vts = useOptions('/transport/vehicle-types');
  const [mode, setMode] = useState<'service' | 'route'>('service');
  const [serviceId, setSvc] = useState(''); const [fromZoneId, setFrom] = useState(''); const [toZoneId, setTo] = useState(''); const [vehicleTypeId, setVt] = useState('');
  const [pickupAt, setPickupAt] = useState(''); const [pickupAddress, setPA] = useState(''); const [dropoffAddress, setDA] = useState(''); const [flightNumber, setFlight] = useState('');
  const [passengers, setPax] = useState(2); const [luggage, setLug] = useState(0); const [ret, setRet] = useState('');
  return <NewBookingShell product="TRANSPORT"
    build={() => !pickupAt ? 'Choose a pickup time' : !pickupAddress.trim() || !dropoffAddress.trim() ? 'Pickup and drop-off addresses are required' :
      mode === 'service' ? (serviceId || services.options[0]?.id ? { serviceId: serviceId || services.options[0].id, pickupAt: toIsoOffset(pickupAt), pickupAddress, dropoffAddress, flightNumber: flightNumber || undefined, passengers, luggage, returnPickupAt: ret ? toIsoOffset(ret) : undefined } : 'Choose a service')
        : (fromZoneId && toZoneId && vehicleTypeId ? { route: { fromZoneId, toZoneId, vehicleTypeId }, pickupAt: toIsoOffset(pickupAt), pickupAddress, dropoffAddress, flightNumber: flightNumber || undefined, passengers, luggage, returnPickupAt: ret ? toIsoOffset(ret) : undefined } : 'Choose both zones and a vehicle type')}>
    <div role="radiogroup" aria-label="Price by" className="flex gap-4 text-sm">{(['service', 'route'] as const).map((m) => <label key={m} className="flex items-center gap-1.5"><input type="radio" checked={mode === m} onChange={() => setMode(m)} />{m === 'service' ? 'Fixed service' : 'Zone to zone'}</label>)}</div>
    {mode === 'service' ? <Field label="Service">{(id) => <Select id={id} value={serviceId || services.options[0]?.id || ''} onChange={(e) => setSvc(e.target.value)}>{services.options.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field> :
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="From zone">{(id) => <Select id={id} value={fromZoneId} onChange={(e) => setFrom(e.target.value)}><option value="">Choose…</option>{zones.options.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select>}</Field>
        <Field label="To zone">{(id) => <Select id={id} value={toZoneId} onChange={(e) => setTo(e.target.value)}><option value="">Choose…</option>{zones.options.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}</Select>}</Field>
        <Field label="Vehicle type">{(id) => <Select id={id} value={vehicleTypeId} onChange={(e) => setVt(e.target.value)}><option value="">Choose…</option>{vts.options.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>}</Field></div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Pickup time" required>{(id) => <Input id={id} type="datetime-local" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} />}</Field>
      <Field label="Return pickup (optional)">{(id) => <Input id={id} type="datetime-local" value={ret} onChange={(e) => setRet(e.target.value)} />}</Field>
      <Field label="Passengers">{(id) => <Input id={id} type="number" min={1} value={passengers} onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))} />}</Field>
      <Field label="Luggage">{(id) => <Input id={id} type="number" min={0} value={luggage} onChange={(e) => setLug(Math.max(0, Number(e.target.value) || 0))} />}</Field>
      <Field label="Flight number">{(id) => <Input id={id} value={flightNumber} onChange={(e) => setFlight(e.target.value.toUpperCase())} maxLength={20} />}</Field></div>
    <Field label="Pickup address" required>{(id) => <Textarea id={id} rows={2} value={pickupAddress} onChange={(e) => setPA(e.target.value)} maxLength={500} />}</Field>
    <Field label="Drop-off address" required>{(id) => <Textarea id={id} rows={2} value={dropoffAddress} onChange={(e) => setDA(e.target.value)} maxLength={500} />}</Field>
  </NewBookingShell>;
}
