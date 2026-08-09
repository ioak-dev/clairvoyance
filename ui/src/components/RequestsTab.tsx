/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Resource, Project, BookingRequest } from '../types';
import { Check, X, ShieldAlert, BadgeInfo, FileSliders, UserCheck, Trash2, HelpCircle } from 'lucide-react';
import { getEffectiveBillableType, getProjectCategoryDotClassForProject } from '../lib/projectCategory';
import { rosterSummaryLabel } from '../lib/rosterUtils';
import { requestDateBounds } from '../types/api';
import { Badge, Button, Card, CardBody, CardHeader, IconButton } from './ui';

interface RequestsTabProps {
  requests: BookingRequest[];
  resources: Resource[];
  projects: Project[];
  onApproveRequest: (id: string) => void | Promise<void>;
  onRejectRequest: (id: string) => void | Promise<void>;
  onDeleteRequest: (id: string) => void | Promise<void>;
}

type RequestAction = 'approve' | 'reject' | 'delete';

function billableTone(type: string | undefined): 'emerald' | 'amber' | 'purple' {
  if (type === 'Billable') return 'emerald';
  if (type === 'Non-billable') return 'amber';
  return 'purple';
}

export const RequestsTab: React.FC<RequestsTabProps> = ({
  requests,
  resources,
  projects,
  onApproveRequest,
  onRejectRequest,
  onDeleteRequest,
}) => {
  const [busy, setBusy] = React.useState<{ id: string; action: RequestAction } | null>(null);

  const getResource = (id: string) => resources.find((r) => r.id === id);
  const getProject = (id: string) => projects.find((p) => p.id === id);

  const runAction = async (id: string, action: RequestAction, fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy({ id, action });
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'Pending');
  const pastRequests = requests.filter((r) => r.status !== 'Pending');

  return (
    <div className="space-y-6" id="requests-tab-container">
      <Card padded>
        <div className="flex items-center gap-3">
          <div className="p-2 tint-purple rounded-lg">
            <FileSliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Booking Requests Workflow</h2>
            <p className="text-xs text-tertiary mt-0.5 font-medium">
              Review resource allocation proposals. Approving an item places it directly onto the timeline scheduler.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">
            Pending Resource Proposals ({pendingRequests.length})
          </h3>

          {pendingRequests.length === 0 ? (
            <Card className="border-dashed p-12 text-center text-tertiary text-sm">
              All booking allocations requests have been resolved!
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => {
                const res = getResource(req.resourceId);
                const proj = getProject(req.projectId);
                const bounds = requestDateBounds(req);
                const summary = rosterSummaryLabel(req.unit, req.roster);
                const billableType = getEffectiveBillableType(req.billableType, proj);
                const isRejecting = busy?.id === req.id && busy.action === 'reject';
                const isApproving = busy?.id === req.id && busy.action === 'approve';

                return (
                  <Card
                    key={req.id}
                    className="hover:shadow-app-md transition-shadow duration-200 overflow-hidden flex flex-col"
                  >
                    <CardHeader className="flex-wrap gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {res?.avatarUrl ? (
                          <img
                            referrerPolicy="no-referrer"
                            src={res.avatarUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border border-white shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center border border-white shadow-sm">
                            {res?.name ? res.name.split(' ').map((n) => n[0]).join('') : 'R'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-primary">{res?.name}</h4>
                          <p className="text-xs text-tertiary capitalize">{res?.role}</p>
                        </div>
                      </div>

                      <Badge tone="amber" className="uppercase tracking-wider">
                        Pending approval
                      </Badge>
                    </CardHeader>

                    <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-tertiary uppercase">Target Project</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`w-3 h-3 rounded ${proj ? getProjectCategoryDotClassForProject(proj) : 'bg-emerald-500'}`}></span>
                          <span className="text-sm font-bold text-primary">{proj?.name || 'TMS'} ({proj?.client})</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-tertiary uppercase">Proposal Period</span>
                        <p className="text-sm font-medium text-secondary mt-1">
                          {bounds ? `${bounds.startDate} to ${bounds.endDate}` : '—'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-tertiary uppercase">Roster</span>
                        <p className="text-sm font-bold text-primary mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>{summary}</span>
                          <Badge tone={billableTone(billableType)}>{billableType}</Badge>
                        </p>
                      </div>

                      {req.notes && (
                        <div className="md:col-span-3 bg-surface-muted p-3 rounded-lg border border-subtle">
                          <span className="text-[9px] font-bold text-tertiary uppercase flex items-center gap-1">
                            <BadgeInfo className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Manager's Proposal Comments
                          </span>
                          <p className="text-xs text-secondary mt-1 font-medium leading-relaxed italic">
                            "{req.notes}"
                          </p>
                        </div>
                      )}
                    </CardBody>

                    <div className="px-5 py-3.5 bg-surface-muted border-t border-subtle flex justify-end gap-3">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void runAction(req.id, 'reject', () => onRejectRequest(req.id))}
                        loading={isRejecting}
                        disabled={Boolean(busy)}
                        leftIcon={<X className="w-4 h-4" />}
                        className="tint-red bg-transparent text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900"
                      >
                        {isRejecting ? 'Rejecting…' : 'Reject Proposal'}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void runAction(req.id, 'approve', () => onApproveRequest(req.id))}
                        loading={isApproving}
                        disabled={Boolean(busy)}
                        leftIcon={<Check className="w-4 h-4" />}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isApproving ? 'Publishing…' : 'Approved & Publish'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">
            Historical Requests Log
          </h3>

          <Card padded className="space-y-4">
            {pastRequests.length === 0 ? (
              <div className="text-center py-12 text-sm text-tertiary">
                No past resolved request records yet in this workspace session.
              </div>
            ) : (
              <div className="divide-y divide-[var(--app-border-subtle)] max-h-[480px] overflow-y-auto pr-1">
                {pastRequests.map((req) => {
                  const res = getResource(req.resourceId);
                  const proj = getProject(req.projectId);
                  const isApproved = req.status === 'Approved';
                  const bounds = requestDateBounds(req);
                  const summary = rosterSummaryLabel(req.unit, req.roster);
                  const isDeleting = busy?.id === req.id && busy.action === 'delete';

                  return (
                    <div key={req.id} className="py-3 first:pt-0 last:pb-0 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-primary truncate max-w-[140px]">
                          {res?.name || 'Staff member'}
                        </span>
                        <Badge tone={isApproved ? 'emerald' : 'red'} className="uppercase">
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-secondary mt-1 font-medium">
                        Project: <span className="text-primary font-semibold">{proj?.name || 'TMS'}</span> ({summary})
                      </p>
                      <p className="text-[10px] text-tertiary mt-0.5">
                        Dates: {bounds ? `${bounds.startDate} to ${bounds.endDate}` : '—'}
                      </p>

                      <div className="mt-2 flex justify-end">
                        <IconButton
                          label="Delete request log entry"
                          size="sm"
                          loading={isDeleting}
                          disabled={Boolean(busy)}
                          onClick={() => void runAction(req.id, 'delete', () => onDeleteRequest(req.id))}
                          className="text-tertiary hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4 border-t border-subtle flex items-start gap-2 text-[10px] text-tertiary">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>
                Approved requests create schedule blocks. Rejected ones stay in this log for audit.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-tertiary">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Only managers with booking rights can approve.</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-tertiary">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assigned resources appear on the timeline after approval.</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
