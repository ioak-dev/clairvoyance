/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resource, Project, Allocation, Vacation, BookingRequest } from './types';

export const INITIAL_RESOURCES: Resource[] = [
  { id: 'res-1', name: 'Anmol Gupta', role: 'Project', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', group: 'Win India Team', skills: ['React', 'TypeScript', 'Frontend Development', 'Tailwind CSS', 'CSS'] },
  { id: 'res-2', name: 'Anumsha Shah', role: 'Project', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', group: 'Win Europe Team', skills: ['SAP ABAP', 'SAP FICO', 'Backend Developer', 'SAP Specialist', 'SQL'] },
  { id: 'res-3', name: 'Alex Sapah', role: 'Prentururson', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', group: 'Win India Team', skills: ['UI/UX Design', 'Figma', 'Product Design', 'HTML/CSS', 'Creative direction'] },
  { id: 'res-4', name: 'Emily Chen', role: 'Project', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', group: 'Win US Team', skills: ['Project Management', 'Agile', 'Scrum Master', 'Jira', 'QA Engineer'] },
  { id: 'res-5', name: 'David Kim', role: 'Contractor', avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', group: 'Win Contractors', skills: ['Node.js', 'Fullstack Development', 'DevOps', 'AWS', 'Backend Developer'] }
];

export const INITIAL_PROJECTS: Project[] = [
  { id: 'proj-tms', name: 'TMS', client: 'TMS Global', color: 'bg-[#4e82c2]', textColor: 'text-white', group: 'Work Group 1' },
  { id: 'proj-s4hana', name: 'S4HANA', client: 'S4HANA Enterprise', color: 'bg-[#4e82c2]', textColor: 'text-white', group: 'Work Group 1' },
  { id: 'proj-solventum', name: 'Solventum', client: 'Solventum Health', color: 'bg-[#4e82c2]', textColor: 'text-white', group: 'Work Group 1' },
  { id: 'proj-internal', name: 'Tech Support', client: 'Internal Systems', color: 'bg-[#4e82c2]', textColor: 'text-white', group: 'Internal Operations' },
  { id: 'proj-opp-honda', name: 'Honda CRM Opportunity', client: 'Honda Corp', color: 'bg-[#936cb9]', textColor: 'text-white', isOpportunity: true, group: 'Work Group 2' }
];

export const INITIAL_ALLOCATIONS: Allocation[] = [
  // Anmol Gupta allocations (Row 1)
  {
    id: 'alloc-1',
    resourceId: 'res-1',
    projectId: 'proj-tms',
    startDate: '2026-06-01',
    endDate: '2026-06-12',
    billablePercent: 50,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-2',
    resourceId: 'res-1',
    projectId: 'proj-tms',
    startDate: '2026-06-13',
    endDate: '2026-06-15',
    billablePercent: 50,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-3',
    resourceId: 'res-1',
    projectId: 'proj-tms',
    startDate: '2026-06-18',
    endDate: '2026-07-05',
    billablePercent: 50,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-4',
    resourceId: 'res-1',
    projectId: 'proj-tms',
    startDate: '2026-07-06',
    endDate: '2026-07-15',
    billablePercent: 50,
    billableType: 'Billable',
    bookingType: 'hard',
  },

  // Anumsha Shah allocations - Track 1 S4HANA
  {
    id: 'alloc-5',
    resourceId: 'res-2',
    projectId: 'proj-s4hana',
    startDate: '2026-06-03',
    endDate: '2026-06-05',
    billablePercent: 40,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-6',
    resourceId: 'res-2',
    projectId: 'proj-s4hana',
    startDate: '2026-06-06',
    endDate: '2026-06-12',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-7',
    resourceId: 'res-2',
    projectId: 'proj-s4hana',
    startDate: '2026-06-13',
    endDate: '2026-06-25',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-7b',
    resourceId: 'res-2',
    projectId: 'proj-s4hana',
    startDate: '2026-06-26',
    endDate: '2026-07-15',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },

  // Anumsha Shah allocations - Track 2 Solventum
  {
    id: 'alloc-8',
    resourceId: 'res-2',
    projectId: 'proj-solventum',
    startDate: '2026-06-13',
    endDate: '2026-06-17',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-9',
    resourceId: 'res-2',
    projectId: 'proj-solventum',
    startDate: '2026-06-18',
    endDate: '2026-07-10',
    billablePercent: 60,
    billableType: 'Billable',
    bookingType: 'hard',
  },

  // Anumsha Shah allocations - Track 3 TMS
  {
    id: 'alloc-10',
    resourceId: 'res-2',
    projectId: 'proj-tms',
    startDate: '2026-06-01',
    endDate: '2026-06-12',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-11',
    resourceId: 'res-2',
    projectId: 'proj-tms',
    startDate: '2026-06-13',
    endDate: '2026-06-17',
    billablePercent: 50,
    billableType: 'Billable',
    bookingType: 'hard',
  },

  // David Kim allocations
  {
    id: 'alloc-12',
    resourceId: 'res-5',
    projectId: 'proj-s4hana',
    startDate: '2026-06-01',
    endDate: '2026-06-12',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-13',
    resourceId: 'res-5',
    projectId: 'proj-s4hana',
    startDate: '2026-06-13',
    endDate: '2026-06-17',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-14',
    resourceId: 'res-5',
    projectId: 'proj-s4hana',
    startDate: '2026-06-18',
    endDate: '2026-06-25',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-15',
    resourceId: 'res-5',
    projectId: 'proj-tms',
    startDate: '2026-06-26',
    endDate: '2026-07-10',
    billablePercent: 10,
    billableType: 'Opportunity',
    bookingType: 'soft',
  },

  // Marcus Vance / Emily Chen
  {
    id: 'alloc-16',
    resourceId: 'res-4',
    projectId: 'proj-solventum',
    startDate: '2026-06-18',
    endDate: '2026-07-05',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'alloc-17',
    resourceId: 'res-3',
    projectId: 'proj-opp-honda',
    startDate: '2026-06-01',
    endDate: '2026-06-19',
    billablePercent: 100,
    billableType: 'Billable',
    bookingType: 'hard',
  }
];

export const INITIAL_VACATIONS: Vacation[] = [
  {
    id: 'vac-1',
    resourceId: 'res-3',
    startDate: '2026-06-22',
    endDate: '2026-06-26',
    status: 'Approved',
    reason: 'Summer Trip to Europe'
  },
  {
    id: 'vac-2',
    resourceId: 'res-1',
    startDate: '2026-07-10',
    endDate: '2026-07-14',
    status: 'Pending',
    reason: 'Family wedding'
  },
  {
    id: 'vac-3',
    resourceId: 'res-5',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    status: 'Pending',
    reason: 'Medical appointment checkup'
  }
];

export const INITIAL_REQUESTS: BookingRequest[] = [
  {
    id: 'req-1',
    referenceId: 'NW-REQ-001',
    resourceId: '', // Start unassigned so that the skill matching works beautifully!
    projectId: 'proj-solventum',
    startDate: '2026-06-29',
    endDate: '2026-07-10',
    billablePercent: 80,
    billableType: 'Billable',
    bookingType: 'hard',
    probability: 100,
    status: 'Pending',
    notes: 'Urgent cover needed for project Solventum backend implementation phase.',
    requiredSkill: 'Backend Developer'
  },
  {
    id: 'req-2',
    referenceId: 'NW-REQ-002',
    resourceId: '',
    projectId: 'proj-internal',
    startDate: '2026-07-01',
    endDate: '2026-07-08',
    billablePercent: 20,
    billableType: 'Opportunity',
    bookingType: 'soft',
    probability: 60,
    status: 'Pending',
    notes: 'Support with onboarding of junior staff.',
    requiredSkill: 'React'
  },
  {
    id: 'req-3',
    referenceId: 'NW-REQ-003',
    resourceId: '',
    projectId: 'proj-s4hana',
    startDate: '2026-06-15',
    endDate: '2026-06-30',
    billablePercent: 100,
    billableType: 'Billable',
    bookingType: 'hard',
    probability: 100,
    status: 'Pending',
    notes: 'SAP consultant to support migration phase.',
    requiredSkill: 'SAP Specialist'
  },
  {
    id: 'req-4',
    referenceId: 'NW-REQ-004',
    resourceId: '',
    projectId: 'proj-tms',
    startDate: '2026-06-08',
    endDate: '2026-06-20',
    billablePercent: 50,
    billableType: 'Billable',
    bookingType: 'hard',
    probability: 100,
    status: 'Pending',
    notes: 'UI expert to design new dashboards.',
    requiredSkill: 'UI/UX Design'
  },
  {
    id: 'req-5',
    referenceId: 'NW-REQ-005',
    resourceId: '',
    projectId: 'proj-opp-honda',
    startDate: '2026-06-22',
    endDate: '2026-07-03',
    billablePercent: 100,
    billableType: 'Opportunity',
    bookingType: 'soft',
    probability: 75,
    status: 'Pending',
    notes: 'Urgent CRM proposal design support.',
    requiredSkill: 'Figma'
  },
  {
    id: 'req-6',
    referenceId: 'NW-REQ-006',
    resourceId: '',
    projectId: 'proj-solventum',
    startDate: '2026-06-15',
    endDate: '2026-06-26',
    billablePercent: 40,
    billableType: 'Billable',
    bookingType: 'hard',
    probability: 100,
    status: 'Pending',
    notes: 'Quality Assurance checking of deployment candidates.',
    requiredSkill: 'QA Engineer'
  }
];

export const REQUESTS_TAB_MOCK_DATA: BookingRequest[] = [
  {
    id: 'req-1',
    referenceId: 'NW-REQ-001',
    resourceId: '',
    projectId: 'proj-solventum',
    startDate: '2026-06-29',
    endDate: '2026-07-10',
    billablePercent: 80,
    billableType: 'Billable',
    bookingType: 'hard',
    probability: 100,
    status: 'Pending',
    notes: 'Urgent cover needed for project Solventum backend implementation phase.',
    requiredSkill: 'Backend Developer'
  },
  {
    id: 'req-2',
    referenceId: 'NW-REQ-002',
    resourceId: '',
    projectId: 'proj-internal',
    startDate: '2026-07-01',
    endDate: '2026-07-08',
    billablePercent: 20,
    billableType: 'Opportunity',
    bookingType: 'soft',
    probability: 60,
    status: 'Pending',
    notes: 'Support with onboarding of junior staff.',
    requiredSkill: 'React'
  },
  {
    id: 'req-3',
    referenceId: 'NW-REQ-003',
    resourceId: '',
    projectId: 'proj-s4hana',
    startDate: '2026-06-15',
    endDate: '2026-06-30',
    billablePercent: 100,
    billableType: 'Billable',
    bookingType: 'hard',
    probability: 100,
    status: 'Pending',
    notes: 'SAP consultant to support migration phase.',
    requiredSkill: 'SAP Specialist'
  },
  {
    id: 'req-4',
    referenceId: 'NW-REQ-004',
    resourceId: '',
    projectId: 'proj-tms',
    startDate: '2026-06-08',
    endDate: '2026-06-20',
    billablePercent: 50,
    billableType: 'Billable',
    bookingType: 'hard',
    probability: 100,
    status: 'Pending',
    notes: 'UI expert to design new dashboards.',
    requiredSkill: 'UI/UX Design'
  },
  {
    id: 'req-5',
    referenceId: 'NW-REQ-005',
    resourceId: '',
    projectId: 'proj-opp-honda',
    startDate: '2026-06-22',
    endDate: '2026-07-03',
    billablePercent: 100,
    billableType: 'Opportunity',
    bookingType: 'soft',
    probability: 75,
    status: 'Pending',
    notes: 'Urgent CRM proposal design support.',
    requiredSkill: 'Figma'
  },
  {
    id: 'req-6',
    referenceId: 'NW-REQ-006',
    resourceId: '',
    projectId: 'proj-solventum',
    startDate: '2026-06-15',
    endDate: '2026-06-26',
    billablePercent: 40,
    billableType: 'Billable',
    bookingType: 'hard',
    probability: 100,
    status: 'Pending',
    notes: 'Quality Assurance checking of deployment candidates.',
    requiredSkill: 'QA Engineer'
  },

  {
    id: 'req-9',
    referenceId: 'NW-REQ-009',
    resourceId: '',
    projectId: 'proj-opp-honda',
    startDate: '2026-06-01',
    endDate: '2026-06-19',
    billablePercent: 100,
    billableType: 'Billable',
    bookingType: 'hard',
    probability: 100,
    status: 'Pending',
    notes: 'Proposed UI/UX Designer assignment for Honda CRM project mockup.',
    requiredSkill: 'Figma'
  }
];

export const REQUESTS_TAB_MOCK_ALLOCATIONS: Allocation[] = [
  {
    id: 'req-alloc-1',
    resourceId: 'res-4', // Emily Chen
    projectId: 'proj-solventum',
    startDate: '2026-06-18',
    endDate: '2026-07-05',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'req-alloc-2',
    resourceId: 'res-1', // Anmol Gupta
    projectId: 'proj-tms',
    startDate: '2026-06-01',
    endDate: '2026-07-15',
    billablePercent: 50,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'req-alloc-3',
    resourceId: 'res-5', // David Kim
    projectId: 'proj-s4hana',
    startDate: '2026-06-01',
    endDate: '2026-06-25',
    billablePercent: 70,
    billableType: 'Billable',
    bookingType: 'hard',
  },
  {
    id: 'req-alloc-4',
    resourceId: 'res-3', // Alex Sapah
    projectId: 'proj-opp-honda',
    startDate: '2026-06-01',
    endDate: '2026-06-19',
    billablePercent: 100,
    billableType: 'Billable',
    bookingType: 'hard',
  }
];

