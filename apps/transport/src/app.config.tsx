import { Car, CreditCard, LineChart, Plus, Route as RouteIcon, Users } from 'lucide-react';
import { Route } from 'react-router-dom';
import { BookingsPage, CustomersPage, OverviewPage, PaymentsPage, ReportsPage, type AppConfig } from '@booking/admin-kit';
import Dispatch from './modules/Dispatch';
import NewBooking from './modules/NewBooking';

const Home = () => <OverviewPage title="Transport" product="TRANSPORT" tiles={[{ label: 'Pickups today', value: (d) => d.transport.pickupsToday, to: '/dispatch' }, { label: 'Unassigned (next 2 days)', value: (d) => d.transport.unassignedNext2Days, to: '/dispatch', tone: 'warn' }]} />;

const app: AppConfig = {
  key: 'transport', title: 'Transport admin', groups: ['transport', 'shared'], Home,
  nav: [
    { label: 'Operations', items: [{ to: '/dispatch', label: 'Dispatch', icon: RouteIcon }] },
    { label: 'Bookings', items: [{ to: '/bookings/new', label: 'New booking', icon: Plus }, { to: '/bookings', label: 'All bookings', icon: Car }, { to: '/customers', label: 'Customers', icon: Users }, { to: '/payments', label: 'Payments', icon: CreditCard }, { to: '/reports', label: 'Reports', icon: LineChart }] },
  ],
  titles: { dispatch: 'Dispatch', bookings: 'Bookings', customers: 'Customers', payments: 'Payments', reports: 'Reports' },
  routes: <>
    <Route path="dispatch" element={<Dispatch />} />
    <Route path="bookings" element={<BookingsPage product="TRANSPORT" title="Transport bookings" />} />
    <Route path="bookings/new" element={<NewBooking />} />
    <Route path="customers" element={<CustomersPage />} />
    <Route path="payments" element={<PaymentsPage product="TRANSPORT" />} />
    <Route path="reports" element={<ReportsPage product="TRANSPORT" />} />
  </>,
};
export default app;
