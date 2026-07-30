import { env } from '../shared/env';
import { http } from '../shared/http';
import type { Project } from '../../types';
import {
  createProjectPayload,
  type ProjectRow,
  toProject,
  updateProjectPayload,
} from '../../types/api';

const baseUrl = `${env.postgrestUrl}/project`;
const projectSelect = '*,market_unit(name),consulting_unit(name)';

export const projectsService = {
  async list(): Promise<Project[]> {
    const rows = await http.get<ProjectRow[]>(`${baseUrl}?select=${encodeURIComponent(projectSelect)}&order=name.asc&limit=1000000`);
    return rows.map(toProject);
  },

  async create(project: Omit<Project, 'id'>): Promise<Project> {
    const rows = await http.post<ProjectRow[]>(baseUrl, createProjectPayload(project), { preferRepresentation: true });
    return toProject(rows[0]);
  },

  async update(project: Project): Promise<Project> {
    const rows = await http.patch<ProjectRow[]>(
      `${baseUrl}?id=eq.${encodeURIComponent(project.id)}`,
      updateProjectPayload(project),
      { preferRepresentation: true },
    );
    return toProject(rows[0]);
  },

  async delete(id: string): Promise<void> {
    await http.delete<void>(`${baseUrl}?id=eq.${encodeURIComponent(id)}`);
  },
};
