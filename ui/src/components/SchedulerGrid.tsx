/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { AllocationBlock, BookingRequest, Project, Resource, ScheduleAssignment, Vacation } from '../types';
import { AlertTriangle, Calendar, CalendarClock, CheckCircle2, Loader2, MinusCircle, Plus, User, UserCheck } from 'lucide-react';
import {
  getProjectCategory,
  getAllocationBlockChrome,
  getAllocationBlockBackgroundFromDays,
  getRequestBlockChrome,
  getRequestBlockBackground,
  SCHEDULE_BLOCK_BADGE_CLASS,
  type ProjectCategory,
  type AllocationBlockChrome,
} from '../lib/projectCategory';
import { filterPeople, filterProjects, filterRequests } from '../lib/filterEngine';
import { addDays, CURRENT_DATE_STRING } from '../lib/dateUtils';
import {
  buildDayColumnLayout,
  deriveAllocationBlocks,
  getDateRangeBounds,
  getIsoWeekKey,
  getIsoWeekWeekdayBounds,
  type DayColumnLayout,
} from '../lib/weekUtils';
import { requestDateBounds } from '../types/api';
import { useSchedulesInRange } from '../hooks/useSchedules';
import { useHorizontalTimelineWindow } from '../hooks/useHorizontalTimelineWindow';
import { SkillMatcherModal } from './SkillMatcherModal';
import { BulkScheduleModal } from './BulkScheduleModal';

const WEEKDAY_COL_WIDTH = 52;
const WEEKEND_COL_WIDTH = 28;
const FETCH_BUFFER_DAYS = 14;

export type SchedulerGridHandle = {
  scrollByWeeks: (weeks: number) => void;
  focusOnDate: (date: string) => void;
  focusToday: () => void;
};

interface SchedulerGridProps {
  resources: Resource[];
  projects: Project[];
  vacations: Vacation[];
  requests?: BookingRequest[];
  filterCriteria?: Record<string, unknown> | null;
  isFilterApplying?: boolean;
  viewMode?: 'resources' | 'projects' | 'requests';
  onEditBlock: (block: AllocationBlock) => void;
  onOpenScheduleModalWithRes: (resId: string, projId?: string) => void;
  onAddResourceClick: () => void;
  onAddProjectClick?: () => void;
  onApproveRequestWithResource?: (requestId: string, resourceId: string) => void | Promise<void>;
  onUnassignRequest?: (requestId: string) => void | Promise<void>;
}

function assignmentToBlocks(assignment: ScheduleAssignment): AllocationBlock[] {
  return deriveAllocationBlocks({
    scheduleId: assignment.id,
    resourceId: assignment.resourceId,
    projectId: assignment.projectId,
    requestId: assignment.requestId,
    billableType: assignment.billableType,
    bookingType: assignment.bookingType,
    weeks: assignment.weeks,
  });
}

function requestToBlocks(request: BookingRequest): AllocationBlock[] {
  return deriveAllocationBlocks({
    scheduleId: request.id,
    resourceId: request.resourceId || 'unassigned',
    projectId: request.projectId,
    requestId: request.id,
    billableType: request.billableType,
    bookingType: request.bookingType,
    weeks: request.weeks,
  });
}

function daysPerWeekLabel(daysPerWeek: number): string {
  const pct = Math.round((daysPerWeek / 5) * 100);
  return `${pct}% · ${daysPerWeek} day${daysPerWeek === 1 ? '' : 's'}`;
}

function UtilizationDayBar({
  columns,
  isoYear,
  isoWeek,
  daysPerWeek,
  topOffset = 0,
}: {
  columns: DayColumnLayout[];
  isoYear: number;
  isoWeek: number;
  daysPerWeek: number;
  topOffset?: number;
}) {
  const bounds = getIsoWeekWeekdayBounds(columns, isoYear, isoWeek);
  if (!bounds) return null;

  const clampedDays = Math.min(5, Math.max(0, daysPerWeek));
  const dayWidth = bounds.width / 5;

  return (
    <div
      className="absolute pointer-events-none flex gap-px"
      style={{ left: bounds.left + 4, width: Math.max(bounds.width - 8, 8), top: topOffset, height: 4 }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ width: dayWidth - 1 }} className="bg-emerald-100/50 rounded-sm overflow-hidden">
          <div
            style={{ width: `${Math.max(0, Math.min(1, clampedDays - i)) * 100}%` }}
            className="h-full bg-emerald-500 rounded-sm"
          />
        </div>
      ))}
    </div>
  );
}

export const SchedulerGrid = forwardRef<SchedulerGridHandle, SchedulerGridProps>(function SchedulerGrid({
  resources,
  projects,
  vacations,
  requests = [],
  filterCriteria = null,
  isFilterApplying = false,
  viewMode = 'resources',
  onEditBlock,
  onOpenScheduleModalWithRes,
  onApproveRequestWithResource,
  onUnassignRequest,
}, ref) {
  const [selectedRequestForSkills, setSelectedRequestForSkills] = useState<BookingRequest | null>(null);
  const [bulkScheduleResource, setBulkScheduleResource] = useState<Resource | null>(null);
  const [bulkScheduleProject, setBulkScheduleProject] = useState<Project | null>(null);

  const {
    scrollRef,
    windowStart,
    windowEnd,
    handleScroll,
    scrollByWeeks,
    focusOnDate,
    focusToday,
  } = useHorizontalTimelineWindow(CURRENT_DATE_STRING);

  useImperativeHandle(ref, () => ({
    scrollByWeeks,
    focusOnDate,
    focusToday,
  }), [scrollByWeeks, focusOnDate, focusToday]);

  const fetchStart = addDays(windowStart, -FETCH_BUFFER_DAYS);
  const fetchEnd = addDays(windowEnd, FETCH_BUFFER_DAYS);
  const { data: rangeAssignments = [], isFetching: isFetchingSchedules } = useSchedulesInRange(
    fetchStart,
    fetchEnd,
  );

  const onTimelineScroll = useCallback(() => {
    handleScroll();
  }, [handleScroll]);

  const { columns: dayColumns, totalWidth: gridWidth } = useMemo(
    () => buildDayColumnLayout(windowStart, windowEnd, WEEKDAY_COL_WIDTH, WEEKEND_COL_WIDTH),
    [windowStart, windowEnd],
  );

  const monthsHeader = useMemo(() => {
    const groups: { monthName: string; width: number }[] = [];
    dayColumns.forEach((col) => {
      const existing = groups.find((g) => g.monthName === col.monthName);
      if (existing) existing.width += col.width;
      else groups.push({ monthName: col.monthName, width: col.width });
    });
    return groups;
  }, [dayColumns]);

  const visibleIsoWeeks = useMemo(() => {
    const seen = new Set<string>();
    const weeks: Array<{ isoYear: number; isoWeek: number }> = [];

    dayColumns.forEach((col) => {
      if (col.isWeekend) return;
      const key = getIsoWeekKey(col.dateStr);
      const weekId = `${key.isoYear}-${key.isoWeek}`;
      if (seen.has(weekId)) return;
      seen.add(weekId);
      weeks.push({ isoYear: key.isoYear, isoWeek: key.isoWeek });
    });

    return weeks;
  }, [dayColumns]);

  const assignmentRows = useMemo(() => {
    interface Lane {
      project?: Project;
      resource?: Resource;
      request?: BookingRequest;
      blocks: AllocationBlock[];
    }

    const rows: {
      id: string;
      resource?: Resource;
      project?: Project;
      projectLanes: Lane[];
    }[] = [];

    const allBlocks = rangeAssignments.flatMap(assignmentToBlocks);

    if (viewMode === 'requests') {
      projects.forEach((proj) => {
        const projRequests = filterRequests(
          requests.filter((r) => r.projectId === proj.id && (r.status === 'Pending' || r.status === 'Approved')),
          filterCriteria,
          projects,
        );

        const projectLanes: Lane[] = projRequests.map((req) => ({
          project: proj,
          request: req,
          blocks: requestToBlocks(req),
        }));

        if (projectLanes.length > 0) {
          rows.push({ id: `row-${proj.id}`, project: proj, projectLanes });
        }
      });
    } else if (viewMode === 'projects') {
      const hasScheduleOnly = filterCriteria?.has_schedule === true;
      filterProjects(projects, filterCriteria).forEach((proj) => {
        const projBlocks = allBlocks.filter((b) => b.projectId === proj.id);
        if (hasScheduleOnly && projBlocks.length === 0) return;
        const resIds = Array.from(new Set(projBlocks.map((b) => b.resourceId)));

        const projectLanes: Lane[] =
          resIds.length === 0
            ? [{ resource: { id: 'none', name: 'Unassigned', role: '-' }, blocks: [] }]
            : resIds.map((rId) => ({
                resource: resources.find((r) => r.id === rId) || { id: rId, name: 'Resource', role: 'Role' },
                blocks: projBlocks.filter((b) => b.resourceId === rId),
              }));

        rows.push({ id: `row-${proj.id}`, project: proj, projectLanes });
      });
    } else {
      const hasScheduleOnly = filterCriteria?.has_schedule === true;
      filterPeople(resources, filterCriteria).forEach((res) => {
        const resBlocks = allBlocks.filter((b) => b.resourceId === res.id);
        if (hasScheduleOnly && resBlocks.length === 0) return;
        const projIds = Array.from(new Set(resBlocks.map((b) => b.projectId)));

        const projectLanes: Lane[] =
          projIds.length === 0
            ? [{
                project: { id: 'none', name: 'Unassigned', client: '-', color: 'bg-gray-400', textColor: 'text-gray-400' },
                blocks: [],
              }]
            : projIds.map((pId) => ({
                project: projects.find((p) => p.id === pId) || {
                  id: pId, name: 'Project', client: 'Client', color: 'bg-emerald-500', textColor: 'text-white',
                },
                blocks: resBlocks.filter((b) => b.projectId === pId),
              }));

        rows.push({ id: `row-${res.id}`, resource: res, projectLanes });
      });
    }

    return rows;
  }, [resources, projects, rangeAssignments, requests, filterCriteria, viewMode]);

  const getApprovedVacationsForResource = (resourceId: string) =>
    vacations.filter((v) => v.status === 'Approved' && v.resourceId === resourceId);

  const renderBlockSegments = (
    block: AllocationBlock,
    lane: { project?: Project; resource?: Resource; request?: BookingRequest },
    row: (typeof assignmentRows)[0],
  ) => {
    const segments = block.weeks.map((week) => ({
      week,
      bounds: getIsoWeekWeekdayBounds(dayColumns, week.isoYear, week.isoWeek),
    })).filter((s) => s.bounds !== null) as Array<{
      week: (typeof block.weeks)[0];
      bounds: { left: number; width: number };
    }>;

    if (segments.length === 0) return null;

    let blockTitle = '';
    let blockLabel = '';
    let showPersonIcon = false;
    let showUserCheckIcon = false;

    if (viewMode === 'requests' && lane.request) {
      const req = lane.request;
      const bounds = requestDateBounds(req);
      const assignedRes = req.resourceId ? resources.find((r) => r.id === req.resourceId) : null;
      const dateLabel = bounds ? `${bounds.startDate} to ${bounds.endDate}` : '';
      if (assignedRes) {
        blockTitle = `Assigned: ${assignedRes.name}\nRequest: ${req.requestName || 'General request'}\n${dateLabel}\n${block.daysPerWeek}d/wk`;
        blockLabel = assignedRes.name;
        showUserCheckIcon = true;
      } else {
        blockTitle = `Request: ${req.requestName || 'General request'}\n${dateLabel}\n${block.daysPerWeek}d/wk`;
        blockLabel = req.requestName || 'Request';
        showPersonIcon = true;
      }
    } else if (viewMode === 'projects') {
      blockTitle = `${lane.resource?.name}: ${block.daysPerWeek}d/wk`;
      blockLabel = lane.resource?.name || 'Resource';
    } else {
      blockTitle = `${lane.project?.name}: ${block.daysPerWeek}d/wk`;
      blockLabel = lane.project?.name || 'Project';
    }

    let textClass = 'text-slate-800';
    let badgeClass = SCHEDULE_BLOCK_BADGE_CLASS;
    let blockSurfaceStyle: React.CSSProperties | undefined;
    let blockCategory: ProjectCategory | null = null;
    let blockChrome: AllocationBlockChrome | null = null;
    let borderClass = 'border';

    if (viewMode === 'requests' && lane.request) {
      const isAssigned = !!lane.request.resourceId;
      const category = row.project ? getProjectCategory(row.project) : 'Billable';
      if (isAssigned) {
        blockCategory = category;
        blockChrome = getAllocationBlockChrome(category);
        blockSurfaceStyle = getAllocationBlockBackgroundFromDays(block.daysPerWeek, blockChrome);
      } else {
        blockChrome = getRequestBlockChrome(category);
        blockSurfaceStyle = getRequestBlockBackground(blockChrome);
      }
      textClass = blockChrome.textClass;
      badgeClass = blockChrome.badgeClass;
      if (!isAssigned) borderClass = 'border border-dotted';
    } else {
      const proj = lane.project || row.project || projects.find((p) => p.id === block.projectId);
      if (proj) {
        blockCategory = getProjectCategory(proj);
        blockChrome = getAllocationBlockChrome(blockCategory);
        blockSurfaceStyle = getAllocationBlockBackgroundFromDays(block.daysPerWeek, blockChrome);
        textClass = blockChrome.textClass;
        badgeClass = blockChrome.badgeClass;
      }
    }

    const subtitle = blockCategory
      ? `${daysPerWeekLabel(block.daysPerWeek)} - ${blockCategory.charAt(0)} - ${block.billableType}`
      : daysPerWeekLabel(block.daysPerWeek);

    const resourceRowOffset = viewMode === 'resources' ? 8 : 0;
    const resourceBlockTop = viewMode === 'resources' ? 14 : 6;

    return segments.map(({ week, bounds }) => (
      <React.Fragment key={`${block.scheduleId}-${week.isoYear}-${week.isoWeek}`}>
        <UtilizationDayBar
          columns={dayColumns}
          isoYear={week.isoYear}
          isoWeek={week.isoWeek}
          daysPerWeek={week.daysPerWeek}
          topOffset={resourceRowOffset}
        />
        <div
          style={{
            left: `${bounds.left + 4}px`,
            width: `${Math.max(bounds.width - 8, 8)}px`,
            height: '44px',
            top: `${resourceBlockTop}px`,
            ...blockSurfaceStyle,
          }}
          onClick={() => {
            if (viewMode === 'requests' && lane.request) {
              setSelectedRequestForSkills(lane.request);
            } else {
              onEditBlock(block);
            }
          }}
          className={`absolute select-none overflow-hidden text-left px-2 py-1.5 rounded-lg transition-transform hover:scale-[1.01] cursor-pointer shadow-sm flex items-center gap-2 ${borderClass} ${textClass} z-[5]`}
          title={blockTitle}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold tracking-tight leading-tight truncate">{blockLabel}</div>
            <div className="text-[9px] font-medium opacity-80 truncate mt-0.5">{subtitle}</div>
          </div>
          {showPersonIcon && <User className="w-3.5 h-3.5 shrink-0" />}
          {showUserCheckIcon && <UserCheck className="w-3.5 h-3.5 shrink-0" />}
        </div>
      </React.Fragment>
    ));
  };

  const renderRow = (row: (typeof assignmentRows)[0]) => {
    const resourceVacations =
      viewMode === 'projects' || viewMode === 'requests' || !row.resource
        ? []
        : getApprovedVacationsForResource(row.resource.id);

    const resourceWeeklyTotals =
      viewMode === 'projects' || viewMode === 'requests' || !row.resource
        ? null
        : row.projectLanes.reduce((acc, lane) => {
            lane.blocks.forEach((block) => {
              block.weeks.forEach((week) => {
                const weekId = `${week.isoYear}-${week.isoWeek}`;
                acc.set(weekId, (acc.get(weekId) || 0) + week.daysPerWeek);
              });
            });
            return acc;
          }, new Map<string, number>());

    return (
      <div key={row.id} className="flex hover:bg-surface-muted/60 items-stretch relative group border-b border-default min-h-[64px]">
        <div className="w-[190px] min-w-[190px] border-r border-default px-4 bg-surface sticky left-0 z-20 flex items-center justify-between shadow-app-sm min-h-[64px]">
          <div className="flex items-center gap-2 overflow-hidden py-3 w-full">
            {(viewMode === 'projects' || viewMode === 'requests') && row.project ? (
              <div className="truncate text-left flex-1">
                <h4 className="text-xs font-black text-primary truncate" title={row.project.name}>{row.project.name}</h4>
              </div>
            ) : row.resource ? (
              <>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center shrink-0">
                  {(row.resource.name || '').split(' ').map((n) => n[0] || '').join('')}
                </div>
                <div className="truncate text-left flex-1">
                  <h4 className="text-xs font-bold text-primary truncate">{row.resource.name}</h4>
                  <p className="text-[10px] text-tertiary capitalize truncate">{row.resource.role}</p>
                </div>
              </>
            ) : null}
          </div>

          {(viewMode === 'projects' || viewMode === 'requests') && row.project ? (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                onClick={() => onOpenScheduleModalWithRes('', row.project!.id)}
                className="p-1 hover:bg-surface-hover text-secondary rounded cursor-pointer"
                title={`Schedule on ${row.project.name}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {viewMode === 'projects' && (
                <button
                  onClick={() => setBulkScheduleProject(row.project!)}
                  className="p-1 hover:bg-indigo-50 text-indigo-500 rounded cursor-pointer"
                  title={`Bulk schedule resources on ${row.project.name}`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : row.resource ? (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                onClick={() => onOpenScheduleModalWithRes(row.resource!.id)}
                className="p-1 hover:bg-blue-50 text-blue-600 rounded cursor-pointer"
                title={`Schedule ${row.resource.name}`}
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setBulkScheduleResource(row.resource!)}
                className="p-1 hover:bg-indigo-50 text-indigo-500 rounded cursor-pointer"
                title={`Bulk schedule ${row.resource.name} for 2026`}
              >
                <CalendarClock className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        <div style={{ width: `${gridWidth}px` }} className="relative flex flex-col justify-center py-3 shrink-0 min-h-[64px]">
          {resourceWeeklyTotals && row.resource && (
            <div className="absolute inset-x-0 top-0 h-[12px] pointer-events-none z-[6]">
              {visibleIsoWeeks.map((week) => {
                const bounds = getIsoWeekWeekdayBounds(dayColumns, week.isoYear, week.isoWeek);
                if (!bounds) return null;

                const weekId = `${week.isoYear}-${week.isoWeek}`;
                const totalDays = resourceWeeklyTotals.get(weekId) || 0;
                if (totalDays <= 0) return null;
                const utilizationLabel = totalDays > 5
                  ? 'Over-utilized'
                  : totalDays === 5
                    ? 'Fully utilized'
                    : 'Under-utilized';

                const indicatorLeft = bounds.left + Math.max((bounds.width - 12) / 2, 0);
                const indicatorClass = totalDays > 5
                  ? 'text-rose-600'
                  : totalDays === 5
                    ? 'text-emerald-600'
                    : 'text-amber-600';

                const IndicatorIcon = totalDays > 5
                  ? AlertTriangle
                  : totalDays === 5
                    ? CheckCircle2
                    : MinusCircle;

                return (
                  <div
                    key={`util-${row.id}-${weekId}`}
                    style={{ left: `${indicatorLeft}px`, width: '12px' }}
                    className={`absolute top-0 h-[12px] w-[12px] rounded-full bg-surface shadow-app-sm flex items-center justify-center ${indicatorClass}`}
                    title={`${row.resource.name} - ${week.isoYear} W${String(week.isoWeek).padStart(2, '0')}: ${totalDays}d/wk (${utilizationLabel})`}
                  >
                    <IndicatorIcon className="w-[10px] h-[10px]" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Day column grid lines */}
          <div className="absolute inset-0 flex pointer-events-none">
            {dayColumns.map((col) => (
              <div
                key={col.dateStr}
                style={{ width: `${col.width}px`, left: `${col.left}px` }}
                className={`absolute top-0 bottom-0 border-r border-default ${
                  col.isWeekend ? 'bg-weekend-cell' : 'bg-transparent'
                }`}
              />
            ))}
          </div>

          {/* Vacation overlays */}
          {resourceVacations.map((v) => {
            const bounds = getDateRangeBounds(dayColumns, v.startDate, v.endDate);
            if (!bounds) return null;

            return (
              <div
                key={v.id}
                style={{
                  left: `${bounds.left}px`,
                  width: `${bounds.width}px`,
                  height: '44px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
                className="absolute bg-slate-200 dark:bg-zinc-600 border border-slate-300 dark:border-zinc-500 text-slate-600 dark:text-slate-300 rounded px-2 flex items-center justify-center text-[9px] font-bold tracking-wider uppercase pointer-events-none z-[4]"
                title={`Absence/Vacation: ${v.reason || 'Annual Leave'}`}
              >
                Time Off
              </div>
            );
          })}

          <div className="flex flex-col gap-1 w-full relative z-10 text-left">
            {row.projectLanes.map((lane, lIdx) => {
              const laneKey =
                viewMode === 'requests'
                  ? lane.request?.id || `lane-req-${lIdx}`
                  : viewMode === 'projects'
                    ? lane.resource?.id || `lane-res-${lIdx}`
                    : lane.project?.id || `lane-proj-${lIdx}`;

              return (
                <div key={laneKey} className="h-[56px] relative w-full">
                  {lane.blocks.flatMap((block) =>
                    renderBlockSegments(block, lane, row) ?? [],
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const requestProject = useMemo(() => {
    if (!selectedRequestForSkills) return null;
    return projects.find((p) => p.id === selectedRequestForSkills.projectId) || null;
  }, [selectedRequestForSkills, projects]);

  return (
    <div className="app-card overflow-hidden flex flex-col h-full min-h-0 relative" id="scheduler-grid-main-board">
      {(isFetchingSchedules || isFilterApplying) && (
        <div className="absolute inset-0 z-20 bg-surface/55 backdrop-blur-[1px] pointer-events-none flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full bg-surface border border-default px-4 py-2 text-xs font-medium text-secondary shadow-app-md">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
            {isFilterApplying ? 'Applying filter…' : 'Loading schedules…'}
          </div>
        </div>
      )}
      <div ref={scrollRef} onScroll={onTimelineScroll} className="flex-1 min-h-0 overflow-auto select-none relative scrollbar-thin">
        {isFetchingSchedules && (
          <div className="absolute top-2 right-3 z-30 flex items-center gap-1.5 rounded-full bg-surface/95 border border-default px-2.5 py-1 text-[10px] font-medium text-secondary shadow-app-sm pointer-events-none">
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
            Loading…
          </div>
        )}
        <div style={{ width: `calc(190px + ${gridWidth}px)` }} className="flex flex-col">
          {/* Month header row */}
          <div className="flex bg-grid-header border-b border-default text-xs font-bold text-secondary uppercase tracking-wider h-9 items-center sticky top-0 z-30">
            <div className="w-[190px] min-w-[190px] border-r border-default px-4 flex items-center bg-grid-header sticky left-0 z-40 h-full">
              {viewMode === 'projects' || viewMode === 'requests' ? 'Projects' : 'Resources'}
            </div>
            {monthsHeader.map((m) => (
              <div
                key={m.monthName}
                style={{ width: `${m.width}px` }}
                className="text-left pl-3 font-semibold text-primary tracking-wide border-r border-default shrink-0"
              >
                {m.monthName}
              </div>
            ))}
          </div>

          {/* Day header row */}
          <div className="flex bg-grid-header border-b border-default text-[11px] font-semibold h-10 items-stretch sticky top-9 z-30">
            <div className="w-[190px] min-w-[190px] border-r border-default px-4 flex items-center bg-grid-header sticky left-0 z-40">
              <span className="text-tertiary text-[10px] uppercase">
                {viewMode === 'projects' || viewMode === 'requests' ? 'Resource Allocation' : 'Project Allocation'}
              </span>
            </div>
            {dayColumns.map((col) => {
              const isToday = col.dateStr === CURRENT_DATE_STRING;
              return (
              <div
                key={`hdr-${col.dateStr}`}
                style={{ width: `${col.width}px` }}
                className={`text-center flex flex-col justify-center border-r border-default shrink-0 ${
                  isToday
                    ? 'bg-amber-400/25 text-secondary'
                    : col.isWeekend
                      ? 'bg-weekend-cell text-tertiary'
                      : 'text-secondary'
                }`}
                title={isToday ? `${col.dateStr} (Today)` : col.dateStr}
              >
                <span className="text-[10px] font-bold leading-none">{col.dayLabel}</span>
                <span className={`text-[11px] font-semibold leading-none mt-0.5 ${
                  col.isWeekend && !isToday ? 'text-tertiary' : 'text-primary'
                }`}>
                  {col.dayNum}
                </span>
              </div>
              );
            })}
          </div>

          <div className="divide-y divide-[var(--app-border)]">
            {assignmentRows.length === 0 ? (
              <div className="flex items-center justify-center py-20 bg-surface-muted text-tertiary text-sm">
                No rows match the current filters.
              </div>
            ) : (
              assignmentRows.map((row) => renderRow(row))
            )}
          </div>
        </div>
      </div>

      <SkillMatcherModal
        isOpen={!!selectedRequestForSkills}
        request={selectedRequestForSkills}
        requestProject={requestProject}
        onClose={() => setSelectedRequestForSkills(null)}
        onUnassignRequest={onUnassignRequest}
        onApproveRequestWithResource={onApproveRequestWithResource}
      />
      {(bulkScheduleResource || bulkScheduleProject) && (
        <BulkScheduleModal
          isOpen
          resources={resources}
          projects={projects}
          fixedResource={bulkScheduleResource || undefined}
          fixedProject={bulkScheduleProject || undefined}
          onClose={() => {
            setBulkScheduleResource(null);
            setBulkScheduleProject(null);
          }}
        />
      )}
    </div>
  );
});
