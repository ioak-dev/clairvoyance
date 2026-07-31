/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { BillableType, Project, Resource } from '../types';
import { schedulesService } from '../lib/services/schedules';
import { dateRangeToWeeks, isoWeekToDateRange } from '../lib/weekUtils';
import { scheduleQueryKeys } from '../hooks/useSchedules';

interface BulkScheduleModalProps {
  isOpen: boolean;
  resource: Resource;
  projects: Project[];
  onClose: () => void;
}

const BILLABILITY_TYPES: BillableType[] = ['Billable', 'Non-billable', 'Opportunity'];
type PatternMode = 'repeat' | 'follow';
const DEFAULT_START_DATE = '2026-01-01';
const DEFAULT_END_DATE = '2026-12-31';

function parsePattern(input: string): number[] | null {
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 5)) return null;
  return nums;
}

export const BulkScheduleModal: React.FC<BulkScheduleModalProps> = ({
  isOpen,
  resource,
  projects,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [billableType, setBillableType] = useState<BillableType>('Billable');
  const [projectId, setProjectId] = useState('');
  const [pattern, setPattern] = useState('');
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [patternMode, setPatternMode] = useState<PatternMode>('repeat');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.billableType === billableType),
    [projects, billableType],
  );

  const handleBillableTypeChange = (type: BillableType) => {
    setBillableType(type);
    setProjectId('');
  };

  const handleClose = () => {
    setError(null);
    setPattern('');
    setProjectId('');
    setBillableType('Billable');
    setStartDate(DEFAULT_START_DATE);
    setEndDate(DEFAULT_END_DATE);
    setPatternMode('repeat');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) {
      setError('Please select a project.');
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

    const patternValues = parsePattern(pattern);
    if (!patternValues) {
      setError('Pattern must be comma-separated integers between 0 and 5.');
      return;
    }

    setIsSubmitting(true);
    try {
      const weeks = dateRangeToWeeks(startDate, endDate);
      // Skip weeks where pattern value is 0 — no block should be created
      const weekAllocations = weeks
        .map((week, i) => {
          const resolvedDays =
            patternMode === 'repeat'
              ? patternValues[i % patternValues.length]
              : patternValues[Math.min(i, patternValues.length - 1)];
          return {
            isoYear: week.isoYear,
            isoWeek: week.isoWeek,
            daysPerWeek: resolvedDays,
          };
        })
        .filter((w) => w.daysPerWeek > 0);

      if (weekAllocations.length === 0) {
        setError('All pattern values are 0 — nothing to schedule.');
        setIsSubmitting(false);
        return;
      }

      // Bootstrap the schedule record using only the first non-zero week's range
      const firstWeek = isoWeekToDateRange(weekAllocations[0].isoYear, weekAllocations[0].isoWeek);
      const scheduleId = await schedulesService.upsertRange({
        personId: resource.id,
        projectId,
        startDate: firstWeek.start,
        endDate: firstWeek.end,
        daysPerWeek: weekAllocations[0].daysPerWeek,
        billableType,
      });

      await schedulesService.upsertWeeks(scheduleId, weekAllocations);
      await queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedules.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-[60] p-4">
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
            Scheduling <span className="font-semibold text-primary">{resource.name}</span>.
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
              Days / Week Pattern
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. 5,4,3,2"
              className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-tertiary">
              Comma-separated integers 0–5. A value of 0 means no block for that week.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
              Pattern Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPatternMode('repeat')}
                className={`text-sm rounded-lg border px-3 py-2 text-left transition-colors ${
                  patternMode === 'repeat'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-default bg-surface text-secondary hover:bg-surface-hover'
                }`}
              >
                Repeat
              </button>
              <button
                type="button"
                onClick={() => setPatternMode('follow')}
                className={`text-sm rounded-lg border px-3 py-2 text-left transition-colors ${
                  patternMode === 'follow'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-default bg-surface text-secondary hover:bg-surface-hover'
                }`}
              >
                Follow
              </button>
            </div>
            <p className="text-xs text-tertiary">
              Repeat: 1-4, 5-8, ... Follow: once pattern ends, last value continues for remaining weeks.
            </p>
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
              {isSubmitting ? 'Creating…' : 'Create Schedules'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
