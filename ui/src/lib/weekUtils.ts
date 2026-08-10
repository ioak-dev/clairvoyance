import type { WeekKey } from '../types';
import { addDays, buildDateRange, formatDateString, parseDateString } from './dateUtils';

export interface TimelineWeek {
  isoYear: number;
  isoWeek: number;
  weekStart: string;
  weekEnd: string;
  label: string;
  monthName: string;
}

export function weekKeyEquals(a: WeekKey, b: WeekKey): boolean {
  return a.isoYear === b.isoYear && a.isoWeek === b.isoWeek;
}

export function weekKeySort(a: WeekKey, b: WeekKey): number {
  if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
  return a.isoWeek - b.isoWeek;
}

/** ISO 8601 week (Monday start). */
export function getIsoWeekKey(dateStr: string): WeekKey {
  const date = parseDateString(dateStr);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { isoYear, isoWeek };
}

/** Monday of the ISO week containing dateStr. */
export function getWeekMonday(dateStr: string): string {
  const date = parseDateString(dateStr);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDateString(date);
}

export function isoWeekToDateRange(isoYear: number, isoWeek: number): { start: string; end: string } {
  const jan4 = parseDateString(`${isoYear}-01-04`);
  const jan4Day = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (isoWeek - 1) * 7);
  const start = formatDateString(monday);
  return { start, end: addDays(start, 6) };
}

export function dateRangeToWeeks(startDate: string, endDate: string): WeekKey[] {
  let start = startDate;
  let end = endDate;
  if (start > end) [start, end] = [end, start];

  const weeks: WeekKey[] = [];
  const seen = new Set<string>();
  let cursor = getWeekMonday(start);
  const endMonday = getWeekMonday(end);

  while (cursor <= endMonday) {
    const key = getIsoWeekKey(cursor);
    const id = `${key.isoYear}-${key.isoWeek}`;
    if (!seen.has(id)) {
      seen.add(id);
      weeks.push(key);
    }
    cursor = addDays(cursor, 7);
  }

  return weeks.sort(weekKeySort);
}

export function weekKeysToDateRange(weeks: WeekKey[]): { start: string; end: string } | null {
  if (weeks.length === 0) return null;
  const sorted = [...weeks].sort(weekKeySort);
  const first = isoWeekToDateRange(sorted[0].isoYear, sorted[0].isoWeek);
  const last = isoWeekToDateRange(sorted[sorted.length - 1].isoYear, sorted[sorted.length - 1].isoWeek);
  return { start: first.start, end: last.end };
}

export function buildWeekTimeline(startDate: string, endDate: string, maxWeeks = 104): TimelineWeek[] {
  const weekKeys = dateRangeToWeeks(startDate, endDate).slice(0, maxWeeks);
  return weekKeys.map((key) => {
    const { start, end } = isoWeekToDateRange(key.isoYear, key.isoWeek);
    const monthDate = parseDateString(start);
    return {
      isoYear: key.isoYear,
      isoWeek: key.isoWeek,
      weekStart: start,
      weekEnd: end,
      label: `W${String(key.isoWeek).padStart(2, '0')}`,
      monthName: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
    };
  });
}

/** Pixel layout for day-column scheduler (weekdays wide, weekends narrow). */
export interface DayColumnLayout {
  dateStr: string;
  dayLabel: string;
  dayNum: number;
  isWeekend: boolean;
  monthName: string;
  left: number;
  width: number;
}

export function buildDayColumnLayout(
  startDate: string,
  endDate: string,
  weekdayWidth = 52,
  weekendWidth = 28,
): { columns: DayColumnLayout[]; totalWidth: number } {
  const days = buildDateRange(startDate, endDate, 730);
  let left = 0;
  const columns: DayColumnLayout[] = days.map((day) => {
    const width = day.isWeekend ? weekendWidth : weekdayWidth;
    const col: DayColumnLayout = {
      dateStr: day.dateStr,
      dayLabel: day.dayLabel,
      dayNum: day.dayNum,
      isWeekend: day.isWeekend,
      monthName: day.monthName,
      left,
      width,
    };
    left += width;
    return col;
  });
  return { columns, totalWidth: left };
}

/** First index with `dateStr >= date`, or `columns.length` if none. */
export function lowerBoundColumnIndex(columns: DayColumnLayout[], date: string): number {
  let lo = 0;
  let hi = columns.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (columns[mid].dateStr < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Last index with `dateStr <= date`, or `-1` if none. */
export function upperBoundColumnIndex(columns: DayColumnLayout[], date: string): number {
  let lo = 0;
  let hi = columns.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (columns[mid].dateStr <= date) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** Exact `dateStr → column index` map (O(1) lookup when dates are in-window). */
export function buildDateColumnIndex(columns: DayColumnLayout[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < columns.length; i++) {
    map.set(columns[i].dateStr, i);
  }
  return map;
}

/** First column whose right edge is past `x`, or last column if `x` is beyond the end. */
export function columnIndexAtOffset(columns: DayColumnLayout[], x: number): number {
  if (columns.length === 0) return -1;
  let lo = 0;
  let hi = columns.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (columns[mid].left + columns[mid].width <= x) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, columns.length - 1);
}

/** Last index with `left < x`, or `-1` if none. */
function lastColumnIndexBefore(columns: DayColumnLayout[], x: number): number {
  let lo = 0;
  let hi = columns.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (columns[mid].left < x) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/**
 * Inclusive column index range overlapping `[rangeStartPx, rangeEndPx)` in timeline coords.
 * Returns null when empty / no overlap.
 */
export function visibleColumnIndexRange(
  columns: DayColumnLayout[],
  rangeStartPx: number,
  rangeEndPx: number,
): { startIndex: number; endIndex: number } | null {
  if (columns.length === 0 || rangeEndPx <= rangeStartPx) return null;
  const startIndex = columnIndexAtOffset(columns, rangeStartPx);
  const endIndex = lastColumnIndexBefore(columns, rangeEndPx);
  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) return null;
  return { startIndex, endIndex };
}

export function getDateRangeBounds(
  columns: DayColumnLayout[],
  startDate: string,
  endDate: string,
  dateIndex?: Map<string, number> | null,
): { left: number; width: number } | null {
  if (columns.length === 0) return null;

  let startIdx = dateIndex?.get(startDate);
  if (startIdx === undefined) startIdx = lowerBoundColumnIndex(columns, startDate);

  let endIdx = dateIndex?.get(endDate);
  if (endIdx === undefined) endIdx = upperBoundColumnIndex(columns, endDate);

  if (startIdx >= columns.length || endIdx < 0 || startIdx > endIdx) return null;

  const startCol = columns[startIdx];
  const endCol = columns[endIdx];
  if (startCol.left > endCol.left + endCol.width) return null;
  return {
    left: startCol.left,
    width: endCol.left + endCol.width - startCol.left,
  };
}

/** Pixel width of one Mon–Sun week with weekday/weekend column sizes. */
export function weekPatternWidthPx(weekdayWidth = 52, weekendWidth = 28): number {
  return 5 * weekdayWidth + 2 * weekendWidth;
}

/**
 * Horizontal offset so a Mon-aligned week chrome pattern lines up when
 * `windowStart` is not Monday (e.g. after a non-7-day edge slide).
 */
export function weekPatternOffsetPx(
  windowStart: string,
  weekdayWidth = 52,
  weekendWidth = 28,
): number {
  const dow = parseDateString(windowStart).getDay(); // 0=Sun … 6=Sat
  const mondayBased = (dow + 6) % 7; // Mon=0 … Sun=6
  let offset = 0;
  for (let i = 0; i < mondayBased; i++) {
    offset += i < 5 ? weekdayWidth : weekendWidth;
  }
  return offset;
}

/**
 * CSS background for scheduler day gridlines + weekend tint (no per-day DOM).
 * Pattern is Mon–Sun; use `backgroundPosition` offset from `weekPatternOffsetPx`.
 *
 * Use plain `linear-gradient` + `background-size`/`repeat-x` (not
 * `repeating-linear-gradient`). With repeating gradients the period is
 * lastStop − firstStop; our first border stop sits at weekdayWidth−1, so the
 * period becomes weekW−(w−1) and Sat/Sun lines ghost into every Monday.
 */
export function buildSchedulerDayChromeStyle(
  windowStart: string,
  weekdayWidth = 52,
  weekendWidth = 28,
): {
  backgroundImage: string;
  backgroundSize: string;
  backgroundRepeat: string;
  backgroundPosition: string;
} {
  const w = weekdayWidth;
  const e = weekendWidth;
  const weekW = weekPatternWidthPx(w, e);
  const offset = weekPatternOffsetPx(windowStart, w, e);

  // Right edges within a Mon-start week (matches former border-r on each day cell).
  const edges = [
    w,
    2 * w,
    3 * w,
    4 * w,
    5 * w,
    5 * w + e,
    weekW,
  ];

  const borderStops: string[] = ['transparent 0'];
  let prev = 0;
  for (const edge of edges) {
    if (prev > 0) borderStops.push(`transparent ${prev}px`);
    borderStops.push(`transparent ${edge - 1}px`);
    borderStops.push(`var(--app-border-subtle) ${edge - 1}px`);
    borderStops.push(`var(--app-border-subtle) ${edge}px`);
    prev = edge;
  }

  const weekendStart = 5 * w;
  // Non-repeating gradients: tiling comes only from background-size + repeat-x.
  const borders = `linear-gradient(to right, ${borderStops.join(', ')})`;
  const weekends = `linear-gradient(to right, transparent 0, transparent ${weekendStart}px, var(--app-weekend-cell) ${weekendStart}px, var(--app-weekend-cell) ${weekW}px)`;

  return {
    backgroundImage: `${borders}, ${weekends}`,
    backgroundSize: `${weekW}px 100%`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: `-${offset}px 0`,
  };
}

export function getIsoWeekWeekdayBounds(
  columns: DayColumnLayout[],
  isoYear: number,
  isoWeek: number,
): { left: number; width: number } | null {
  const { start: monday } = isoWeekToDateRange(isoYear, isoWeek);
  const friday = addDays(monday, 4);
  return getDateRangeBounds(columns, monday, friday);
}
