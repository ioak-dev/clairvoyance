import type {
  AllocationBlock,
  Roster,
  ScheduleAssignment,
  ScheduleUnit,
} from '../types';
import { DEFAULT_ROSTER } from '../types';
import { addDays, formatDateString, parseDateString } from './dateUtils';
import { getIsoWeekKey } from './weekUtils';

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** ISO weekday index: Mon=0 … Sun=6. */
export function isoWeekdayIndex(dateStr: string): number {
  // Local noon avoids DST edge cases; getDay is cheap enough for per-day loops.
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

export function normalizeRoster(raw: unknown): Roster {
  if (!Array.isArray(raw) || raw.length !== 7) return [...DEFAULT_ROSTER] as Roster;
  return raw.map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }) as Roster;
}

export function personDailyCapacityHours(weeklyHours?: number | null, fte?: number | null): number {
  return Math.max(0, (weeklyHours ?? 40) / 5 * (fte ?? 1));
}

export function rosterSlotHours(
  unit: ScheduleUnit,
  raw: number,
  dailyCapacity: number,
): number {
  if (unit === 'hours') return raw;
  return raw * dailyCapacity;
}

export function blockHoursOnDate(
  block: Pick<ScheduleAssignment, 'startDate' | 'endDate' | 'unit' | 'roster'>,
  dateStr: string,
  dailyCapacity: number,
): number {
  if (dateStr < block.startDate || dateStr > block.endDate) return 0;
  const idx = isoWeekdayIndex(dateStr);
  return rosterSlotHours(block.unit, block.roster[idx] ?? 0, dailyCapacity);
}

export function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

export function assignmentToBlock(assignment: ScheduleAssignment): AllocationBlock {
  return {
    scheduleId: assignment.id,
    title: assignment.title,
    resourceId: assignment.resourceId,
    projectId: assignment.projectId,
    requestId: assignment.requestId,
    billableType: assignment.billableType,
    bookingType: assignment.bookingType,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    unit: assignment.unit,
    roster: assignment.roster,
  };
}

/** Sum hours per day for a resource from overlapping blocks. */
export function buildDailyTotals(
  blocks: Array<Pick<ScheduleAssignment, 'startDate' | 'endDate' | 'unit' | 'roster'>>,
  startDate: string,
  endDate: string,
  dailyCapacity: number,
): Map<string, number> {
  const totals = new Map<string, number>();
  if (blocks.length === 0 || startDate > endDate) return totals;

  // Walk each block's overlap with the window (avoids O(days × blocks) zero checks).
  for (const block of blocks) {
    const from = block.startDate > startDate ? block.startDate : startDate;
    const to = block.endDate < endDate ? block.endDate : endDate;
    if (from > to) continue;

    let cursor = from;
    while (cursor <= to) {
      const hours = blockHoursOnDate(block, cursor, dailyCapacity);
      if (hours > 0) {
        totals.set(cursor, (totals.get(cursor) || 0) + hours);
      }
      cursor = addDays(cursor, 1);
    }
  }
  return totals;
}

export function rosterSummaryLabel(unit: ScheduleUnit, roster: Roster): string {
  const weekday = roster.slice(0, 5);
  const avg = weekday.reduce((s, v) => s + v, 0) / 5;
  if (unit === 'hours') {
    return `${avg.toFixed(1)}h/day`;
  }
  return `${Math.round(avg * 100)}%`;
}

/** Single weekday allocation value (Mon–Fri average). */
export function weekdayAllocationValue(roster: Roster): number {
  const weekdays = normalizeRoster(roster).slice(0, 5);
  if (weekdays.every((d) => d === weekdays[0])) return weekdays[0] ?? 0;
  const sum = weekdays.reduce((a, b) => a + b, 0);
  return Math.round((sum / 5) * 1000) / 1000;
}

/** Uniform Mon–Fri roster; weekends always 0. */
export function weekdayRoster(value: number): Roster {
  const v = Math.max(0, Number.isFinite(value) ? value : 0);
  return [v, v, v, v, v, 0, 0];
}

/** Count Mon–Fri dates inclusive in [startDate, endDate]. */
export function countWeekdaysInRange(startDate: string, endDate: string): number {
  if (!startDate || !endDate || startDate > endDate) return 0;
  let n = 0;
  for (const d of expandDates(startDate, endDate)) {
    if (isoWeekdayIndex(d) < 5) n += 1;
  }
  return n;
}

/** Monday of the ISO week containing dateStr. */
export function getWeekMonday(dateStr: string): string {
  const date = parseDateString(dateStr);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDateString(date);
}

export function expandDates(startDate: string, endDate: string): string[] {
  let start = startDate;
  let end = endDate;
  if (start > end) [start, end] = [end, start];
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** One visual week chunk for the scheduler (typically Mon–Fri when weekends are 0). */
export interface WeekDisplaySegment {
  isoYear: number;
  isoWeek: number;
  /** First day in this week with roster > 0, clipped to the block. */
  startDate: string;
  /** Last day in this week with roster > 0, clipped to the block. */
  endDate: string;
  /** Count of active (roster > 0) days in this segment. */
  activeDays: number;
}

/**
 * Break a date-range schedule into one display segment per ISO week.
 * Days with roster[weekday] === 0 (e.g. Sat/Sun) are excluded, so weekends
 * create visual gaps between weekly bars.
 */
export function splitBlockIntoWeekSegments(
  block: Pick<ScheduleAssignment, 'startDate' | 'endDate' | 'roster'>,
): WeekDisplaySegment[] {
  if (!block.startDate || !block.endDate || block.startDate > block.endDate) return [];

  const roster = normalizeRoster(block.roster);
  const segments: WeekDisplaySegment[] = [];

  let weekMonday = getWeekMonday(block.startDate);
  const lastMonday = getWeekMonday(block.endDate);

  while (weekMonday <= lastMonday) {
    const weekSunday = addDays(weekMonday, 6);
    let segStart: string | null = null;
    let segEnd: string | null = null;
    let activeDays = 0;

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekMonday, i);
      if (day > weekSunday) break;
      if (day < block.startDate || day > block.endDate) continue;
      if ((roster[i] ?? 0) <= 0) continue;
      if (!segStart) segStart = day;
      segEnd = day;
      activeDays += 1;
    }

    if (segStart && segEnd && activeDays > 0) {
      const { isoYear, isoWeek } = getIsoWeekKey(weekMonday);
      segments.push({
        isoYear,
        isoWeek,
        startDate: segStart,
        endDate: segEnd,
        activeDays,
      });
    }

    weekMonday = addDays(weekMonday, 7);
  }

  return segments;
}

/** Week-scoped label like "50% · 5 days" for a roster pattern. */
export function weekSegmentLabel(unit: ScheduleUnit, roster: Roster, activeDays: number): string {
  const summary = rosterSummaryLabel(unit, roster);
  return `${summary} · ${activeDays} day${activeDays === 1 ? '' : 's'}`;
}

/**
 * Inclusive date bounds for resizing a schedule without overlapping another
 * allocation for the same person + project. Adjacent (touching) siblings are OK.
 */
export function scheduleSiblingDateBounds(
  block: Pick<AllocationBlock, 'scheduleId' | 'resourceId' | 'projectId' | 'startDate' | 'endDate'>,
  assignments: Array<Pick<ScheduleAssignment, 'id' | 'resourceId' | 'projectId' | 'startDate' | 'endDate'>>,
): { minStart: string | null; maxEnd: string | null } {
  let minStart: string | null = null;
  let maxEnd: string | null = null;

  for (const s of assignments) {
    if (s.id === block.scheduleId) continue;
    if (s.resourceId !== block.resourceId || s.projectId !== block.projectId) continue;

    // Sibling completely before this block (or ending on/after our start → treat as previous edge).
    if (s.endDate < block.startDate) {
      const candidate = addDays(s.endDate, 1);
      if (!minStart || candidate > minStart) minStart = candidate;
      continue;
    }
    // Sibling completely after this block.
    if (s.startDate > block.endDate) {
      const candidate = addDays(s.startDate, -1);
      if (!maxEnd || candidate < maxEnd) maxEnd = candidate;
      continue;
    }
    // Overlapping sibling (should be rare after DB guard): clamp away from it.
    if (s.startDate > block.startDate) {
      const candidate = addDays(s.startDate, -1);
      if (!maxEnd || candidate < maxEnd) maxEnd = candidate;
    }
    if (s.endDate < block.endDate) {
      const candidate = addDays(s.endDate, 1);
      if (!minStart || candidate > minStart) minStart = candidate;
    }
  }

  return { minStart, maxEnd };
}
