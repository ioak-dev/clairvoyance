import { env } from '../shared/env';
import { http } from '../shared/http';
import { datesOverlap } from '../rosterUtils';
import type {
  BillableType,
  BookingCommitmentType,
  Roster,
  ScheduleAssignment,
  ScheduleUnit,
} from '../../types';
import { type ScheduleRow, toScheduleAssignment } from '../../types/api';

const baseUrl = `${env.postgrestUrl}/schedule`;

export interface UpsertScheduleParams {
  id?: string;
  title?: string | null;
  personId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  unit: ScheduleUnit;
  roster: Roster;
  billableType?: BillableType | null;
  bookingType?: BookingCommitmentType;
  requestId?: string | null;
}

export interface ReplaceScheduleRangeParams {
  id: string;
  rangeStart: string;
  rangeEnd: string;
  unit: ScheduleUnit;
  roster: Roster;
  title?: string | null;
}

export interface SplitScheduleParams {
  id: string;
  splitDate: string;
}

export type ScheduleRangeResult = { ids: string[] };

export const schedulesService = {
  async list(): Promise<ScheduleAssignment[]> {
    const rows = await http.get<ScheduleRow[]>(`${baseUrl}?select=*&limit=1000000`);
    return rows.map(toScheduleAssignment);
  },

  async listInDateRange(startDate: string, endDate: string): Promise<ScheduleAssignment[]> {
    const all = await this.list();
    return all.filter((s) => datesOverlap(s.startDate, s.endDate, startDate, endDate));
  },

  async upsert(params: UpsertScheduleParams): Promise<string> {
    return http.post<string>(`${env.postgrestUrl}/rpc/upsert_schedule`, {
      p_payload: {
        id: params.id ?? null,
        title: params.title ?? null,
        person_id: params.personId,
        project_id: params.projectId,
        start: params.startDate,
        end: params.endDate,
        unit: params.unit,
        roster: params.roster,
        billable_type: params.billableType ?? null,
        booking_type: params.bookingType ?? 'hard',
        request_id: params.requestId ?? null,
      },
    });
  },

  async replaceRange(params: ReplaceScheduleRangeParams): Promise<ScheduleRangeResult> {
    return http.post<ScheduleRangeResult>(`${env.postgrestUrl}/rpc/replace_schedule_range`, {
      p_payload: {
        id: params.id,
        range_start: params.rangeStart,
        range_end: params.rangeEnd,
        unit: params.unit,
        roster: params.roster,
        title: params.title ?? null,
      },
    });
  },

  async split(params: SplitScheduleParams): Promise<ScheduleRangeResult> {
    return http.post<ScheduleRangeResult>(`${env.postgrestUrl}/rpc/split_schedule`, {
      p_payload: {
        id: params.id,
        split_date: params.splitDate,
      },
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
