/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PersonStatus = 'Active' | 'Inactive';
export type LifecycleStatus = 'Hired' | 'Employed' | 'Terminated' | 'Garden Leave' | 'Leave' | 'Parental Leave';
export type JobCategory =
  | 'B0- Fresher'
  | 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  | 'D0' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

export interface Resource {
  id: string;
  name: string;
  employeeId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  group?: string;
  competencyCenter?: string;
  site?: string;
  status?: PersonStatus;
  lifecycleStatus?: LifecycleStatus;
  jobLevelId?: string | null;
  practiceArea?: string;
  employmentType?: string;
  fte?: number;
  weeklyHours?: number;
  siteId?: string | null;
  consultingUnitId?: string | null;
  practiceAreaId?: string | null;
  avatarUrl?: string;
  skills?: string[];
}

export type FilterKind = 'project' | 'person' | 'request';

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  criteria: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  itemCount?: number;
}

export interface Project {
  id: string;
  referenceId?: string;
  projectId?: string;
  name: string;
  client: string;
  color: string;
  textColor: string;
  isOpportunity?: boolean;
  billableType?: BillableType;
  group?: string;
  winProbability?: number | null;
  managerId?: string | null;
  marketUnitId?: string | null;
  consultingUnitId?: string | null;
}

export type BillableType = 'Billable' | 'Non-billable' | 'Opportunity';
export type BookingCommitmentType = 'hard' | 'soft';
export type ScheduleUnit = 'utilization' | 'hours';

/** Mon→Sun roster values (utilization fraction or hours/day). */
export type Roster = [number, number, number, number, number, number, number];

export const DEFAULT_ROSTER: Roster = [1, 1, 1, 1, 1, 0, 0];

export interface WeekKey {
  isoYear: number;
  isoWeek: number;
}

/** First-class schedule block (date range + roster). */
export interface ScheduleAssignment {
  id: string;
  title?: string;
  resourceId: string;
  projectId: string;
  requestId?: string;
  /** Override; when omitted, use project's billable type. */
  billableType?: BillableType;
  bookingType: BookingCommitmentType;
  startDate: string;
  endDate: string;
  unit: ScheduleUnit;
  roster: Roster;
}

/** Timeline display alias — same as schedule row. */
export interface AllocationBlock {
  scheduleId: string;
  title?: string;
  resourceId: string;
  projectId: string;
  requestId?: string;
  /** Override; when omitted, use project's billable type. */
  billableType?: BillableType;
  bookingType: BookingCommitmentType;
  startDate: string;
  endDate: string;
  unit: ScheduleUnit;
  roster: Roster;
}

export interface Vacation {
  id: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason?: string;
}

/** Request block with same range+roster model. */
export interface BookingRequest {
  id: string;
  referenceId: string;
  resourceId: string;
  projectId: string;
  /** Override; when omitted, use project's billable type. */
  billableType?: BillableType;
  bookingType: BookingCommitmentType;
  probability: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
  requestName?: string;
  consultingUnitId?: string | null;
  practiceAreaId?: string | null;
  competencyCenterId?: string | null;
  siteId?: string | null;
  jobLevelId?: string | null;
  startDate: string;
  endDate: string;
  unit: ScheduleUnit;
  roster: Roster;
}

export type AvailabilityMode = 'complete' | 'partial' | 'everyone';

export interface UtilizationSegment {
  date: string;
  hours: number;
  /** Fraction of daily capacity (1 = fully booked). */
  utilization: number;
}

export interface PersonUtilizationResult {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  role: string;
  jobLevelId?: string | null;
  consultingUnitId?: string | null;
  practiceAreaId?: string | null;
  competencyCenterId?: string | null;
  siteId?: string | null;
  group?: string;
  practiceArea?: string;
  competencyCenter?: string;
  site?: string;
  utilization: UtilizationSegment[];
  /** Average utilization fraction over the period (1 = fully booked). */
  avgUtilization: number;
  /** Average available capacity fraction over the period (1 = fully free). */
  avgAvailability: number;
}
