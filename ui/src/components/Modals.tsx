/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import type {
  AllocationBlock,
  BillableType,
  BookingCommitmentType,
  BookingRequest,
  Project,
  Resource,
  Roster,
  ScheduleAssignment,
  ScheduleUnit,
} from '../types';
import { DEFAULT_ROSTER } from '../types';
import { Search, Plus, Trash2 } from 'lucide-react';
import { getProjectCategory, getProjectCategoryIconClass, getBillableTypeFromProject, getProjectCategoryLabel, getEffectiveBillableType } from '../lib/projectCategory';
import {
  blockHoursOnDate,
  countWeekdaysInRange,
  datesOverlap,
  expandDates,
  isoWeekdayIndex,
  normalizeRoster,
  personDailyCapacityHours,
  scheduleSiblingDateBounds,
  weekdayAllocationValue,
  weekdayRoster,
} from '../lib/rosterUtils';
import { addDays } from '../lib/dateUtils';
import { useLookups } from '../hooks/useLookups';
import { useScheduleSiblings } from '../hooks/useSchedules';
import {
  Modal,
  ConfirmDialog,
  Button,
  Input,
  Textarea,
  Field,
  Label,
  Description,
  Select,
  Combobox,
  Checkbox,
  RadioGroup,
} from './ui';

export type BookingEndsMode = 'on' | 'after';

export type ScheduleApplyScope = 'entire' | 'partial';

export type ScheduleEditPatch = {
  title?: string;
  startDate: string;
  endDate: string;
  unit: ScheduleUnit;
  roster: Roster;
  applyScope: ScheduleApplyScope;
  /** null clears override (inherit project); undefined leaves unchanged on partial. */
  billableType?: BillableType | null;
};

const BILLABLE_OVERRIDE_EMPTY = '';

function billableOverrideOptions(project: Project | null | undefined): { value: string; label: string }[] {
  const projectDefault = project
    ? getBillableTypeFromProject(project)
    : 'Billable';
  return [
    { value: BILLABLE_OVERRIDE_EMPTY, label: `Project default (${projectDefault})` },
    { value: 'Billable', label: 'Billable' },
    { value: 'Non-billable', label: 'Non-billable' },
    { value: 'Opportunity', label: 'Opportunity' },
  ];
}

function parseBillableOverride(value: string): BillableType | undefined {
  if (value === 'Billable' || value === 'Non-billable' || value === 'Opportunity') {
    return value;
  }
  return undefined;
}

/** End date covering `occurrences` weekly periods starting at startDate. */
function endDateAfterWeeklyOccurrences(startDate: string, occurrences: number): string {
  const n = Math.max(1, Math.floor(occurrences));
  // N full ISO weeks from the Monday of start → Sunday of week N
  const startMondayOffset = isoWeekdayIndex(startDate); // 0=Mon
  const firstWeekEnd = addDays(startDate, 6 - startMondayOffset);
  if (n === 1) return firstWeekEnd < startDate ? startDate : firstWeekEnd;
  return addDays(firstWeekEnd, (n - 1) * 7);
}

/** Smallest week count whose weekly end covers `endDate`. */
function weeklyOccurrencesForEndDate(startDate: string, endDate: string): number {
  if (!startDate || !endDate || endDate < startDate) return 1;
  let n = 1;
  while (n < 520 && endDateAfterWeeklyOccurrences(startDate, n) < endDate) {
    n += 1;
  }
  return n;
}

const ALLOCATION_UNIT_OPTIONS: { value: ScheduleUnit; label: string }[] = [
  { value: 'utilization', label: '%' },
  { value: 'hours', label: 'hrs / day' },
];

/** Single allocation by % or hours/day; weekends always free. Total hours is derived. */
function AllocationFields({
  unit,
  roster,
  onChange,
  dailyCapacity = 8,
  startDate,
  endDate,
}: {
  unit: ScheduleUnit;
  roster: Roster;
  onChange: (next: { unit: ScheduleUnit; roster: Roster }) => void;
  dailyCapacity?: number;
  startDate?: string;
  endDate?: string;
}) {
  const cap = dailyCapacity > 0 ? dailyCapacity : 8;
  const raw = weekdayAllocationValue(roster);
  const hoursPerDay = unit === 'hours' ? raw : raw * cap;
  const displayValue =
    unit === 'utilization'
      ? Math.round(raw * 1000) / 10
      : Math.round(hoursPerDay * 10) / 10;
  const weekdayCount =
    startDate && endDate ? countWeekdaysInRange(startDate, endDate) : 0;
  const totalHours = Math.round(hoursPerDay * weekdayCount * 10) / 10;

  const setUnit = (next: ScheduleUnit) => {
    if (next === unit) return;
    if (next === 'hours') {
      onChange({ unit: next, roster: weekdayRoster(hoursPerDay) });
    } else {
      onChange({ unit: next, roster: weekdayRoster(cap > 0 ? hoursPerDay / cap : 0) });
    }
  };

  const setValue = (value: number) => {
    const safe = Math.max(0, Number.isFinite(value) ? value : 0);
    if (unit === 'utilization') {
      onChange({ unit, roster: weekdayRoster(safe / 100) });
    } else {
      onChange({ unit, roster: weekdayRoster(safe) });
    }
  };

  return (
    <Field>
      <Label className="text-sm font-semibold">Allocation</Label>
      <div className="grid grid-cols-[1fr_8.5rem] gap-2">
        <Input
          type="number"
          min={0}
          max={unit === 'utilization' ? 200 : 24}
          step={unit === 'utilization' ? 5 : 0.5}
          value={displayValue}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <Select
          value={unit}
          onChange={setUnit}
          options={ALLOCATION_UNIT_OPTIONS}
          aria-label="Allocation unit"
        />
      </div>
      <Description>
        Total hours: <span className="font-semibold text-secondary">{totalHours}</span>
      </Description>
    </Field>
  );
}

interface CapacityFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: Resource[];
  projects: Project[];
  assignments: ScheduleAssignment[];
  onBookResource: (resourceId: string, startDate: string, endDate: string) => void;
}

export const CapacityFinderModal: React.FC<CapacityFinderModalProps> = ({
  isOpen,
  onClose,
  resources,
  projects,
  assignments,
  onBookResource,
}) => {
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-06-30');
  const [minAvailableDays, setMinAvailableDays] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Peak weekday utilization in range → approximate free days/wk
  const daysInRange = expandDates(startDate, endDate);
  const resourceAvailabilities = resources.map((res) => {
    const dailyCap = personDailyCapacityHours(res.weeklyHours, res.fte);
    const relevant = assignments.filter(
      (a) => a.resourceId === res.id && datesOverlap(a.startDate, a.endDate, startDate, endDate),
    );

    let maxUtil = 0;
    daysInRange.forEach((day) => {
      if (isoWeekdayIndex(day) >= 5) return;
      let hours = 0;
      relevant.forEach((a) => {
        hours += blockHoursOnDate(a, day, dailyCap);
      });
      maxUtil = Math.max(maxUtil, dailyCap > 0 ? hours / dailyCap : 0);
    });

    const peakAssignedDays = Math.min(5, maxUtil * 5);
    const availableDays = Math.max(0, 5 - peakAssignedDays);
    return {
      resource: res,
      assignedDays: Math.round(peakAssignedDays * 100) / 100,
      availableDays: Math.round(availableDays * 100) / 100,
    };
  });

  const filteredResults = resourceAvailabilities.filter((item) => {
    const q = searchQuery.toLowerCase();
    const nameStr = item.resource.name || '';
    const roleStr = item.resource.role || '';
    const matchesSearch = nameStr.toLowerCase().includes(q) || roleStr.toLowerCase().includes(q);
    return matchesSearch && item.availableDays >= minAvailableDays;
  });

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      id="capacity-finder-modal-container"
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-500" />
          Resource Capacity Finder
        </span>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-muted p-4 rounded-lg border border-subtle">
          <Field>
            <Label className="uppercase tracking-wider">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field>
            <Label className="uppercase tracking-wider">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
          <Field>
            <Label className="uppercase tracking-wider">Min free days/wk</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={minAvailableDays}
                onChange={(e) => setMinAvailableDays(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-semibold text-primary w-10 text-right">{minAvailableDays}d</span>
            </div>
          </Field>
        </div>

        <div className="relative">
          <Input
            type="text"
            placeholder="Search resource name or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <Search className="w-4 h-4 text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide">
            Available Resources ({filteredResults.length})
          </h4>
          {filteredResults.length === 0 ? (
            <div className="text-center py-8 text-tertiary text-sm">
              No resources match the selected criteria or availability percentage.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto pr-1">
              {filteredResults.map((item) => (
                <div
                  key={item.resource.id}
                  className="py-3 flex items-center justify-between hover:bg-surface-muted px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {item.resource.avatarUrl ? (
                      <img
                        referrerPolicy="no-referrer"
                        src={item.resource.avatarUrl}
                        alt={item.resource.name}
                        className="w-10 h-10 rounded-full object-cover border border-subtle"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
                        {item.resource.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                    )}
                    <div>
                      <h5 className="text-sm font-semibold text-primary">{item.resource.name}</h5>
                      <p className="text-xs text-secondary">{item.resource.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-600">{item.availableDays}d free/wk</div>
                      <div className="text-xs text-tertiary">({item.assignedDays}d booked peak)</div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        onBookResource(item.resource.id, startDate, endDate);
                        onClose();
                      }}
                    >
                      Book
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};


interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: Resource[];
  projects: Project[];
  onSave: (params: {
    resourceId: string;
    projectId: string;
    startDate: string;
    endDate: string;
    unit: ScheduleUnit;
    roster: Roster;
    title?: string;
    billableType?: BillableType;
    bookingType: BookingCommitmentType;
  }) => void | Promise<void>;
  initialResourceId?: string;
  initialProjectId?: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  resources,
  projects,
  onSave,
  initialResourceId = '',
  initialProjectId = '',
  initialStartDate = '2026-06-01',
  initialEndDate = '2026-06-15',
}) => {
  const fromProject = Boolean(initialProjectId) && !initialResourceId;
  const fromResource = Boolean(initialResourceId) && !initialProjectId;
  const fromBoth = Boolean(initialResourceId) && Boolean(initialProjectId);
  const fromScratch = !initialResourceId && !initialProjectId;

  const [resourceId, setResourceId] = useState(initialResourceId);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState<ScheduleUnit>('utilization');
  const [roster, setRoster] = useState<Roster>([...DEFAULT_ROSTER] as Roster);
  const [bookingType, setBookingType] = useState<BookingCommitmentType>('hard');
  const [billableOverride, setBillableOverride] = useState(BILLABLE_OVERRIDE_EMPTY);
  const [endsMode, setEndsMode] = useState<BookingEndsMode>('on');
  const [endsOnDate, setEndsOnDate] = useState(initialEndDate);
  const [occurrences, setOccurrences] = useState(
    () => weeklyOccurrencesForEndDate(initialStartDate, initialEndDate),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResourceId(initialResourceId);
      setProjectId(initialProjectId);
      setStartDate(initialStartDate);
      setTitle('');
      setUnit('utilization');
      setRoster([...DEFAULT_ROSTER] as Roster);
      setBookingType('hard');
      setBillableOverride(BILLABLE_OVERRIDE_EMPTY);
      setEndsMode('on');
      setEndsOnDate(initialEndDate);
      setOccurrences(weeklyOccurrencesForEndDate(initialStartDate, initialEndDate));
    }
  }, [isOpen, initialResourceId, initialProjectId, initialStartDate, initialEndDate]);

  const resourceOptions = useMemo(
    () =>
      resources.map((res) => ({
        value: res.id,
        label: `${res.name} (${res.role})`,
      })),
    [resources],
  );
  const projectOptions = useMemo(
    () =>
      projects.map((proj) => ({
        value: proj.id,
        label: `${proj.name} - ${proj.client}`,
      })),
    [projects],
  );

  if (!isOpen) return null;

  const fixedProject = projects.find((p) => p.id === initialProjectId);
  const fixedResource = resources.find((r) => r.id === initialResourceId);
  const selectedProject = projects.find((p) => p.id === projectId);
  const billingProject = fromProject || fromBoth ? fixedProject : selectedProject;
  const billingLabel = billingProject
    ? getProjectCategoryLabel(getProjectCategory(billingProject))
    : '—';

  const allocationResourceId = fromProject || fromScratch ? resourceId : initialResourceId;
  const allocationResource =
    resources.find((r) => r.id === allocationResourceId) || fixedResource || null;
  const dailyCapacity = personDailyCapacityHours(
    allocationResource?.weeklyHours,
    allocationResource?.fte,
  );

  const resolveEndDate = (): string => {
    if (endsMode === 'after') return endDateAfterWeeklyOccurrences(startDate, occurrences);
    return endsOnDate || startDate;
  };

  const syncFromEndsOnDate = (nextEnd: string) => {
    const safeEnd = startDate && nextEnd < startDate ? startDate : nextEnd;
    setEndsOnDate(safeEnd);
    setOccurrences(weeklyOccurrencesForEndDate(startDate, safeEnd));
  };

  const syncFromOccurrences = (nextOccurrences: number) => {
    const n = Math.max(1, nextOccurrences);
    setOccurrences(n);
    setEndsOnDate(endDateAfterWeeklyOccurrences(startDate, n));
  };

  const syncFromStartDate = (nextStart: string) => {
    setStartDate(nextStart);
    if (endsMode === 'after') {
      setEndsOnDate(endDateAfterWeeklyOccurrences(nextStart, occurrences));
      return;
    }
    const safeEnd = endsOnDate && endsOnDate < nextStart ? nextStart : endsOnDate;
    setEndsOnDate(safeEnd);
    setOccurrences(weeklyOccurrencesForEndDate(nextStart, safeEnd || nextStart));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedResourceId = fromProject || fromScratch ? resourceId : initialResourceId;
    const resolvedProjectId = fromResource || fromScratch ? projectId : initialProjectId;
    const project = projects.find((p) => p.id === resolvedProjectId);
    const resolvedEnd = resolveEndDate();
    if (!resolvedResourceId || !resolvedProjectId || !project || !startDate || !resolvedEnd) return;
    if (startDate > resolvedEnd) return;

    setSaving(true);
    try {
      await onSave({
        resourceId: resolvedResourceId,
        projectId: resolvedProjectId,
        startDate,
        endDate: resolvedEnd,
        unit,
        roster: weekdayRoster(weekdayAllocationValue(roster)),
        title: title.trim() || undefined,
        billableType: parseBillableOverride(billableOverride),
        bookingType,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const description = fromProject
    ? 'Assign a Resource on a Project'
    : fromResource
      ? 'Assign a Project to a Resource'
      : 'Schedule a Resource on a Project';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      id="schedule-modal-container"
      size="lg"
      title="Schedule Resource"
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="schedule-modal-form"
            loading={saving}
          >
            {saving ? 'Scheduling…' : 'Schedule'}
          </Button>
        </>
      }
    >
      <form id="schedule-modal-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {fromBoth && fixedResource && fixedProject && (
          <div className="p-3 bg-surface-muted rounded-lg border border-subtle space-y-2">
            <div>
              <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-0.5">Resource</p>
              <p className="text-sm font-bold text-primary">{fixedResource.name}</p>
              <p className="text-xs text-secondary">{fixedResource.role}</p>
            </div>
            <div className="border-t border-subtle pt-2">
              <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-0.5">Project</p>
              <p className="text-sm font-bold text-primary">{fixedProject.name}</p>
              <p className="text-xs text-secondary">{fixedProject.client}</p>
              <p className="text-xs text-secondary mt-1">
                Billing: <span className="font-semibold text-primary">{billingLabel}</span>
              </p>
            </div>
          </div>
        )}

        {fromProject && fixedProject && (
          <div className="p-3 bg-surface-muted rounded-lg border border-subtle">
            <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-1">Project</p>
            <p className="text-sm font-bold text-primary">{fixedProject.name}</p>
            <p className="text-xs text-secondary">{fixedProject.client}</p>
            <p className="text-xs text-secondary mt-1">
              Billing: <span className="font-semibold text-primary">{billingLabel}</span>
            </p>
          </div>
        )}

        {fromResource && fixedResource && (
          <div className="p-3 bg-surface-muted rounded-lg border border-subtle">
            <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-1">Resource</p>
            <p className="text-sm font-bold text-primary">{fixedResource.name}</p>
            <p className="text-xs text-secondary">{fixedResource.role}</p>
          </div>
        )}

        {(fromProject || fromScratch) && (
          <Field>
            <Label className="text-sm font-semibold">Resource</Label>
            <Combobox
              value={resourceId || null}
              onChange={(v) => setResourceId(v || '')}
              options={resourceOptions}
              placeholder="Type at least 3 characters…"
            />
          </Field>
        )}

        {(fromResource || fromScratch) && (
          <Field>
            <Label className="text-sm font-semibold">Project</Label>
            <Combobox
              value={projectId || null}
              onChange={(v) => setProjectId(v || '')}
              options={projectOptions}
              placeholder="Type at least 3 characters…"
            />
            {billingProject && (
              <Description>
                Billing: <span className="font-semibold text-secondary">{billingLabel}</span>
                <span className="text-tertiary"> (from project)</span>
              </Description>
            )}
          </Field>
        )}

        <Field>
          <Label className="text-sm font-semibold">Title (optional)</Label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint support"
          />
        </Field>

        <AllocationFields
          unit={unit}
          roster={roster}
          dailyCapacity={dailyCapacity}
          startDate={startDate}
          endDate={resolveEndDate()}
          onChange={({ unit: nextUnit, roster: nextRoster }) => {
            setUnit(nextUnit);
            setRoster(nextRoster);
          }}
        />

        <Field>
          <Label className="text-sm font-semibold">Start</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => syncFromStartDate(e.target.value)}
            required
          />
        </Field>

        <div>
          <p className="text-sm font-semibold text-secondary mb-2">Ends</p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 text-sm text-secondary">
              <input type="radio" name="create-ends-mode" checked={endsMode === 'on'} onChange={() => setEndsMode('on')} />
              <span className="w-12 font-medium">On</span>
              <Input
                type="date"
                value={endsOnDate}
                disabled={endsMode !== 'on'}
                onChange={(e) => syncFromEndsOnDate(e.target.value)}
                className="w-auto"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-secondary">
              <input type="radio" name="create-ends-mode" checked={endsMode === 'after'} onChange={() => setEndsMode('after')} />
              <span className="w-12 font-medium">After</span>
              <Input
                type="number"
                min={1}
                value={occurrences}
                disabled={endsMode !== 'after'}
                onChange={(e) => syncFromOccurrences(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 text-center"
              />
              <span className="text-xs text-tertiary">Occurrences (weeks)</span>
            </label>
          </div>
        </div>

        <Field>
          <Label className="text-sm font-semibold">Booking</Label>
          <Select
            value={bookingType}
            onChange={(v) => setBookingType(v)}
            options={[
              { value: 'hard' as const, label: 'Hard' },
              { value: 'soft' as const, label: 'Soft' },
            ]}
          />
        </Field>

        <Field>
          <Label className="text-sm font-semibold">Billable type</Label>
          <Select
            value={billableOverride}
            onChange={(v) => setBillableOverride(String(v))}
            options={billableOverrideOptions(billingProject || selectedProject)}
          />
          <p className="mt-1 text-xs text-tertiary">
            Leave as project default unless this allocation needs a different type.
          </p>
        </Field>
      </form>
    </Modal>
  );
};


interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: Resource[];
  projects: Project[];
  onSave: (request: Omit<BookingRequest, 'id' | 'status'>) => void | Promise<void>;
}

export const RequestModal: React.FC<RequestModalProps> = ({
  isOpen,
  onClose,
  resources,
  projects,
  onSave,
}) => {
  const [resourceId, setResourceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [startDate, setStartDate] = useState('2026-06-15');
  const [endDate, setEndDate] = useState('2026-06-30');
  const [unit, setUnit] = useState<ScheduleUnit>('utilization');
  const [roster, setRoster] = useState<Roster>([...DEFAULT_ROSTER] as Roster);
  const [billableOverride, setBillableOverride] = useState(BILLABLE_OVERRIDE_EMPTY);
  const [notes, setNotes] = useState('');
  const [consultingUnitId, setConsultingUnitId] = useState('');
  const [practiceAreaId, setPracticeAreaId] = useState('');
  const [competencyCenterId, setCompetencyCenterId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [jobLevelId, setJobLevelId] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: lookups } = useLookups();

  useEffect(() => {
    if (isOpen) {
      setResourceId(resources[0]?.id || '');
      setProjectId(projects[0]?.id || '');
      setStartDate('2026-06-15');
      setEndDate('2026-06-30');
      setUnit('utilization');
      setRoster([...DEFAULT_ROSTER] as Roster);
      setBillableOverride(BILLABLE_OVERRIDE_EMPTY);
      setNotes('');
      setConsultingUnitId('');
      setPracticeAreaId('');
      setCompetencyCenterId('');
      setSiteId('');
      setJobLevelId('');
    }
  }, [isOpen, resources, projects]);

  const resourceOptions = useMemo(
    () =>
      resources.map((res) => ({
        value: res.id,
        label: `${res.name} (${res.role})`,
      })),
    [resources],
  );
  const projectOptions = useMemo(
    () =>
      projects.map((proj) => ({
        value: proj.id,
        label: `${proj.name} - ${proj.client}`,
      })),
    [projects],
  );

  if (!isOpen) return null;

  const filteredCompetencyCenters = (lookups?.competencyCenters || []).filter(
    (entry) => !practiceAreaId || entry.practice_area_id === practiceAreaId,
  );

  const requestResource = resources.find((r) => r.id === resourceId);
  const requestProject = projects.find((p) => p.id === projectId);
  const dailyCapacity = personDailyCapacityHours(
    requestResource?.weeklyHours,
    requestResource?.fte,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceId || !projectId || !startDate || !endDate) return;
    if (startDate > endDate) return;
    setSaving(true);
    try {
      await onSave({
        resourceId,
        projectId,
        billableType: parseBillableOverride(billableOverride),
        referenceId: crypto.randomUUID(),
        bookingType: 'hard',
        probability: 100,
        notes,
        consultingUnitId: consultingUnitId || null,
        practiceAreaId: practiceAreaId || null,
        competencyCenterId: competencyCenterId || null,
        siteId: siteId || null,
        jobLevelId: jobLevelId || null,
        startDate,
        endDate,
        unit,
        roster: weekdayRoster(weekdayAllocationValue(roster)),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const anyOption = { value: '', label: 'Any' };
  const cuOptions = [anyOption, ...(lookups?.consultingUnits || []).map((e) => ({ value: e.id, label: e.name }))];
  const practiceOptions = [anyOption, ...(lookups?.practiceAreas || []).map((e) => ({ value: e.id, label: e.name }))];
  const ccOptions = [anyOption, ...filteredCompetencyCenters.map((e) => ({ value: e.id, label: e.name }))];
  const siteOptions = [anyOption, ...(lookups?.sites || []).map((e) => ({ value: e.id, label: e.name }))];
  const levelOptions = [anyOption, ...(lookups?.jobLevels || []).map((e) => ({ value: e.id, label: e.name }))];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      id="request-modal-container"
      size="md"
      title={
        <span className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-500" />
          Request Project Booking
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="request-modal-form"
            loading={saving}
          >
            {saving ? 'Submitting…' : 'Submit Approval Request'}
          </Button>
        </>
      }
    >
      <form id="request-modal-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Field>
          <Label className="text-sm font-semibold">Allocate Resource</Label>
          <Combobox
            value={resourceId || null}
            onChange={(v) => setResourceId(v || '')}
            options={resourceOptions}
            placeholder="Type at least 3 characters…"
            nullable={false}
          />
        </Field>

        <Field>
          <Label className="text-sm font-semibold">Select Project</Label>
          <Combobox
            value={projectId || null}
            onChange={(v) => setProjectId(v || '')}
            options={projectOptions}
            placeholder="Type at least 3 characters…"
            nullable={false}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label className="text-sm font-semibold">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>
          <Field>
            <Label className="text-sm font-semibold">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field>
          <Label className="text-sm font-semibold">Billable type</Label>
          <Select
            value={billableOverride}
            onChange={(v) => setBillableOverride(String(v))}
            options={billableOverrideOptions(requestProject)}
          />
          <p className="mt-1 text-xs text-tertiary">
            Leave as project default unless this request needs a different type.
          </p>
        </Field>

        <AllocationFields
          unit={unit}
          roster={roster}
          dailyCapacity={dailyCapacity}
          startDate={startDate}
          endDate={endDate}
          onChange={({ unit: nextUnit, roster: nextRoster }) => {
            setUnit(nextUnit);
            setRoster(nextRoster);
          }}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label className="text-sm font-semibold">CU</Label>
            <Select value={consultingUnitId} onChange={(v) => setConsultingUnitId(v)} options={cuOptions} />
          </Field>
          <Field>
            <Label className="text-sm font-semibold">Practice</Label>
            <Select
              value={practiceAreaId}
              onChange={(v) => {
                setPracticeAreaId(v);
                setCompetencyCenterId('');
              }}
              options={practiceOptions}
            />
          </Field>
          <Field>
            <Label className="text-sm font-semibold">CC</Label>
            <Select value={competencyCenterId} onChange={(v) => setCompetencyCenterId(v)} options={ccOptions} />
          </Field>
          <Field>
            <Label className="text-sm font-semibold">Site</Label>
            <Select value={siteId} onChange={(v) => setSiteId(v)} options={siteOptions} />
          </Field>
          <Field className="col-span-2">
            <Label className="text-sm font-semibold">Level</Label>
            <Select value={jobLevelId} onChange={(v) => setJobLevelId(v)} options={levelOptions} />
          </Field>
        </div>

        <Field>
          <Label className="text-sm font-semibold">Justification / Request Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="E.g. Support project launch workload buffer, replacing vacant head count."
            rows={3}
          />
        </Field>
      </form>
    </Modal>
  );
};


interface EditAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: AllocationBlock | null;
  projects: Project[];
  resources: Resource[];
  /**
   * Optional override for sibling clamps. When omitted, loads only the
   * person+project schedules needed for Entire-mode date bounds.
   */
  assignments?: ScheduleAssignment[];
  onUpdate: (block: AllocationBlock, updated: ScheduleEditPatch) => void | Promise<void>;
  onDelete: (block: AllocationBlock) => void | Promise<void>;
  /** Prefill apply scope when opening (e.g. from week menu or bar drag). */
  initialApplyScope?: ScheduleApplyScope;
  /** Prefill partial From/To when opening in partial mode. */
  initialPartialRange?: { startDate: string; endDate: string } | null;
}

export const EditAllocationModal: React.FC<EditAllocationModalProps> = ({
  isOpen,
  onClose,
  block,
  projects,
  resources,
  assignments: assignmentsProp,
  onUpdate,
  onDelete,
  initialApplyScope = 'entire',
  initialPartialRange = null,
}) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [unit, setUnit] = useState<ScheduleUnit>('utilization');
  const [roster, setRoster] = useState<Roster>([...DEFAULT_ROSTER] as Roster);
  const [endsMode, setEndsMode] = useState<BookingEndsMode>('on');
  const [endsOnDate, setEndsOnDate] = useState('');
  const [occurrences, setOccurrences] = useState(4);
  const [applyScope, setApplyScope] = useState<ScheduleApplyScope>('entire');
  const [billableOverride, setBillableOverride] = useState(BILLABLE_OVERRIDE_EMPTY);
  const [partialFrom, setPartialFrom] = useState('');
  const [partialTo, setPartialTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const fetchSiblings = isOpen && !!block && assignmentsProp === undefined;
  const { data: fetchedSiblings = [] } = useScheduleSiblings(
    block?.resourceId,
    block?.projectId,
    fetchSiblings,
  );
  const assignments = assignmentsProp ?? fetchedSiblings;

  useEffect(() => {
    if (!isOpen || !block) return;
    setTitle(block.title || '');
    setUnit(block.unit);
    setRoster(weekdayRoster(weekdayAllocationValue(normalizeRoster(block.roster))));
    setStartDate(block.startDate);
    setEndsMode('on');
    setEndsOnDate(block.endDate);
    setOccurrences(weeklyOccurrencesForEndDate(block.startDate, block.endDate));
    setApplyScope(initialApplyScope);
    setBillableOverride(block.billableType || BILLABLE_OVERRIDE_EMPTY);
    const from = initialPartialRange?.startDate || block.startDate;
    const to = initialPartialRange?.endDate || block.endDate;
    setPartialFrom(from < block.startDate ? block.startDate : from > block.endDate ? block.endDate : from);
    setPartialTo(to > block.endDate ? block.endDate : to < block.startDate ? block.startDate : to);
    setSaving(false);
    setDeleting(false);
    setConfirmDeleteOpen(false);
  }, [isOpen, block, initialApplyScope, initialPartialRange]);

  if (!isOpen || !block) return null;

  const resource = resources.find((r) => r.id === block.resourceId);
  const project = projects.find((p) => p.id === block.projectId);
  const effectiveBillable = getEffectiveBillableType(block.billableType, project);
  const billingLabel = project
    ? `${getProjectCategoryLabel(getProjectCategory(project))}${block.billableType ? ` · override ${block.billableType}` : ''}`
    : effectiveBillable;
  const dailyCapacity = personDailyCapacityHours(resource?.weeklyHours, resource?.fte);
  const { minStart: siblingMinStart, maxEnd: siblingMaxEnd } = scheduleSiblingDateBounds(
    block,
    assignments,
  );

  const clampEntireStart = (nextStart: string): string => {
    let start = nextStart;
    if (siblingMinStart && start < siblingMinStart) start = siblingMinStart;
    if (siblingMaxEnd && start > siblingMaxEnd) start = siblingMaxEnd;
    return start;
  };

  const clampEntireEnd = (nextEnd: string, forStart: string): string => {
    let end = nextEnd < forStart ? forStart : nextEnd;
    if (siblingMaxEnd && end > siblingMaxEnd) end = siblingMaxEnd;
    if (siblingMinStart && end < siblingMinStart) end = siblingMinStart;
    if (end < forStart) end = forStart;
    return end;
  };

  const resolveEndDate = (): string => {
    const raw = endsMode === 'after'
      ? endDateAfterWeeklyOccurrences(startDate, occurrences)
      : (endsOnDate || startDate);
    return clampEntireEnd(raw, startDate);
  };

  const clampPartial = (from: string, to: string) => {
    let nextFrom = from;
    let nextTo = to;
    if (nextFrom < block.startDate) nextFrom = block.startDate;
    if (nextFrom > block.endDate) nextFrom = block.endDate;
    if (nextTo > block.endDate) nextTo = block.endDate;
    if (nextTo < block.startDate) nextTo = block.startDate;
    if (nextTo < nextFrom) nextTo = nextFrom;
    return { from: nextFrom, to: nextTo };
  };

  const syncFromEndsOnDate = (nextEnd: string) => {
    const safeEnd = clampEntireEnd(nextEnd, startDate);
    setEndsOnDate(safeEnd);
    setOccurrences(weeklyOccurrencesForEndDate(startDate, safeEnd));
  };

  const syncFromOccurrences = (nextOccurrences: number) => {
    const n = Math.max(1, nextOccurrences);
    setOccurrences(n);
    const computed = endDateAfterWeeklyOccurrences(startDate, n);
    const safeEnd = clampEntireEnd(computed, startDate);
    setEndsOnDate(safeEnd);
    if (safeEnd !== computed) {
      setOccurrences(weeklyOccurrencesForEndDate(startDate, safeEnd));
    }
  };

  const syncFromStartDate = (nextStart: string) => {
    const safeStart = clampEntireStart(nextStart);
    setStartDate(safeStart);
    if (endsMode === 'after') {
      const computed = endDateAfterWeeklyOccurrences(safeStart, occurrences);
      const safeEnd = clampEntireEnd(computed, safeStart);
      setEndsOnDate(safeEnd);
      if (safeEnd !== computed) {
        setOccurrences(weeklyOccurrencesForEndDate(safeStart, safeEnd));
      }
      return;
    }
    const safeEnd = clampEntireEnd(endsOnDate || safeStart, safeStart);
    setEndsOnDate(safeEnd);
    setOccurrences(weeklyOccurrencesForEndDate(safeStart, safeEnd));
  };

  const allocationStart = applyScope === 'partial' ? partialFrom : startDate;
  const allocationEnd = applyScope === 'partial' ? partialTo : resolveEndDate();

  const partialValid =
    Boolean(partialFrom && partialTo) &&
    partialFrom <= partialTo &&
    partialFrom >= block.startDate &&
    partialTo <= block.endDate;

  const entireValid = Boolean(startDate && resolveEndDate() && startDate <= resolveEndDate());
  const canSubmit = applyScope === 'partial' ? partialValid : entireValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (applyScope === 'partial') {
        await onUpdate(block, {
          title: title.trim() || undefined,
          startDate: partialFrom,
          endDate: partialTo,
          unit,
          roster: weekdayRoster(weekdayAllocationValue(roster)),
          applyScope: 'partial',
        });
      } else {
        await onUpdate(block, {
          title: title.trim() || undefined,
          startDate,
          endDate: resolveEndDate(),
          unit,
          roster: weekdayRoster(weekdayAllocationValue(roster)),
          applyScope: 'entire',
          billableType: parseBillableOverride(billableOverride) ?? null,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal
      open={isOpen}
      onClose={onClose}
      id="edit-allocation-modal-container"
      size="lg"
      title="Schedule Resource"
      description="Edit allocation on a project"
      footer={
        <>
          <Button
            variant="danger"
            className="mr-auto"
            leftIcon={<Trash2 className="w-4 h-4" />}
            loading={deleting}
            disabled={saving}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="edit-allocation-modal-form"
            loading={saving}
            disabled={!canSubmit || deleting}
          >
            {saving ? 'Updating…' : 'Update'}
          </Button>
        </>
      }
    >
      <form id="edit-allocation-modal-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div className="p-3 bg-surface-muted rounded-lg border border-subtle grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-0.5">Resource</p>
            <p className="text-sm font-bold text-primary">{resource?.name || 'Unknown'}</p>
            <p className="text-xs text-secondary">{resource?.role}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-0.5">Project</p>
            <p className="text-sm font-bold text-primary">{project?.name || 'Unknown'}</p>
            <p className="text-xs text-secondary">{billingLabel} · {block.bookingType}</p>
          </div>
        </div>

        <Field>
          <Label className="text-sm font-semibold">Apply changes to</Label>
          <RadioGroup
            aria-label="Apply changes to"
            value={applyScope}
            onChange={(value) => setApplyScope(value as ScheduleApplyScope)}
            options={[
              {
                value: 'entire',
                label: 'Entire allocation',
                description: `${block.startDate} – ${block.endDate}`,
              },
              {
                value: 'partial',
                label: 'Partial range',
                description: 'Change hours only inside a date window',
              },
            ]}
          />
        </Field>

        <Field>
          <Label className="text-sm font-semibold">Title (optional)</Label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint support"
          />
        </Field>

        {applyScope === 'entire' && (
          <Field>
            <Label className="text-sm font-semibold">Billable type</Label>
            <Select
              value={billableOverride}
              onChange={(v) => setBillableOverride(String(v))}
              options={billableOverrideOptions(project)}
            />
            <p className="mt-1 text-xs text-tertiary">
              Effective: {getEffectiveBillableType(parseBillableOverride(billableOverride), project)}
            </p>
          </Field>
        )}

        <AllocationFields
          unit={unit}
          roster={roster}
          dailyCapacity={dailyCapacity}
          startDate={allocationStart}
          endDate={allocationEnd}
          onChange={({ unit: nextUnit, roster: nextRoster }) => {
            setUnit(nextUnit);
            setRoster(nextRoster);
          }}
        />

        {applyScope === 'partial' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field>
                <Label className="text-sm font-semibold">From</Label>
                <Input
                  type="date"
                  min={block.startDate}
                  max={block.endDate}
                  value={partialFrom}
                  onChange={(e) => {
                    const { from, to } = clampPartial(e.target.value, partialTo || e.target.value);
                    setPartialFrom(from);
                    setPartialTo(to);
                  }}
                />
              </Field>
              <Field>
                <Label className="text-sm font-semibold">To</Label>
                <Input
                  type="date"
                  min={block.startDate}
                  max={block.endDate}
                  value={partialTo}
                  onChange={(e) => {
                    const { from, to } = clampPartial(partialFrom || e.target.value, e.target.value);
                    setPartialFrom(from);
                    setPartialTo(to);
                  }}
                />
              </Field>
            </div>
            <Description>
              Outside this range the current allocation is unchanged. The booking may split into up to 3 parts.
            </Description>
          </div>
        ) : (
          <>
            <Field>
              <Label className="text-sm font-semibold">Start</Label>
              <Input
                type="date"
                min={siblingMinStart ?? undefined}
                max={siblingMaxEnd ?? undefined}
                value={startDate}
                onChange={(e) => syncFromStartDate(e.target.value)}
              />
            </Field>

            <div>
              <p className="text-sm font-semibold text-secondary mb-2">Ends</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm text-secondary">
                  <input type="radio" name="ends-mode" checked={endsMode === 'on'} onChange={() => setEndsMode('on')} />
                  <span className="w-12 font-medium">On</span>
                  <Input
                    type="date"
                    min={startDate || siblingMinStart || undefined}
                    max={siblingMaxEnd ?? undefined}
                    value={endsOnDate}
                    disabled={endsMode !== 'on'}
                    onChange={(e) => syncFromEndsOnDate(e.target.value)}
                    className="w-auto"
                  />
                </label>
                <label className="flex items-center gap-3 text-sm text-secondary">
                  <input type="radio" name="ends-mode" checked={endsMode === 'after'} onChange={() => setEndsMode('after')} />
                  <span className="w-12 font-medium">After</span>
                  <Input
                    type="number"
                    min={1}
                    value={occurrences}
                    disabled={endsMode !== 'after'}
                    onChange={(e) => syncFromOccurrences(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 text-center"
                  />
                  <span className="text-xs text-tertiary">Occurrences (weeks)</span>
                </label>
              </div>
              {(siblingMinStart || siblingMaxEnd) && (
                <Description className="mt-2">
                  Dates are limited so this allocation stays clear of other bookings for the same resource and project
                  {siblingMinStart && siblingMaxEnd
                    ? ` (${siblingMinStart} – ${siblingMaxEnd})`
                    : siblingMinStart
                      ? ` (from ${siblingMinStart})`
                      : ` (through ${siblingMaxEnd})`}
                  .
                </Description>
              )}
            </div>
          </>
        )}
      </form>
    </Modal>

    <ConfirmDialog
      open={confirmDeleteOpen}
      onClose={() => setConfirmDeleteOpen(false)}
      confirmLabel="Delete"
      loading={deleting}
      onConfirm={async () => {
        setDeleting(true);
        try {
          await onDelete(block);
          setConfirmDeleteOpen(false);
          onClose();
        } finally {
          setDeleting(false);
        }
      }}
    >
      Delete this entire allocation? This cannot be undone.
    </ConfirmDialog>
    </>
  );
};

interface ResourceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource?: Resource | null;
  onSave: (resource: Omit<Resource, 'id'> | Resource) => void | Promise<void>;
}

export const ResourceFormModal: React.FC<ResourceFormModalProps> = ({ isOpen, onClose, resource, onSave }) => {
  const isEdit = Boolean(resource?.id);
  const { data: lookups } = useLookups();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('Consultant');
  const [jobLevelId, setJobLevelId] = useState<string>('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (resource) {
      const names = resource.name.split(/\s+/);
      setFirstName(resource.firstName || names[0] || '');
      setLastName(resource.lastName || names.slice(1).join(' ') || '');
      setEmail(resource.email || '');
      setEmployeeId(resource.employeeId || '');
      setRole(resource.role || 'Consultant');
      setJobLevelId(resource.jobLevelId || '');
      setStatus(resource.status || 'Active');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setEmployeeId('');
      setRole('Consultant');
      setJobLevelId('');
      setStatus('Active');
    }
  }, [isOpen, resource]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    const payload = {
      name: `${firstName.trim()} ${lastName.trim()}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      employeeId: employeeId.trim() || undefined,
      role: role.trim(),
      jobLevelId: jobLevelId || null,
      status,
    };

    setSaving(true);
    try {
      if (isEdit && resource) {
        await onSave({ ...resource, ...payload });
      } else {
        await onSave(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const jobLevelOptions = [
    { value: '', label: 'Any' },
    ...(lookups?.jobLevels || []).map((level) => ({ value: level.id, label: level.name })),
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-500" />
          {isEdit ? 'Edit Resource' : 'Add Resource'}
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="resource-form-modal-form"
            loading={saving}
          >
            {saving
              ? isEdit
                ? 'Saving…'
                : 'Adding…'
              : isEdit
                ? 'Save Changes'
                : 'Add Resource'}
          </Button>
        </>
      }
    >
      <form id="resource-form-modal-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <Label className="uppercase">First Name</Label>
            <Input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </Field>
          <Field>
            <Label className="uppercase">Last Name</Label>
            <Input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </Field>
        </div>
        <Field>
          <Label className="uppercase">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane.doe@example.com"
          />
        </Field>
        <Field>
          <Label className="uppercase">Employee ID</Label>
          <Input
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="EMP-1006"
          />
        </Field>
        <Field>
          <Label className="uppercase">Designation</Label>
          <Input type="text" value={role} onChange={(e) => setRole(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <Label className="uppercase">Job Level</Label>
            <Select value={jobLevelId} onChange={(v) => setJobLevelId(v)} options={jobLevelOptions} />
          </Field>
          <Field>
            <Label className="uppercase">Status</Label>
            <Select
              value={status}
              onChange={(v) => setStatus(v)}
              options={[
                { value: 'Active' as const, label: 'Active' },
                { value: 'Inactive' as const, label: 'Inactive' },
              ]}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
};

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (resource: Omit<Resource, 'id'>) => void | Promise<void>;
}

export const AddResourceModal: React.FC<AddResourceModalProps> = ({ isOpen, onClose, onAdd }) => (
  <ResourceFormModal isOpen={isOpen} onClose={onClose} onSave={(data) => onAdd(data as Omit<Resource, 'id'>)} />
);

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
  onSave: (project: Omit<Project, 'id'> | Project) => void | Promise<void>;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ isOpen, onClose, project, onSave }) => {
  const isEdit = Boolean(project?.id);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [winProbability, setWinProbability] = useState(100);
  const [isOpportunity, setIsOpportunity] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (project) {
      setName(project.name);
      setProjectId(project.projectId || '');
      const winProb = project.winProbability ?? (project.isOpportunity ? 35 : 100);
      setWinProbability(winProb);
      setIsOpportunity(winProb < 100);
    } else {
      setName('');
      setProjectId('');
      setWinProbability(100);
      setIsOpportunity(false);
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      projectId: projectId.trim() || undefined,
      client: 'Demo Client',
      textColor: 'text-white',
      isOpportunity,
      winProbability: isOpportunity ? Math.min(winProbability, 99) : 100,
    };

    const categoryColor = getProjectCategoryIconClass(
      getProjectCategory({
        id: project?.id || 'new',
        name: payload.name,
        client: payload.client,
        color: 'bg-emerald-500',
        textColor: 'text-white',
        isOpportunity: payload.isOpportunity,
        winProbability: payload.winProbability,
      }),
    );

    setSaving(true);
    try {
      if (isEdit && project) {
        await onSave({ ...project, ...payload, color: categoryColor });
      } else {
        await onSave({ ...payload, color: categoryColor, textColor: 'text-white' });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-500" />
          {isEdit ? 'Edit Project' : 'Add Project'}
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="project-form-modal-form"
            loading={saving}
          >
            {saving
              ? isEdit
                ? 'Saving…'
                : 'Adding…'
              : isEdit
                ? 'Save Changes'
                : 'Add Project'}
          </Button>
        </>
      }
    >
      <form id="project-form-modal-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Field>
          <Label className="uppercase">Project Name</Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Phoenix Platform"
            required
          />
        </Field>
        <Field>
          <Label className="uppercase">Project ID</Label>
          <Input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="e.g. PRJ-DEMO-001"
          />
        </Field>
        <Field className="flex-row items-center gap-2">
          <Checkbox
            checked={isOpportunity}
            onChange={setIsOpportunity}
            id="is-opportunity"
          />
          <Label htmlFor="is-opportunity" className="text-sm text-primary font-normal">
            Opportunity (not yet committed)
          </Label>
        </Field>
        {isOpportunity && (
          <Field>
            <Label className="uppercase">Win Probability (%)</Label>
            <Input
              type="number"
              min={0}
              max={99}
              value={winProbability}
              onChange={(e) => setWinProbability(Number(e.target.value))}
            />
          </Field>
        )}
      </form>
    </Modal>
  );
};

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (project: Omit<Project, 'id'>) => void | Promise<void>;
}

export const AddProjectModal: React.FC<AddProjectModalProps> = ({ isOpen, onClose, onAdd }) => (
  <ProjectFormModal isOpen={isOpen} onClose={onClose} onSave={(data) => onAdd(data as Omit<Project, 'id'>)} />
);
