import type { AllocationBlock, BillableType, BookingCommitmentType, WeekAllocation, WeekKey } from '../types';
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

function nextWeekKey(key: WeekKey): WeekKey {
  const { end } = isoWeekToDateRange(key.isoYear, key.isoWeek);
  return getIsoWeekKey(addDays(end, 1));
}

export interface BlockSource {
  scheduleId: string;
  resourceId: string;
  projectId: string;
  requestId?: string;
  billableType: BillableType;
  bookingType: BookingCommitmentType;
  weeks: WeekAllocation[];
}

export function deriveAllocationBlocks(source: BlockSource): AllocationBlock[] {
  const sorted = [...source.weeks].sort((a, b) => weekKeySort(a, b));
  if (sorted.length === 0) return [];

  const blocks: AllocationBlock[] = [];
  let runStart = 0;

  for (let i = 1; i <= sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const sameDays = curr && curr.daysPerWeek === sorted[runStart].daysPerWeek;
    const consecutive = curr && weekKeyEquals(nextWeekKey(prev), curr);

    if (!curr || !sameDays || !consecutive) {
      const runWeeks = sorted.slice(runStart, i);
      const range = weekKeysToDateRange(runWeeks)!;
      blocks.push({
        scheduleId: source.scheduleId,
        resourceId: source.resourceId,
        projectId: source.projectId,
        requestId: source.requestId,
        billableType: source.billableType,
        bookingType: source.bookingType,
        startDate: range.start,
        endDate: range.end,
        weeks: runWeeks.map((w) => ({ isoYear: w.isoYear, isoWeek: w.isoWeek, daysPerWeek: w.daysPerWeek })),
        daysPerWeek: sorted[runStart].daysPerWeek,
      });
      runStart = i;
    }
  }

  return blocks;
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
  const days = buildDateRange(startDate, endDate);
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

export function getDateRangeBounds(
  columns: DayColumnLayout[],
  startDate: string,
  endDate: string,
): { left: number; width: number } | null {
  const startCol = columns.find((c) => c.dateStr >= startDate);
  const endCol = [...columns].reverse().find((c) => c.dateStr <= endDate);
  if (!startCol || !endCol || startCol.left > endCol.left + endCol.width) return null;
  return {
    left: startCol.left,
    width: endCol.left + endCol.width - startCol.left,
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

export function maxDaysPerWeek(weeks: WeekAllocation[]): number {
  if (weeks.length === 0) return 0;
  return Math.max(...weeks.map((w) => w.daysPerWeek));
}

export function avgDaysPerWeek(weeks: WeekAllocation[]): number {
  if (weeks.length === 0) return 0;
  return weeks.reduce((sum, w) => sum + w.daysPerWeek, 0) / weeks.length;
}
