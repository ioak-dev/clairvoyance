import { env } from '../shared/env';
import { http } from '../shared/http';
import type {
  BillableType,
  BookingCommitmentType,
  Roster,
  ScheduleAssignment,
  ScheduleUnit,
} from '../../types';
import { type ScheduleRow, toScheduleAssignment } from '../../types/api';

const baseUrl = `${env.postgrestUrl}/schedule`;

/** PostgREST URL length safety — beyond this, fall back to date-only server filter. */
const MAX_IN_FILTER_IDS = 200;

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

export interface ListSchedulesInRangeParams {
  startDate: string;
  endDate: string;
  /** When set (including empty), restricts to these people. Empty → no rows. */
  resourceIds?: string[];
  /** When set (including empty), restricts to these projects. Empty → no rows. */
  projectIds?: string[];
}

export type ScheduleRangeResult = { ids: string[] };

function buildInFilter(column: string, ids: string[]): string {
  return `${column}=in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`;
}

export const schedulesService = {
  async list(): Promise<ScheduleAssignment[]> {
    const rows = await http.get<ScheduleRow[]>(`${baseUrl}?select=*&limit=1000000`);
    return rows.map(toScheduleAssignment);
  },

  /** All schedules for one person + project (edit-modal sibling clamps). */
  async listByPersonAndProject(
    personId: string,
    projectId: string,
  ): Promise<ScheduleAssignment[]> {
    if (!personId || !projectId) return [];
    const rows = await http.get<ScheduleRow[]>(
      `${baseUrl}?select=*&person_id=eq.${encodeURIComponent(personId)}&project_id=eq.${encodeURIComponent(projectId)}&limit=100000`,
    );
    return rows.map(toScheduleAssignment);
  },

  /**
   * Load schedules overlapping [startDate, endDate], optionally scoped to people and/or projects.
   * Overlap: end_date >= startDate AND start_date <= endDate.
   */
  async listInDateRange(params: ListSchedulesInRangeParams): Promise<ScheduleAssignment[]> {
    const { startDate, endDate, resourceIds, projectIds } = params;
    if (!startDate || !endDate || startDate > endDate) return [];

    if (resourceIds && resourceIds.length === 0) return [];
    if (projectIds && projectIds.length === 0) return [];

    const applyResourceFilter =
      resourceIds != null && resourceIds.length > 0 && resourceIds.length <= MAX_IN_FILTER_IDS;
    const applyProjectFilter =
      projectIds != null && projectIds.length > 0 && projectIds.length <= MAX_IN_FILTER_IDS;

    // Build URL manually so PostgREST `in.()` filters stay unencoded.
    const parts = [
      `select=*`,
      `and=(end_date.gte.${startDate},start_date.lte.${endDate})`,
      `limit=100000`,
    ];
    if (applyResourceFilter) parts.push(buildInFilter('person_id', resourceIds!));
    if (applyProjectFilter) parts.push(buildInFilter('project_id', projectIds!));

    const rows = await http.get<ScheduleRow[]>(`${baseUrl}?${parts.join('&')}`);
    let assignments = rows.map(toScheduleAssignment);

    // Client-side entity filter when ID lists were too large for the URL.
    if (resourceIds != null && resourceIds.length > MAX_IN_FILTER_IDS) {
      const allowed = new Set(resourceIds);
      assignments = assignments.filter((s) => allowed.has(s.resourceId));
    }
    if (projectIds != null && projectIds.length > MAX_IN_FILTER_IDS) {
      const allowed = new Set(projectIds);
      assignments = assignments.filter((s) => allowed.has(s.projectId));
    }

    return assignments;
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
