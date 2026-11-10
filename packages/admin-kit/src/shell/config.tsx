import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

export interface NavItem { to: string; label: string; icon?: ComponentType<{ className?: string }> }
export interface NavGroup { label: string; items: NavItem[] }
export interface AppConfig {
  /** url segment + storage key, e.g. "hotel" */
  key: string;
  title: string;
  /** resource groups (generated CRUD pages) listed in the sidebar, e.g. ['hotel','shared'] */
  groups: string[];
  /** app-specific screens, listed above the CRUD groups */
  nav: NavGroup[];
  /** home screen (index route). Defaults to the generic Dashboard. */
  Home?: ComponentType;
  /** extra <Route> elements, rendered inside the authenticated layout */
  routes?: ReactNode;
  /** breadcrumb labels for custom paths, e.g. { 'front-desk': 'Front desk' } */
  titles?: Record<string, string>;
}
const Ctx = createContext<AppConfig>(null as never);
export const AppConfigProvider = Ctx.Provider;
export const useApp = () => useContext(Ctx);
