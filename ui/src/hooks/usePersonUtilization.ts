import { useMutation } from '@tanstack/react-query';
import {
  personUtilizationService,
  type PersonUtilizationSearchParams,
} from '../lib/services/personUtilization';

export function usePersonUtilizationSearch() {
  return useMutation({
    mutationFn: (params: PersonUtilizationSearchParams) => personUtilizationService.search(params),
  });
}
