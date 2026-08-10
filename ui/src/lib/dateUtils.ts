/** Shared app reference date based on runtime local date. */
export const CURRENT_DATE_STRING = formatDateString(new Date());

/** Format a Date as YYYY-MM-DD in local time. */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDateString(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateString(date);
}

export function daysBetween(startStr: string, endStr: string): number {
  const start = parseDateString(startStr);
  const end = parseDateString(endStr);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export interface TimelineDay {
  dateStr: string;
  dayLabel: string;
  dayNum: number;
  isWeekend: boolean;
  monthName: string;
}

export function buildDateRange(startStr: string, endStr: string, maxDays = 730): TimelineDay[] {
  let start = parseDateString(startStr);
  let end = parseDateString(endStr);

  if (isNaN(start.getTime())) start = parseDateString('2026-06-01');
  if (isNaN(end.getTime())) end = parseDateString('2026-07-25');
  if (start > end) {
    const temp = start;
    start = end;
    end = temp;
  }

  if (daysBetween(formatDateString(start), formatDateString(end)) > maxDays) {
    end = parseDateString(addDays(formatDateString(start), maxDays));
  }

  const daysList: TimelineDay[] = [];
  const temp = new Date(start);
  const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  let loops = 0;
  while (temp <= end && loops < maxDays + 1) {
    loops++;
    const dateStr = formatDateString(temp);
    const dayOfWeek = temp.getDay();
    daysList.push({
      dateStr,
      dayLabel: labels[dayOfWeek],
      dayNum: temp.getDate(),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      monthName: temp.toLocaleString('default', { month: 'long', year: 'numeric' }),
    });
    temp.setDate(temp.getDate() + 1);
  }

  return daysList;
}

// ── Dashboard period helpers ──

export type DashboardPeriodMode = '30d' | '90d' | 'custom';

export type DashboardPeriod = {
  mode: DashboardPeriodMode;
  start: string;
  end: string;
  label: string;
};

/** Business days (Mon–Fri) inclusive between two ISO date strings. */
export function countWeekdays(startStr: string, endStr: string): number {
  const start = parseDateString(startStr);
  const end = parseDateString(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  const current = new Date(start);
  let loops = 0;
  while (current <= end && loops < 10000) {
    loops++;
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/** Clipped overlap weekdays between a range and a period window. */
export function countOverlapWeekdays(
  rangeStart: string,
  rangeEnd: string,
  periodStart: string,
  periodEnd: string,
): number {
  const rs = parseDateString(rangeStart);
  const re = parseDateString(rangeEnd);
  const ps = parseDateString(periodStart);
  const pe = parseDateString(periodEnd);
  if (isNaN(rs.getTime()) || isNaN(re.getTime()) || isNaN(ps.getTime()) || isNaN(pe.getTime())) {
    return 0;
  }

  const overlapStart = rs > ps ? rs : ps;
  const overlapEnd = re < pe ? re : pe;
  if (overlapStart > overlapEnd) return 0;

  return countWeekdays(formatDateString(overlapStart), formatDateString(overlapEnd));
}

function formatShortDate(dateStr: string): string {
  const d = parseDateString(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getDashboardPeriod(
  mode: DashboardPeriodMode,
  referenceDate: string = CURRENT_DATE_STRING,
  customStart?: string,
  customEnd?: string,
): DashboardPeriod {
  if (mode === 'custom' && customStart && customEnd) {
    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    return {
      mode,
      start,
      end,
      label: `${formatShortDate(start)} – ${formatShortDate(end)}`,
    };
  }

  const days = mode === '90d' ? 89 : 29;
  const start = addDays(referenceDate, -days);
  const label =
    mode === '90d'
      ? `Last 90 days ending ${formatShortDate(referenceDate)}`
      : `Last 30 days ending ${formatShortDate(referenceDate)}`;

  return { mode, start, end: referenceDate, label };
}

/** ISO week key (Monday-based) for bucketing. */
export function getWeekKey(dateStr: string): string {
  const d = parseDateString(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return formatDateString(monday);
}

export function isDateInRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}
