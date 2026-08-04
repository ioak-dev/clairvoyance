import { env } from '../shared/env';
import { http } from '../shared/http';
import type { Resource } from '../../types';
import {
  createPersonPayload,
  type PersonRow,
  toResource,
  updatePersonPayload,
} from '../../types/api';

const peopleUrl = `${env.postgrestUrl}/person`;
const personSelect = '*,practice_area(name),consulting_unit(name),site(name),competency_center(name)';
const PAGE_SIZE = 1000;

async function listAllPeopleRows(): Promise<PersonRow[]> {
  const allRows: PersonRow[] = [];
  let offset = 0;

  while (true) {
    const rows = await http.get<PersonRow[]>(
      `${peopleUrl}?select=${encodeURIComponent(personSelect)}&order=first_name.asc,last_name.asc&limit=${PAGE_SIZE}&offset=${offset}`,
    );

    if (rows.length === 0) {
      break;
    }

    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return allRows;
}

export const peopleService = {
  async list(): Promise<Resource[]> {
    const people = await listAllPeopleRows();
    return people.map(toResource);
  },

  async create(resource: Omit<Resource, 'id'>): Promise<Resource> {
    const people = await http.post<PersonRow[]>(peopleUrl, createPersonPayload(resource), { preferRepresentation: true });
    return toResource(people[0]);
  },

  async update(resource: Resource): Promise<Resource> {
    const rows = await http.patch<PersonRow[]>(
      `${peopleUrl}?id=eq.${encodeURIComponent(resource.id)}`,
      updatePersonPayload(resource),
      { preferRepresentation: true },
    );
    return toResource(rows[0]);
  },

  async delete(id: string): Promise<void> {
    await http.delete<void>(`${peopleUrl}?id=eq.${encodeURIComponent(id)}`);
  },
};
