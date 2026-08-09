import { env } from '../shared/env';
import { http } from '../shared/http';
import type { Vacation } from '../../types';
import { createVacationPayload, type VacationRow, toVacation, updateVacationPayload } from '../../types/api';

const baseUrl = `${env.postgrestUrl}/vacation`;

export const vacationsService = {
  async list(): Promise<Vacation[]> {
    const rows = await http.get<VacationRow[]>(`${baseUrl}?select=*&order=start_date.asc&limit=1000000`);
    return rows.map(toVacation);
  },

  async create(vacation: Omit<Vacation, 'id' | 'status'>): Promise<Vacation> {
    const rows = await http.post<VacationRow[]>(baseUrl, createVacationPayload(vacation), { preferRepresentation: true });
    return toVacation(rows[0]);
  },

  async update(id: string, vacation: Partial<Vacation>): Promise<Vacation> {
    const rows = await http.patch<VacationRow[]>(
      `${baseUrl}?id=eq.${encodeURIComponent(id)}`,
      updateVacationPayload(vacation),
      { preferRepresentation: true },
    );
    return toVacation(rows[0]);
  },

  async delete(id: string): Promise<void> {
    await http.delete<void>(`${baseUrl}?id=eq.${encodeURIComponent(id)}`);
  },
};
