import React, { useMemo, useState } from 'react';
import { FlaskConical, Plus } from 'lucide-react';
import type { BookingRequest, Project, Resource } from '../types';
import { LabCreateModal } from './LabCreateModal.tsx';

interface LabTabProps {
  requests: BookingRequest[];
  resources: Resource[];
  projects: Project[];
}

export const LabTab: React.FC<LabTabProps> = ({ requests, resources, projects }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: string; text: string; createdAt: string }>>([]);

  const visibleRequests = useMemo(
    () => requests.filter((request) => request.status === 'Pending' || request.status === 'Approved'),
    [requests],
  );

  const getResourceName = (id: string) => resources.find((resource) => resource.id === id)?.name || 'Unassigned';
  const getProjectName = (id: string) => projects.find((project) => project.id === id)?.name || 'Project';

  const handleCreate = (text: string) => {
    setNotes((current) => [
      {
        id: `${Date.now()}`,
        text,
        createdAt: new Date().toLocaleString(),
      },
      ...current,
    ]);
  };

  const requestBadgeClass = (status: BookingRequest['status']) => {
    if (status === 'Pending') return 'bg-amber-50 text-amber-800 border-amber-200';
    if (status === 'Approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="space-y-6" id="lab-workspace">
      <div className="app-card p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 tint-blue rounded-lg">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Lab</h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>

      <div className="app-card overflow-hidden">
        <div className="px-6 py-4 border-b border-subtle flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Requests</h3>
          </div>
          <span className="text-xs font-semibold text-secondary">
            {visibleRequests.length} item{visibleRequests.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-surface-muted/70 text-[11px] uppercase tracking-wider text-tertiary">
              <tr>
                <th className="px-6 py-3 font-semibold">Resource</th>
                <th className="px-6 py-3 font-semibold">Project</th>
                <th className="px-6 py-3 font-semibold">Dates</th>
                <th className="px-6 py-3 font-semibold">Commitment</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {visibleRequests.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-sm text-tertiary" colSpan={6}>
                    No pending or approved requests available.
                  </td>
                </tr>
              ) : (
                visibleRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-surface-muted/40 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-primary">{getResourceName(request.resourceId)}</td>
                    <td className="px-6 py-4 text-sm text-secondary">{getProjectName(request.projectId)}</td>
                    <td className="px-6 py-4 text-sm text-secondary whitespace-nowrap">
                      {request.startDate} to {request.endDate}
                    </td>
                    <td className="px-6 py-4 text-sm text-secondary whitespace-nowrap">
                      {request.billablePercent}% {request.billableType}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide ${requestBadgeClass(request.status)}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-tertiary max-w-[320px] truncate">
                      {request.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-tertiary pl-1">Lab Notes</h3>
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="app-card p-4">
                <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">{note.text}</p>
                <p className="mt-2 text-[11px] text-tertiary">Created {note.createdAt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <LabCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
};
