import type { Project, Resource } from '../types';
import type { Lookups } from '../lib/services/lookups';
import type { EditField } from './LabEditModal.tsx';

export interface ValidationEditField extends EditField {
  required?: boolean;
}

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

  // Filter for opportunities only (billable_type = 'Opportunity')
  const opportunityOptions = projects
    .filter((project) => project.billableType === 'Opportunity')
    .map((project) => ({
      value: project.id,
      label: project.name,
    }));

  return [
    { key: 'id', label: 'Request Reference ID', type: 'text', required: true, canGenerateUuid: true },
    { key: 'project_id', label: 'Opportunity', type: 'searchable-select', options: opportunityOptions, required: true },
    { key: 'person_id', label: 'Person', type: 'select', options: [], nullable: true, readOnly: true },
    {
      key: 'weeks',
      label: 'Weeks (JSON: [{iso_year, iso_week, days_per_week}])',
      type: 'textarea',
      required: true,
    },
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
    { key: 'request_name', label: 'Request Name', type: 'text', nullable: true },
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
      key: 'job_level_id',
      label: 'Job Level',
      type: 'select',
      options: (lookups?.jobLevels || []).map((entry) => ({ value: entry.id, label: entry.name })),
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
