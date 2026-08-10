/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookingRequest, Project, Resource, ScheduleAssignment, Vacation } from '../types';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useScheduleAuditExport } from '../hooks/useScheduleAudit';
import type { ScheduleAuditReportRow } from '../types/api';
import { Button, Card, ErrorMessage, Field, Input, Label, Select } from './ui';
import { getEffectiveBillableType } from '../lib/projectCategory';

interface ReportsTabProps {
  resources?: Resource[];
  projects?: Project[];
  assignments?: ScheduleAssignment[];
  requests?: BookingRequest[];
  vacations?: Vacation[];
}

type ReportKey =
  | 'scheduleAuditLog'
  | 'resources'
  | 'projects'
  | 'schedules'
  | 'requests'
  | 'vacations';

function rosterExportValue(roster: number[] | null | undefined): string {
  if (!roster || !Array.isArray(roster)) return '';
  return JSON.stringify(roster);
}

type AuditFilterMode = 'project' | 'resource';

type ReportConfig = {
  key: ReportKey;
  title: string;
  filePrefix: string;
  buildRows: () => Record<string, unknown>[];
};

function downloadRowsAsWorkbook(filePrefix: string, rows: Record<string, unknown>[]): void {
  const today = new Date().toISOString().slice(0, 10);
  const workbook = XLSX.utils.book_new();
  const data = rows.length > 0 ? rows : [{ message: 'No data available' }];
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `${filePrefix}_${today}.xlsx`);
}

function toScheduleAuditWorkbookRow(row: ScheduleAuditReportRow): Record<string, unknown> {
  return {
    entity_type: row.entity_type,
    change_action: row.change_action,
    project_reference_id: row.project_reference_id || '',
    project_name: row.project_name || '',
    person_employee_id: row.person_employee_id || '',
    person_name: row.person_name || '',
    start_date_before: row.start_date_before || '',
    start_date_after: row.start_date_after || '',
    end_date_before: row.end_date_before || '',
    end_date_after: row.end_date_after || '',
    unit_before: row.unit_before || '',
    unit_after: row.unit_after || '',
    roster_before: rosterExportValue(row.roster_before),
    roster_after: rosterExportValue(row.roster_after),
  };
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  resources = [],
  projects = [],
  assignments = [],
  requests = [],
  vacations = [],
}) => {
  const [downloading, setDownloading] = React.useState<ReportKey | null>(null);
  const [auditFilterMode, setAuditFilterMode] = React.useState<AuditFilterMode>('project');
  const [selectedAuditIds, setSelectedAuditIds] = React.useState<string[]>([]);
  const [auditChangedFrom, setAuditChangedFrom] = React.useState('');
  const [auditChangedTo, setAuditChangedTo] = React.useState('');
  const [auditError, setAuditError] = React.useState<string | null>(null);
  const { mutateAsync: exportScheduleAudit, isPending: isAuditExporting } = useScheduleAuditExport();

  const resourceNameById = React.useMemo(() => {
    return new Map(resources.map((resource) => [resource.id, resource.name]));
  }, [resources]);

  const projectNameById = React.useMemo(() => {
    return new Map(projects.map((project) => [project.id, project.name]));
  }, [projects]);

  const auditOptions = React.useMemo(() => {
    if (auditFilterMode === 'project') {
      return projects.map((project) => ({
        id: project.id,
        label: `${project.name} (${project.referenceId || project.projectId || project.id})`,
      }));
    }

    return resources.map((resource) => ({
      id: resource.id,
      label: `${resource.name} (${resource.employeeId || resource.id})`,
    }));
  }, [auditFilterMode, projects, resources]);

  React.useEffect(() => {
    setSelectedAuditIds([]);
    setAuditError(null);
  }, [auditFilterMode]);

  const reports = React.useMemo<ReportConfig[]>(() => {
    return [
      {
        key: 'resources',
        title: 'Resource Directory',
        filePrefix: 'resource_directory',
        buildRows: () =>
          resources.map((resource) => ({
            resource_id: resource.id,
            employee_id: resource.employeeId || '',
            name: resource.name,
            first_name: resource.firstName || '',
            last_name: resource.lastName || '',
            email: resource.email || '',
            role: resource.role,
            consulting_unit: resource.group || '',
            practice_area: resource.practiceArea || '',
            competency_center: resource.competencyCenter || '',
            site: resource.site || '',
            status: resource.status || '',
            lifecycle_status: resource.lifecycleStatus || '',
            job_level_id: resource.jobLevelId || '',
            fte: resource.fte ?? '',
            weekly_hours: resource.weeklyHours ?? '',
          })),
      },
      {
        key: 'projects',
        title: 'Project Portfolio',
        filePrefix: 'project_portfolio',
        buildRows: () =>
          projects.map((project) => ({
            project_id: project.id,
            reference_id: project.referenceId || '',
            external_project_id: project.projectId || '',
            name: project.name,
            client: project.client,
            billable_type: project.billableType || '',
            is_opportunity: project.isOpportunity ? 'Yes' : 'No',
            consulting_unit: project.group || '',
            win_probability: project.winProbability ?? '',
            manager_id: project.managerId || '',
            market_unit_id: project.marketUnitId || '',
            consulting_unit_id: project.consultingUnitId || '',
          })),
      },
      {
        key: 'schedules',
        title: 'Schedules',
        filePrefix: 'schedules',
        buildRows: () =>
          assignments
            .map((assignment) => {
              const project = projects.find((p) => p.id === assignment.projectId);
              return {
              schedule_id: assignment.id,
              resource_id: assignment.resourceId,
              resource_name: resourceNameById.get(assignment.resourceId) || assignment.resourceId,
              project_id: assignment.projectId,
              project_name: projectNameById.get(assignment.projectId) || assignment.projectId,
              request_id: assignment.requestId || '',
              billable_type: getEffectiveBillableType(assignment.billableType, project),
              booking_type: assignment.bookingType,
              start: assignment.startDate,
              end: assignment.endDate,
              unit: assignment.unit,
              roster: rosterExportValue(assignment.roster),
            };
            })
            .sort((a, b) => {
              if (a.start !== b.start) return String(a.start).localeCompare(String(b.start));
              if (a.end !== b.end) return String(a.end).localeCompare(String(b.end));
              return String(a.resource_name).localeCompare(String(b.resource_name));
            }),
      },
      {
        key: 'requests',
        title: 'Requests',
        filePrefix: 'requests',
        buildRows: () =>
          requests
            .map((request) => {
              const project = projects.find((p) => p.id === request.projectId);
              return {
              request_id: request.id,
              reference_id: request.referenceId,
              request_name: request.requestName || '',
              status: request.status,
              probability: request.probability,
              resource_id: request.resourceId || '',
              resource_name: request.resourceId
                ? resourceNameById.get(request.resourceId) || request.resourceId
                : '',
              project_id: request.projectId,
              project_name: projectNameById.get(request.projectId) || request.projectId,
              billable_type: getEffectiveBillableType(request.billableType, project),
              booking_type: request.bookingType,
              start: request.startDate,
              end: request.endDate,
              unit: request.unit,
              roster: rosterExportValue(request.roster),
              notes: request.notes || '',
            };
            })
            .sort((a, b) => {
              if (a.start !== b.start) return String(a.start).localeCompare(String(b.start));
              if (a.end !== b.end) return String(a.end).localeCompare(String(b.end));
              return String(a.request_name || a.reference_id).localeCompare(String(b.request_name || b.reference_id));
            }),
      },
      {
        key: 'vacations',
        title: 'Vacation Register',
        filePrefix: 'vacation_register',
        buildRows: () =>
          vacations
            .map((vacation) => ({
              vacation_id: vacation.id,
              resource_id: vacation.resourceId,
              resource_name: resourceNameById.get(vacation.resourceId) || vacation.resourceId,
              start_date: vacation.startDate,
              end_date: vacation.endDate,
              status: vacation.status,
              reason: vacation.reason || '',
            }))
            .sort((a, b) => {
              if (String(a.start_date) !== String(b.start_date)) {
                return String(a.start_date).localeCompare(String(b.start_date));
              }
              return String(a.resource_name).localeCompare(String(b.resource_name));
            }),
      },
    ];
  }, [assignments, projectNameById, projects, requests, resourceNameById, resources, vacations]);

  const handleDownload = (report: ReportConfig) => {
    setDownloading(report.key);
    try {
      const rows = report.buildRows();
      downloadRowsAsWorkbook(report.filePrefix, rows);
    } finally {
      setDownloading(null);
    }
  };

  const handleAuditSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions, (option) => option.value);
    setSelectedAuditIds(values);
  };

  const handleAuditDownload = async () => {
    if (selectedAuditIds.length === 0) {
      setAuditError(`Select at least one ${auditFilterMode === 'project' ? 'project' : 'resource'} to export.`);
      return;
    }

    if (auditChangedFrom && auditChangedTo && auditChangedTo < auditChangedFrom) {
      setAuditError('Changed To must be on or after Changed From.');
      return;
    }

    setAuditError(null);
    setDownloading('scheduleAuditLog');

    try {
      const rows = await exportScheduleAudit({
        projectIds: auditFilterMode === 'project' ? selectedAuditIds : undefined,
        personIds: auditFilterMode === 'resource' ? selectedAuditIds : undefined,
        changedFrom: auditChangedFrom || undefined,
        changedTo: auditChangedTo || undefined,
      });

      downloadRowsAsWorkbook('schedule_audit_log', rows.map(toScheduleAuditWorkbookRow));
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Failed to download schedule audit log.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card padded className="flex flex-col gap-4" id="reports-downloads">
      <h2 className="text-xl font-bold text-primary tracking-tight">Reports</h2>

      <div className="rounded-lg border border-subtle bg-surface px-4 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-medium text-primary">Schedule Audit Log</h3>
            <p className="text-xs text-secondary mt-1">
              Export schedule change history by project or resource, with optional changed-date bounds.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAuditDownload}
            loading={downloading === 'scheduleAuditLog' || isAuditExporting}
            disabled={Boolean(downloading) || isAuditExporting || auditOptions.length === 0}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            {downloading === 'scheduleAuditLog' ? 'Downloading...' : 'Download Audit Log'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field>
            <Label>Filter Mode</Label>
            <Select<AuditFilterMode>
              value={auditFilterMode}
              onChange={setAuditFilterMode}
              options={[
                { value: 'project', label: 'Projects' },
                { value: 'resource', label: 'Resources' },
              ]}
              aria-label="Filter Mode"
            />
          </Field>

          <Field>
            <Label>Changed From</Label>
            <Input
              type="date"
              value={auditChangedFrom}
              onChange={(event) => setAuditChangedFrom(event.target.value)}
            />
          </Field>

          <Field>
            <Label>Changed To</Label>
            <Input
              type="date"
              value={auditChangedTo}
              onChange={(event) => setAuditChangedTo(event.target.value)}
            />
          </Field>
        </div>

        <Field>
          <Label>{auditFilterMode === 'project' ? 'Projects' : 'Resources'}</Label>
          {/* Multi-select is not supported by Select primitive; keep native control */}
          <select
            multiple
            size={Math.min(Math.max(auditOptions.length, 4), 8)}
            value={selectedAuditIds}
            onChange={handleAuditSelectionChange}
            className="w-full rounded-lg border border-default bg-input px-3 py-2 text-[13px] text-primary focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
          >
            {auditOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </Field>

        {auditError && <ErrorMessage>{auditError}</ErrorMessage>}
      </div>

      <div className="flex flex-col gap-2">
        {reports.map((report) => {
          const isDownloading = downloading === report.key;
          return (
            <div
              key={report.key}
              className="rounded-lg border border-subtle bg-surface px-3 py-2.5 flex items-center justify-between gap-3"
            >
              <h3 className="text-sm font-medium text-primary">{report.title}</h3>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleDownload(report)}
                loading={isDownloading}
                disabled={Boolean(downloading)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                {isDownloading ? 'Downloading...' : 'Download'}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
