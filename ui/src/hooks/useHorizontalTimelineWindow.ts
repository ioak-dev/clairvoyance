import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, daysBetween, CURRENT_DATE_STRING } from '../lib/dateUtils';
import { buildDayColumnLayout, getWeekMonday } from '../lib/weekUtils';

const INITIAL_VISIBLE_DAYS = 42; // ~6 weeks
const LOAD_CHUNK_DAYS = 28; // ~4 weeks
const SCROLL_EDGE_THRESHOLD_PX = 80;
const MAX_WINDOW_DAYS = 366;
const WEEKDAY_COL_WIDTH = 52;
const WEEKEND_COL_WIDTH = 28;

interface TimelineWindow {
  start: string;
  end: string;
}

function windowWidthPx(start: string, end: string): number {
  return buildDayColumnLayout(start, end, WEEKDAY_COL_WIDTH, WEEKEND_COL_WIDTH).totalWidth;
}

function weekWidthPx(): number {
  return 5 * WEEKDAY_COL_WIDTH + 2 * WEEKEND_COL_WIDTH;
}

function centeredWindow(focusDate: string, spanDays = INITIAL_VISIBLE_DAYS): TimelineWindow {
  const half = Math.floor(spanDays / 2);
  const monday = getWeekMonday(focusDate);
  return {
    start: addDays(monday, -Math.floor(half / 7) * 7),
    end: addDays(monday, spanDays - 1),
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
  const col = columns.find((c) => c.dateStr === dateStr)
    ?? columns.find((c) => c.dateStr >= dateStr)
    ?? columns[columns.length - 1];

  if (!col) return 0;

  const target = center
    ? col.left + col.width / 2 - el.clientWidth / 2
    : col.left;

  return Math.max(0, Math.min(target, Math.max(0, totalWidth - el.clientWidth)));
}

export function useHorizontalTimelineWindow(initialFocusDate = CURRENT_DATE_STRING) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingScrollLeftRef = useRef<number | null>(null);
  const pendingPrependAdjustRef = useRef(0);
  const scrollThrottleRef = useRef(0);
  const [focusDate, setFocusDate] = useState(initialFocusDate);
  const [windowRange, setWindowRange] = useState<TimelineWindow>(() =>
    clampWindow(...Object.values(centeredWindow(initialFocusDate)) as [string, string]),
  );

  // Apply pending scroll after DOM updates (prepend width adjust or focus scroll).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (pendingPrependAdjustRef.current !== 0) {
      el.scrollLeft += pendingPrependAdjustRef.current;
      pendingPrependAdjustRef.current = 0;
    }

    if (pendingScrollLeftRef.current !== null) {
      el.scrollLeft = pendingScrollLeftRef.current;
      pendingScrollLeftRef.current = null;
    }
  }, [windowRange.start, windowRange.end, focusDate]);

  const ensureDateInWindow = useCallback((dateStr: string, center: boolean) => {
    setWindowRange((current) => {
      const inWindow = dateStr >= current.start && dateStr <= current.end;
      let next = current;

      if (!inWindow) {
        next = clampWindow(...Object.values(centeredWindow(dateStr)) as [string, string]);
      } else {
        // Near first/last week → extend before scrolling.
        const firstWeekEnd = addDays(getWeekMonday(current.start), 6);
        const lastWeekStart = getWeekMonday(current.end);

        if (dateStr <= firstWeekEnd) {
          const nextStart = addDays(current.start, -LOAD_CHUNK_DAYS);
          if (daysBetween(nextStart, current.end) <= MAX_WINDOW_DAYS) {
            pendingPrependAdjustRef.current = windowWidthPx(nextStart, addDays(current.start, -1));
            next = clampWindow(nextStart, current.end);
          }
        } else if (dateStr >= lastWeekStart) {
          const nextEnd = addDays(current.end, LOAD_CHUNK_DAYS);
          if (daysBetween(current.start, nextEnd) <= MAX_WINDOW_DAYS) {
            next = clampWindow(current.start, nextEnd);
          }
        }
      }

      // Defer scroll until after layout with the (possibly new) window.
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollLeft = scrollLeftForDate(el, dateStr, next.start, next.end, center);
      });

      return next;
    });
  }, []);

  const focusOnDate = useCallback((dateStr: string) => {
    if (!dateStr) return;
    setFocusDate(dateStr);
    ensureDateInWindow(dateStr, true);
  }, [ensureDateInWindow]);

  const focusToday = useCallback(() => {
    focusOnDate(CURRENT_DATE_STRING);
  }, [focusOnDate]);

  const scrollByWeeks = useCallback((weeks: number) => {
    const el = scrollRef.current;
    if (!el || weeks === 0) return;

    const deltaPx = weeks * weekWidthPx();
    const nextScroll = el.scrollLeft + deltaPx;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);

    // Extending at edges when trying to move past loaded content.
    if (weeks < 0 && el.scrollLeft <= SCROLL_EDGE_THRESHOLD_PX) {
      setWindowRange((current) => {
        const nextStart = addDays(current.start, -LOAD_CHUNK_DAYS);
        if (daysBetween(nextStart, current.end) > MAX_WINDOW_DAYS) return current;
        pendingPrependAdjustRef.current = windowWidthPx(nextStart, addDays(current.start, -1));
        pendingScrollLeftRef.current = Math.max(0, el.scrollLeft + deltaPx + pendingPrependAdjustRef.current);
        // pendingScrollLeft already includes prepend adjust; clear double-apply
        const prepend = pendingPrependAdjustRef.current;
        pendingScrollLeftRef.current = Math.max(0, el.scrollLeft + deltaPx + prepend);
        pendingPrependAdjustRef.current = prepend;
        pendingScrollLeftRef.current = null; // use prepend adjust + scroll in rAF
        requestAnimationFrame(() => {
          const node = scrollRef.current;
          if (!node) return;
          node.scrollLeft = Math.max(0, node.scrollLeft + deltaPx);
        });
        return clampWindow(nextStart, current.end);
      });
      return;
    }

    if (weeks > 0 && el.scrollLeft >= maxScroll - SCROLL_EDGE_THRESHOLD_PX) {
      setWindowRange((current) => {
        const nextEnd = addDays(current.end, LOAD_CHUNK_DAYS);
        if (daysBetween(current.start, nextEnd) > MAX_WINDOW_DAYS) return current;
        requestAnimationFrame(() => {
          const node = scrollRef.current;
          if (!node) return;
          node.scrollLeft = Math.min(
            node.scrollLeft + deltaPx,
            Math.max(0, node.scrollWidth - node.clientWidth),
          );
        });
        return clampWindow(current.start, nextEnd);
      });
      return;
    }

    el.scrollLeft = Math.max(0, Math.min(nextScroll, maxScroll));
  }, []);

  const extendEnd = useCallback(() => {
    setWindowRange((current) => {
      const nextEnd = addDays(current.end, LOAD_CHUNK_DAYS);
      if (daysBetween(current.start, nextEnd) > MAX_WINDOW_DAYS) {
        return clampWindow(current.start, addDays(current.start, MAX_WINDOW_DAYS));
      }
      return clampWindow(current.start, nextEnd);
    });
  }, []);

  const extendStart = useCallback(() => {
    setWindowRange((current) => {
      const nextStart = addDays(current.start, -LOAD_CHUNK_DAYS);
      if (daysBetween(nextStart, current.end) > MAX_WINDOW_DAYS) {
        return current;
      }
      pendingPrependAdjustRef.current = windowWidthPx(nextStart, addDays(current.start, -1));
      return clampWindow(nextStart, current.end);
    });
  }, []);

  const handleScroll = useCallback(() => {
    const now = Date.now();
    if (now - scrollThrottleRef.current < 200) return;
    scrollThrottleRef.current = now;

    const el = scrollRef.current;
    if (!el) return;

    const nearRight =
      el.scrollLeft + el.clientWidth >= el.scrollWidth - weekWidthPx();
    const nearLeft = el.scrollLeft <= weekWidthPx();

    if (nearRight) {
      extendEnd();
    }
    if (nearLeft && el.scrollLeft >= 0) {
      // Only extend when already scrolled (or pinned at start while navigating).
      if (el.scrollWidth > el.clientWidth || el.scrollLeft <= SCROLL_EDGE_THRESHOLD_PX) {
        extendStart();
      }
    }
  }, [extendEnd, extendStart]);

  // Initial center on focus date once mounted.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = scrollLeftForDate(
      el,
      initialFocusDate,
      windowRange.start,
      windowRange.end,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initial focus
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
    weekWidthPx: weekWidthPx(),
  };
}
