import { env } from '../shared/env';
import { http } from '../shared/http';
import type { BookingRequest, WeekAllocation } from '../../types';
import {
  createRequestHeaderPayload,
  type RequestRow,
  toBookingRequest,
  updateRequestPayload,
  weekAllocationToPayload,
} from '../../types/api';

const baseUrl = `${env.postgrestUrl}/request`;
const weekSelect = 'request_week(id,request_id,iso_year,iso_week,days_per_week)';
const headerSelect = `*,${weekSelect}`;

export const requestsService = {
  async list(): Promise<BookingRequest[]> {
    const rows = await http.get<RequestRow[]>(`${baseUrl}?select=${encodeURIComponent(headerSelect)}`);
    return rows.map(toBookingRequest);
  },

  async create(
    request: Omit<BookingRequest, 'id' | 'status'>,
    weeks: WeekAllocation[],
  ): Promise<BookingRequest> {
    const headerRows = await http.post<RequestRow[]>(
      baseUrl,
      createRequestHeaderPayload(request),
      { preferRepresentation: true },
    );
    const header = headerRows[0];
    if (weeks.length > 0) {
      await http.post(
        `${env.postgrestUrl}/request_week`,
        weeks.map((w) => ({ request_id: header.id, ...weekAllocationToPayload(w) })),
      );
    }
    const full = await http.get<RequestRow[]>(
      `${baseUrl}?id=eq.${encodeURIComponent(header.id)}&select=${encodeURIComponent(headerSelect)}`,
    );
    return toBookingRequest(full[0]);
  },

  async replaceWeeks(requestId: string, weeks: WeekAllocation[]): Promise<void> {
    await http.delete<void>(`${env.postgrestUrl}/request_week?request_id=eq.${encodeURIComponent(requestId)}`);
    if (weeks.length > 0) {
      await http.post(
        `${env.postgrestUrl}/request_week`,
        weeks.map((w) => ({ request_id: requestId, ...weekAllocationToPayload(w) })),
      );
    }
  },

  async update(id: string, request: Partial<BookingRequest> & { status?: RequestRow['status'] }): Promise<BookingRequest> {
    const rows = await http.patch<RequestRow[]>(
      `${baseUrl}?id=eq.${encodeURIComponent(id)}`,
      updateRequestPayload(request),
      { preferRepresentation: true },
    );
    if (request.weeks) {
      await this.replaceWeeks(id, request.weeks);
    }
    const full = await http.get<RequestRow[]>(
      `${baseUrl}?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(headerSelect)}`,
    );
    return toBookingRequest(full[0] ?? rows[0]);
  },

  async delete(id: string): Promise<void> {
    await http.delete<void>(`${baseUrl}?id=eq.${encodeURIComponent(id)}`);
  },
};
