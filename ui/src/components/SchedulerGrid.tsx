/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  memo,
} from 'react';
import type { AllocationBlock, BookingRequest, Project, Resource, ScheduleAssignment, Vacation } from '../types';
import { Calendar, Loader2, MoreVertical, Plus, User, UserCheck } from 'lucide-react';
import {
  getProjectCategory,
  getAllocationBlockChrome,
  getAllocationBlockBackgroundFromDays,
  getRequestBlockChrome,
  getRequestBlockBackground,
  getEffectiveBillableType,
  type ProjectCategory,
  type AllocationBlockChrome,
} from '../lib/projectCategory';
import { filterPeople, filterProjects, filterRequests } from '../lib/filterEngine';
import { addDays, CURRENT_DATE_STRING } from '../lib/dateUtils';
import {
  buildDayColumnLayout,
  getDateRangeBounds,
  type DayColumnLayout,
} from '../lib/weekUtils';
import {
  assignmentToBlock,
  buildDailyTotals,
  personDailyCapacityHours,
  rosterSummaryLabel,
  splitBlockIntoWeekSegments,
  weekSegmentLabel,
} from '../lib/rosterUtils';
import { requestDateBounds } from '../types/api';
import { useSchedulesInRange } from '../hooks/useSchedules';
import { useHorizontalTimelineWindow } from '../hooks/useHorizontalTimelineWindow';
import { SkillMatcherModal } from './SkillMatcherModal';
import {
  Card,
  IconButton,
  Menu,
  DropdownMenuButton,
  DropdownMenuItems,
  DropdownMenuItem,
} from './ui';

const WEEKDAY_COL_WIDTH = 52;
const WEEKEND_COL_WIDTH = 28;
const FETCH_BUFFER_DAYS = 14;
const SIDEBAR_WIDTH = 190;

export type SchedulerGridHandle = {
  scrollByWeeks: (weeks: number) => void;
  focusOnDate: (date: string) => void;
  focusToday: () => void;
};

export type EditBlockOptions = {
  applyScope?: 'entire' | 'partial';
  partialRange?: { startDate: string; endDate: string } | null;
};

interface SchedulerGridProps {
  resources: Resource[];
  projects: Project[];
  vacations: Vacation[];
  requests?: BookingRequest[];
  filterCriteria?: Record<string, unknown> | null;
  focusedEntityId?: string | null;
  hideUnbooked?: boolean;
  isFilterApplying?: boolean;
  viewMode?: 'resources' | 'projects' | 'requests';
  onEditBlock: (block: AllocationBlock, options?: EditBlockOptions) => void;
  onSplitBlock?: (block: AllocationBlock, splitDate: string) => void | Promise<void>;
  onDeleteBlock?: (block: AllocationBlock) => void | Promise<void>;
  onOpenScheduleModalWithRes: (resId: string, projId?: string, startDate?: string, endDate?: string) => void;
  onAddResourceClick: () => void;
  onAddProjectClick?: () => void;
  onApproveRequestWithResource?: (requestId: string, resourceId: string) => void | Promise<void>;
  onUnassignRequest?: (requestId: string) => void | Promise<void>;
}

function assignmentToBlocks(assignment: ScheduleAssignment): AllocationBlock[] {
  return [assignmentToBlock(assignment)];
}

function requestToBlocks(request: BookingRequest): AllocationBlock[] {
  return [{
    scheduleId: request.id,
    title: request.requestName,
    resourceId: request.resourceId || 'unassigned',
    projectId: request.projectId,
    requestId: request.id,
    billableType: request.billableType,
    bookingType: request.bookingType,
    startDate: request.startDate,
    endDate: request.endDate,
    unit: request.unit,
    roster: request.roster,
  }];
}

function formatDayHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function DailyTotalStrip({
  columns,
  totals,
  capacity,
  label,
  selectionStartIdx,
  selectionEndIdx,
  selectionActive,
  onDayMouseDown,
  onDayMouseEnter,
}: {
  columns: DayColumnLayout[];
  totals: Map<string, number>;
  capacity: number;
  label: string;
  selectionStartIdx?: number | null;
  selectionEndIdx?: number | null;
  selectionActive?: boolean;
  onDayMouseDown?: (index: number) => void;
  onDayMouseEnter?: (index: number) => void;
}) {
  const hasSelection =
    selectionActive &&
    selectionStartIdx != null &&
    selectionEndIdx != null &&
    selectionStartIdx >= 0 &&
    selectionEndIdx >= 0;

  return (
    <div data-date-select-strip className="absolute inset-x-0 top-[2px] h-[18px] z-[6]">
      {columns.map((col, index) => {
        const hours = totals.get(col.dateStr) || 0;
        const inSelection =
          hasSelection && index >= selectionStartIdx! && index <= selectionEndIdx!;
        const util = capacity > 0 ? hours / capacity : 0;
        const over = util > 1.01;
        const showBar = !col.isWeekend;
        const barClass =
          hours <= 0
            ? 'bg-surface-muted text-tertiary border border-subtle'
            : over
              ? 'bg-rose-500/45 text-rose-950'
              : 'bg-emerald-500/40 text-emerald-950';

        return (
          <div
            key={`util-${col.dateStr}`}
            style={{ left: `${col.left}px`, width: `${col.width}px` }}
            onMouseDown={(event) => {
              if (event.button !== 0 || !onDayMouseDown) return;
              event.preventDefault();
              event.stopPropagation();
              onDayMouseDown(index);
            }}
            onMouseEnter={() => onDayMouseEnter?.(index)}
            className={`absolute top-0 h-[18px] cursor-ew-resize ${
              inSelection ? 'bg-sky-400/35' : 'hover:bg-sky-400/15'
            }`}
            title={
              capacity > 0
                ? `${label} · ${col.dateStr}: ${hours.toFixed(1)}h / ${capacity.toFixed(1)}h (${Math.round(util * 100)}%) — drag to select dates`
                : `${label} · ${col.dateStr}: ${hours.toFixed(1)}h — drag to select dates`
            }
          >
            {showBar && (
              <div
                className={`absolute inset-x-[1px] inset-y-0 rounded-[3px] flex items-center justify-center text-[10px] font-bold tabular-nums leading-none pointer-events-none ${barClass}`}
              >
                {formatDayHours(hours)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const SchedulerGrid = memo(forwardRef<SchedulerGridHandle, SchedulerGridProps>(function SchedulerGrid({
  resources,
  projects,
  vacations,
  requests = [],
  filterCriteria = null,
  focusedEntityId = null,
  hideUnbooked = false,
  isFilterApplying = false,
  viewMode = 'resources',
  onEditBlock,
  onSplitBlock,
  onDeleteBlock,
  onOpenScheduleModalWithRes,
  onApproveRequestWithResource,
  onUnassignRequest,
}, ref) {
  const [selectedRequestForSkills, setSelectedRequestForSkills] = useState<BookingRequest | null>(null);
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null);
  const [dateSelection, setDateSelection] = useState<{
    anchorIndex: number;
    focusIndex: number;
    entityId: string;
  } | null>(null);
  const [isSelectingDates, setIsSelectingDates] = useState(false);
  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false);
  const isSelectingDatesRef = useRef(false);
  const selectionMenuRef = useRef<HTMLDivElement>(null);

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

  const selectedDateRange = useMemo(() => {
    if (!dateSelection || dayColumns.length === 0) return null;
    const startIdx = Math.min(dateSelection.anchorIndex, dateSelection.focusIndex);
    const endIdx = Math.max(dateSelection.anchorIndex, dateSelection.focusIndex);
    const startDate = dayColumns[startIdx]?.dateStr;
    const endDate = dayColumns[endIdx]?.dateStr;
    if (!startDate || !endDate) return null;
    const bounds = getDateRangeBounds(dayColumns, startDate, endDate);
    if (!bounds) return null;
    return {
      startIdx,
      endIdx,
      startDate,
      endDate,
      bounds,
      entityId: dateSelection.entityId,
    };
  }, [dateSelection, dayColumns]);

  const clearDateSelection = useCallback(() => {
    isSelectingDatesRef.current = false;
    setIsSelectingDates(false);
    setSelectionMenuOpen(false);
    setDateSelection(null);
  }, []);

  const beginDateSelection = useCallback((index: number, entityId: string) => {
    isSelectingDatesRef.current = true;
    setIsSelectingDates(true);
    setSelectionMenuOpen(false);
    setDateSelection({ anchorIndex: index, focusIndex: index, entityId });
  }, []);

  const updateDateSelection = useCallback((index: number) => {
    if (!isSelectingDatesRef.current) return;
    setDateSelection((prev) => (prev ? { ...prev, focusIndex: index } : prev));
  }, []);

  const endDateSelection = useCallback(() => {
    if (!isSelectingDatesRef.current) return;
    isSelectingDatesRef.current = false;
    setIsSelectingDates(false);
  }, []);

  useEffect(() => {
    const onMouseUp = () => endDateSelection();
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [endDateSelection]);

  useEffect(() => {
    if (!dateSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearDateSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dateSelection, clearDateSelection]);

  useEffect(() => {
    if (!selectionMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (selectionMenuRef.current?.contains(target)) return;
      setSelectionMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [selectionMenuOpen]);

  // Drop selection when the visible timeline window or view changes.
  useEffect(() => {
    clearDateSelection();
  }, [windowStart, windowEnd, viewMode, clearDateSelection]);

  const handleScheduleSelectedRange = useCallback(() => {
    if (!selectedDateRange) return;
    const { startDate, endDate, entityId } = selectedDateRange;
    clearDateSelection();
    if (viewMode === 'projects') {
      onOpenScheduleModalWithRes('', entityId, startDate, endDate);
    } else {
      onOpenScheduleModalWithRes(entityId, undefined, startDate, endDate);
    }
  }, [selectedDateRange, onOpenScheduleModalWithRes, clearDateSelection, viewMode]);

  const monthsHeader = useMemo(() => {
    const groups: { monthName: string; width: number }[] = [];
    dayColumns.forEach((col) => {
      const existing = groups.find((g) => g.monthName === col.monthName);
      if (existing) existing.width += col.width;
      else groups.push({ monthName: col.monthName, width: col.width });
    });
    return groups;
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
      filterProjects(projects, filterCriteria).forEach((proj) => {
        if (focusedEntityId && proj.id !== focusedEntityId) return;
        const projBlocks = allBlocks.filter((b) => b.projectId === proj.id);
        if (hideUnbooked && projBlocks.length === 0) return;
        const resIds = Array.from(new Set(projBlocks.map((b) => b.resourceId)));

        const projectLanes: Lane[] =
          resIds.length === 0
            ? [{ resource: { id: 'none', name: 'Unassigned', role: '-' }, blocks: [] }]
            : resIds
                .map((rId) => ({
                  resource: resources.find((r) => r.id === rId) || { id: rId, name: 'Resource', role: 'Role' },
                  blocks: projBlocks.filter((b) => b.resourceId === rId),
                }))
                .sort((a, b) =>
                  (a.resource?.name || '').localeCompare(b.resource?.name || '', undefined, {
                    sensitivity: 'base',
                  }),
                );

        rows.push({ id: `row-${proj.id}`, project: proj, projectLanes });
      });
    } else {
      filterPeople(resources, filterCriteria).forEach((res) => {
        if (focusedEntityId && res.id !== focusedEntityId) return;
        const resBlocks = allBlocks.filter((b) => b.resourceId === res.id);
        if (hideUnbooked && resBlocks.length === 0) return;
        const projIds = Array.from(new Set(resBlocks.map((b) => b.projectId)));

        const projectLanes: Lane[] =
          projIds.length === 0
            ? [{
                project: { id: 'none', name: 'Unassigned', client: '-', color: 'bg-gray-400', textColor: 'text-gray-400' },
                blocks: [],
              }]
            : projIds
                .map((pId) => ({
                  project: projects.find((p) => p.id === pId) || {
                    id: pId, name: 'Project', client: 'Client', color: 'bg-emerald-500', textColor: 'text-white',
                  },
                  blocks: resBlocks.filter((b) => b.projectId === pId),
                }))
                .sort((a, b) =>
                  (a.project?.name || '').localeCompare(b.project?.name || '', undefined, {
                    sensitivity: 'base',
                  }),
                );

        rows.push({ id: `row-${res.id}`, resource: res, projectLanes });
      });
    }

    return rows;
  }, [resources, projects, rangeAssignments, requests, filterCriteria, focusedEntityId, hideUnbooked, viewMode]);

  const resourceDailyTotals = useMemo(() => {
    if (viewMode !== 'resources') return null;
    const map = new Map<string, Map<string, number>>();
    for (const row of assignmentRows) {
      if (!row.resource) continue;
      const capacity = personDailyCapacityHours(row.resource.weeklyHours, row.resource.fte);
      const blocks = row.projectLanes.flatMap((lane) => lane.blocks);
      map.set(row.resource.id, buildDailyTotals(blocks, windowStart, windowEnd, capacity));
    }
    return map;
  }, [assignmentRows, viewMode, windowStart, windowEnd]);

  const projectDailyTotals = useMemo(() => {
    if (viewMode !== 'projects') return null;
    const map = new Map<string, Map<string, number>>();
    for (const row of assignmentRows) {
      if (!row.project) continue;
      const totals = new Map<string, number>();
      for (const lane of row.projectLanes) {
        if (!lane.resource || lane.resource.id === 'none') continue;
        const capacity = personDailyCapacityHours(lane.resource.weeklyHours, lane.resource.fte);
        for (const block of lane.blocks) {
          const blockTotals = buildDailyTotals([block], windowStart, windowEnd, capacity);
          for (const [date, hours] of blockTotals) {
            totals.set(date, (totals.get(date) || 0) + hours);
          }
        }
      }
      map.set(row.project.id, totals);
    }
    return map;
  }, [assignmentRows, viewMode, windowStart, windowEnd]);

  const getApprovedVacationsForResource = (resourceId: string) =>
    vacations.filter((v) => v.status === 'Approved' && v.resourceId === resourceId);

  const renderBlockSegments = (
    block: AllocationBlock,
    lane: { project?: Project; resource?: Resource; request?: BookingRequest },
    row: (typeof assignmentRows)[0],
  ) => {
    const weekSegments = splitBlockIntoWeekSegments(block);
    if (weekSegments.length === 0) return null;

    const summary = rosterSummaryLabel(block.unit, block.roster);
    let blockTitle = '';
    let blockLabel = '';
    let showPersonIcon = false;
    let showUserCheckIcon = false;

    if (viewMode === 'requests' && lane.request) {
      const req = lane.request;
      const reqBounds = requestDateBounds(req);
      const assignedRes = req.resourceId ? resources.find((r) => r.id === req.resourceId) : null;
      const dateLabel = reqBounds ? `${reqBounds.startDate} to ${reqBounds.endDate}` : '';
      if (assignedRes) {
        blockTitle = `Assigned: ${assignedRes.name}\nRequest: ${req.requestName || 'General request'}\n${dateLabel}\n${summary}`;
        blockLabel = assignedRes.name;
        showUserCheckIcon = true;
      } else {
        blockTitle = `Request: ${req.requestName || 'General request'}\n${dateLabel}\n${summary}`;
        blockLabel = req.requestName || 'Request';
        showPersonIcon = true;
      }
    } else if (viewMode === 'projects') {
      blockTitle = `${lane.resource?.name}: ${summary}${block.title ? `\n${block.title}` : ''}`;
      blockLabel = lane.resource?.name || 'Resource';
    } else {
      blockTitle = `${lane.project?.name}: ${summary}${block.title ? `\n${block.title}` : ''}`;
      blockLabel = block.title || lane.project?.name || 'Project';
    }

    let textClass = 'text-slate-800';
    let blockSurfaceStyle: React.CSSProperties | undefined;
    let blockCategory: ProjectCategory | null = null;
    let blockChrome: AllocationBlockChrome | null = null;
    let borderClass = 'border';

    const proj = lane.project || row.project || projects.find((p) => p.id === block.projectId);
    const effectiveBillable = getEffectiveBillableType(block.billableType, proj);
    const projectIsOpportunity = proj ? getProjectCategory(proj) === 'Opportunity' : false;
    // Hue from effective billable type; opportunity projects (and opportunity type) stay translucent.
    const translucent = projectIsOpportunity || effectiveBillable === 'Opportunity';

    if (viewMode === 'requests' && lane.request) {
      const isAssigned = !!lane.request.resourceId;
      blockCategory = effectiveBillable;
      if (isAssigned) {
        blockChrome = getAllocationBlockChrome(effectiveBillable, { translucent });
        blockSurfaceStyle = getAllocationBlockBackgroundFromDays(0, blockChrome);
      } else {
        blockChrome = getRequestBlockChrome(effectiveBillable);
        blockSurfaceStyle = getRequestBlockBackground(blockChrome);
      }
      textClass = blockChrome.textClass;
      if (!isAssigned) borderClass = 'border border-dotted';
    } else {
      blockCategory = effectiveBillable;
      blockChrome = getAllocationBlockChrome(effectiveBillable, { translucent });
      blockSurfaceStyle = getAllocationBlockBackgroundFromDays(0, blockChrome);
      textClass = blockChrome.textClass;
    }

    const blockTopOffset = viewMode === 'requests' ? 6 : 24;
    const showBlockMenu = viewMode !== 'requests';
    const blockBusy = busyBlockId === block.scheduleId;

    return weekSegments.map((seg) => {
      const bounds = getDateRangeBounds(dayColumns, seg.startDate, seg.endDate);
      if (!bounds) return null;

      const segLabel = weekSegmentLabel(block.unit, block.roster, seg.activeDays);
      const subtitle = blockCategory
        ? `${segLabel} - ${blockCategory.charAt(0)} - ${effectiveBillable}`
        : segLabel;

      const splitDate = addDays(seg.endDate, 1);
      const canSplit =
        showBlockMenu &&
        Boolean(onSplitBlock) &&
        splitDate > block.startDate &&
        splitDate <= block.endDate;

      return (
        <div
          key={`${block.scheduleId}-${seg.isoYear}-W${seg.isoWeek}`}
          style={{
            left: `${bounds.left + 4}px`,
            width: `${Math.max(bounds.width - 8, 8)}px`,
            height: '44px',
            top: `${blockTopOffset}px`,
            ...blockSurfaceStyle,
          }}
          onClick={() => {
            if (viewMode === 'requests' && lane.request) {
              setSelectedRequestForSkills(lane.request);
              return;
            }
            onEditBlock(block);
          }}
          className={`absolute select-none overflow-visible text-left px-2 py-1.5 rounded-lg transition-transform hover:scale-[1.01] cursor-pointer shadow-sm flex items-center gap-1 ${borderClass} ${textClass} z-[5]`}
          title={`${blockTitle}\n${seg.startDate} – ${seg.endDate}`}
        >
          <div className="flex-1 min-w-0 pr-1">
            <div className="text-[11px] font-bold tracking-tight leading-tight truncate">{blockLabel}</div>
            <div className="text-[9px] font-medium opacity-90 truncate mt-0.5">{subtitle}</div>
          </div>
          {showPersonIcon && <User className="w-3.5 h-3.5 shrink-0" />}
          {showUserCheckIcon && <UserCheck className="w-3.5 h-3.5 shrink-0" />}
          {showBlockMenu && (
            <div
              data-block-menu
              className="shrink-0 opacity-70 hover:opacity-100"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <Menu>
                <DropdownMenuButton
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 text-inherit hover:bg-black/10 ${blockBusy ? 'opacity-100' : ''}`}
                  aria-label="Allocation actions"
                  title="Allocation actions"
                  loading={blockBusy}
                  disabled={Boolean(busyBlockId)}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </DropdownMenuButton>
                <DropdownMenuItems anchor="bottom end" className="z-[80]">
                  <DropdownMenuItem
                    disabled={Boolean(busyBlockId)}
                    onClick={() => onEditBlock(block)}
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={Boolean(busyBlockId)}
                    onClick={() =>
                      onEditBlock(block, {
                        applyScope: 'partial',
                        partialRange: { startDate: seg.startDate, endDate: seg.endDate },
                      })
                    }
                  >
                    Edit this week…
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canSplit || Boolean(busyBlockId)}
                    onClick={() => {
                      if (!canSplit || !onSplitBlock || busyBlockId) return;
                      setBusyBlockId(block.scheduleId);
                      void Promise.resolve(onSplitBlock(block, splitDate)).finally(() => {
                        setBusyBlockId(null);
                      });
                    }}
                  >
                    Split after this week
                  </DropdownMenuItem>
                  {onDeleteBlock && (
                    <DropdownMenuItem
                      destructive
                      disabled={Boolean(busyBlockId)}
                      onClick={() => {
                        if (busyBlockId) return;
                        if (window.confirm('Delete this entire allocation?')) {
                          setBusyBlockId(block.scheduleId);
                          void Promise.resolve(onDeleteBlock(block)).finally(() => {
                            setBusyBlockId(null);
                          });
                        }
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuItems>
              </Menu>
            </div>
          )}
        </div>
      );
    });
  };

  const renderRow = (row: (typeof assignmentRows)[0]) => {
    const resourceVacations =
      viewMode === 'projects' || viewMode === 'requests' || !row.resource
        ? []
        : getApprovedVacationsForResource(row.resource.id);

    const rowEntityId = row.resource?.id ?? row.project?.id ?? null;
    const rowEntityLabel = row.resource?.name ?? row.project?.name ?? '';

    const capacity = row.resource
      ? personDailyCapacityHours(row.resource.weeklyHours, row.resource.fte)
      : row.project
        ? row.projectLanes.reduce((sum, lane) => {
            if (!lane.resource || lane.resource.id === 'none') return sum;
            return sum + personDailyCapacityHours(lane.resource.weeklyHours, lane.resource.fte);
          }, 0)
        : 0;

    const dailyTotals =
      viewMode === 'resources' && row.resource
        ? resourceDailyTotals?.get(row.resource.id) ?? new Map<string, number>()
        : viewMode === 'projects' && row.project
          ? projectDailyTotals?.get(row.project.id) ?? new Map<string, number>()
          : null;

    const selectionActive =
      !!selectedDateRange && !!rowEntityId && selectedDateRange.entityId === rowEntityId;

    return (
      <div key={row.id} className="flex hover:bg-surface-muted/60 items-stretch relative group border-b border-subtle min-h-[72px]">
        <div className="w-[190px] min-w-[190px] border-r border-subtle px-4 bg-surface sticky left-0 z-20 flex items-center justify-between shadow-app-sm min-h-[72px]">
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
              <IconButton
                size="sm"
                label={`Schedule on ${row.project.name}`}
                onClick={() => onOpenScheduleModalWithRes('', row.project!.id)}
                className="h-7 w-7 text-secondary"
              >
                <Plus className="w-3.5 h-3.5" />
              </IconButton>
            </div>
          ) : row.resource ? (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              <IconButton
                size="sm"
                label={`Schedule ${row.resource.name}`}
                onClick={() => onOpenScheduleModalWithRes(row.resource!.id)}
                className="h-7 w-7 text-blue-600 hover:bg-blue-50"
              >
                <Calendar className="w-3.5 h-3.5" />
              </IconButton>
            </div>
          ) : null}
        </div>

        <div style={{ width: `${gridWidth}px` }} className="relative flex flex-col justify-center py-3 shrink-0 min-h-[72px]">
          {dailyTotals && rowEntityId && (
            <DailyTotalStrip
              columns={dayColumns}
              totals={dailyTotals}
              capacity={capacity}
              label={rowEntityLabel}
              selectionActive={selectionActive}
              selectionStartIdx={selectedDateRange?.startIdx}
              selectionEndIdx={selectedDateRange?.endIdx}
              onDayMouseDown={(index) => beginDateSelection(index, rowEntityId)}
              onDayMouseEnter={updateDateSelection}
            />
          )}

          {selectionActive && selectedDateRange && (
              <div
                data-date-selection-overlay
                className="absolute inset-y-0 z-[12] pointer-events-none"
                style={{
                  left: `${selectedDateRange.bounds.left}px`,
                  width: `${selectedDateRange.bounds.width}px`,
                }}
              >
                <div className="absolute inset-0 bg-sky-400/15 border-x-2 border-sky-400/50 rounded-sm" />
                {!isSelectingDates && (
                  <div
                    ref={selectionMenuRef}
                    className="absolute inset-0 flex items-center justify-center pointer-events-auto"
                  >
                    <div className="relative">
                      <IconButton
                        size="sm"
                        label="Schedule actions for selected dates"
                        className="h-8 w-8 rounded-md bg-surface border border-subtle shadow-app-sm text-secondary hover:bg-surface-hover"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectionMenuOpen((open) => !open);
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </IconButton>
                      {selectionMenuOpen && (
                        <div className="absolute left-1/2 top-full z-[70] mt-1 w-36 -translate-x-1/2 rounded-lg border border-default bg-surface-raised shadow-app-md py-1">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left text-primary hover:bg-surface-hover cursor-pointer"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleScheduleSelectedRange();
                            }}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Schedule
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Day column grid lines */}
          <div className="absolute inset-0 flex pointer-events-none">
            {dayColumns.map((col) => (
              <div
                key={col.dateStr}
                style={{ width: `${col.width}px`, left: `${col.left}px` }}
                className={`absolute top-0 bottom-0 border-r border-subtle ${
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
                className="absolute bg-surface-muted border border-subtle text-secondary rounded px-2 flex items-center justify-center text-[9px] font-bold tracking-wider uppercase pointer-events-none z-[4]"
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
                  {lane.blocks.flatMap((block) => renderBlockSegments(block, lane, row) ?? [])}
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
    <Card className="overflow-hidden flex flex-col h-full min-h-0 relative" id="scheduler-grid-main-board">
      {(isFetchingSchedules || isFilterApplying) && (
        <div className="absolute inset-0 z-20 bg-surface/55 backdrop-blur-[1px] pointer-events-none flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full bg-surface border border-subtle px-4 py-2 text-xs font-medium text-secondary shadow-app-md">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
            {isFilterApplying ? 'Applying filter…' : 'Loading schedules…'}
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={onTimelineScroll}
        onMouseDown={(event) => {
          if (isSelectingDatesRef.current) return;
          const target = event.target as HTMLElement;
          if (
            target.closest('[data-date-select-strip]') ||
            target.closest('[data-date-selection-overlay]') ||
            target.closest('[data-block-menu]')
          ) {
            return;
          }
          if (dateSelection) clearDateSelection();
        }}
        className="flex-1 min-h-0 overflow-auto select-none relative scrollbar-thin"
      >
        {isFetchingSchedules && (
          <div className="absolute top-2 right-3 z-30 flex items-center gap-1.5 rounded-full bg-surface/95 border border-subtle px-2.5 py-1 text-[10px] font-medium text-secondary shadow-app-sm pointer-events-none">
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
            Loading…
          </div>
        )}
        <div style={{ width: `calc(${SIDEBAR_WIDTH}px + ${gridWidth}px)` }} className="flex flex-col relative">
          {/* Month header row */}
          <div className="flex bg-grid-header border-b border-subtle text-xs font-bold text-secondary uppercase tracking-wider h-9 items-center sticky top-0 z-30">
            <div
              className="border-r border-subtle px-4 flex items-center bg-grid-header sticky left-0 z-40 h-full"
              style={{ width: `${SIDEBAR_WIDTH}px`, minWidth: `${SIDEBAR_WIDTH}px` }}
            >
              {viewMode === 'projects' || viewMode === 'requests' ? 'Projects' : 'Resources'}
            </div>
            {monthsHeader.map((m) => (
              <div
                key={m.monthName}
                style={{ width: `${m.width}px` }}
                className="text-left pl-3 font-semibold text-primary tracking-wide border-r border-subtle shrink-0"
              >
                {m.monthName}
              </div>
            ))}
          </div>

          {/* Day header row */}
          <div className="flex bg-grid-header border-b border-subtle text-[11px] font-semibold h-10 items-stretch sticky top-9 z-30">
            <div
              className="border-r border-subtle px-4 flex items-center bg-grid-header sticky left-0 z-40"
              style={{ width: `${SIDEBAR_WIDTH}px`, minWidth: `${SIDEBAR_WIDTH}px` }}
            >
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
                  className={`text-center flex flex-col justify-center border-r border-subtle shrink-0 ${
                    isToday
                      ? 'bg-amber-400/25 text-secondary'
                      : col.isWeekend
                        ? 'bg-weekend-cell text-tertiary'
                        : 'text-secondary'
                  }`}
                  title={isToday ? `${col.dateStr} (Today)` : col.dateStr}
                >
                  <span className="text-[10px] font-bold leading-none">{col.dayLabel}</span>
                  <span
                    className={`text-[11px] font-semibold leading-none mt-0.5 ${
                      col.isWeekend && !isToday ? 'text-tertiary' : 'text-primary'
                    }`}
                  >
                    {col.dayNum}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="divide-y divide-[var(--app-border-subtle)]">
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
    </Card>
  );
}));

SchedulerGrid.displayName = 'SchedulerGrid';
