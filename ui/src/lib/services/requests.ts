import { env } from '../shared/env';
import { http } from '../shared/http';
import type { BookingRequest } from '../../types';
import { createRequestPayload, type RequestRow, toBookingRequest, updateRequestPayload } from '../../types/api';

const baseUrl = `${env.postgrestUrl}/request`;

export const requestsService = {
  async list(): Promise<BookingRequest[]> {
    const rows = await http.get<RequestRow[]>(`${baseUrl}?select=*&order=start_date.asc`);
    return rows.map(toBookingRequest);
  },

  async create(request: Omit<BookingRequest, 'id' | 'status'>): Promise<BookingRequest> {
    const rows = await http.post<RequestRow[]>(baseUrl, createRequestPayload(request), { preferRepresentation: true });
    return toBookingRequest(rows[0]);
  },

  async update(id: string, request: Partial<BookingRequest> & { status?: RequestRow['status'] }): Promise<BookingRequest> {
    const rows = await http.patch<RequestRow[]>(
      `${baseUrl}?id=eq.${encodeURIComponent(id)}`,
      updateRequestPayload(request),
      { preferRepresentation: true },
    );
    return toBookingRequest(rows[0]);
  },

  async delete(id: string): Promise<void> {
    await http.delete<void>(`${baseUrl}?id=eq.${encodeURIComponent(id)}`);
  },
};
