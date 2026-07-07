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

export function buildDateRange(startStr: string, endStr: string, maxDays = 366): TimelineDay[] {
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
