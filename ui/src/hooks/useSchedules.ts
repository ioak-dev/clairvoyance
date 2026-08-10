import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  schedulesService,
  type ListSchedulesInRangeParams,
  type ReplaceScheduleRangeParams,
  type SplitScheduleParams,
  type UpsertScheduleParams,
} from '../lib/services/schedules';

function sortedIdsKey(ids: string[] | undefined): string {
  if (ids == null) return '*';
  if (ids.length === 0) return '-';
  return [...ids].sort().join(',');
}

export const scheduleQueryKeys = {
  all: ['schedules'] as const,
  list: () => [...scheduleQueryKeys.all, 'list'] as const,
  range: (params: ListSchedulesInRangeParams) =>
    [
      ...scheduleQueryKeys.all,
      'range',
      params.startDate,
      params.endDate,
      sortedIdsKey(params.resourceIds),
      sortedIdsKey(params.projectIds),
    ] as const,
};

export function useSchedules() {
  return useQuery({
    queryKey: scheduleQueryKeys.list(),
    queryFn: schedulesService.list,
  });
}

/**
 * Viewport-scoped schedule load. Shows previous viewport data only while the next
 * request is in flight, then replaces it (no merge/accumulation across ranges).
 */
export function useSchedulesInRange(params: ListSchedulesInRangeParams, enabled = true) {
  const { startDate, endDate, resourceIds, projectIds } = params;
  const hasValidDates = Boolean(startDate && endDate && startDate <= endDate);
  const hasEntityScope =
    resourceIds === undefined && projectIds === undefined
      ? true
      : (resourceIds != null && resourceIds.length > 0) ||
        (projectIds != null && projectIds.length > 0);

  return useQuery({
    queryKey: scheduleQueryKeys.range(params),
    queryFn: () => schedulesService.listInDateRange(params),
    enabled: enabled && hasValidDates && hasEntityScope,
    staleTime: 0,
    gcTime: 0,
    placeholderData: keepPreviousData,
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
