import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WeekAllocation } from '../types';
import { schedulesService, type UpsertScheduleRangeParams } from '../lib/services/schedules';

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

export function useUpsertScheduleRange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: UpsertScheduleRangeParams) => schedulesService.upsertRange(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
    },
  });
}

export function useUpsertScheduleWeeks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId, weeks }: { scheduleId: string; weeks: WeekAllocation[] }) =>
      schedulesService.upsertWeeks(scheduleId, weeks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
    },
  });
}

export function useDeleteScheduleWeeksInRange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scheduleId,
      startDate,
      endDate,
    }: {
      scheduleId: string;
      startDate: string;
      endDate: string;
    }) => schedulesService.deleteWeeksInRange(scheduleId, startDate, endDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
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