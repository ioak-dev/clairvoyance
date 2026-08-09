import { env } from '../shared/env';
import { http } from '../shared/http';
import type { ScheduleAuditReportRow } from '../../types/api';

export interface ScheduleAuditReportParams {
  projectIds?: string[];
  personIds?: string[];
  changedFrom?: string;
  changedTo?: string;
}

export const scheduleAuditService = {
  async list(params: ScheduleAuditReportParams): Promise<ScheduleAuditReportRow[]> {
    return http.post<ScheduleAuditReportRow[]>(`${env.postgrestUrl}/rpc/schedule_audit_report`, {
      p_project_ids: params.projectIds && params.projectIds.length > 0 ? params.projectIds : null,
      p_person_ids: params.personIds && params.personIds.length > 0 ? params.personIds : null,
      p_changed_from: params.changedFrom || null,
      p_changed_to: params.changedTo || null,
    });
  },
};