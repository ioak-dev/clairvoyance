/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  memo,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { AllocationBlock, BookingRequest, Project, Resource, ScheduleAssignment, Vacation } from '../types';
import { Calendar, Loader2 } from 'lucide-react';
import { addDays, CURRENT_DATE_STRING } from '../lib/dateUtils';
import { filterPeople, filterProjects, filterRequests } from '../lib/filterEngine';
import {
  buildDateColumnIndex,
  buildDayColumnLayout,
  buildSchedulerDayChromeStyle,
  getDateRangeBounds,
  visibleColumnIndexRange,
  weekPatternWidthPx,
} from '../lib/weekUtils';
import {
  assignmentToBlock,
  type WeekDisplaySegment,
} from '../lib/rosterUtils';
import { useSchedulesInRange } from '../hooks/useSchedules';
import {
  centeredFetchRange,
  dateAtTimelineCenter,
  entityIdFromRow,
  sampleEntitiesFromVirtualRange,
  shouldRefetchDates,
  useHorizontalTimelineWindow,
  VERTICAL_REFETCH_PX,
  viewportCoveredByFetch,
} from '../hooks/useHorizontalTimelineWindow';
import type { ListSchedulesInRangeParams } from '../lib/services/schedules';
import { SkillMatcherModal } from './SkillMatcherModal';
import { SchedulerRow, type EditBlockOptions, type SchedulerRowModel } from './SchedulerRow';
import { Card, ConfirmDialog } from './ui';

const WEEKDAY_COL_WIDTH = 52;
const WEEKEND_COL_WIDTH = 28;
/** Schedule data window loaded per scroll-settle (inclusive days). */
const SCHEDULE_FETCH_DAYS = 30;
const SIDEBAR_WIDTH = 190;
/** Sticky month + day header rows (h-9 + h-10). */
const STICKY_HEADER_HEIGHT_PX = 76;
const LANE_HEIGHT_PX = 56;
const LANE_GAP_PX = 4;
const ROW_PADDING_Y_PX = 24;
const VIRTUAL_OVERSCAN = 8;
/** Extra timeline px beyond the viewport for sticky day headers. */
const HEADER_OVERSCAN_PX = weekPatternWidthPx(WEEKDAY_COL_WIDTH, WEEKEND_COL_WIDTH) * 2;

function estimateRowHeight(laneCount: number): number {
  const lanes = Math.max(1, laneCount);
  return Math.max(72, lanes * LANE_HEIGHT_PX + (lanes - 1) * LANE_GAP_PX + ROW_PADDING_Y_PX);
}

export type { EditBlockOptions };

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

function sortedIdsEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (a.length !== b.length) return false;
  const as = [...a].sort();
  const bs = [...b].sort();
  return as.every((id, i) => id === bs[i]);
}

/** Clip a block to the loaded schedule window so bars only paint in the 30-day fetch range. */
function clipBlockToFetchRange(
  block: AllocationBlock,
  fetchStart: string,
  fetchEnd: string,
): AllocationBlock | null {
  const startDate = block.startDate > fetchStart ? block.startDate : fetchStart;
  const endDate = block.endDate < fetchEnd ? block.endDate : fetchEnd;
  if (startDate > endDate) return null;
  if (startDate === block.startDate && endDate === block.endDate) return block;
  return { ...block, startDate, endDate };
}

function rowOwnsBusyBlock(row: SchedulerRowModel, busyBlockId: string | null): boolean {
  if (!busyBlockId) return false;
  return row.projectLanes.some((lane) => lane.blocks.some((b) => b.scheduleId === busyBlockId));
}

const EMPTY_BLOCKS: AllocationBlock[] = [];

function pushBlockIndex(
  map: Map<string, AllocationBlock[]>,
  key: string,
  block: AllocationBlock,
): void {
  const list = map.get(key);
  if (list) list.push(block);
  else map.set(key, [block]);
}

function indexBlocksByEntity(blocks: AllocationBlock[]): {
  byResourceId: Map<string, AllocationBlock[]>;
  byProjectId: Map<string, AllocationBlock[]>;
} {
  const byResourceId = new Map<string, AllocationBlock[]>();
  const byProjectId = new Map<string, AllocationBlock[]>();
  for (const block of blocks) {
    pushBlockIndex(byResourceId, block.resourceId, block);
    pushBlockIndex(byProjectId, block.projectId, block);
  }
  return { byResourceId, byProjectId };
}

function groupBlocksByKey(
  blocks: AllocationBlock[],
  keyOf: (block: AllocationBlock) => string,
): Map<string, AllocationBlock[]> {
  const map = new Map<string, AllocationBlock[]>();
  for (const block of blocks) {
    pushBlockIndex(map, keyOf(block), block);
  }
  return map;
}

type BlockContextMenuState = {
  block: AllocationBlock;
  segment: WeekDisplaySegment;
  anchorRect: DOMRect;
};

const BLOCK_MENU_WIDTH_PX = 176;
const SELECTION_MENU_WIDTH_PX = 144;

function sameBlockMenuTarget(
  a: BlockContextMenuState | null,
  block: AllocationBlock,
  segment: WeekDisplaySegment,
): boolean {
  return (
    !!a &&
    a.block.scheduleId === block.scheduleId &&
    a.segment.startDate === segment.startDate &&
    a.segment.endDate === segment.endDate
  );
}

function menuPosition(anchorRect: DOMRect, menuWidth: number): { left: number; top: number } {
  const isPoint = anchorRect.width === 0 && anchorRect.height === 0;
  const left = Math.min(
    Math.max(
      8,
      isPoint ? anchorRect.left : anchorRect.left + anchorRect.width / 2 - menuWidth / 2,
    ),
    window.innerWidth - menuWidth - 8,
  );
  const top = Math.min(
    (isPoint ? anchorRect.top : anchorRect.bottom) + 4,
    window.innerHeight - 8,
  );
  return { left, top };
}

function SelectionScheduleMenu({
  anchorRect,
  menuRef,
  onSchedule,
}: {
  anchorRect: DOMRect;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onSchedule: () => void;
}) {
  const { left, top } = menuPosition(anchorRect, SELECTION_MENU_WIDTH_PX);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Schedule actions for selected dates"
      className="fixed z-[80] rounded-lg border border-default bg-surface-raised shadow-app-md py-1"
      style={{ left, top, width: SELECTION_MENU_WIDTH_PX }}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left text-primary hover:bg-surface-hover cursor-pointer"
        onClick={onSchedule}
      >
        <Calendar className="w-3.5 h-3.5" />
        Schedule
      </button>
    </div>
  );
}

function BlockContextMenu({
  menu,
  busy,
  canDelete,
  canSplit,
  onEdit,
  onEditWeek,
  onSplit,
  onDelete,
  menuRef,
}: {
  menu: BlockContextMenuState;
  busy: boolean;
  canDelete: boolean;
  canSplit: boolean;
  onEdit: () => void;
  onEditWeek: () => void;
  onSplit: () => void;
  onDelete: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  // Bottom-end align to ⋮ / right-click point (matches prior Headless Menu).
  const left = Math.min(
    Math.max(8, menu.anchorRect.right - BLOCK_MENU_WIDTH_PX),
    window.innerWidth - BLOCK_MENU_WIDTH_PX - 8,
  );
  const top = Math.min(menu.anchorRect.bottom + 4, window.innerHeight - 8);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Allocation actions"
      className="fixed z-[80] min-w-[11rem] rounded-lg border border-default bg-surface-raised shadow-app-md py-1"
      style={{ left, top, width: BLOCK_MENU_WIDTH_PX }}
    >
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left text-primary hover:bg-surface-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onEdit}
      >
        Edit
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left text-primary hover:bg-surface-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onEditWeek}
      >
        Edit this week…
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canSplit || busy}
        className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left text-primary hover:bg-surface-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onSplit}
      >
        Split after this week
      </button>
      {canDelete && (
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left text-red-600 dark:text-red-400 hover:bg-surface-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onDelete}
        >
          Delete
        </button>
      )}
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
  /** Committed selection — set on mouseup only (not during drag). */
  const [dateSelection, setDateSelection] = useState<{
    anchorIndex: number;
    focusIndex: number;
    entityId: string;
  } | null>(null);
  /** Entity row that owns the in-progress drag overlay (mousedown → mouseup). */
  const [dragEntityId, setDragEntityId] = useState<string | null>(null);
  const [selectionMenuAnchor, setSelectionMenuAnchor] = useState<DOMRect | null>(null);
  const [blockMenu, setBlockMenu] = useState<BlockContextMenuState | null>(null);
  const [confirmDeleteBlock, setConfirmDeleteBlock] = useState<AllocationBlock | null>(null);
  const isSelectingDatesRef = useRef(false);
  const dateSelectionRef = useRef<{
    anchorIndex: number;
    focusIndex: number;
    entityId: string;
  } | null>(null);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const selectionOverlayRef = useRef<HTMLDivElement | null>(null);

  const {
    scrollRef,
    windowStart,
    windowEnd,
    handleScroll,
    scrollByWeeks,
    focusOnDate,
    focusToday,
    setOnScrollSettle,
    setScrollSettlePaused,
  } = useHorizontalTimelineWindow(CURRENT_DATE_STRING);

  useImperativeHandle(ref, () => ({
    scrollByWeeks,
    focusOnDate,
    focusToday,
  }), [scrollByWeeks, focusOnDate, focusToday]);

  const { columns: dayColumns, totalWidth: gridWidth } = useMemo(
    () => buildDayColumnLayout(windowStart, windowEnd, WEEKDAY_COL_WIDTH, WEEKEND_COL_WIDTH),
    [windowStart, windowEnd],
  );

  const dateColumnIndex = useMemo(() => buildDateColumnIndex(dayColumns), [dayColumns]);

  const dayChromeStyle = useMemo(
    () => buildSchedulerDayChromeStyle(windowStart, WEEKDAY_COL_WIDTH, WEEKEND_COL_WIDTH),
    [windowStart],
  );

  const dayColumnsRef = useRef(dayColumns);
  dayColumnsRef.current = dayColumns;
  const dateColumnIndexRef = useRef(dateColumnIndex);
  dateColumnIndexRef.current = dateColumnIndex;

  // Horizontal viewport for day-header virtualization (rAF-coalesced).
  const [headerViewport, setHeaderViewport] = useState({ scrollLeft: 0, clientWidth: 0 });
  const headerViewportRafRef = useRef(0);
  const syncHeaderViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setHeaderViewport((prev) => {
      if (prev.scrollLeft === el.scrollLeft && prev.clientWidth === el.clientWidth) return prev;
      return { scrollLeft: el.scrollLeft, clientWidth: el.clientWidth };
    });
  }, [scrollRef]);
  const scheduleHeaderViewportSync = useCallback(() => {
    if (headerViewportRafRef.current) return;
    headerViewportRafRef.current = requestAnimationFrame(() => {
      headerViewportRafRef.current = 0;
      syncHeaderViewport();
    });
  }, [syncHeaderViewport]);

  useLayoutEffect(() => {
    syncHeaderViewport();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => scheduleHeaderViewportSync());
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (headerViewportRafRef.current) cancelAnimationFrame(headerViewportRafRef.current);
    };
  }, [syncHeaderViewport, scheduleHeaderViewportSync, scrollRef, gridWidth]);

  const initialFetch = centeredFetchRange(CURRENT_DATE_STRING, SCHEDULE_FETCH_DAYS);
  const [scheduleQuery, setScheduleQuery] = useState<ListSchedulesInRangeParams>({
    startDate: initialFetch.start,
    endDate: initialFetch.end,
    resourceIds: viewMode === 'resources' ? [] : undefined,
    projectIds: viewMode === 'projects' ? [] : undefined,
  });
  const scheduleQueryRef = useRef(scheduleQuery);
  scheduleQueryRef.current = scheduleQuery;
  const fetchAnchorScrollTopRef = useRef(0);

  const filteredEntityIds = useMemo(() => {
    if (viewMode === 'projects') {
      return filterProjects(projects, filterCriteria)
        .filter((p) => !focusedEntityId || p.id === focusedEntityId)
        .map((p) => p.id);
    }
    if (viewMode === 'resources') {
      return filterPeople(resources, filterCriteria)
        .filter((r) => !focusedEntityId || r.id === focusedEntityId)
        .map((r) => r.id);
    }
    return [] as string[];
  }, [viewMode, projects, resources, filterCriteria, focusedEntityId]);

  const scheduleFetchEnabled = viewMode !== 'requests';
  const {
    data: rangeAssignments = [],
    isPending: isPendingSchedules,
    isFetching: isFetchingSchedules,
  } = useSchedulesInRange(scheduleQuery, scheduleFetchEnabled);

  // Full-grid overlay only for true empty/pending loads — not background refetches.
  const showScheduleLoading =
    isFilterApplying || (isPendingSchedules && isFetchingSchedules);

  const onTimelineScroll = useCallback(() => {
    scheduleHeaderViewportSync();
    handleScroll();
  }, [handleScroll, scheduleHeaderViewportSync]);

  const applyOverlayBounds = useCallback((anchorIndex: number, focusIndex: number) => {
    const overlay = selectionOverlayRef.current;
    if (!overlay) return;
    const columns = dayColumnsRef.current;
    const index = dateColumnIndexRef.current;
    const startIdx = Math.min(anchorIndex, focusIndex);
    const endIdx = Math.max(anchorIndex, focusIndex);
    const startDate = columns[startIdx]?.dateStr;
    const endDate = columns[endIdx]?.dateStr;
    if (!startDate || !endDate) return;
    const bounds = getDateRangeBounds(columns, startDate, endDate, index);
    if (!bounds) return;
    overlay.style.left = `${bounds.left}px`;
    overlay.style.width = `${bounds.width}px`;
  }, []);

  const selectedDateRange = useMemo(() => {
    if (!dateSelection || dayColumns.length === 0) return null;
    const startIdx = Math.min(dateSelection.anchorIndex, dateSelection.focusIndex);
    const endIdx = Math.max(dateSelection.anchorIndex, dateSelection.focusIndex);
    const startDate = dayColumns[startIdx]?.dateStr;
    const endDate = dayColumns[endIdx]?.dateStr;
    if (!startDate || !endDate) return null;
    const bounds = getDateRangeBounds(dayColumns, startDate, endDate, dateColumnIndex);
    if (!bounds) return null;
    return {
      startIdx,
      endIdx,
      startDate,
      endDate,
      bounds,
      entityId: dateSelection.entityId,
    };
  }, [dateSelection, dayColumns, dateColumnIndex]);

  const clearDateSelection = useCallback(() => {
    isSelectingDatesRef.current = false;
    dateSelectionRef.current = null;
    selectionOverlayRef.current = null;
    setScrollSettlePaused(false);
    setDragEntityId(null);
    setSelectionMenuAnchor(null);
    setDateSelection(null);
  }, [setScrollSettlePaused]);

  const closeBlockMenu = useCallback(() => {
    setBlockMenu(null);
  }, []);

  const closeSelectionMenu = useCallback(() => {
    setSelectionMenuAnchor(null);
  }, []);

  const openSelectionMenu = useCallback((anchorRect: DOMRect, toggle = false) => {
    setBlockMenu(null);
    setSelectionMenuAnchor((prev) => (toggle && prev ? null : anchorRect));
  }, []);

  const openBlockMenu = useCallback(
    (block: AllocationBlock, segment: WeekDisplaySegment, anchorRect: DOMRect) => {
      setSelectionMenuAnchor(null);
      setBlockMenu((prev) =>
        sameBlockMenuTarget(prev, block, segment) ? null : { block, segment, anchorRect },
      );
    },
    [],
  );

  const beginDateSelection = useCallback((fullIndex: number, entityId: string) => {
    const next = { anchorIndex: fullIndex, focusIndex: fullIndex, entityId };
    isSelectingDatesRef.current = true;
    dateSelectionRef.current = next;
    setScrollSettlePaused(true);
    setSelectionMenuAnchor(null);
    setBlockMenu(null);
    setDateSelection(null);
    // Mount overlay on this row only — no focusIndex React updates during drag.
    setDragEntityId(entityId);
  }, [setScrollSettlePaused]);

  // After drag overlay mounts, position it from refs (DOM only thereafter).
  useLayoutEffect(() => {
    if (!dragEntityId) return;
    const live = dateSelectionRef.current;
    if (!live) return;
    applyOverlayBounds(live.anchorIndex, live.focusIndex);
  }, [dragEntityId, applyOverlayBounds]);

  // During drag: update overlay via DOM only (no React re-render).
  const updateDateSelection = useCallback((fullIndex: number) => {
    if (!isSelectingDatesRef.current || !dateSelectionRef.current) return;
    if (dateSelectionRef.current.focusIndex === fullIndex) return;
    dateSelectionRef.current = { ...dateSelectionRef.current, focusIndex: fullIndex };
    applyOverlayBounds(dateSelectionRef.current.anchorIndex, fullIndex);
  }, [applyOverlayBounds]);

  const endDateSelection = useCallback(() => {
    if (!isSelectingDatesRef.current) return;
    isSelectingDatesRef.current = false;
    setScrollSettlePaused(false);
    setDragEntityId(null);
    // One React commit with the final range → schedule menu on active row.
    const live = dateSelectionRef.current;
    if (live) {
      setDateSelection({ ...live });
    }
  }, [setScrollSettlePaused]);

  const handleSelectionOverlayRef = useCallback((node: HTMLDivElement | null) => {
    selectionOverlayRef.current = node;
  }, []);

  const handleRequestClick = useCallback((request: BookingRequest) => {
    setSelectedRequestForSkills(request);
  }, []);

  const handleBlockMenuEdit = useCallback(() => {
    if (!blockMenu) return;
    const { block } = blockMenu;
    closeBlockMenu();
    onEditBlock(block);
  }, [blockMenu, closeBlockMenu, onEditBlock]);

  const handleBlockMenuEditWeek = useCallback(() => {
    if (!blockMenu) return;
    const { block, segment } = blockMenu;
    closeBlockMenu();
    onEditBlock(block, {
      applyScope: 'partial',
      partialRange: { startDate: segment.startDate, endDate: segment.endDate },
    });
  }, [blockMenu, closeBlockMenu, onEditBlock]);

  const handleBlockMenuSplit = useCallback(() => {
    if (!blockMenu || !onSplitBlock || busyBlockId) return;
    const { block, segment } = blockMenu;
    const splitDate = addDays(segment.endDate, 1);
    const canSplit = splitDate > block.startDate && splitDate <= block.endDate;
    if (!canSplit) return;
    closeBlockMenu();
    setBusyBlockId(block.scheduleId);
    void Promise.resolve(onSplitBlock(block, splitDate)).finally(() => {
      setBusyBlockId(null);
    });
  }, [blockMenu, busyBlockId, closeBlockMenu, onSplitBlock]);

  const handleBlockMenuDelete = useCallback(() => {
    if (!blockMenu || !onDeleteBlock || busyBlockId) return;
    const { block } = blockMenu;
    closeBlockMenu();
    setConfirmDeleteBlock(block);
  }, [blockMenu, busyBlockId, closeBlockMenu, onDeleteBlock]);

  const handleConfirmDeleteBlock = useCallback(async () => {
    if (!confirmDeleteBlock || !onDeleteBlock || busyBlockId) return;
    const block = confirmDeleteBlock;
    setBusyBlockId(block.scheduleId);
    try {
      await onDeleteBlock(block);
      setConfirmDeleteBlock(null);
    } finally {
      setBusyBlockId(null);
    }
  }, [confirmDeleteBlock, busyBlockId, onDeleteBlock]);

  useEffect(() => {
    const onMouseUp = () => endDateSelection();
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [endDateSelection]);

  useEffect(() => {
    if (!dateSelection && !dragEntityId && !blockMenu && !selectionMenuAnchor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (blockMenu) {
        closeBlockMenu();
        return;
      }
      if (selectionMenuAnchor) {
        closeSelectionMenu();
        return;
      }
      clearDateSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    dateSelection,
    dragEntityId,
    blockMenu,
    selectionMenuAnchor,
    clearDateSelection,
    closeBlockMenu,
    closeSelectionMenu,
  ]);

  useEffect(() => {
    if (!selectionMenuAnchor && !blockMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (selectionMenuAnchor && selectionMenuRef.current?.contains(target)) return;
      if (blockMenu && blockMenuRef.current?.contains(target)) return;
      // Opener buttons toggle/open on click; skip pointerdown so menu is not closed first.
      if (
        target instanceof Element &&
        target.closest('[data-block-menu], [data-selection-menu-trigger]')
      ) {
        return;
      }
      if (selectionMenuAnchor) closeSelectionMenu();
      if (blockMenu) closeBlockMenu();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [selectionMenuAnchor, blockMenu, closeBlockMenu, closeSelectionMenu]);

  // Fixed-position menus drift on scroll — dismiss instead of tracking.
  useEffect(() => {
    if (!blockMenu && !selectionMenuAnchor) return;
    const scroller = scrollRef.current;
    const onScroll = () => {
      closeBlockMenu();
      closeSelectionMenu();
    };
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller?.removeEventListener('scroll', onScroll);
  }, [blockMenu, selectionMenuAnchor, closeBlockMenu, closeSelectionMenu, scrollRef]);

  // Drop selection when the visible timeline window or view changes.
  useEffect(() => {
    clearDateSelection();
    closeBlockMenu();
  }, [windowStart, windowEnd, viewMode, clearDateSelection, closeBlockMenu]);

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
    const groups: { monthName: string; left: number; width: number }[] = [];
    for (const col of dayColumns) {
      const last = groups[groups.length - 1];
      if (last && last.monthName === col.monthName) last.width += col.width;
      else groups.push({ monthName: col.monthName, left: col.left, width: col.width });
    }
    return groups;
  }, [dayColumns]);

  const visibleDayHeaders = useMemo(() => {
    const clientWidth = headerViewport.clientWidth || 1200;
    const timelineViewW = Math.max(0, clientWidth - SIDEBAR_WIDTH);
    const rangeStart = headerViewport.scrollLeft - HEADER_OVERSCAN_PX;
    const rangeEnd = headerViewport.scrollLeft + timelineViewW + HEADER_OVERSCAN_PX;
    const range = visibleColumnIndexRange(dayColumns, rangeStart, rangeEnd);
    if (!range) return [] as typeof dayColumns;
    return dayColumns.slice(range.startIndex, range.endIndex + 1);
  }, [dayColumns, headerViewport.scrollLeft, headerViewport.clientWidth]);

  /** Month chips that intersect the virtualized day-header window (true left/width). */
  const visibleMonthHeaders = useMemo(() => {
    if (visibleDayHeaders.length === 0) return monthsHeader;
    const winStart = visibleDayHeaders[0].left;
    const last = visibleDayHeaders[visibleDayHeaders.length - 1];
    const winEnd = last.left + last.width;
    return monthsHeader.filter((m) => m.left < winEnd && m.left + m.width > winStart);
  }, [monthsHeader, visibleDayHeaders]);

  const fetchDayColumns = useMemo(
    () =>
      dayColumns
        .map((col, fullIndex) => ({ ...col, fullIndex }))
        .filter(
          (col) =>
            col.dateStr >= scheduleQuery.startDate && col.dateStr <= scheduleQuery.endDate,
        ),
    [dayColumns, scheduleQuery.startDate, scheduleQuery.endDate],
  );

  const assignmentRows = useMemo((): SchedulerRowModel[] => {
    const rows: SchedulerRowModel[] = [];

    const allBlocks = rangeAssignments
      .flatMap(assignmentToBlocks)
      .map((block) =>
        clipBlockToFetchRange(block, scheduleQuery.startDate, scheduleQuery.endDate),
      )
      .filter((block): block is AllocationBlock => block != null);

    const { byResourceId, byProjectId } = indexBlocksByEntity(allBlocks);

    if (viewMode === 'requests') {
      projects.forEach((proj) => {
        const projRequests = filterRequests(
          requests.filter((r) => r.projectId === proj.id && (r.status === 'Pending' || r.status === 'Approved')),
          filterCriteria,
          projects,
        );

        const projectLanes = projRequests.map((req) => ({
          project: proj,
          request: req,
          blocks: requestToBlocks(req),
        }));

        if (projectLanes.length > 0) {
          rows.push({ id: `row-${proj.id}`, project: proj, projectLanes });
        }
      });
    } else if (viewMode === 'projects') {
      const resourcesById = new Map(resources.map((r) => [r.id, r]));
      filterProjects(projects, filterCriteria).forEach((proj) => {
        if (focusedEntityId && proj.id !== focusedEntityId) return;
        const projBlocks = byProjectId.get(proj.id) ?? EMPTY_BLOCKS;
        if (hideUnbooked && projBlocks.length === 0) return;

        const projectLanes =
          projBlocks.length === 0
            ? [{ resource: { id: 'none', name: 'Unassigned', role: '-' }, blocks: [] as AllocationBlock[] }]
            : Array.from(groupBlocksByKey(projBlocks, (b) => b.resourceId).entries())
                .map(([rId, blocks]) => ({
                  resource: resourcesById.get(rId) || { id: rId, name: 'Resource', role: 'Role' },
                  blocks,
                }))
                .sort((a, b) =>
                  (a.resource?.name || '').localeCompare(b.resource?.name || '', undefined, {
                    sensitivity: 'base',
                  }),
                );

        rows.push({ id: `row-${proj.id}`, project: proj, projectLanes });
      });
    } else {
      const projectsById = new Map(projects.map((p) => [p.id, p]));
      filterPeople(resources, filterCriteria).forEach((res) => {
        if (focusedEntityId && res.id !== focusedEntityId) return;
        const resBlocks = byResourceId.get(res.id) ?? EMPTY_BLOCKS;
        if (hideUnbooked && resBlocks.length === 0) return;

        const projectLanes =
          resBlocks.length === 0
            ? [{
                project: { id: 'none', name: 'Unassigned', client: '-', color: 'bg-gray-400', textColor: 'text-gray-400' },
                blocks: [] as AllocationBlock[],
              }]
            : Array.from(groupBlocksByKey(resBlocks, (b) => b.projectId).entries())
                .map(([pId, blocks]) => ({
                  project: projectsById.get(pId) || {
                    id: pId, name: 'Project', client: 'Client', color: 'bg-emerald-500', textColor: 'text-white',
                  },
                  blocks,
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
  }, [
    resources,
    projects,
    rangeAssignments,
    requests,
    filterCriteria,
    focusedEntityId,
    hideUnbooked,
    viewMode,
    scheduleQuery.startDate,
    scheduleQuery.endDate,
  ]);

  const assignmentRowsRef = useRef(assignmentRows);
  assignmentRowsRef.current = assignmentRows;

  const rowVirtualizer = useVirtualizer({
    count: assignmentRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      estimateRowHeight(assignmentRows[index]?.projectLanes.length ?? 1),
    overscan: VIRTUAL_OVERSCAN,
    scrollMargin: STICKY_HEADER_HEIGHT_PX,
    getItemKey: (index) => assignmentRows[index]?.id ?? index,
  });

  const rowVirtualizerRef = useRef(rowVirtualizer);
  rowVirtualizerRef.current = rowVirtualizer;

  const refreshScheduleViewport = useCallback((force = false) => {
    if (viewMode === 'requests') return;
    const el = scrollRef.current;
    if (!el) return;

    const prev = scheduleQueryRef.current;
    const rows = assignmentRowsRef.current;
    const centerDate =
      dateAtTimelineCenter(el, dayColumnsRef.current, SIDEBAR_WIDTH) ?? CURRENT_DATE_STRING;
    const centered = centeredFetchRange(centerDate, SCHEDULE_FETCH_DAYS);
    let start = centered.start;
    let end = centered.end;

    let ids: string[];
    const scrollTop = el.scrollTop;

    if (hideUnbooked) {
      ids = filteredEntityIds;
      if (!force) {
        const datesNeedRefresh = shouldRefetchDates(prev.startDate, prev.endDate, start, end);
        if (!datesNeedRefresh) {
          return;
        }
      }
    } else {
      const range = rowVirtualizerRef.current.range;
      const sample = sampleEntitiesFromVirtualRange(rows, range);
      ids =
        sample.fetchIds.length > 0
          ? sample.fetchIds
          : filteredEntityIds.slice(0, 40);

      if (!force) {
        const prevIds = viewMode === 'projects' ? prev.projectIds : prev.resourceIds;
        const datesNeedRefresh = shouldRefetchDates(prev.startDate, prev.endDate, start, end);
        const covered = viewportCoveredByFetch(sample.visibleIds, prevIds);
        const verticalMoved =
          Math.abs(scrollTop - fetchAnchorScrollTopRef.current) >= VERTICAL_REFETCH_PX;

        if (!datesNeedRefresh && covered && !verticalMoved) {
          return;
        }
        if (!datesNeedRefresh) {
          start = prev.startDate;
          end = prev.endDate;
        }
      }
    }

    setScheduleQuery((current) => {
      const next: ListSchedulesInRangeParams =
        viewMode === 'projects'
          ? { startDate: start, endDate: end, projectIds: ids, resourceIds: undefined }
          : { startDate: start, endDate: end, resourceIds: ids, projectIds: undefined };

      if (
        current.startDate === next.startDate &&
        current.endDate === next.endDate &&
        sortedIdsEqual(current.resourceIds, next.resourceIds) &&
        sortedIdsEqual(current.projectIds, next.projectIds)
      ) {
        return current;
      }
      fetchAnchorScrollTopRef.current = scrollTop;
      return next;
    });
  }, [viewMode, hideUnbooked, filteredEntityIds, scrollRef]);

  useEffect(() => {
    setOnScrollSettle(() => refreshScheduleViewport(false));
    return () => setOnScrollSettle(null);
  }, [setOnScrollSettle, refreshScheduleViewport]);

  useEffect(() => {
    if (viewMode === 'requests') return;
    const id = requestAnimationFrame(() => refreshScheduleViewport(true));
    return () => cancelAnimationFrame(id);
  }, [viewMode, hideUnbooked, filteredEntityIds, windowStart, windowEnd, assignmentRows.length, refreshScheduleViewport]);

  // Drop date selection when the selected row is virtualized away.
  const virtualItems = rowVirtualizer.getVirtualItems();
  const virtualRangeStart = rowVirtualizer.range?.startIndex ?? 0;
  const virtualRangeEnd = rowVirtualizer.range?.endIndex ?? -1;
  useEffect(() => {
    if (!dateSelection || isSelectingDatesRef.current) return;
    const mounted = virtualItems.some((item) => {
      const row = assignmentRows[item.index];
      return entityIdFromRow(row) === dateSelection.entityId;
    });
    if (!mounted) clearDateSelection();
    // virtualItems identity changes every render; range indexes are the stable signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [virtualRangeStart, virtualRangeEnd, assignmentRows, dateSelection, clearDateSelection]);

  const requestProject = useMemo(() => {
    if (!selectedRequestForSkills) return null;
    return projects.find((p) => p.id === selectedRequestForSkills.projectId) || null;
  }, [selectedRequestForSkills, projects]);

  const activeSelectionEntityId = dragEntityId ?? dateSelection?.entityId ?? null;

  const blockMenuCanSplit = (() => {
    if (!blockMenu || !onSplitBlock) return false;
    const splitDate = addDays(blockMenu.segment.endDate, 1);
    return splitDate > blockMenu.block.startDate && splitDate <= blockMenu.block.endDate;
  })();

  return (
    <div className="relative flex flex-col h-full min-h-0">
    <Card className="overflow-hidden flex flex-col h-full min-h-0 relative" id="scheduler-grid-main-board">
      {(showScheduleLoading) && (
        <div className="absolute inset-0 z-20 bg-black/20 pointer-events-none flex items-center justify-center">
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
        <div style={{ width: `calc(${SIDEBAR_WIDTH}px + ${gridWidth}px)` }} className="flex flex-col relative">
          {/* Month header row */}
          <div className="flex bg-grid-header border-b border-subtle text-xs font-bold text-secondary uppercase tracking-wider h-9 items-center sticky top-0 z-30">
            <div
              className="border-r border-subtle px-4 flex items-center bg-grid-header sticky left-0 z-40 h-full"
              style={{ width: `${SIDEBAR_WIDTH}px`, minWidth: `${SIDEBAR_WIDTH}px` }}
            >
              {viewMode === 'projects' || viewMode === 'requests' ? 'Projects' : 'Resources'}
            </div>
            <div className="relative h-full shrink-0" style={{ width: `${gridWidth}px` }}>
              {visibleMonthHeaders.map((m) => (
                <div
                  key={m.monthName}
                  style={{ left: `${m.left}px`, width: `${m.width}px` }}
                  className="absolute top-0 bottom-0 text-left pl-3 font-semibold text-primary tracking-wide border-r border-subtle flex items-center"
                >
                  {m.monthName}
                </div>
              ))}
            </div>
          </div>

          {/* Day header row — only viewport ± overscan cells */}
          <div className="flex bg-grid-header border-b border-subtle text-[11px] font-semibold h-10 items-stretch sticky top-9 z-30">
            <div
              className="border-r border-subtle px-4 flex items-center bg-grid-header sticky left-0 z-40"
              style={{ width: `${SIDEBAR_WIDTH}px`, minWidth: `${SIDEBAR_WIDTH}px` }}
            >
              <span className="text-tertiary text-[10px] uppercase">
                {viewMode === 'projects' || viewMode === 'requests' ? 'Resource Allocation' : 'Project Allocation'}
              </span>
            </div>
            <div className="relative h-full shrink-0" style={{ width: `${gridWidth}px` }}>
              {visibleDayHeaders.map((col) => {
                const isToday = col.dateStr === CURRENT_DATE_STRING;
                return (
                  <div
                    key={`hdr-${col.dateStr}`}
                    style={{ left: `${col.left}px`, width: `${col.width}px` }}
                    className={`absolute top-0 bottom-0 text-center flex flex-col justify-center border-r border-subtle ${
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
          </div>

          <div className="relative w-full">
            {assignmentRows.length === 0 ? (
              <div className="flex items-center justify-center py-20 bg-surface-muted text-tertiary text-sm">
                No rows match the current filters.
              </div>
            ) : (
              <div
                className="relative w-full"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {virtualItems.map((virtualRow) => {
                  const row = assignmentRows[virtualRow.index];
                  if (!row) return null;

                  const rowEntityId = row.resource?.id ?? row.project?.id ?? null;
                  const isActiveSelectionRow =
                    !!rowEntityId && rowEntityId === activeSelectionEntityId;
                  const selectionCommitted =
                    isActiveSelectionRow && !!dateSelection && !dragEntityId;

                  return (
                    <div
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="absolute top-0 left-0 w-full"
                      style={{
                        transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                      }}
                    >
                      <SchedulerRow
                        row={row}
                        viewMode={viewMode}
                        gridWidth={gridWidth}
                        dayChromeStyle={dayChromeStyle}
                        dayColumns={dayColumns}
                        dateColumnIndex={dateColumnIndex}
                        fetchDayColumns={fetchDayColumns}
                        totalsRangeStart={scheduleQuery.startDate}
                        totalsRangeEnd={scheduleQuery.endDate}
                        vacations={vacations}
                        projects={projects}
                        resources={resources}
                        showSelectionOverlay={isActiveSelectionRow}
                        selectionCommitted={selectionCommitted}
                        selectionBounds={
                          selectionCommitted && selectedDateRange
                            ? selectedDateRange.bounds
                            : null
                        }
                        selectionStartIdx={
                          selectionCommitted && selectedDateRange
                            ? selectedDateRange.startIdx
                            : null
                        }
                        selectionEndIdx={
                          selectionCommitted && selectedDateRange
                            ? selectedDateRange.endIdx
                            : null
                        }
                        busyBlockId={rowOwnsBusyBlock(row, busyBlockId) ? busyBlockId : null}
                        onBeginDateSelection={beginDateSelection}
                        onUpdateDateSelection={updateDateSelection}
                        onOpenSelectionMenu={openSelectionMenu}
                        onSelectionOverlayRef={handleSelectionOverlayRef}
                        onEditBlock={onEditBlock}
                        onOpenBlockMenu={openBlockMenu}
                        onOpenScheduleModalWithRes={onOpenScheduleModalWithRes}
                        onRequestClick={handleRequestClick}
                      />
                    </div>
                  );
                })}
              </div>
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

      {selectionMenuAnchor && (
        <SelectionScheduleMenu
          anchorRect={selectionMenuAnchor}
          menuRef={selectionMenuRef}
          onSchedule={handleScheduleSelectedRange}
        />
      )}

      {blockMenu && (
        <BlockContextMenu
          menu={blockMenu}
          busy={Boolean(busyBlockId)}
          canDelete={Boolean(onDeleteBlock)}
          canSplit={blockMenuCanSplit}
          onEdit={handleBlockMenuEdit}
          onEditWeek={handleBlockMenuEditWeek}
          onSplit={handleBlockMenuSplit}
          onDelete={handleBlockMenuDelete}
          menuRef={blockMenuRef}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteBlock != null}
        onClose={() => setConfirmDeleteBlock(null)}
        confirmLabel="Delete"
        loading={Boolean(busyBlockId && confirmDeleteBlock)}
        onConfirm={() => void handleConfirmDeleteBlock()}
      >
        Delete this entire allocation? This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}));

SchedulerGrid.displayName = 'SchedulerGrid';
