import { env } from '../shared/env';
import { http } from '../shared/http';
import type { LookupRow } from '../../types/api';

export interface CompetencyCenterLookupRow extends LookupRow {
  practice_area_id: string;
  practice_area?: LookupRow | null;
}

export interface JobLevelLookupRow extends LookupRow {}

interface JobLevelRow {
  id: string;
  level_code: string;
  level_name: string;
}

export interface Lookups {
  consultingUnits: LookupRow[];
  competencyCenters: CompetencyCenterLookupRow[];
  jobLevels: JobLevelLookupRow[];
  marketUnits: LookupRow[];
  practiceAreas: LookupRow[];
  sites: LookupRow[];
}

async function fetchLookup(table: string): Promise<LookupRow[]> {
  return http.get<LookupRow[]>(`${env.postgrestUrl}/${table}?select=id,name&order=name.asc&limit=1000000`);
}

async function fetchCompetencyCenters(): Promise<CompetencyCenterLookupRow[]> {
  return http.get<CompetencyCenterLookupRow[]>(
    `${env.postgrestUrl}/competency_center?select=id,name,practice_area_id,practice_area(id,name)&order=name.asc&limit=1000000`,
  );
}

async function fetchJobLevels(): Promise<JobLevelLookupRow[]> {
  const rows = await http.get<JobLevelRow[]>(
    `${env.postgrestUrl}/job_level?select=id,level_code,level_name&order=level_code.asc&limit=1000000`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.level_code,
  }));
}

export const lookupsService = {
  async list(): Promise<Lookups> {
    const [consultingUnits, competencyCenters, jobLevels, marketUnits, practiceAreas, sites] = await Promise.all([
      fetchLookup('consulting_unit'),
      fetchCompetencyCenters(),
      fetchJobLevels(),
      fetchLookup('market_unit'),
      fetchLookup('practice_area'),
      fetchLookup('site'),
    ]);
    return { consultingUnits, competencyCenters, jobLevels, marketUnits, practiceAreas, sites };
  },
};
