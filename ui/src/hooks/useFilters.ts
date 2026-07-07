import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SavedFilter } from '../types';
import {
  personFiltersService,
  projectFiltersService,
  requestFiltersService,
} from '../lib/services/filters';

export const filterQueryKeys = {
  project: ['filters', 'project'] as const,
  person: ['filters', 'person'] as const,
  request: ['filters', 'request'] as const,
};

function useFilterMutations(
  queryKey: readonly string[],
  service: typeof projectFiltersService,
) {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (filter: Omit<SavedFilter, 'id'>) => service.create(filter),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SavedFilter> }) =>
      service.update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => service.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { create, update, remove };
}

export function useProjectFilters() {
  const query = useQuery({
    queryKey: filterQueryKeys.project,
    queryFn: projectFiltersService.list,
  });
  const mutations = useFilterMutations(filterQueryKeys.project, projectFiltersService);
  return { ...query, ...mutations };
}

export function usePersonFilters() {
  const query = useQuery({
    queryKey: filterQueryKeys.person,
    queryFn: personFiltersService.list,
  });
  const mutations = useFilterMutations(filterQueryKeys.person, personFiltersService);
  return { ...query, ...mutations };
}

export function useRequestFilters() {
  const query = useQuery({
    queryKey: filterQueryKeys.request,
    queryFn: requestFiltersService.list,
  });
  const mutations = useFilterMutations(filterQueryKeys.request, requestFiltersService);
  return { ...query, ...mutations };
}
