import { env } from '../shared/env';
import { http } from '../shared/http';
import type { AvailabilityMode, PersonUtilizationResult } from '../../types';
import { toPersonUtilizationResult, type PersonUtilizationSearchRow } from '../../types/api';

export interface PersonUtilizationSearchParams {
  from: string;
  to: string;
  availability?: AvailabilityMode;
  /** Required days per week from request weeks. */
  requiredDays?: number;
  consultingUnitId?: string | null;
  practiceAreaId?: string | null;
  competencyCenterId?: string | null;
  siteId?: string | null;
  jobCategory?: string | null;
  name?: string | null;
}

export const personUtilizationService = {
  async search(params: PersonUtilizationSearchParams): Promise<PersonUtilizationResult[]> {
    const rows = await http.post<PersonUtilizationSearchRow[]>(
      `${env.postgrestUrl}/rpc/person_utilization_search`,
      {
        p_from: params.from,
        p_to: params.to,
        p_availability: params.availability || 'everyone',
        p_required_days: params.requiredDays ?? 5,
        p_consulting_unit_id: params.consultingUnitId || null,
        p_practice_area_id: params.practiceAreaId || null,
        p_competency_center_id: params.competencyCenterId || null,
        p_site_id: params.siteId || null,
        p_job_category: params.jobCategory || null,
        p_name: params.name || null,
      },
    );

    return rows.map(toPersonUtilizationResult);
  },
};
