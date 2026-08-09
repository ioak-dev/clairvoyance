import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  schedulesService,
  type ReplaceScheduleRangeParams,
  type SplitScheduleParams,
  type UpsertScheduleParams,
} from '../lib/services/schedules';

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
    queryFn: () => schedulesService.listInDateRange(startDate, endDate),
    enabled: enabled && Boolean(startDate && endDate && startDate <= endDate),
    staleTime: 30_000,
  });
}

export function useUpsertSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: UpsertScheduleParams) => schedulesService.upsert(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
    },
  });
}

export function useReplaceScheduleRange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ReplaceScheduleRangeParams) => schedulesService.replaceRange(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
    },
  });
}

export function useSplitSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: SplitScheduleParams) => schedulesService.split(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
    },
  });
}

export function useCopyRequestToSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, personId }: { requestId: string; personId: string }) =>
      schedulesService.copyRequestToSchedule(requestId, personId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
      ]);
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
