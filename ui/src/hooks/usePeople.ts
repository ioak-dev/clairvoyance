import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Resource } from '../types';
import { peopleService } from '../lib/services/people';
import { filterQueryKeys } from './useFilters';

export const peopleQueryKeys = {
  all: ['people'] as const,
  list: () => [...peopleQueryKeys.all, 'list'] as const,
};

export function usePeople() {
  return useQuery({
    queryKey: peopleQueryKeys.list(),
    queryFn: peopleService.list,
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resource: Omit<Resource, 'id'>) => peopleService.create(resource),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.person });
    },
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => peopleService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.person });
    },
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resource: Resource) => peopleService.update(resource),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.person });
    },
  });
}
