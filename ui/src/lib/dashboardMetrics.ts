import type {
  Allocation,
  BookingRequest,
  Project,
  Resource,
  Vacation,
} from '../types';
import {
  countOverlapWeekdays,
  countWeekdays,
  addDays,
  formatDateString,
  getWeekKey,
  isDateInRange,
  parseDateString,
  type DashboardPeriod,
} from './dateUtils';
import {
  getProjectCategory,
  getProjectCategoryDotClass,
  type ProjectCategory,
} from './projectCategory';

export type CategoryHours = {
  category: ProjectCategory;
  hours: number;
  colorClass: string;
};

export type WeeklyBucket = {
  weekKey: string;
  label: string;
  hours: number;
};

export type ProjectHoursRow = {
  projectId: string;
  name: string;
  hours: number;
  category: ProjectCategory;
  colorClass: string;
};

export type OpenRequestRow = {
  id: string;
  projectName: string;
  skill: string;
  hours: number;
  unassigned: boolean;
};

export type PersonUtilization = {
  resourceId: string;
  name: string;
  practiceArea?: string;
  plannedHours: number;
  capacityHours: number;
  utilizationPercent: number;
};

export type DashboardSnapshot = {
  period: DashboardPeriod;
  utilizationPercent: number;
  rawUtilizationPercent: number;
  totalPlannedHours: number;
  totalCapacityHours: number;
  billableHours: number;
  billableRatioPercent: number;
  activePeople: number;
  activeProjects: number;
  opportunityCount: number;
  openRequestsTotal: number;
  openRequestsUnassigned: number;
  approvedLeaveDays: number;
  peopleOnLeave: number;
  pendingVacations: number;
  categoryHours: CategoryHours[];
  weeklyTrend: WeeklyBucket[];
  topProjects: ProjectHoursRow[];
  openRequests: OpenRequestRow[];
  overAllocated: PersonUtilization[];
  underUtilized: PersonUtilization[];
};

function hoursPerWeekday(resource: Resource | undefined): number {
  if (resource?.weeklyHours) return resource.weeklyHours / 5;
  return 8;
}

function resourceFte(resource: Resource | undefined): number {
  return resource?.fte ?? 1;
}

function allocationHoursInPeriod(
  startDate: string,
  endDate: string,
  billablePercent: number,
  resource: Resource | undefined,
  period: DashboardPeriod,
): number {
  const overlapDays = countOverlapWeekdays(startDate, endDate, period.start, period.end);
  if (overlapDays === 0) return 0;
  const dailyHours = hoursPerWeekday(resource) * resourceFte(resource);
  return overlapDays * dailyHours * (billablePercent / 100);
}

function capacityHoursInPeriod(resource: Resource, period: DashboardPeriod): number {
  const overlapDays = countWeekdays(period.start, period.end);
  if (overlapDays === 0) return 0;
  return overlapDays * hoursPerWeekday(resource) * resourceFte(resource);
}

function endOfWeekSunday(dateStr: string): string {
  const d = parseDateString(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return formatDateString(d);
}

function addAllocationToWeeklyBuckets(
  startDate: string,
  endDate: string,
  billablePercent: number,
  resource: Resource | undefined,
  period: DashboardPeriod,
  weeklyMap: Map<string, number>,
): void {
  const overlapStart = startDate > period.start ? startDate : period.start;
  const overlapEnd = endDate < period.end ? endDate : period.end;
  if (overlapStart > overlapEnd) return;

  const dailyHours = hoursPerWeekday(resource) * resourceFte(resource);
  let cursor = overlapStart;

  while (cursor <= overlapEnd) {
    const weekEnd = endOfWeekSunday(cursor);
    const chunkEnd = weekEnd < overlapEnd ? weekEnd : overlapEnd;
    const days = countOverlapWeekdays(cursor, chunkEnd, period.start, period.end);
    if (days > 0) {
      const hours = days * dailyHours * (billablePercent / 100);
      const weekKey = getWeekKey(cursor);
      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) ?? 0) + hours);
    }
    cursor = addDays(chunkEnd, 1);
  }
}

const CATEGORY_ORDER: ProjectCategory[] = [
  'Billable',
  'Internal',
  'Non-billable',
  'Opportunity',
];

export function buildDashboardSnapshot(
  resources: Resource[],
  projects: Project[],
  allocations: Allocation[],
  requests: BookingRequest[],
  vacations: Vacation[],
  period: DashboardPeriod,
  referenceDate: string,
): DashboardSnapshot {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  const activePeople = resources.filter((r) => r.status !== 'Inactive').length;
  const activeProjects = projects.length;
  const opportunityCount = projects.filter(
    (p) => p.isOpportunity || (p.winProbability ?? 100) < 100,
  ).length;

  let totalPlannedHours = 0;
  let billableHours = 0;
  const categoryMap = new Map<ProjectCategory, number>();
  CATEGORY_ORDER.forEach((c) => categoryMap.set(c, 0));

  const projectHoursMap = new Map<string, number>();
  const weeklyMap = new Map<string, number>();

  const personPlanned = new Map<string, number>();
  resources.forEach((r) => personPlanned.set(r.id, 0));

  allocations.forEach((alloc) => {
    const resource = resourceMap.get(alloc.resourceId);
    const project = projectMap.get(alloc.projectId);
    const hours = allocationHoursInPeriod(
      alloc.startDate,
      alloc.endDate,
      alloc.billablePercent,
      resource,
      period,
    );
    if (hours <= 0) return;

    totalPlannedHours += hours;
    if (alloc.billableType === 'Billable') billableHours += hours;

    const category = project ? getProjectCategory(project) : 'Billable';
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + hours);
    projectHoursMap.set(alloc.projectId, (projectHoursMap.get(alloc.projectId) ?? 0) + hours);

    addAllocationToWeeklyBuckets(
      alloc.startDate,
      alloc.endDate,
      alloc.billablePercent,
      resource,
      period,
      weeklyMap,
    );

    if (alloc.resourceId) {
      personPlanned.set(
        alloc.resourceId,
        (personPlanned.get(alloc.resourceId) ?? 0) + hours,
      );
    }
  });

  function weekLabel(weekKey: string): string {
    const d = parseDateString(weekKey);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  let totalCapacityHours = 0;
  const personUtilization: PersonUtilization[] = [];

  resources
    .filter((r) => r.status !== 'Inactive')
    .forEach((resource) => {
      const capacity = capacityHoursInPeriod(resource, period);
      const planned = personPlanned.get(resource.id) ?? 0;
      totalCapacityHours += capacity;
      const utilizationPercent = capacity > 0 ? (planned / capacity) * 100 : 0;
      personUtilization.push({
        resourceId: resource.id,
        name: resource.name,
        practiceArea: resource.practiceArea || resource.group,
        plannedHours: Math.round(planned),
        capacityHours: Math.round(capacity),
        utilizationPercent: Math.round(utilizationPercent),
      });
    });

  const rawUtilizationPercent =
    totalCapacityHours > 0 ? (totalPlannedHours / totalCapacityHours) * 100 : 0;

  const pendingRequests = requests.filter((r) => r.status === 'Pending');
  const openRequests: OpenRequestRow[] = pendingRequests
    .map((req) => {
      const project = projectMap.get(req.projectId);
      const resource = req.resourceId ? resourceMap.get(req.resourceId) : undefined;
      const hours = allocationHoursInPeriod(
        req.startDate,
        req.endDate,
        req.billablePercent,
        resource,
        period,
      );
      return {
        id: req.id,
        projectName: project?.name ?? 'Unknown',
        skill: req.requiredSkill || 'General',
        hours: Math.round(hours),
        unassigned: !req.resourceId,
      };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);

  let approvedLeaveDays = 0;
  let peopleOnLeave = 0;
  let pendingVacations = 0;

  vacations.forEach((vac) => {
    if (vac.status === 'Pending') {
      pendingVacations++;
      return;
    }
    if (vac.status !== 'Approved') return;

    const days = countOverlapWeekdays(vac.startDate, vac.endDate, period.start, period.end);
    approvedLeaveDays += days;

    if (isDateInRange(referenceDate, vac.startDate, vac.endDate)) {
      peopleOnLeave++;
    }
  });

  const categoryHours: CategoryHours[] = CATEGORY_ORDER.map((category) => ({
    category,
    hours: Math.round(categoryMap.get(category) ?? 0),
    colorClass: getProjectCategoryDotClass(category),
  })).filter((c) => c.hours > 0);

  const weeklyTrend: WeeklyBucket[] = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, hours]) => ({
      weekKey,
      label: weekLabel(weekKey),
      hours: Math.round(hours),
    }));

  const topProjects: ProjectHoursRow[] = projects
    .map((p) => ({
      projectId: p.id,
      name: p.name,
      hours: Math.round(projectHoursMap.get(p.id) ?? 0),
      category: getProjectCategory(p),
      colorClass: getProjectCategoryDotClass(getProjectCategory(p)),
    }))
    .filter((p) => p.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);

  const overAllocated = personUtilization
    .filter((p) => p.utilizationPercent > 100)
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const underUtilized = personUtilization
    .filter((p) => p.capacityHours > 0 && p.utilizationPercent < 50)
    .sort((a, b) => a.utilizationPercent - b.utilizationPercent);

  return {
    period,
    utilizationPercent: Math.min(100, Math.round(rawUtilizationPercent)),
    rawUtilizationPercent: Math.round(rawUtilizationPercent),
    totalPlannedHours: Math.round(totalPlannedHours),
    totalCapacityHours: Math.round(totalCapacityHours),
    billableHours: Math.round(billableHours),
    billableRatioPercent:
      totalPlannedHours > 0 ? Math.round((billableHours / totalPlannedHours) * 100) : 0,
    activePeople,
    activeProjects,
    opportunityCount,
    openRequestsTotal: pendingRequests.length,
    openRequestsUnassigned: pendingRequests.filter((r) => !r.resourceId).length,
    approvedLeaveDays,
    peopleOnLeave,
    pendingVacations,
    categoryHours,
    weeklyTrend,
    topProjects,
    openRequests,
    overAllocated,
    underUtilized,
  };
}
