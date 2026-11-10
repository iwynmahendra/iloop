import { BookOpen, ClipboardList, MessageSquare, UtensilsCrossed, Users, BedDouble } from 'lucide-react';
import { Route } from 'react-router-dom';
import type { AppConfig } from '@booking/admin-kit';
import Dining from './modules/Dining';
import Knowledge from './modules/Knowledge';
import Overview from './modules/Overview';
import Rooms from './modules/Rooms';
import Tasks from './modules/Tasks';
import Team from './modules/Team';

const app: AppConfig = {
  key: 'ops', title: 'Ops board', groups: [], Home: Overview,
  nav: [{ label: 'Operations', items: [
    { to: '/tasks', label: 'Tasks', icon: ClipboardList }, { to: '/requests', label: 'Guest requests', icon: MessageSquare }, { to: '/rooms', label: 'Rooms', icon: BedDouble },
    { to: '/dining', label: 'Room dining', icon: UtensilsCrossed }, { to: '/knowledge', label: 'Knowledge base', icon: BookOpen }, { to: '/team', label: 'Team & handover', icon: Users }] }],
  titles: { tasks: 'Tasks', requests: 'Guest requests', rooms: 'Rooms', dining: 'Room dining', knowledge: 'Knowledge base', team: 'Team & handover' },
  routes: <>
    <Route path="tasks" element={<Tasks kind="TASK" />} />
    <Route path="requests" element={<Tasks kind="REQUEST" />} />
    <Route path="rooms" element={<Rooms />} />
    <Route path="dining" element={<Dining />} />
    <Route path="knowledge" element={<Knowledge />} />
    <Route path="team" element={<Team />} />
  </>,
};
export default app;
