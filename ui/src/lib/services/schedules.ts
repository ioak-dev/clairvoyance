import { env } from '../shared/env';
import { http } from '../shared/http';
import type { Allocation } from '../../types';
import { createSchedulePayload, type ScheduleRow, toAllocation, updateSchedulePayload } from '../../types/api';

const baseUrl = `${env.postgrestUrl}/schedule`;

export const schedulesService = {
  async list(): Promise<Allocation[]> {
    const rows = await http.get<ScheduleRow[]>(`${baseUrl}?select=*&order=start_date.asc`);
    return rows.map(toAllocation);
  },

  async listOverlapping(startDate: string, endDate: string): Promise<Allocation[]> {
    const params = new URLSearchParams({
      select: '*',
      order: 'start_date.asc',
      and: `(start_date.lte.${endDate},end_date.gte.${startDate})`,
    });
    const rows = await http.get<ScheduleRow[]>(`${baseUrl}?${params.toString()}`);
    return rows.map(toAllocation);
  },

  async create(allocation: Omit<Allocation, 'id'> & { requestId?: string | null }): Promise<Allocation> {
    const rows = await http.post<ScheduleRow[]>(baseUrl, createSchedulePayload(allocation), { preferRepresentation: true });
    return toAllocation(rows[0]);
  },

  async update(allocation: Allocation): Promise<Allocation> {
    const rows = await http.patch<ScheduleRow[]>(
      `${baseUrl}?id=eq.${encodeURIComponent(allocation.id)}`,
      updateSchedulePayload(allocation),
      { preferRepresentation: true },
    );
    return toAllocation(rows[0]);
  },

  async delete(id: string): Promise<void> {
    await http.delete<void>(`${baseUrl}?id=eq.${encodeURIComponent(id)}`);
  },

  async deleteByRequestId(requestId: string): Promise<void> {
    await http.delete<void>(`${baseUrl}?request_id=eq.${encodeURIComponent(requestId)}`);
  },
};
