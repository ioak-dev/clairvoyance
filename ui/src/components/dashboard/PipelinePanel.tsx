import React from 'react';
import { Clock, Palmtree, UserRound } from 'lucide-react';
import type { OpenRequestRow } from '../../lib/dashboardMetrics';
import { Badge, Card } from '../ui';

type PipelinePanelProps = {
  openRequestsTotal: number;
  openRequestsUnassigned: number;
  openRequests: OpenRequestRow[];
  approvedLeaveDays: number;
  peopleOnLeave: number;
  pendingVacations: number;
};

export const PipelinePanel: React.FC<PipelinePanelProps> = ({
  openRequestsTotal,
  openRequestsUnassigned,
  openRequests,
  approvedLeaveDays,
  peopleOnLeave,
  pendingVacations,
}) => (
  <Card padded className="flex flex-col h-full">
    <h3 className="text-sm font-semibold text-primary tracking-[0.02em] mb-1">Pipeline & Leave</h3>
    <p className="text-xs text-secondary mb-4">Open requests and time-off impact</p>

    <div className="grid grid-cols-2 gap-3 mb-4">
      <div className="rounded-xl bg-surface-muted border border-subtle p-3">
        <div className="flex items-center gap-2 text-tertiary mb-1">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em]">Requests</span>
        </div>
        <p className="text-xl font-bold text-primary">{openRequestsTotal}</p>
        <p className="text-[11px] text-secondary mt-0.5">{openRequestsUnassigned} unassigned</p>
      </div>
      <div className="rounded-xl bg-surface-muted border border-subtle p-3">
        <div className="flex items-center gap-2 text-tertiary mb-1">
          <Palmtree className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em]">Leave</span>
        </div>
        <p className="text-xl font-bold text-primary">{approvedLeaveDays}d</p>
        <p className="text-[11px] text-secondary mt-0.5">
          {peopleOnLeave} away now · {pendingVacations} pending
        </p>
      </div>
    </div>

    <div className="flex-1 space-y-2">
      <p className="text-[10px] font-semibold text-tertiary uppercase tracking-[0.08em]">
        Top open requests
      </p>
      {openRequests.length === 0 ? (
        <p className="text-xs text-tertiary py-4 text-center">No pending requests in period.</p>
      ) : (
        openRequests.map((req) => (
          <div
            key={req.id}
            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-subtle bg-surface-muted/50"
          >
            <div
              className={`p-1.5 rounded-md shrink-0 ${
                req.unassigned ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
              }`}
            >
              <UserRound className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary truncate">{req.projectName}</p>
              <p className="text-[11px] text-secondary truncate">
                {req.requestName}
                {req.unassigned ? ' · open slot' : ''}
              </p>
            </div>
            <Badge tone="neutral" className="shrink-0 tabular-nums">
              {req.hours}h
            </Badge>
          </div>
        ))
      )}
    </div>
  </Card>
);
