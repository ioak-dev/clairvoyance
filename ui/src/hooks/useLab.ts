import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  labService,
  type LabPublishInput,
} from '../lib/services/lab';
import { requestQueryKeys } from './useRequests';

export const labQueryKeys = {
  all: ['lab'] as const,
  simulations: () => [...labQueryKeys.all, 'simulations'] as const,
};

export function useLabSimulations() {
  return useQuery({
    queryKey: labQueryKeys.simulations(),
    queryFn: labService.listSimulations,
  });
}

export function usePublishLab() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LabPublishInput) => labService.publish(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: labQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: requestQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['schedules'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
    },
  });
}
