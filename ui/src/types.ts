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
  jobCategory?: JobCategory;
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
  group?: string;
  winProbability?: number | null;
  managerId?: string | null;
  marketUnitId?: string | null;
  consultingUnitId?: string | null;
}

export type BillableType = 'Billable' | 'Opportunity';

export type BookingCommitmentType = 'hard' | 'soft';

export interface Allocation {
  id: string;
  resourceId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  billablePercent: number;
  billableType: BillableType;
  bookingType: BookingCommitmentType;
  /** Set when this schedule row was created from a booking request. */
  requestId?: string;
}

export interface Vacation {
  id: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason?: string;
}

export interface BookingRequest {
  id: string;
  referenceId: string;
  resourceId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  billablePercent: number;
  billableType: BillableType;
  bookingType: BookingCommitmentType;
  probability: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
  requiredSkill?: string;
  consultingUnitId?: string | null;
  practiceAreaId?: string | null;
  competencyCenterId?: string | null;
  siteId?: string | null;
  jobCategory?: JobCategory | null;
}

export type AvailabilityMode = 'complete' | 'partial' | 'everyone';

export interface UtilizationSegment {
  from: string;
  to: string;
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
  jobCategory?: JobCategory;
  consultingUnitId?: string | null;
  practiceAreaId?: string | null;
  competencyCenterId?: string | null;
  siteId?: string | null;
  group?: string;
  practiceArea?: string;
  competencyCenter?: string;
  site?: string;
  utilization: UtilizationSegment[];
  avgUtilization: number;
  avgAvailability: number;
}
