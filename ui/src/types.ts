/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Resource {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  group?: string;
  skills?: string[];
}

export interface Project {
  id: string;
  name: string;
  client: string;
  color: string; // Tailwind bg-class e.g. "bg-[#0091ff]"
  textColor: string; // Tailwind text-class e.g. "text-white"
  isOpportunity?: boolean;
  group?: string;
}

export type BillableType = 'Billable' | 'Opportunity';

export interface Allocation {
  id: string;
  resourceId: string;
  projectId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  billablePercent: number; // 0 to 100
  billableType: BillableType;
}

export interface Vacation {
  id: string;
  resourceId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'Pending' | 'Approved' | 'Rejected';
  reason?: string;
}

export interface BookingRequest {
  id: string;
  resourceId: string;
  projectId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  billablePercent: number;
  billableType: BillableType;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
  requiredSkill?: string;
}
