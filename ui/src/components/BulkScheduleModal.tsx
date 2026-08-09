/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { BillableType, Project, Resource, Roster } from '../types';
import { schedulesService } from '../lib/services/schedules';
import { normalizeRoster, rosterSummaryLabel, WEEKDAY_LABELS } from '../lib/rosterUtils';
import { scheduleQueryKeys } from '../hooks/useSchedules';

interface BulkScheduleModalProps {
  isOpen: boolean;
  resources: Resource[];
  projects: Project[];
  fixedResource?: Resource;
  fixedProject?: Project;
  onClose: () => void;
}

const BILLABILITY_TYPES: BillableType[] = ['Billable', 'Non-billable', 'Opportunity'];
const DEFAULT_START_DATE = '2026-01-01';
const DEFAULT_END_DATE = '2026-12-31';
const DEFAULT_PATTERN = '1,1,1,1,1';

/** Parse Mon–Fri utilization values (1 or 5 numbers, each ≥ 0). */
function parseMonFriPattern(input: string): number[] | null {
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 1 && parts.length !== 5) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (nums.length === 1) return [nums[0], nums[0], nums[0], nums[0], nums[0]];
  return nums;
}

function patternToRoster(monFri: number[]): Roster {
  return normalizeRoster([monFri[0], monFri[1], monFri[2], monFri[3], monFri[4], 0, 0]);
}

export const BulkScheduleModal: React.FC<BulkScheduleModalProps> = ({
  isOpen,
  resources,
  projects,
  fixedResource,
  fixedProject,
  onClose,
}) => {
  const isResourceFixed = !!fixedResource;
  const isProjectFixed = !!fixedProject;
  const queryClient = useQueryClient();
  const [billableType, setBillableType] = useState<BillableType>(fixedProject?.billableType || 'Billable');
  const [projectId, setProjectId] = useState(fixedProject?.id || '');
  const [resourceId, setResourceId] = useState(fixedResource?.id || '');
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setBillableType(fixedProject?.billableType || 'Billable');
    setProjectId(fixedProject?.id || '');
    setResourceId(fixedResource?.id || '');
    setPattern(DEFAULT_PATTERN);
    setStartDate(DEFAULT_START_DATE);
    setEndDate(DEFAULT_END_DATE);
    setError(null);
  }, [isOpen, fixedProject, fixedResource]);

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.billableType === billableType),
    [projects, billableType],
  );

  const selectedResource = useMemo(
    () => resources.find((r) => r.id === resourceId) || null,
    [resources, resourceId],
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId],
  );

  const previewRoster = useMemo(() => {
    const monFri = parseMonFriPattern(pattern);
    return monFri ? patternToRoster(monFri) : null;
  }, [pattern]);

  const handleBillableTypeChange = (type: BillableType) => {
    setBillableType(type);
    setProjectId('');
  };

  const handleClose = () => {
    setError(null);
    setPattern(DEFAULT_PATTERN);
    setProjectId(fixedProject?.id || '');
    setResourceId(fixedResource?.id || '');
    setBillableType(fixedProject?.billableType || 'Billable');
    setStartDate(DEFAULT_START_DATE);
    setEndDate(DEFAULT_END_DATE);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) {
      setError('Please select a project.');
      return;
    }

    if (!resourceId) {
      setError('Please select a resource.');
      return;
    }

    if (!startDate || !endDate) {
      setError('Please select both start and end date.');
      return;
    }

    if (startDate > endDate) {
      setError('Start date must be on or before end date.');
      return;
    }

    const monFri = parseMonFriPattern(pattern);
    if (!monFri) {
      setError('Pattern must be one value or five comma-separated utilization numbers (≥ 0) for Mon–Fri.');
      return;
    }

    if (monFri.every((v) => v === 0)) {
      setError('All roster values are 0 — nothing to schedule.');
      return;
    }

    const roster = patternToRoster(monFri);

    setIsSubmitting(true);
    try {
      await schedulesService.upsert({
        personId: resourceId,
        projectId,
        startDate,
        endDate,
        unit: 'utilization',
        roster,
        billableType: selectedProject?.billableType || billableType,
        bookingType: 'hard',
      });

      await queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[60] p-4">
      <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-md w-full flex flex-col overflow-hidden">
        <div className="app-card-header px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-500" />
            <h3 className="text-base font-semibold text-primary">Bulk Schedule</h3>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-surface-hover rounded-lg text-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          <p className="text-sm text-secondary">
            Scheduling <span className="font-semibold text-primary">{selectedResource?.name || 'resource'}</span>
            {' '}on <span className="font-semibold text-primary">{selectedProject?.name || 'project'}</span>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {!isProjectFixed && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
                Billability Type
              </label>
              <select
                value={billableType}
                onChange={(e) => handleBillableTypeChange(e.target.value as BillableType)}
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {BILLABILITY_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
          )}

          {isProjectFixed ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
                Project
              </label>
              <input
                type="text"
                value={fixedProject?.name || ''}
                readOnly
                className="w-full rounded-lg border border-default bg-surface-muted px-3 py-2 text-sm text-primary"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select a project —</option>
                {filteredProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {filteredProjects.length === 0 && (
                <p className="text-xs text-amber-600">No {billableType} projects available.</p>
              )}
            </div>
          )}

          {isResourceFixed ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
                Resource
              </label>
              <input
                type="text"
                value={fixedResource?.name || ''}
                readOnly
                className="w-full rounded-lg border border-default bg-surface-muted px-3 py-2 text-sm text-primary"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
                Resource
              </label>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select a resource —</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
              Mon–Fri utilization pattern
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. 1,1,1,0.5,0.5 or 1"
              className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-tertiary">
              One value (applied to Mon–Fri) or five values ({WEEKDAY_LABELS.slice(0, 5).join(', ')}).
              Sat/Sun are fixed at 0. Creates a single schedule block for the date range.
            </p>
            {previewRoster && (
              <p className="text-xs text-secondary">
                Preview: {rosterSummaryLabel('utilization', previewRoster)} avg weekday utilization
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1 border-t border-default">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-secondary hover:bg-surface-hover rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating…' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
