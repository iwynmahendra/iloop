import { BedDouble, CalendarCheck, CreditCard, LineChart, Plug, Plus, Search, Users } from 'lucide-react';
import { Route } from 'react-router-dom';
import { BookingsPage, CustomersPage, IntegrationsPage, OverviewPage, PaymentsPage, ReportsPage, type AppConfig } from '@booking/admin-kit';
import Availability from './modules/Availability';
import FrontDesk from './modules/FrontDesk';
import NewBooking from './modules/NewBooking';

const Home = () => <OverviewPage title="Hotel" product="HOTEL" bookingsPath="/bookings" tiles={[
  { label: 'Arrivals today', value: (d) => d.hotel.arrivals, to: '/front-desk' }, { label: 'Departures today', value: (d) => d.hotel.departures, to: '/front-desk' }]} />;

const app: AppConfig = {
  key: 'hotel', title: 'Hotel admin', groups: ['hotel', 'shared'], Home,
  nav: [
    { label: 'Operations', items: [{ to: '/front-desk', label: 'Front desk', icon: CalendarCheck }, { to: '/availability', label: 'Availability', icon: Search }] },
    { label: 'Bookings', items: [{ to: '/bookings/new', label: 'New booking', icon: Plus }, { to: '/bookings', label: 'All bookings', icon: BedDouble }, { to: '/customers', label: 'Customers', icon: Users }, { to: '/payments', label: 'Payments', icon: CreditCard }, { to: '/reports', label: 'Reports', icon: LineChart }] },
    { label: 'Connect', items: [{ to: '/integrations', label: 'Integrations', icon: Plug }] },
  ],
  titles: { 'front-desk': 'Front desk', availability: 'Availability', bookings: 'Bookings', customers: 'Customers', payments: 'Payments', reports: 'Reports', integrations: 'Integrations' },
  routes: <>
    <Route path="front-desk" element={<FrontDesk />} />
    <Route path="availability" element={<Availability />} />
    <Route path="bookings" element={<BookingsPage product="HOTEL" title="Hotel bookings" />} />
    <Route path="bookings/new" element={<NewBooking />} />
    <Route path="customers" element={<CustomersPage />} />
    <Route path="payments" element={<PaymentsPage product="HOTEL" />} />
    <Route path="reports" element={<ReportsPage product="HOTEL" />} />
    <Route path="integrations" element={<IntegrationsPage />} />
  </>,
};
export default app;
