import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, daysBetween, CURRENT_DATE_STRING } from '../lib/dateUtils';
import { buildDayColumnLayout, getWeekMonday } from '../lib/weekUtils';

const INITIAL_VISIBLE_DAYS = 42; // ~6 weeks
const LOAD_CHUNK_DAYS = 28; // ~4 weeks
const MAX_WINDOW_DAYS = 366;
const WEEKDAY_COL_WIDTH = 52;
const WEEKEND_COL_WIDTH = 28;

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

function centeredWindow(focusDate: string, spanDays = INITIAL_VISIBLE_DAYS): TimelineWindow {
  const weeksSpan = Math.max(1, Math.ceil(spanDays / 7));
  const halfWeeks = Math.floor(weeksSpan / 2);
  const monday = getWeekMonday(focusDate);
  return {
    start: addDays(monday, -halfWeeks * 7),
    end: addDays(monday, (weeksSpan - halfWeeks) * 7 - 1),
  };
}

function clampWindow(start: string, end: string): TimelineWindow {
  let windowStart = start;
  let windowEnd = end;

  if (daysBetween(windowStart, windowEnd) > MAX_WINDOW_DAYS) {
    windowEnd = addDays(windowStart, MAX_WINDOW_DAYS);
  }
  if (windowStart > windowEnd) {
    windowEnd = windowStart;
  }
  return { start: windowStart, end: windowEnd };
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
  const col =
    columns.find((c) => c.dateStr === dateStr) ??
    columns.find((c) => c.dateStr >= dateStr) ??
    columns[columns.length - 1];

  if (!col) return 0;

  const target = center
    ? col.left + col.width / 2 - el.clientWidth / 2
    : col.left;

  return Math.max(0, Math.min(target, Math.max(0, totalWidth - el.clientWidth)));
}

export function useHorizontalTimelineWindow(initialFocusDate = CURRENT_DATE_STRING) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingPrependPxRef = useRef(0);
  const pendingCenterDateRef = useRef<string | null>(null);
  const scrollThrottleRef = useRef(0);
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

  // After window changes: fix scroll for prepended columns and/or center on a date.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (pendingPrependPxRef.current !== 0) {
      el.scrollLeft += pendingPrependPxRef.current;
      pendingPrependPxRef.current = 0;
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
  }, [windowRange.start, windowRange.end]);

  const extendStartIfNeeded = useCallback(() => {
    const current = windowRangeRef.current;
    const nextStart = addDays(current.start, -LOAD_CHUNK_DAYS);
    if (daysBetween(nextStart, current.end) > MAX_WINDOW_DAYS) return false;
    pendingPrependPxRef.current = windowWidthPx(nextStart, addDays(current.start, -1));
    updateWindow({ start: nextStart, end: current.end });
    return true;
  }, [updateWindow]);

  const extendEndIfNeeded = useCallback(() => {
    const current = windowRangeRef.current;
    const nextEnd = addDays(current.end, LOAD_CHUNK_DAYS);
    if (daysBetween(current.start, nextEnd) > MAX_WINDOW_DAYS) return false;
    updateWindow({ start: current.start, end: nextEnd });
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
    }
  }, [extendEndIfNeeded, extendStartIfNeeded, updateWindow]);

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
        });
      }
      return;
    }

    el.scrollLeft = Math.max(0, Math.min(el.scrollLeft + deltaPx, maxScroll));
  }, [extendEndIfNeeded, extendStartIfNeeded]);

  const handleScroll = useCallback(() => {
    const now = Date.now();
    if (now - scrollThrottleRef.current < 200) return;
    scrollThrottleRef.current = now;

    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - weekWidthPx()) {
      extendEndIfNeeded();
    }
    if (el.scrollLeft <= weekWidthPx() && maxScroll > 0) {
      extendStartIfNeeded();
    }
  }, [extendEndIfNeeded, extendStartIfNeeded]);

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
  };
}
