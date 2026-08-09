import { env } from '../shared/env';
import { http } from '../shared/http';
import { isoWeekToDateRange } from '../weekUtils';
import type { BillableType, BookingCommitmentType, ScheduleAssignment, WeekAllocation } from '../../types';
import { type ScheduleRow, toScheduleAssignment } from '../../types/api';

const baseUrl = `${env.postgrestUrl}/schedule`;
const weekSelect = 'schedule_week(id,schedule_id,person_id,project_id,iso_year,iso_week,days_per_week)';
const headerSelect = `*,${weekSelect}`;

export interface UpsertScheduleRangeParams {
  personId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  daysPerWeek: number;
  billableType?: BillableType;
  bookingType?: BookingCommitmentType;
  requestId?: string | null;
}

function assignmentOverlapsRange(assignment: ScheduleAssignment, startDate: string, endDate: string): boolean {
  return assignment.weeks.some((w) => {
    const range = isoWeekToDateRange(w.isoYear, w.isoWeek);
    return range.start <= endDate && range.end >= startDate;
  });
}

export const schedulesService = {
  async list(): Promise<ScheduleAssignment[]> {
    const rows = await http.get<ScheduleRow[]>(`${baseUrl}?select=${encodeURIComponent(headerSelect)}&limit=1000000`);
    return rows.map(toScheduleAssignment);
  },

  async listInDateRange(startDate: string, endDate: string): Promise<ScheduleAssignment[]> {
    const all = await this.list();
    return all.filter((s) => assignmentOverlapsRange(s, startDate, endDate));
  },

  async upsertRange(params: UpsertScheduleRangeParams): Promise<string> {
    return http.post<string>(`${env.postgrestUrl}/rpc/upsert_schedule_range`, {
      p_person_id: params.personId,
      p_project_id: params.projectId,
      p_start_date: params.startDate,
      p_end_date: params.endDate,
      p_days_per_week: params.daysPerWeek,
      p_billable_type: params.billableType ?? 'Billable',
      p_booking_type: params.bookingType ?? 'hard',
      p_request_id: params.requestId ?? null,
    });
  },

  async upsertWeeks(scheduleId: string, weeks: WeekAllocation[]): Promise<number> {
    return http.post<number>(`${env.postgrestUrl}/rpc/upsert_schedule_weeks`, {
      p_schedule_id: scheduleId,
      p_weeks: weeks.map((w) => ({
        iso_year: w.isoYear,
        iso_week: w.isoWeek,
        days_per_week: w.daysPerWeek,
      })),
    });
  },

  async deleteWeeksInRange(scheduleId: string, startDate: string, endDate: string): Promise<number> {
    return http.post<number>(`${env.postgrestUrl}/rpc/delete_schedule_weeks_in_range`, {
      p_schedule_id: scheduleId,
      p_start_date: startDate,
      p_end_date: endDate,
    });
  },

  async copyRequestToSchedule(requestId: string, personId: string): Promise<string> {
    return http.post<string>(`${env.postgrestUrl}/rpc/copy_request_to_schedule`, {
      p_request_id: requestId,
      p_person_id: personId,
    });
  },

  async delete(scheduleId: string): Promise<void> {
    await http.delete<void>(`${baseUrl}?id=eq.${encodeURIComponent(scheduleId)}`);
  },

  async deleteByRequestId(requestId: string): Promise<void> {
    await http.delete<void>(`${baseUrl}?request_id=eq.${encodeURIComponent(requestId)}`);
  },
};
