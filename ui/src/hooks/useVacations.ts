import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Vacation } from '../types';
import { vacationsService } from '../lib/services/vacations';

export const vacationQueryKeys = {
  all: ['vacations'] as const,
  list: () => [...vacationQueryKeys.all, 'list'] as const,
};

export function useVacations() {
  return useQuery({
    queryKey: vacationQueryKeys.list(),
    queryFn: vacationsService.list,
  });
}

export function useCreateVacation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vacation: Omit<Vacation, 'id' | 'status'>) => vacationsService.create(vacation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vacationQueryKeys.all });
    },
  });
}

export function useUpdateVacation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Vacation> }) => vacationsService.update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vacationQueryKeys.all });
    },
  });
}

export function useDeleteVacation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vacationsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vacationQueryKeys.all });
    },
  });
}
