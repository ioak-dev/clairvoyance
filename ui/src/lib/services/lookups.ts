import { env } from '../shared/env';
import { http } from '../shared/http';
import type { LookupRow } from '../../types/api';

export interface Lookups {
  consultingUnits: LookupRow[];
  marketUnits: LookupRow[];
  practiceAreas: LookupRow[];
  sites: LookupRow[];
}

async function fetchLookup(table: string): Promise<LookupRow[]> {
  return http.get<LookupRow[]>(`${env.postgrestUrl}/${table}?select=id,name&order=name.asc`);
}

export const lookupsService = {
  async list(): Promise<Lookups> {
    const [consultingUnits, marketUnits, practiceAreas, sites] = await Promise.all([
      fetchLookup('consulting_unit'),
      fetchLookup('market_unit'),
      fetchLookup('practice_area'),
      fetchLookup('site'),
    ]);
    return { consultingUnits, marketUnits, practiceAreas, sites };
  },
};
