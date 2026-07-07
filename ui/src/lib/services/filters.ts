import { env } from '../shared/env';
import { http } from '../shared/http';
import type { SavedFilter } from '../../types';
import {
  createFilterPayload,
  type FilterRow,
  toSavedFilter,
  updateFilterPayload,
} from '../../types/api';

function createFilterService(table: string, listView: string) {
  const tableUrl = `${env.postgrestUrl}/${table}`;
  const viewUrl = `${env.postgrestUrl}/${listView}`;

  return {
    async list(): Promise<SavedFilter[]> {
      const rows = await http.get<FilterRow[]>(
        `${viewUrl}?select=*&is_active=eq.true&order=sort_order.asc,name.asc`,
      );
      return rows.map(toSavedFilter);
    },

    async create(filter: Omit<SavedFilter, 'id' | 'itemCount'>): Promise<SavedFilter> {
      const rows = await http.post<FilterRow[]>(tableUrl, createFilterPayload(filter), {
        preferRepresentation: true,
      });
      return toSavedFilter(rows[0]);
    },

    async update(id: string, filter: Partial<SavedFilter>): Promise<SavedFilter> {
      const rows = await http.patch<FilterRow[]>(
        `${tableUrl}?id=eq.${encodeURIComponent(id)}`,
        updateFilterPayload(filter),
        { preferRepresentation: true },
      );
      return toSavedFilter(rows[0]);
    },

    async delete(id: string): Promise<void> {
      await http.delete<void>(`${tableUrl}?id=eq.${encodeURIComponent(id)}`);
    },
  };
}

export const projectFiltersService = createFilterService(
  'project_filter',
  'project_filter_with_count',
);
export const personFiltersService = createFilterService(
  'person_filter',
  'person_filter_with_count',
);
export const requestFiltersService = createFilterService(
  'request_filter',
  'request_filter_with_count',
);
