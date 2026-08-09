/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Resource, Project, BookingRequest } from '../types';
import { Check, X, ShieldAlert, BadgeInfo, FileSliders, UserCheck, Trash2, HelpCircle } from 'lucide-react';
import { getProjectCategoryDotClassForProject } from '../lib/projectCategory';
import { avgDaysPerWeek, maxDaysPerWeek } from '../lib/weekUtils';
import { requestDateBounds } from '../types/api';

interface RequestsTabProps {
  requests: BookingRequest[];
  resources: Resource[];
  projects: Project[];
  onApproveRequest: (id: string) => void;
  onRejectRequest: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}

export const RequestsTab: React.FC<RequestsTabProps> = ({
  requests,
  resources,
  projects,
  onApproveRequest,
  onRejectRequest,
  onDeleteRequest,
}) => {
  const getResource = (id: string) => resources.find((r) => r.id === id);
  const getProject = (id: string) => projects.find((p) => p.id === id);

  const pendingRequests = requests.filter((r) => r.status === 'Pending');
  const pastRequests = requests.filter((r) => r.status !== 'Pending');

  return (
    <div className="space-y-6" id="requests-tab-container">
      {/* Intro section */}
      <div className="app-card p-6">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main interactive pending list (spanning 2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">
            Pending Resource Proposals ({pendingRequests.length})
          </h3>

          {pendingRequests.length === 0 ? (
            <div className="app-card border-dashed p-12 text-center text-tertiary text-sm">
              All booking allocations requests have been resolved! 🌟
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => {
                const res = getResource(req.resourceId);
                const proj = getProject(req.projectId);
                const bounds = requestDateBounds(req);
                const avgDays = avgDaysPerWeek(req.weeks);

                return (
                  <div
                    key={req.id}
                    className="app-card hover:shadow-app-md transition-shadow duration-200 overflow-hidden flex flex-col"
                  >
                    {/* Header bar within request */}
                    <div className="px-6 py-4 bg-surface-muted/70 border-b border-subtle flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
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
                        <div>
                          <h4 className="text-sm font-bold text-primary">{res?.name}</h4>
                          <p className="text-xs text-tertiary capitalize">{res?.role}</p>
                        </div>
                      </div>

                      {/* Pill Badge */}
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold uppercase tracking-wider scale-95">
                        PENDING APPROVAL
                      </span>
                    </div>

                    {/* Request Details */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
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
                          {bounds ? `${bounds.startDate} to ${bounds.endDate}` : 'No weeks'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-tertiary uppercase">Days per Week</span>
                        <p className="text-sm font-bold text-primary mt-1 flex items-center gap-1.5">
                          <span>{avgDays}d/wk avg</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                            (() => {
                              const type = getProject(req.projectId)?.billableType || req.billableType;
                              if (type === 'Billable') return 'bg-emerald-100 text-emerald-800';
                              if (type === 'Non-billable') return 'bg-amber-100 text-amber-800';
                              return 'bg-purple-100 text-purple-800';
                            })()
                          }`}>
                            {getProject(req.projectId)?.billableType || req.billableType}
                          </span>
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
                    </div>

                    {/* Interactive Action Bar */}
                    <div className="px-6 py-3.5 bg-surface-muted border-t border-subtle flex justify-end gap-3">
                      <button
                        onClick={() => onRejectRequest(req.id)}
                        className="px-4 py-2 tint-red rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-4 h-4" /> Reject Proposal
                      </button>
                      <button
                        onClick={() => onApproveRequest(req.id)}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Approved & Publish
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Audit history sidebar (spanning 1 column) */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-tertiary uppercase tracking-widest pl-1">
            Historical Requests Log
          </h3>

          <div className="app-card p-6 space-y-4">
            {pastRequests.length === 0 ? (
              <div className="text-center py-12 text-sm text-tertiary">
                No past resolved request records yet in this workspace session.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto pr-1">
                {pastRequests.map((req) => {
                  const res = getResource(req.resourceId);
                  const proj = getProject(req.projectId);
                  const isApproved = req.status === 'Approved';
                  const bounds = requestDateBounds(req);
                  const peakDays = maxDaysPerWeek(req.weeks);

                  return (
                    <div key={req.id} className="py-3 first:pt-0 last:pb-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary truncate max-w-[140px]">
                          {res?.name || 'Staff member'}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-secondary mt-1 font-medium">
                        Project: <span className="text-primary font-semibold">{proj?.name || 'TMS'}</span> ({peakDays}d/wk peak)
                      </p>
                      <p className="text-[10px] text-tertiary mt-0.5">
                        Dates: {bounds ? `${bounds.startDate} to ${bounds.endDate}` : '—'}
                      </p>

                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => onDeleteRequest(req.id)}
                          className="text-tertiary hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete request log entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
