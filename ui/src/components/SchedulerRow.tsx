/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo, useCallback, useMemo } from 'react';
import type { AllocationBlock, BookingRequest, Project, Resource, Vacation } from '../types';
import { Calendar, MoreVertical, Plus, User, UserCheck } from 'lucide-react';
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
import { getDateRangeBounds, type DayColumnLayout } from '../lib/weekUtils';
import {
  buildDailyTotals,
  personDailyCapacityHours,
  rosterSummaryLabel,
  splitBlockIntoWeekSegments,
  weekSegmentLabel,
  type WeekDisplaySegment,
} from '../lib/rosterUtils';
import { requestDateBounds } from '../types/api';
import { IconButton } from './ui';

export type EditBlockOptions = {
  applyScope?: 'entire' | 'partial';
  partialRange?: { startDate: string; endDate: string } | null;
};

export type SchedulerLane = {
  project?: Project;
  resource?: Resource;
  request?: BookingRequest;
  blocks: AllocationBlock[];
};

export type SchedulerRowModel = {
  id: string;
  resource?: Resource;
  project?: Project;
  projectLanes: SchedulerLane[];
};

const EMPTY_DAILY_TOTALS = new Map<string, number>();
/** Stable style while drag owns left/width via DOM (avoids React wiping imperative bounds). */
const EMPTY_OVERLAY_STYLE: React.CSSProperties = {};

function formatDayHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const DailyTotalStrip = memo(function DailyTotalStrip({
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
  columns: Array<DayColumnLayout & { fullIndex: number }>;
  totals: Map<string, number>;
  capacity: number;
  label: string;
  selectionStartIdx?: number | null;
  selectionEndIdx?: number | null;
  selectionActive?: boolean;
  onDayMouseDown?: (fullIndex: number) => void;
  onDayMouseEnter?: (fullIndex: number) => void;
}) {
  const hasSelection =
    selectionActive &&
    selectionStartIdx != null &&
    selectionEndIdx != null &&
    selectionStartIdx >= 0 &&
    selectionEndIdx >= 0;

  return (
    // Totals band only (above allocation bars at ~24px). z above lanes so padding
    // under the hour pills still receives resize hover (lanes start after py-3).
    <div data-date-select-strip className="absolute inset-x-0 top-0 h-6 z-[11]">
      {columns.map((col) => {
        const hours = totals.get(col.dateStr) || 0;
        const inSelection =
          hasSelection && col.fullIndex >= selectionStartIdx! && col.fullIndex <= selectionEndIdx!;
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
            data-full-index={col.fullIndex}
            style={{ left: `${col.left}px`, width: `${col.width}px` }}
            onMouseDown={(event) => {
              if (event.button !== 0 || !onDayMouseDown) return;
              event.preventDefault();
              event.stopPropagation();
              onDayMouseDown(col.fullIndex);
            }}
            onMouseEnter={() => onDayMouseEnter?.(col.fullIndex)}
            className={`absolute inset-y-0 cursor-ew-resize ${
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
                className={`absolute inset-x-[1px] top-[2px] h-[18px] rounded-[3px] flex items-center justify-center text-[10px] font-bold tabular-nums leading-none pointer-events-none ${barClass}`}
              >
                {formatDayHours(hours)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

type AllocationSegmentsProps = {
  block: AllocationBlock;
  lane: SchedulerLane;
  row: SchedulerRowModel;
  viewMode: 'resources' | 'projects' | 'requests';
  dayColumns: DayColumnLayout[];
  dateColumnIndex?: Map<string, number> | null;
  projects: Project[];
  resources: Resource[];
  /** Busy schedule id for this row only (null when idle / other rows). */
  busyBlockId: string | null;
  onEditBlock: (block: AllocationBlock, options?: EditBlockOptions) => void;
  onOpenBlockMenu: (
    block: AllocationBlock,
    segment: WeekDisplaySegment,
    anchorRect: DOMRect,
  ) => void;
  onRequestClick: (request: BookingRequest) => void;
};

function AllocationSegments({
  block,
  lane,
  row,
  viewMode,
  dayColumns,
  dateColumnIndex,
  projects,
  resources,
  busyBlockId,
  onEditBlock,
  onOpenBlockMenu,
  onRequestClick,
}: AllocationSegmentsProps) {
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
  const anyBusy = Boolean(busyBlockId);

  return (
    <>
      {weekSegments.map((seg) => {
        const bounds = getDateRangeBounds(dayColumns, seg.startDate, seg.endDate, dateColumnIndex);
        if (!bounds) return null;

        const segLabel = weekSegmentLabel(block.unit, block.roster, seg.activeDays);
        const subtitle = blockCategory
          ? `${segLabel} - ${blockCategory.charAt(0)} - ${effectiveBillable}`
          : segLabel;

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
                onRequestClick(lane.request);
                return;
              }
              onEditBlock(block);
            }}
            onContextMenu={(event) => {
              if (!showBlockMenu || anyBusy) return;
              event.preventDefault();
              event.stopPropagation();
              onOpenBlockMenu(
                block,
                seg,
                new DOMRect(event.clientX, event.clientY, 0, 0),
              );
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
                <IconButton
                  size="sm"
                  label="Allocation actions"
                  className={`h-6 w-6 text-inherit hover:bg-black/10 ${blockBusy ? 'opacity-100' : ''}`}
                  loading={blockBusy}
                  disabled={anyBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    onOpenBlockMenu(block, seg, rect);
                  }}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export type SchedulerRowProps = {
  row: SchedulerRowModel;
  viewMode: 'resources' | 'projects' | 'requests';
  gridWidth: number;
  dayChromeStyle: React.CSSProperties;
  dayColumns: DayColumnLayout[];
  dateColumnIndex?: Map<string, number> | null;
  fetchDayColumns: Array<DayColumnLayout & { fullIndex: number }>;
  /** Inclusive fetch window used for daily hour totals (matches clipped bars). */
  totalsRangeStart: string;
  totalsRangeEnd: string;
  vacations: Vacation[];
  projects: Project[];
  resources: Resource[];
  /** True while this row owns an in-progress or committed date selection overlay. */
  showSelectionOverlay: boolean;
  /** Committed selection (after mouseup) — drives strip highlight + menu. */
  selectionCommitted: boolean;
  selectionBounds: { left: number; width: number } | null;
  selectionStartIdx: number | null;
  selectionEndIdx: number | null;
  /** Busy id only when a block on this row is busy; otherwise null. */
  busyBlockId: string | null;
  onBeginDateSelection: (fullIndex: number, entityId: string) => void;
  onUpdateDateSelection: (fullIndex: number) => void;
  onOpenSelectionMenu: (anchorRect: DOMRect, toggle?: boolean) => void;
  onSelectionOverlayRef: (node: HTMLDivElement | null) => void;
  onEditBlock: (block: AllocationBlock, options?: EditBlockOptions) => void;
  onOpenBlockMenu: (
    block: AllocationBlock,
    segment: WeekDisplaySegment,
    anchorRect: DOMRect,
  ) => void;
  onOpenScheduleModalWithRes: (resId: string, projId?: string, startDate?: string, endDate?: string) => void;
  onRequestClick: (request: BookingRequest) => void;
};

export const SchedulerRow = memo(function SchedulerRow({
  row,
  viewMode,
  gridWidth,
  dayChromeStyle,
  dayColumns,
  dateColumnIndex,
  fetchDayColumns,
  totalsRangeStart,
  totalsRangeEnd,
  vacations,
  projects,
  resources,
  showSelectionOverlay,
  selectionCommitted,
  selectionBounds,
  selectionStartIdx,
  selectionEndIdx,
  busyBlockId,
  onBeginDateSelection,
  onUpdateDateSelection,
  onOpenSelectionMenu,
  onSelectionOverlayRef,
  onEditBlock,
  onOpenBlockMenu,
  onOpenScheduleModalWithRes,
  onRequestClick,
}: SchedulerRowProps) {
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

  // Only mounted (virtualized) rows pay for totals — not the full roster.
  const dailyTotals = useMemo(() => {
    if (viewMode === 'resources' && row.resource) {
      const blocks = row.projectLanes.flatMap((lane) => lane.blocks);
      return buildDailyTotals(
        blocks,
        totalsRangeStart,
        totalsRangeEnd,
        personDailyCapacityHours(row.resource.weeklyHours, row.resource.fte),
      );
    }
    if (viewMode === 'projects' && row.project) {
      const totals = new Map<string, number>();
      for (const lane of row.projectLanes) {
        if (!lane.resource || lane.resource.id === 'none') continue;
        const laneCapacity = personDailyCapacityHours(
          lane.resource.weeklyHours,
          lane.resource.fte,
        );
        for (const block of lane.blocks) {
          const blockTotals = buildDailyTotals(
            [block],
            totalsRangeStart,
            totalsRangeEnd,
            laneCapacity,
          );
          for (const [date, hours] of blockTotals) {
            totals.set(date, (totals.get(date) || 0) + hours);
          }
        }
      }
      return totals;
    }
    return null;
  }, [viewMode, row, totalsRangeStart, totalsRangeEnd]);

  const resourceVacations =
    viewMode === 'projects' || viewMode === 'requests' || !row.resource
      ? []
      : vacations.filter((v) => v.status === 'Approved' && v.resourceId === row.resource!.id);

  const handleDayMouseDown = useCallback(
    (fullIndex: number) => {
      if (!rowEntityId) return;
      onBeginDateSelection(fullIndex, rowEntityId);
    },
    [onBeginDateSelection, rowEntityId],
  );

  const totals = dailyTotals ?? EMPTY_DAILY_TOTALS;

  return (
    <div
      data-schedule-row
      data-entity-id={rowEntityId ?? undefined}
      className="flex hover:bg-surface-muted/60 items-stretch relative group border-b border-subtle min-h-[72px]"
    >
      <div className="w-[190px] min-w-[190px] border-r border-subtle px-4 bg-surface sticky left-0 z-20 flex items-center justify-between shadow-app-sm min-h-[72px]">
        <div className="flex items-center gap-2 overflow-hidden py-3 w-full">
          {(viewMode === 'projects' || viewMode === 'requests') && row.project ? (
            <div className="truncate text-left flex-1">
              <h4 className="text-xs font-black text-primary truncate" title={row.project.name}>
                {row.project.name}
              </h4>
            </div>
          ) : row.resource ? (
            <>
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center shrink-0">
                {(row.resource.name || '')
                  .split(' ')
                  .map((n) => n[0] || '')
                  .join('')}
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

      <div
        style={{ width: `${gridWidth}px`, ...dayChromeStyle }}
        className="relative flex flex-col justify-center py-3 shrink-0 min-h-[72px]"
      >
        {dailyTotals && rowEntityId && (
          <DailyTotalStrip
            columns={fetchDayColumns}
            totals={totals}
            capacity={capacity}
            label={rowEntityLabel}
            selectionActive={selectionCommitted}
            selectionStartIdx={selectionStartIdx}
            selectionEndIdx={selectionEndIdx}
            onDayMouseDown={handleDayMouseDown}
            onDayMouseEnter={onUpdateDateSelection}
          />
        )}

        {showSelectionOverlay && (
          <div
            ref={onSelectionOverlayRef}
            data-date-selection-overlay
            className="absolute inset-y-0 z-[12] pointer-events-none"
            style={
              selectionCommitted && selectionBounds
                ? { left: `${selectionBounds.left}px`, width: `${selectionBounds.width}px` }
                : EMPTY_OVERLAY_STYLE
            }
          >
            <div className="absolute inset-0 bg-sky-400/15 border-x-2 border-sky-400/50 rounded-sm" />
            {selectionCommitted && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-auto"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenSelectionMenu(new DOMRect(event.clientX, event.clientY, 0, 0));
                }}
              >
                <IconButton
                  data-selection-menu-trigger
                  size="sm"
                  label="Schedule actions for selected dates"
                  className="h-8 w-8 rounded-md bg-surface border border-subtle shadow-app-sm text-secondary hover:bg-surface-hover"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenSelectionMenu(event.currentTarget.getBoundingClientRect(), true);
                  }}
                >
                  <MoreVertical className="w-4 h-4" />
                </IconButton>
              </div>
            )}
          </div>
        )}

        {resourceVacations.map((v) => {
          const bounds = getDateRangeBounds(dayColumns, v.startDate, v.endDate, dateColumnIndex);
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
                {lane.blocks.map((block) => (
                  <AllocationSegments
                    key={block.scheduleId}
                    block={block}
                    lane={lane}
                    row={row}
                    viewMode={viewMode}
                    dayColumns={dayColumns}
                    dateColumnIndex={dateColumnIndex}
                    projects={projects}
                    resources={resources}
                    busyBlockId={busyBlockId}
                    onEditBlock={onEditBlock}
                    onOpenBlockMenu={onOpenBlockMenu}
                    onRequestClick={onRequestClick}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
