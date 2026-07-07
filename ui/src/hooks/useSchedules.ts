import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Allocation } from '../types';
import { schedulesService } from '../lib/services/schedules';

export const scheduleQueryKeys = {
  all: ['schedules'] as const,
  list: () => [...scheduleQueryKeys.all, 'list'] as const,
  range: (startDate: string, endDate: string) =>
    [...scheduleQueryKeys.all, 'range', startDate, endDate] as const,
};

export function useSchedules() {
  return useQuery({
    queryKey: scheduleQueryKeys.list(),
    queryFn: schedulesService.list,
  });
}

export function useSchedulesInRange(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: scheduleQueryKeys.range(startDate, endDate),
    queryFn: () => schedulesService.listOverlapping(startDate, endDate),
    enabled: enabled && Boolean(startDate && endDate && startDate <= endDate),
    staleTime: 30_000,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allocation: Omit<Allocation, 'id'> & { requestId?: string | null }) => schedulesService.create(allocation),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
      ]);
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allocation: Allocation) => schedulesService.update(allocation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => schedulesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
    },
  });
}

export function useDeleteSchedulesByRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => schedulesService.deleteByRequestId(requestId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
      ]);
    },
  });
}
