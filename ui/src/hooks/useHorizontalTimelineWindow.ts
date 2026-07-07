import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, daysBetween } from '../lib/dateUtils';

const INITIAL_VISIBLE_DAYS = 42;
const LOAD_CHUNK_DAYS = 28;
const SCROLL_EDGE_THRESHOLD_PX = 240;
const MAX_WINDOW_DAYS = 366;

interface TimelineWindow {
  start: string;
  end: string;
}

function clampWindow(start: string, end: string, maxEnd?: string): TimelineWindow {
  let windowStart = start;
  let windowEnd = end;

  if (maxEnd && windowEnd > maxEnd) {
    windowEnd = maxEnd;
  }

  if (daysBetween(windowStart, windowEnd) > MAX_WINDOW_DAYS) {
    windowEnd = addDays(windowStart, MAX_WINDOW_DAYS);
  }

  if (windowStart > windowEnd) {
    windowEnd = windowStart;
  }

  return { start: windowStart, end: windowEnd };
}

export function useHorizontalTimelineWindow(
  anchorStartDate: string,
  maxEndDate?: string,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingPrependRef = useRef(0);
  const scrollThrottleRef = useRef(0);
  const [windowRange, setWindowRange] = useState<TimelineWindow>(() =>
    clampWindow(
      anchorStartDate,
      addDays(anchorStartDate, INITIAL_VISIBLE_DAYS - 1),
      maxEndDate,
    ),
  );

  useEffect(() => {
    setWindowRange(
      clampWindow(
        anchorStartDate,
        addDays(anchorStartDate, INITIAL_VISIBLE_DAYS - 1),
        maxEndDate,
      ),
    );
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [anchorStartDate, maxEndDate]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || pendingPrependRef.current <= 0) return;

    el.scrollLeft += pendingPrependRef.current;
    pendingPrependRef.current = 0;
  }, [windowRange.start]);

  const extendEnd = useCallback(() => {
    setWindowRange((current) => {
      const nextEnd = addDays(current.end, LOAD_CHUNK_DAYS);
      if (maxEndDate && nextEnd >= maxEndDate) {
        if (current.end >= maxEndDate) return current;
        return clampWindow(current.start, maxEndDate, maxEndDate);
      }
      if (daysBetween(current.start, nextEnd) > MAX_WINDOW_DAYS) {
        return clampWindow(current.start, addDays(current.start, MAX_WINDOW_DAYS), maxEndDate);
      }
      return { start: current.start, end: nextEnd };
    });
  }, [maxEndDate]);

  const extendStart = useCallback((colWidth: number) => {
    setWindowRange((current) => {
      const nextStart = addDays(current.start, -LOAD_CHUNK_DAYS);
      if (daysBetween(nextStart, current.end) > MAX_WINDOW_DAYS) {
        return current;
      }
      pendingPrependRef.current = LOAD_CHUNK_DAYS * colWidth;
      return clampWindow(nextStart, current.end, maxEndDate);
    });
  }, [maxEndDate]);

  const handleScroll = useCallback(
    (colWidth: number) => {
      const now = Date.now();
      if (now - scrollThrottleRef.current < 250) return;
      scrollThrottleRef.current = now;

      const el = scrollRef.current;
      if (!el) return;

      const nearRight =
        el.scrollLeft + el.clientWidth >= el.scrollWidth - SCROLL_EDGE_THRESHOLD_PX;
      const nearLeft = el.scrollLeft <= SCROLL_EDGE_THRESHOLD_PX;

      if (nearRight) {
        const atMaxEnd = maxEndDate ? windowRange.end >= maxEndDate : false;
        const atMaxSpan = daysBetween(windowRange.start, windowRange.end) >= MAX_WINDOW_DAYS;
        if (!atMaxEnd && !atMaxSpan) {
          extendEnd();
        }
      }

      if (nearLeft && el.scrollLeft > 10) {
        extendStart(colWidth);
      }
    },
    [anchorStartDate, extendEnd, extendStart, maxEndDate, windowRange.end, windowRange.start],
  );

  return {
    scrollRef,
    windowStart: windowRange.start,
    windowEnd: windowRange.end,
    handleScroll,
  };
}
