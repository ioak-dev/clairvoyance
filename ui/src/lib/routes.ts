/** Bookmarkable app routes */

export const ROUTES = {
  schedulePeople: '/schedule/people',
  scheduleProjects: '/schedule/projects',
  scheduleRequests: '/schedule/requests',
  timeOff: '/time-off',
  masterProjects: '/master/projects',
  masterPeople: '/master/people',
  dashboard: '/dashboard',
  reports: '/reports',
  settings: '/settings',
} as const;

export type AppTab =
  | 'scheduler'
  | 'vacation'
  | 'projects'
  | 'resources'
  | 'requests'
  | 'dashboard'
  | 'reports'
  | 'settings';

export type ScheduleSidebar = 'projects' | 'resources';

export type ParsedRoute = {
  tab: AppTab;
  scheduleSidebar: ScheduleSidebar;
};

const PATH_TO_ROUTE: Record<string, ParsedRoute> = {
  [ROUTES.schedulePeople]: { tab: 'scheduler', scheduleSidebar: 'resources' },
  [ROUTES.scheduleProjects]: { tab: 'scheduler', scheduleSidebar: 'projects' },
  [ROUTES.scheduleRequests]: { tab: 'requests', scheduleSidebar: 'resources' },
  [ROUTES.timeOff]: { tab: 'vacation', scheduleSidebar: 'resources' },
  [ROUTES.masterProjects]: { tab: 'projects', scheduleSidebar: 'resources' },
  [ROUTES.masterPeople]: { tab: 'resources', scheduleSidebar: 'resources' },
  [ROUTES.dashboard]: { tab: 'dashboard', scheduleSidebar: 'resources' },
  [ROUTES.reports]: { tab: 'reports', scheduleSidebar: 'resources' },
  [ROUTES.settings]: { tab: 'settings', scheduleSidebar: 'resources' },
};

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function parsePathname(pathname: string): ParsedRoute | null {
  const path = normalizePathname(pathname);
  if (path === '/') return null;
  if (path === '/schedule') return PATH_TO_ROUTE[ROUTES.schedulePeople];
  return PATH_TO_ROUTE[path] ?? null;
}

export function isScheduleArea(tab: AppTab): boolean {
  return tab === 'scheduler' || tab === 'requests';
}

export const DEFAULT_ROUTE = ROUTES.schedulePeople;
