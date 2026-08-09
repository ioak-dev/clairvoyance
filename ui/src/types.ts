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

export interface WeekKey {
  isoYear: number;
  isoWeek: number;
}

export interface WeekAllocation extends WeekKey {
  daysPerWeek: number;
}

/** Schedule assignment header + week rows. */
export interface ScheduleAssignment {
  id: string;
  resourceId: string;
  projectId: string;
  requestId?: string;
  billableType: BillableType;
  bookingType: BookingCommitmentType;
  weeks: WeekAllocation[];
}

/** Derived contiguous block for timeline display. */
export interface AllocationBlock {
  scheduleId: string;
  resourceId: string;
  projectId: string;
  requestId?: string;
  billableType: BillableType;
  bookingType: BookingCommitmentType;
  startDate: string;
  endDate: string;
  weeks: WeekAllocation[];
  daysPerWeek: number;
}

export interface Vacation {
  id: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason?: string;
}

/** Request header + week rows. */
export interface BookingRequest {
  id: string;
  referenceId: string;
  resourceId: string;
  projectId: string;
  billableType: BillableType;
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
  weeks: WeekAllocation[];
}

export type AvailabilityMode = 'complete' | 'partial' | 'everyone';

export interface UtilizationSegment {
  isoYear: number;
  isoWeek: number;
  /** Allocated days in this ISO week (raw from RPC; 5 = fully booked). */
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
  /** Average allocated days/week over the period (5 = fully booked). */
  avgUtilization: number;
  /** Average available days/week over the period (5 = fully free). */
  avgAvailability: number;
}
