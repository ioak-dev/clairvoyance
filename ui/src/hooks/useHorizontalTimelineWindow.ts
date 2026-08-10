import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, daysBetween, CURRENT_DATE_STRING } from '../lib/dateUtils';
import {
  buildDayColumnLayout,
  columnIndexAtOffset,
  getWeekMonday,
  lowerBoundColumnIndex,
  type DayColumnLayout,
} from '../lib/weekUtils';

/** Fixed display timeline span — sliding window of date headers (Hub Planner–style). */
const WINDOW_DAYS = 730; // exactly 2 years (inclusive)
const LOAD_CHUNK_DAYS = 60; // ~2 months when hitting an edge
const WEEKDAY_COL_WIDTH = 52;
const WEEKEND_COL_WIDTH = 28;
/** Debounce after scrolling stops before notifying consumers (schedule fetch). */
const SCROLL_SETTLE_MS = 180;

/** Extra row indexes beyond the virtualizer range to eagerly fetch. */
export const FETCH_INDEX_OVERSCAN = 20;
/** Refetch only after the viewport has moved this far from the last fetch anchor. */
export const VERTICAL_REFETCH_PX = 360;
/** Refetch dates only when the centered day moves at least this far. */
export const DATE_REFETCH_THRESHOLD_DAYS = 7;

interface TimelineWindow {
  start: string;
  end: string;
}

function weekWidthPx(): number {
  return 5 * WEEKDAY_COL_WIDTH + 2 * WEEKEND_COL_WIDTH;
}

function windowWidthPx(start: string, end: string): number {
  if (start > end) return 0;
  return buildDayColumnLayout(start, end, WEEKDAY_COL_WIDTH, WEEKEND_COL_WIDTH).totalWidth;
}

function fixedWindowFromStart(start: string): TimelineWindow {
  return { start, end: addDays(start, WINDOW_DAYS - 1) };
}

function fixedWindowFromEnd(end: string): TimelineWindow {
  return { start: addDays(end, -(WINDOW_DAYS - 1)), end };
}

function centeredWindow(focusDate: string): TimelineWindow {
  const weeksSpan = Math.max(1, Math.ceil(WINDOW_DAYS / 7));
  const halfWeeks = Math.floor(weeksSpan / 2);
  const monday = getWeekMonday(focusDate);
  return fixedWindowFromStart(addDays(monday, -halfWeeks * 7));
}

function clampWindow(start: string, end: string): TimelineWindow {
  // Always keep a fixed 2-year span; prefer start when both are provided.
  if (start <= end) return fixedWindowFromStart(start);
  return fixedWindowFromStart(end);
}

function scrollLeftForDate(
  el: HTMLDivElement,
  dateStr: string,
  windowStart: string,
  windowEnd: string,
  center: boolean,
): number {
  const { columns, totalWidth } = buildDayColumnLayout(
    windowStart,
    windowEnd,
    WEEKDAY_COL_WIDTH,
    WEEKEND_COL_WIDTH,
  );
  if (columns.length === 0) return 0;
  let idx = lowerBoundColumnIndex(columns, dateStr);
  if (idx >= columns.length) idx = columns.length - 1;
  const col = columns[idx];
  if (!col) return 0;

  const target = center
    ? col.left + col.width / 2 - el.clientWidth / 2
    : col.left;

  return Math.max(0, Math.min(target, Math.max(0, totalWidth - el.clientWidth)));
}

/** Date under the horizontal center of the visible timeline (excludes sticky sidebar). */
export function dateAtTimelineCenter(
  el: HTMLElement,
  columns: DayColumnLayout[],
  sidebarWidth: number,
): string | null {
  if (columns.length === 0) return null;
  const timelineViewportWidth = Math.max(0, el.clientWidth - sidebarWidth);
  // Sticky sidebar occupies [0, sidebarWidth) in content; column.left is timeline-relative.
  // Viewport point under timeline center → timeline x = scrollLeft + timelineViewportWidth/2.
  const timelineX = el.scrollLeft + timelineViewportWidth / 2;
  const idx = columnIndexAtOffset(columns, Math.max(0, timelineX));
  return columns[idx]?.dateStr ?? null;
}

/** Inclusive 30-day window centered on focusDate. */
export function centeredFetchRange(focusDate: string, spanDays = 30): { start: string; end: string } {
  const before = Math.floor((spanDays - 1) / 2);
  const after = spanDays - 1 - before;
  return {
    start: addDays(focusDate, -before),
    end: addDays(focusDate, after),
  };
}

export type EntityIndexSample = {
  visibleIds: string[];
  fetchIds: string[];
};

type RowEntity = {
  resource?: { id: string };
  project?: { id: string };
};

export function entityIdFromRow(row: RowEntity | undefined): string | null {
  const id = row?.resource?.id ?? row?.project?.id ?? null;
  if (!id || id === 'none') return null;
  return id;
}

/** Map a contiguous row-index range to entity ids (for schedule fetch). */
export function entityIdsFromIndexRange(
  rows: RowEntity[],
  startIndex: number,
  endIndex: number,
): string[] {
  const ids: string[] = [];
  const lo = Math.max(0, startIndex);
  const hi = Math.min(rows.length - 1, endIndex);
  if (hi < lo) return ids;
  for (let i = lo; i <= hi; i++) {
    const id = entityIdFromRow(rows[i]);
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Derive visible + fetch entity ids from a virtualizer index range.
 * `range` is the mounted/visible band; fetch expands by FETCH_INDEX_OVERSCAN.
 */
export function sampleEntitiesFromVirtualRange(
  rows: RowEntity[],
  range: { startIndex: number; endIndex: number } | null,
  fetchOverscan = FETCH_INDEX_OVERSCAN,
): EntityIndexSample {
  if (!range || rows.length === 0) {
    return { visibleIds: [], fetchIds: [] };
  }
  const visibleIds = entityIdsFromIndexRange(rows, range.startIndex, range.endIndex);
  const fetchIds = entityIdsFromIndexRange(
    rows,
    range.startIndex - fetchOverscan,
    range.endIndex + fetchOverscan,
  );
  return { visibleIds, fetchIds };
}

/** True when every strict-visible id is already covered by the last fetch set. */
export function viewportCoveredByFetch(
  visibleIds: string[],
  fetchedIds: string[] | undefined,
): boolean {
  if (!fetchedIds || fetchedIds.length === 0) return visibleIds.length === 0;
  const fetched = new Set(fetchedIds);
  return visibleIds.every((id) => fetched.has(id));
}

export function shouldRefetchDates(
  prevStart: string,
  prevEnd: string,
  nextStart: string,
  nextEnd: string,
  thresholdDays = DATE_REFETCH_THRESHOLD_DAYS,
): boolean {
  if (prevStart === nextStart && prevEnd === nextEnd) return false;
  const prevCenter = addDays(prevStart, Math.floor(daysBetween(prevStart, prevEnd) / 2));
  const nextCenter = addDays(nextStart, Math.floor(daysBetween(nextStart, nextEnd) / 2));
  return daysBetween(
    prevCenter < nextCenter ? prevCenter : nextCenter,
    prevCenter < nextCenter ? nextCenter : prevCenter,
  ) >= thresholdDays;
}

export function useHorizontalTimelineWindow(initialFocusDate = CURRENT_DATE_STRING) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Positive when columns are prepended; negative when start is trimmed (sliding window).
  const pendingScrollAdjustPxRef = useRef(0);
  const pendingCenterDateRef = useRef<string | null>(null);
  const scrollThrottleRef = useRef(0);
  const scrollSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScrollSettleRef = useRef<(() => void) | null>(null);
  const scrollSettlePausedRef = useRef(false);
  const windowRangeRef = useRef<TimelineWindow>(clampWindow(
    centeredWindow(initialFocusDate).start,
    centeredWindow(initialFocusDate).end,
  ));

  const [focusDate, setFocusDate] = useState(initialFocusDate);
  const [windowRange, setWindowRange] = useState<TimelineWindow>(windowRangeRef.current);

  const updateWindow = useCallback((next: TimelineWindow) => {
    const clamped = clampWindow(next.start, next.end);
    windowRangeRef.current = clamped;
    setWindowRange(clamped);
    return clamped;
  }, []);

  const setOnScrollSettle = useCallback((cb: (() => void) | null) => {
    onScrollSettleRef.current = cb;
  }, []);

  const setScrollSettlePaused = useCallback((paused: boolean) => {
    scrollSettlePausedRef.current = paused;
  }, []);

  const scheduleScrollSettle = useCallback(() => {
    if (scrollSettlePausedRef.current) return;
    if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
    scrollSettleTimerRef.current = setTimeout(() => {
      scrollSettleTimerRef.current = null;
      if (scrollSettlePausedRef.current) return;
      onScrollSettleRef.current?.();
    }, SCROLL_SETTLE_MS);
  }, []);

  // After window changes: keep viewport stable across prepend/trim and/or center on a date.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (pendingScrollAdjustPxRef.current !== 0) {
      el.scrollLeft += pendingScrollAdjustPxRef.current;
      pendingScrollAdjustPxRef.current = 0;
    }

    if (pendingCenterDateRef.current) {
      const date = pendingCenterDateRef.current;
      pendingCenterDateRef.current = null;
      el.scrollLeft = scrollLeftForDate(
        el,
        date,
        windowRange.start,
        windowRange.end,
        true,
      );
    }

    scheduleScrollSettle();
  }, [windowRange.start, windowRange.end, scheduleScrollSettle]);

  useEffect(() => () => {
    if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
  }, []);

  const extendStartIfNeeded = useCallback(() => {
    const current = windowRangeRef.current;
    const next = fixedWindowFromStart(addDays(current.start, -LOAD_CHUNK_DAYS));
    pendingScrollAdjustPxRef.current += windowWidthPx(next.start, addDays(current.start, -1));
    updateWindow(next);
    return true;
  }, [updateWindow]);

  const extendEndIfNeeded = useCallback(() => {
    const current = windowRangeRef.current;
    const next = fixedWindowFromEnd(addDays(current.end, LOAD_CHUNK_DAYS));
    pendingScrollAdjustPxRef.current -= windowWidthPx(current.start, addDays(next.start, -1));
    updateWindow(next);
    return true;
  }, [updateWindow]);

  const focusOnDate = useCallback((dateStr: string) => {
    if (!dateStr) return;
    setFocusDate(dateStr);

    const current = windowRangeRef.current;
    const inWindow = dateStr >= current.start && dateStr <= current.end;

    if (!inWindow) {
      const next = centeredWindow(dateStr);
      pendingCenterDateRef.current = dateStr;
      updateWindow(next);
      return;
    }

    // At first/last loaded week → load another chunk, then center.
    const firstWeekEnd = addDays(getWeekMonday(current.start), 6);
    const lastWeekStart = getWeekMonday(current.end);

    if (dateStr <= firstWeekEnd) {
      extendStartIfNeeded();
      pendingCenterDateRef.current = dateStr;
      return;
    }
    if (dateStr >= lastWeekStart) {
      extendEndIfNeeded();
      pendingCenterDateRef.current = dateStr;
      return;
    }

    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = scrollLeftForDate(el, dateStr, current.start, current.end, true);
      scheduleScrollSettle();
    }
  }, [extendEndIfNeeded, extendStartIfNeeded, scheduleScrollSettle, updateWindow]);

  const focusToday = useCallback(() => {
    focusOnDate(CURRENT_DATE_STRING);
  }, [focusOnDate]);

  const scrollByWeeks = useCallback((weeks: number) => {
    const el = scrollRef.current;
    if (!el || weeks === 0) return;

    const deltaPx = weeks * weekWidthPx();
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const atStart = el.scrollLeft <= weekWidthPx();
    const atEnd = el.scrollLeft >= maxScroll - weekWidthPx();

    if (weeks < 0 && atStart) {
      if (extendStartIfNeeded()) {
        // After prepend adjust, apply the week scroll.
        requestAnimationFrame(() => {
          const node = scrollRef.current;
          if (!node) return;
          node.scrollLeft = Math.max(0, node.scrollLeft + deltaPx);
          scheduleScrollSettle();
        });
      }
      return;
    }

    if (weeks > 0 && atEnd) {
      if (extendEndIfNeeded()) {
        requestAnimationFrame(() => {
          const node = scrollRef.current;
          if (!node) return;
          const max = Math.max(0, node.scrollWidth - node.clientWidth);
          node.scrollLeft = Math.min(node.scrollLeft + deltaPx, max);
          scheduleScrollSettle();
        });
      }
      return;
    }

    el.scrollLeft = Math.max(0, Math.min(el.scrollLeft + deltaPx, maxScroll));
    scheduleScrollSettle();
  }, [extendEndIfNeeded, extendStartIfNeeded, scheduleScrollSettle]);

  const handleScroll = useCallback(() => {
    scheduleScrollSettle();

    const now = Date.now();
    if (now - scrollThrottleRef.current < 200) return;
    scrollThrottleRef.current = now;

    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    // Edge hit → slide the date-header window (structure only; data fetch is on settle).
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - weekWidthPx()) {
      extendEndIfNeeded();
    }
    if (el.scrollLeft <= weekWidthPx() && maxScroll > 0) {
      extendStartIfNeeded();
    }
  }, [extendEndIfNeeded, extendStartIfNeeded, scheduleScrollSettle]);

  // Center on initial focus after first paint.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = scrollLeftForDate(
      el,
      initialFocusDate,
      windowRangeRef.current.start,
      windowRangeRef.current.end,
      true,
    );
    scheduleScrollSettle();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  return {
    scrollRef,
    windowStart: windowRange.start,
    windowEnd: windowRange.end,
    focusDate,
    handleScroll,
    scrollByWeeks,
    focusOnDate,
    focusToday,
    setOnScrollSettle,
    setScrollSettlePaused,
  };
}
