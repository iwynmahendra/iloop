import { CalendarClock, CreditCard, LineChart, Map, Plus, Users } from 'lucide-react';
import { Route } from 'react-router-dom';
import { BookingsPage, CustomersPage, OverviewPage, PaymentsPage, ReportsPage, type AppConfig } from '@booking/admin-kit';
import Departures from './modules/Departures';
import NewBooking from './modules/NewBooking';

const Home = () => <OverviewPage title="Trips" product="TRIP" tiles={[{ label: 'Guests departing today', value: (d) => d.trips.guestsToday, to: '/departures' }]} />;

const app: AppConfig = {
  key: 'trips', title: 'Trips admin', groups: ['trips', 'shared'], Home,
  nav: [
    { label: 'Operations', items: [{ to: '/departures', label: 'Departures', icon: CalendarClock }] },
    { label: 'Bookings', items: [{ to: '/bookings/new', label: 'New booking', icon: Plus }, { to: '/bookings', label: 'All bookings', icon: Map }, { to: '/customers', label: 'Customers', icon: Users }, { to: '/payments', label: 'Payments', icon: CreditCard }, { to: '/reports', label: 'Reports', icon: LineChart }] },
  ],
  titles: { departures: 'Departures', bookings: 'Bookings', customers: 'Customers', payments: 'Payments', reports: 'Reports' },
  routes: <>
    <Route path="departures" element={<Departures />} />
    <Route path="bookings" element={<BookingsPage product="TRIP" title="Trip bookings" />} />
    <Route path="bookings/new" element={<NewBooking />} />
    <Route path="customers" element={<CustomersPage />} />
    <Route path="payments" element={<PaymentsPage product="TRIP" />} />
    <Route path="reports" element={<ReportsPage product="TRIP" />} />
  </>,
};
export default app;
