import { useMutation } from '@tanstack/react-query';
import {
  scheduleAuditService,
  type ScheduleAuditReportParams,
} from '../lib/services/scheduleAudit';

export function useScheduleAuditExport() {
  return useMutation({
    mutationFn: (params: ScheduleAuditReportParams) => scheduleAuditService.list(params),
  });
}
