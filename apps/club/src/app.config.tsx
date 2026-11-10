import { CreditCard, DoorOpen, LineChart, Plus, Ticket, Users } from 'lucide-react';
import { Route } from 'react-router-dom';
import { BookingsPage, CustomersPage, OverviewPage, PaymentsPage, ReportsPage, type AppConfig } from '@booking/admin-kit';
import DoorList from './modules/DoorList';
import NewBooking from './modules/NewBooking';

const Home = () => <OverviewPage title="Club" product="CLUB" tiles={[{ label: 'Guests expected tonight', value: (d) => d.club.guestsExpectedTonight, to: '/door' }, { label: 'Checked in tonight', value: (d) => d.club.checkedInTonight, to: '/door' }]} />;

const app: AppConfig = {
  key: 'club', title: 'Club admin', groups: ['club', 'shared'], Home,
  nav: [
    { label: 'Operations', items: [{ to: '/door', label: 'Door list', icon: DoorOpen }] },
    { label: 'Bookings', items: [{ to: '/bookings/new', label: 'New booking', icon: Plus }, { to: '/bookings', label: 'All bookings', icon: Ticket }, { to: '/customers', label: 'Customers', icon: Users }, { to: '/payments', label: 'Payments', icon: CreditCard }, { to: '/reports', label: 'Reports', icon: LineChart }] },
  ],
  titles: { door: 'Door list', bookings: 'Bookings', customers: 'Customers', payments: 'Payments', reports: 'Reports' },
  routes: <>
    <Route path="door" element={<DoorList />} />
    <Route path="bookings" element={<BookingsPage product="CLUB" title="Club bookings" />} />
    <Route path="bookings/new" element={<NewBooking />} />
    <Route path="customers" element={<CustomersPage />} />
    <Route path="payments" element={<PaymentsPage product="CLUB" />} />
    <Route path="reports" element={<ReportsPage product="CLUB" />} />
  </>,
};
export default app;
