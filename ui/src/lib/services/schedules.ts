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
  billableType?: BillableType;
  bookingType?: BookingCommitmentType;
  requestId?: string | null;
}

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
        billable_type: params.billableType ?? 'Billable',
        booking_type: params.bookingType ?? 'hard',
        request_id: params.requestId ?? null,
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
