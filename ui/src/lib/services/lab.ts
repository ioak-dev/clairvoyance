import { env } from '../shared/env';
import { http } from '../shared/http';
import type { SimulationLogRow } from '../../types/api';

export interface LabPublishInput {
  type: string;
  payload: Record<string, unknown>[];
}

export interface LabPublishResult {
  simulation_log_id: string;
  upserted_count: number;
  cleared_schedule_count: number;
}

export interface SimulationLogEntry {
  id: string;
  simulationType: string;
  payload: Record<string, unknown>[];
  recordCount: number;
  createdAt: string;
}

function toSimulationLogEntry(row: SimulationLogRow): SimulationLogEntry {
  return {
    id: row.id,
    simulationType: row.simulation_type,
    payload: Array.isArray(row.payload) ? row.payload : [],
    recordCount: row.record_count,
    createdAt: row.created_at,
  };
}

export const labService = {
  async publish(input: LabPublishInput): Promise<LabPublishResult> {
    return http.post<LabPublishResult>(`${env.apiUrl}/api/lab/publish`, input);
  },

  async listSimulations(): Promise<SimulationLogEntry[]> {
    const rows = await http.get<SimulationLogRow[]>(
      `${env.postgrestUrl}/simulation_log?select=*&order=created_at.desc`,
    );
    return rows.map(toSimulationLogEntry);
  },
};
