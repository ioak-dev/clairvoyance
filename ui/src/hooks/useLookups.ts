import { useQuery } from '@tanstack/react-query';
import { lookupsService } from '../lib/services/lookups';

export const lookupQueryKeys = {
  all: ['lookups'] as const,
};

export function useLookups() {
  return useQuery({
    queryKey: lookupQueryKeys.all,
    queryFn: lookupsService.list,
    staleTime: 5 * 60 * 1000,
  });
}
