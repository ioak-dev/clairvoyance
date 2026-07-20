import { env } from '../shared/env';
import { http } from '../shared/http';
import type { LookupRow } from '../../types/api';

export interface CompetencyCenterLookupRow extends LookupRow {
  practice_area_id: string;
  practice_area?: LookupRow | null;
}

export interface Lookups {
  consultingUnits: LookupRow[];
  competencyCenters: CompetencyCenterLookupRow[];
  marketUnits: LookupRow[];
  practiceAreas: LookupRow[];
  sites: LookupRow[];
}

async function fetchLookup(table: string): Promise<LookupRow[]> {
  return http.get<LookupRow[]>(`${env.postgrestUrl}/${table}?select=id,name&order=name.asc`);
}

async function fetchCompetencyCenters(): Promise<CompetencyCenterLookupRow[]> {
  return http.get<CompetencyCenterLookupRow[]>(
    `${env.postgrestUrl}/competency_center?select=id,name,practice_area_id,practice_area(id,name)&order=name.asc`,
  );
}

export const lookupsService = {
  async list(): Promise<Lookups> {
    const [consultingUnits, competencyCenters, marketUnits, practiceAreas, sites] = await Promise.all([
      fetchLookup('consulting_unit'),
      fetchCompetencyCenters(),
      fetchLookup('market_unit'),
      fetchLookup('practice_area'),
      fetchLookup('site'),
    ]);
    return { consultingUnits, competencyCenters, marketUnits, practiceAreas, sites };
  },
};
