import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project } from '../types';
import { projectsService } from '../lib/services/projects';
import { filterQueryKeys } from './useFilters';

export const projectQueryKeys = {
  all: ['projects'] as const,
  list: () => [...projectQueryKeys.all, 'list'] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectQueryKeys.list(),
    queryFn: projectsService.list,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: Omit<Project, 'id'>) => projectsService.create(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.project });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.request });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.project });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.request });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: Project) => projectsService.update(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.project });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.request });
    },
  });
}
