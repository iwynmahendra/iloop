import { Card, ErrorState, OverviewPage, Spinner, addDaysStr, money, today, useGet } from '@booking/admin-kit';

/** Cross-product overview: today's operations plus 30-day revenue by product. */
export default function Overview() {
  const r = useGet<any>('/reports/summary', { from: addDaysStr(today(), -29), to: today(), groupBy: 'week' });
  return <div className="space-y-6">
    <OverviewPage title="Platform overview" subtitle="All products, all suppliers in scope" bookingsPath="/bookings" tiles={[
      { label: 'Hotel arrivals', value: (d) => d.hotel.arrivals }, { label: 'Hotel departures', value: (d) => d.hotel.departures },
      { label: 'Trip guests today', value: (d) => d.trips.guestsToday }, { label: 'Transport pickups today', value: (d) => d.transport.pickupsToday },
      { label: 'Unassigned transport', value: (d) => d.transport.unassignedNext2Days, tone: 'warn' }, { label: 'Club guests tonight', value: (d) => d.club.guestsExpectedTonight }]} />
    <Card className="p-4"><h2 className="mb-3 text-sm font-semibold">Last 30 days</h2>
      {r.isLoading ? <Spinner /> : r.isError ? <ErrorState error={r.error} retry={() => r.refetch()} /> : <div className="grid gap-4 sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-semibold tabular-nums">{money(r.data.totals.revenue)}</p></div>
        <div><p className="text-xs text-muted-foreground">Commission</p><p className="text-xl font-semibold tabular-nums">{money(r.data.totals.commission)}</p></div>
        <div><p className="text-xs text-muted-foreground">Bookings</p><p className="text-xl font-semibold tabular-nums">{r.data.totals.bookings}</p></div>
        <ul className="text-sm">{r.data.byProduct.map((p: any) => <li key={p.product} className="flex justify-between"><span>{p.product}</span><span className="tabular-nums">{money(p.revenue)}</span></li>)}</ul></div>}</Card>
  </div>;
}
