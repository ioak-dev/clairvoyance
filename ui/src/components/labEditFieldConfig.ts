import type { Project, Resource, JobCategory } from '../types';
import type { Lookups } from '../lib/services/lookups';
import type { EditField } from './LabEditModal.tsx';

export interface ValidationEditField extends EditField {
  required?: boolean;
}

const JOB_CATEGORY_OPTIONS: JobCategory[] = [
  'B0- Fresher',
  'L0', 'L1', 'L2', 'L3', 'L4', 'L5',
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5',
];

export function getFilteredCompetencyCenterOptions(
  lookups: Lookups | undefined,
  practiceAreaId: string,
) {
  const centers = lookups?.competencyCenters || [];
  const filtered = practiceAreaId
    ? centers.filter((entry) => entry.practice_area_id === practiceAreaId)
    : centers;

  return filtered.map((entry) => ({ value: entry.id, label: entry.name }));
}

export function buildRequestFields(params: {
  projects: Project[];
  people: Resource[];
  lookups: Lookups | undefined;
  competencyCenterOptions: Array<{ value: string; label: string }>;
}): ValidationEditField[] {
  const { projects, people, lookups, competencyCenterOptions } = params;

  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  return [
    { key: 'id', label: 'Request Reference ID', type: 'text', required: true, canGenerateUuid: true },
    { key: 'project_id', label: 'Project', type: 'select', options: projectOptions, required: true },
    { key: 'person_id', label: 'Person', type: 'select', options: [], nullable: true, readOnly: true },
    { key: 'start_date', label: 'Start Date', type: 'date', required: true },
    { key: 'end_date', label: 'End Date', type: 'date', required: true },
    { key: 'billable_percent', label: 'Utilization(%)', type: 'number', required: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
      ],
      required: true,
    },
    { key: 'probability', label: 'Probability', type: 'number', required: true },
    { key: 'required_skill', label: 'Required Skill', type: 'text', nullable: true },
    { key: 'notes', label: 'Notes', type: 'textarea', nullable: true },
    {
      key: 'consulting_unit_id',
      label: 'Consulting Unit',
      type: 'select',
      options: (lookups?.consultingUnits || []).map((entry) => ({ value: entry.id, label: entry.name })),
      nullable: true,
    },
    {
      key: 'practice_area_id',
      label: 'Practice Area',
      type: 'select',
      options: (lookups?.practiceAreas || []).map((entry) => ({ value: entry.id, label: entry.name })),
      nullable: true,
    },
    {
      key: 'competency_center_id',
      label: 'Competency Center',
      type: 'select',
      options: competencyCenterOptions,
      nullable: true,
    },
    {
      key: 'site_id',
      label: 'Site',
      type: 'select',
      options: (lookups?.sites || []).map((entry) => ({ value: entry.id, label: entry.name })),
      nullable: true,
    },
    {
      key: 'job_category',
      label: 'Job Category',
      type: 'select',
      options: JOB_CATEGORY_OPTIONS.map((value) => ({ value, label: value })),
      nullable: true,
    },
  ];
}

export function buildProjectFields(params: {
  people: Resource[];
  lookups: Lookups | undefined;
}): ValidationEditField[] {
  const { people, lookups } = params;

  return [
    { key: 'id', label: 'Project Reference ID', type: 'text', required: true },
    { key: 'project_id', label: 'Project ID', type: 'text', nullable: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    {
      key: 'manager_id',
      label: 'Manager',
      type: 'select',
      options: people.map((person) => ({ value: person.id, label: person.name })),
      nullable: true,
    },
    {
      key: 'market_unit_id',
      label: 'Market Unit',
      type: 'select',
      options: (lookups?.marketUnits || []).map((entry) => ({ value: entry.id, label: entry.name })),
      nullable: true,
    },
    {
      key: 'consulting_unit_id',
      label: 'Consulting Unit',
      type: 'select',
      options: (lookups?.consultingUnits || []).map((entry) => ({ value: entry.id, label: entry.name })),
      nullable: true,
    },
    { key: 'win_probability', label: 'Win Probability', type: 'number', required: true },
  ];
}
