/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookingRequest, Project, Resource, ScheduleAssignment, Vacation } from '../types';
import { Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { isoWeekToDateRange } from '../lib/weekUtils';

interface ReportsTabProps {
  resources?: Resource[];
  projects?: Project[];
  assignments?: ScheduleAssignment[];
  requests?: BookingRequest[];
  vacations?: Vacation[];
}

type ReportKey =
  | 'resources'
  | 'projects'
  | 'scheduleByWeek'
  | 'requestsByWeek'
  | 'vacations';

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

export const ReportsTab: React.FC<ReportsTabProps> = ({
  resources = [],
  projects = [],
  assignments = [],
  requests = [],
  vacations = [],
}) => {
  const [downloading, setDownloading] = React.useState<ReportKey | null>(null);

  const resourceNameById = React.useMemo(() => {
    return new Map(resources.map((resource) => [resource.id, resource.name]));
  }, [resources]);

  const projectNameById = React.useMemo(() => {
    return new Map(projects.map((project) => [project.id, project.name]));
  }, [projects]);

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
        key: 'scheduleByWeek',
        title: 'Schedule by Week',
        filePrefix: 'schedule_by_week',
        buildRows: () =>
          assignments
            .flatMap((assignment) =>
              assignment.weeks.map((week) => {
                const range = isoWeekToDateRange(week.isoYear, week.isoWeek);
                return {
                  schedule_id: assignment.id,
                  resource_id: assignment.resourceId,
                  resource_name: resourceNameById.get(assignment.resourceId) || assignment.resourceId,
                  project_id: assignment.projectId,
                  project_name: projectNameById.get(assignment.projectId) || assignment.projectId,
                  request_id: assignment.requestId || '',
                  billable_type: assignment.billableType,
                  booking_type: assignment.bookingType,
                  iso_year: week.isoYear,
                  iso_week: week.isoWeek,
                  week_start: range.start,
                  week_end: range.end,
                  days_per_week: week.daysPerWeek,
                };
              }),
            )
            .sort((a, b) => {
              if (a.iso_year !== b.iso_year) return Number(a.iso_year) - Number(b.iso_year);
              if (a.iso_week !== b.iso_week) return Number(a.iso_week) - Number(b.iso_week);
              return String(a.resource_name).localeCompare(String(b.resource_name));
            }),
      },
      {
        key: 'requestsByWeek',
        title: 'Requests by Week',
        filePrefix: 'requests_by_week',
        buildRows: () =>
          requests
            .flatMap((request) =>
              request.weeks.map((week) => {
                const range = isoWeekToDateRange(week.isoYear, week.isoWeek);
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
                  billable_type: request.billableType,
                  booking_type: request.bookingType,
                  iso_year: week.isoYear,
                  iso_week: week.isoWeek,
                  week_start: range.start,
                  week_end: range.end,
                  days_per_week: week.daysPerWeek,
                  notes: request.notes || '',
                };
              }),
            )
            .sort((a, b) => {
              if (a.iso_year !== b.iso_year) return Number(a.iso_year) - Number(b.iso_year);
              if (a.iso_week !== b.iso_week) return Number(a.iso_week) - Number(b.iso_week);
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

  return (
    <div className="app-card p-6 flex flex-col gap-4" id="reports-downloads">
      <h2 className="text-xl font-bold text-primary tracking-tight">Reports</h2>

      <div className="flex flex-col gap-2">
        {reports.map((report) => {
          const isDownloading = downloading === report.key;
          return (
            <div
              key={report.key}
              className="rounded-lg border border-subtle bg-surface px-3 py-2.5 flex items-center justify-between gap-3"
            >
              <h3 className="text-sm font-medium text-primary">{report.title}</h3>
              <button
                type="button"
                onClick={() => handleDownload(report)}
                disabled={Boolean(downloading)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

