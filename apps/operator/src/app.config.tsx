import { Activity, CreditCard, LineChart, Receipt, Users } from 'lucide-react';
import { Route } from 'react-router-dom';
import { BookingsPage, CustomersPage, PaymentsPage, ReportsPage, type AppConfig } from '@booking/admin-kit';
import IntegrationHealth from './modules/IntegrationHealth';
import Overview from './modules/Overview';

const app: AppConfig = {
  key: 'operator', title: 'Operator console', groups: ['shared', 'hotel', 'trips', 'transport', 'club'], Home: Overview,
  nav: [
    { label: 'Platform', items: [{ to: '/bookings', label: 'All bookings', icon: Receipt }, { to: '/customers', label: 'Customers', icon: Users }, { to: '/payments', label: 'Payments', icon: CreditCard }, { to: '/reports', label: 'Reports & commission', icon: LineChart }, { to: '/integration-health', label: 'Integration health', icon: Activity }] },
  ],
  titles: { bookings: 'Bookings', customers: 'Customers', payments: 'Payments', reports: 'Reports', 'integration-health': 'Integration health' },
  routes: <>
    <Route path="bookings" element={<BookingsPage title="All bookings" newPath={null} />} />
    <Route path="customers" element={<CustomersPage />} />
    <Route path="payments" element={<PaymentsPage />} />
    <Route path="reports" element={<ReportsPage showCommission />} />
    <Route path="integration-health" element={<IntegrationHealth />} />
  </>,
};
export default app;
