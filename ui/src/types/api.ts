import type {
  Allocation,
  BillableType,
  BookingCommitmentType,
  BookingRequest,
  JobCategory,
  LifecycleStatus,
  PersonStatus,
  Project,
  Resource,
  SavedFilter,
  Vacation,
} from '../types';
import {
  getProjectCategory,
  getProjectCategoryIconClass,
} from '../lib/projectCategory';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LookupRow {
  id: string;
  name: string;
}

export interface ProjectRow {
  id: string;
  reference_id: string;
  project_id: string;
  name: string;
  manager_id: string | null;
  market_unit_id: string | null;
  consulting_unit_id: string | null;
  win_probability: number | null;
  market_unit?: LookupRow | null;
  consulting_unit?: LookupRow | null;
}

export interface PersonRow {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  start_date: string | null;
  gender: string | null;
  status: PersonStatus;
  consulting_unit_id: string | null;
  practice_area_id: string | null;
  competency_center_id: string | null;
  lifecycle_status: LifecycleStatus;
  site_id: string | null;
  manager_id: string | null;
  termination_date: string | null;
  employment_type: string | null;
  job_category: JobCategory | null;
  fte: number | null;
  weekly_hours: number | null;
  global_designation: string | null;
  local_designation: string | null;
  practice_area?: LookupRow | null;
  consulting_unit?: LookupRow | null;
  site?: LookupRow | null;
  competency_center?: LookupRow | null;
}

export interface ScheduleRow {
  id: string;
  project_id: string;
  person_id: string;
  request_id: string | null;
  start_date: string;
  end_date: string;
  billable_percent: number;
  billable_type: BillableType;
  booking_type: BookingCommitmentType;
}

export interface RequestRow {
  id: string;
  reference_id: string;
  project_id: string;
  person_id: string | null;
  start_date: string;
  end_date: string;
  billable_percent: number;
  billable_type: BillableType;
  booking_type: BookingCommitmentType;
  probability: number;
  status: ApprovalStatus;
  required_skill: string | null;
  notes: string | null;
  consulting_unit_id: string | null;
  practice_area_id: string | null;
  competency_center_id: string | null;
  site_id: string | null;
  job_category: string | null;
}

export interface SimulationLogRow {
  id: string;
  simulation_type: string;
  payload: Record<string, unknown>[];
  record_count: number;
  created_at: string;
  updated_at: string;
}

export interface PersonUtilizationSearchRow {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  global_designation: string | null;
  local_designation: string | null;
  job_category: string | null;
  consulting_unit_id: string | null;
  practice_area_id: string | null;
  competency_center_id: string | null;
  site_id: string | null;
  consulting_unit_name: string | null;
  practice_area_name: string | null;
  competency_center_name: string | null;
  site_name: string | null;
  utilization: Array<{ from: string; to: string; utilization: number }>;
  avg_utilization: number;
  avg_availability: number;
}

export interface VacationRow {
  id: string;
  person_id: string;
  start_date: string;
  end_date: string;
  status: ApprovalStatus;
  reason: string | null;
}

export interface FilterRow {
  id: string;
  name: string;
  description: string | null;
  criteria: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
  item_count?: number;
}

export function toProject(row: ProjectRow): Project {
  const winProbability = row.win_probability ?? 100;
  const isOpportunity = winProbability < 100;

  const project: Project = {
    id: row.id,
    referenceId: row.reference_id ?? row.project_id,
    projectId: row.project_id,
    name: row.name,
    client: row.market_unit?.name || 'Demo Client',
    color: 'bg-emerald-500',
    textColor: 'text-white',
    isOpportunity,
    group: row.consulting_unit?.name || undefined,
    winProbability,
    managerId: row.manager_id,
    marketUnitId: row.market_unit_id,
    consultingUnitId: row.consulting_unit_id,
  };

  const category = getProjectCategory(project);
  return {
    ...project,
    color: getProjectCategoryIconClass(category),
  };
}

export function toResource(row: PersonRow): Resource {
  return {
    id: row.id,
    employeeId: row.employee_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    role: row.global_designation || row.local_designation || 'Consultant',
    group: row.consulting_unit?.name || row.site?.name || undefined,
    competencyCenter: row.competency_center?.name || undefined,
    site: row.site?.name || undefined,
    status: row.status,
    lifecycleStatus: row.lifecycle_status,
    jobCategory: row.job_category || undefined,
    practiceArea: row.practice_area?.name || undefined,
    employmentType: row.employment_type || undefined,
    fte: row.fte ?? undefined,
    weeklyHours: row.weekly_hours ?? undefined,
    siteId: row.site_id,
    consultingUnitId: row.consulting_unit_id,
    practiceAreaId: row.practice_area_id,
  };
}

export function toAllocation(row: ScheduleRow): Allocation {
  return {
    id: row.id,
    resourceId: row.person_id,
    projectId: row.project_id,
    startDate: row.start_date,
    endDate: row.end_date,
    billablePercent: row.billable_percent,
    billableType: row.billable_type,
    bookingType: row.booking_type ?? 'hard',
    requestId: row.request_id || undefined,
  };
}

export function toBookingRequest(row: RequestRow): BookingRequest {
  return {
    id: row.id,
    referenceId: row.reference_id,
    resourceId: row.person_id || '',
    projectId: row.project_id,
    startDate: row.start_date,
    endDate: row.end_date,
    billablePercent: row.billable_percent,
    billableType: row.billable_type,
    bookingType: row.booking_type ?? 'hard',
    probability: row.probability ?? 100,
    status: row.status,
    notes: row.notes || undefined,
    requiredSkill: row.required_skill || undefined,
    consultingUnitId: row.consulting_unit_id,
    practiceAreaId: row.practice_area_id,
    competencyCenterId: row.competency_center_id,
    siteId: row.site_id,
    jobCategory: (row.job_category as JobCategory) || null,
  };
}

export function toPersonUtilizationResult(row: PersonUtilizationSearchRow) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    role: row.global_designation || row.local_designation || 'Consultant',
    jobCategory: (row.job_category as JobCategory) || undefined,
    consultingUnitId: row.consulting_unit_id,
    practiceAreaId: row.practice_area_id,
    competencyCenterId: row.competency_center_id,
    siteId: row.site_id,
    group: row.consulting_unit_name || undefined,
    practiceArea: row.practice_area_name || undefined,
    competencyCenter: row.competency_center_name || undefined,
    site: row.site_name || undefined,
    utilization: row.utilization || [],
    avgUtilization: Number(row.avg_utilization) || 0,
    avgAvailability: Number(row.avg_availability) || 0,
  };
}

export function toVacation(row: VacationRow): Vacation {
  return {
    id: row.id,
    resourceId: row.person_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    reason: row.reason || undefined,
  };
}

export function toSavedFilter(row: FilterRow): SavedFilter {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    criteria: row.criteria || {},
    isActive: row.is_active,
    sortOrder: row.sort_order,
    itemCount: row.item_count,
  };
}

export function createFilterPayload(filter: Omit<SavedFilter, 'id'>) {
  return {
    name: filter.name,
    description: filter.description || null,
    criteria: filter.criteria || {},
    is_active: filter.isActive,
    sort_order: filter.sortOrder,
  };
}

export function updateFilterPayload(filter: Partial<SavedFilter>) {
  return {
    ...(filter.name !== undefined ? { name: filter.name } : {}),
    ...(filter.description !== undefined ? { description: filter.description || null } : {}),
    ...(filter.criteria !== undefined ? { criteria: filter.criteria } : {}),
    ...(filter.isActive !== undefined ? { is_active: filter.isActive } : {}),
    ...(filter.sortOrder !== undefined ? { sort_order: filter.sortOrder } : {}),
  };
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] || 'Unknown',
    lastName: parts.slice(1).join(' ') || 'User',
  };
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function createPersonPayload(resource: Omit<Resource, 'id'>) {
  const firstName = resource.firstName || splitName(resource.name).firstName;
  const lastName = resource.lastName || splitName(resource.name).lastName;
  const employeeId = resource.employeeId || `EMP-${Date.now()}`;
  const email = resource.email || `${slugify(`${firstName}.${lastName}`)}@example.com`;

  return {
    employee_id: employeeId,
    email,
    first_name: firstName,
    last_name: lastName,
    status: resource.status || 'Active',
    lifecycle_status: resource.lifecycleStatus || 'Employed',
    global_designation: resource.role || 'Consultant',
    job_category: resource.jobCategory || 'L1',
    employment_type: resource.employmentType || 'Full Time',
    fte: resource.fte ?? 1,
    weekly_hours: resource.weeklyHours ?? 40,
  };
}

export function updatePersonPayload(resource: Partial<Resource>) {
  const names = resource.name ? splitName(resource.name) : null;

  return {
    ...(resource.employeeId !== undefined ? { employee_id: resource.employeeId } : {}),
    ...(resource.email !== undefined ? { email: resource.email } : {}),
    ...(resource.firstName !== undefined ? { first_name: resource.firstName } : {}),
    ...(resource.lastName !== undefined ? { last_name: resource.lastName } : {}),
    ...(names ? { first_name: names.firstName, last_name: names.lastName } : {}),
    ...(resource.status !== undefined ? { status: resource.status } : {}),
    ...(resource.lifecycleStatus !== undefined ? { lifecycle_status: resource.lifecycleStatus } : {}),
    ...(resource.role !== undefined ? { global_designation: resource.role } : {}),
    ...(resource.jobCategory !== undefined ? { job_category: resource.jobCategory || null } : {}),
    ...(resource.employmentType !== undefined ? { employment_type: resource.employmentType || null } : {}),
    ...(resource.fte !== undefined ? { fte: resource.fte } : {}),
    ...(resource.weeklyHours !== undefined ? { weekly_hours: resource.weeklyHours } : {}),
  };
}

export function createProjectPayload(project: Omit<Project, 'id'>) {
  const winProbability = project.winProbability ?? (project.isOpportunity ? 35 : 100);

  return {
    reference_id: project.referenceId || crypto.randomUUID(),
    project_id: project.projectId || `PRJ-${Date.now()}`,
    name: project.name,
    win_probability: winProbability,
    ...(project.managerId !== undefined ? { manager_id: project.managerId || null } : {}),
    ...(project.marketUnitId !== undefined ? { market_unit_id: project.marketUnitId || null } : {}),
    ...(project.consultingUnitId !== undefined ? { consulting_unit_id: project.consultingUnitId || null } : {}),
  };
}

export function updateProjectPayload(project: Partial<Project>) {
  const winProbability =
    project.winProbability !== undefined
      ? project.winProbability
      : project.isOpportunity !== undefined
        ? (project.isOpportunity ? 35 : 100)
        : undefined;

  return {
    ...(project.projectId !== undefined ? { project_id: project.projectId } : {}),
    ...(project.name !== undefined ? { name: project.name } : {}),
    ...(winProbability !== undefined ? { win_probability: winProbability } : {}),
    ...(project.managerId !== undefined ? { manager_id: project.managerId || null } : {}),
    ...(project.marketUnitId !== undefined ? { market_unit_id: project.marketUnitId || null } : {}),
    ...(project.consultingUnitId !== undefined ? { consulting_unit_id: project.consultingUnitId || null } : {}),
  };
}

export function createSchedulePayload(allocation: Omit<Allocation, 'id'> & { requestId?: string | null }) {
  return {
    project_id: allocation.projectId,
    person_id: allocation.resourceId,
    request_id: allocation.requestId || null,
    start_date: allocation.startDate,
    end_date: allocation.endDate,
    billable_percent: allocation.billablePercent,
    billable_type: allocation.billableType,
    booking_type: allocation.bookingType ?? 'hard',
  };
}

export function updateSchedulePayload(allocation: Allocation) {
  return createSchedulePayload(allocation);
}

export function createRequestPayload(request: Omit<BookingRequest, 'id' | 'status'>, status: ApprovalStatus = 'Pending') {
  return {
    reference_id: request.referenceId || crypto.randomUUID(),
    project_id: request.projectId,
    person_id: request.resourceId || null,
    start_date: request.startDate,
    end_date: request.endDate,
    billable_percent: request.billablePercent,
    billable_type: request.billableType,
    booking_type: request.bookingType ?? 'hard',
    probability: request.probability ?? 100,
    status,
    required_skill: request.requiredSkill || null,
    notes: request.notes || null,
    consulting_unit_id: request.consultingUnitId || null,
    practice_area_id: request.practiceAreaId || null,
    competency_center_id: request.competencyCenterId || null,
    site_id: request.siteId || null,
    job_category: request.jobCategory || null,
  };
}

export function updateRequestPayload(request: Partial<BookingRequest> & { status?: ApprovalStatus }) {
  return {
    ...(request.resourceId !== undefined ? { person_id: request.resourceId || null } : {}),
    ...(request.projectId !== undefined ? { project_id: request.projectId } : {}),
    ...(request.startDate !== undefined ? { start_date: request.startDate } : {}),
    ...(request.endDate !== undefined ? { end_date: request.endDate } : {}),
    ...(request.billablePercent !== undefined ? { billable_percent: request.billablePercent } : {}),
    ...(request.billableType !== undefined ? { billable_type: request.billableType } : {}),
    ...(request.bookingType !== undefined ? { booking_type: request.bookingType } : {}),
    ...(request.probability !== undefined ? { probability: request.probability } : {}),
    ...(request.status !== undefined ? { status: request.status } : {}),
    ...(request.requiredSkill !== undefined ? { required_skill: request.requiredSkill || null } : {}),
    ...(request.notes !== undefined ? { notes: request.notes || null } : {}),
    ...(request.consultingUnitId !== undefined ? { consulting_unit_id: request.consultingUnitId || null } : {}),
    ...(request.practiceAreaId !== undefined ? { practice_area_id: request.practiceAreaId || null } : {}),
    ...(request.competencyCenterId !== undefined ? { competency_center_id: request.competencyCenterId || null } : {}),
    ...(request.siteId !== undefined ? { site_id: request.siteId || null } : {}),
    ...(request.jobCategory !== undefined ? { job_category: request.jobCategory || null } : {}),
  };
}

export function toLabRequestPayloadItem(request: BookingRequest): Record<string, unknown> {
  return {
    id: request.referenceId,
    project_id: request.projectId,
    person_id: request.resourceId || null,
    start_date: request.startDate,
    end_date: request.endDate,
    billable_percent: request.billablePercent,
    billable_type: request.billableType,
    status: request.status,
    booking_type: request.bookingType,
    probability: request.probability,
    required_skill: request.requiredSkill ?? null,
    notes: request.notes ?? null,
    consulting_unit_id: request.consultingUnitId ?? null,
    practice_area_id: request.practiceAreaId ?? null,
    competency_center_id: request.competencyCenterId ?? null,
    site_id: request.siteId ?? null,
    job_category: request.jobCategory ?? null,
  };
}

export function toLabProjectPayloadItem(project: Project): Record<string, unknown> {
  return {
    id: project.referenceId,
    project_id: project.projectId ?? null,
    name: project.name,
    manager_id: project.managerId ?? null,
    market_unit_id: project.marketUnitId ?? null,
    consulting_unit_id: project.consultingUnitId ?? null,
    win_probability: project.winProbability ?? 35,
  };
}

export function createVacationPayload(vacation: Omit<Vacation, 'id' | 'status'>, status: ApprovalStatus = 'Pending') {
  return {
    person_id: vacation.resourceId,
    start_date: vacation.startDate,
    end_date: vacation.endDate,
    status,
    reason: vacation.reason || null,
  };
}

export function updateVacationPayload(vacation: Partial<Vacation>) {
  return {
    ...(vacation.resourceId !== undefined ? { person_id: vacation.resourceId } : {}),
    ...(vacation.startDate !== undefined ? { start_date: vacation.startDate } : {}),
    ...(vacation.endDate !== undefined ? { end_date: vacation.endDate } : {}),
    ...(vacation.status !== undefined ? { status: vacation.status } : {}),
    ...(vacation.reason !== undefined ? { reason: vacation.reason || null } : {}),
  };
}
