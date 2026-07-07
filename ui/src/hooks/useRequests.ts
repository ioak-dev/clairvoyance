import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BookingRequest } from '../types';
import type { ApprovalStatus } from '../types/api';
import { requestsService } from '../lib/services/requests';
import { filterQueryKeys } from './useFilters';

export const requestQueryKeys = {
  all: ['requests'] as const,
  list: () => [...requestQueryKeys.all, 'list'] as const,
};

export function useRequests() {
  return useQuery({
    queryKey: requestQueryKeys.list(),
    queryFn: requestsService.list,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: Omit<BookingRequest, 'id' | 'status'>) => requestsService.create(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.request });
    },
  });
}

export function useUpdateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<BookingRequest> & { status?: ApprovalStatus } }) =>
      requestsService.update(id, patch),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: requestQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['schedules'] }),
        queryClient.invalidateQueries({ queryKey: filterQueryKeys.request }),
      ]);
    },
  });
}

export function useDeleteRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: filterQueryKeys.request });
    },
  });
}
