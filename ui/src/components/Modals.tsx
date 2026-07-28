/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { AllocationBlock, BillableType, BookingCommitmentType, BookingRequest, Project, Resource, ScheduleAssignment, Vacation, JobCategory } from '../types';
import { Search, ShieldAlert, Check, Calendar, Plus, X, UserMinus, UserCheck, Trash2 } from 'lucide-react';
import { getProjectCategory, getProjectCategoryIconClass, getBillableTypeFromProject, getProjectCategoryLabel } from '../lib/projectCategory';
import { dateRangeToWeeks, isoWeekToDateRange } from '../lib/weekUtils';
import { useLookups } from '../hooks/useLookups';

const safeConfirm = (msg: string): boolean => {
  try {
    return window.confirm(msg);
  } catch (e) {
    console.warn("confirm() blocked by environment, auto-confirming", e);
    return true;
  }
};

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

  // Calculate available capacity per resource in the selected date range
  const weekKeysInRange = dateRangeToWeeks(startDate, endDate);

  const resourceAvailabilities = resources.map((res) => {
    let maxAssignedDays = 0;
    weekKeysInRange.forEach((wk) => {
      let weekTotal = 0;
      assignments.filter((a) => a.resourceId === res.id).forEach((a) => {
        const match = a.weeks.find((w) => w.isoYear === wk.isoYear && w.isoWeek === wk.isoWeek);
        if (match) weekTotal += match.daysPerWeek;
      });
      maxAssignedDays = Math.max(maxAssignedDays, weekTotal);
    });

    const availableDays = 5 - maxAssignedDays;
    return {
      resource: res,
      assignedDays: maxAssignedDays,
      availableDays,
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
    <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4" id="capacity-finder-modal-container">
      <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        <div className="app-card-header px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" />
            Resource Capacity Finder
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg transition-colors text-tertiary hover:text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Query Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-muted p-4 rounded-lg border border-subtle">
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">Min free days/wk</label>
              <div className="flex items-center gap-2 mt-1">
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
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search resource name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-default rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
            />
            <Search className="w-4 h-4 text-tertiary absolute left-3 top-3" />
          </div>

          {/* Results List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-secondary uppercase tracking-wide">Available Resources ({filteredResults.length})</h4>
            {filteredResults.length === 0 ? (
              <div className="text-center py-8 text-tertiary text-sm">
                No resources match the selected criteria or availability percentage.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto pr-1">
                {filteredResults.map((item) => (
                  <div key={item.resource.id} className="py-3 flex items-center justify-between hover:bg-surface-muted px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      {item.resource.avatarUrl ? (
                        <img referrerPolicy="no-referrer" src={item.resource.avatarUrl} alt={item.resource.name} className="w-10 h-10 rounded-full object-cover border border-subtle" />
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
                      <button
                        onClick={() => {
                          onBookResource(item.resource.id, startDate, endDate);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Book
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
    daysPerWeek: number;
    billableType: BillableType;
    bookingType: BookingCommitmentType;
  }) => void;
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

  const [resourceId, setResourceId] = useState(initialResourceId);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [daysPerWeek, setDaysPerWeek] = useState(5);

  useEffect(() => {
    if (isOpen) {
      setResourceId(initialResourceId);
      setProjectId(initialProjectId);
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      setDaysPerWeek(5);
    }
  }, [isOpen, initialResourceId, initialProjectId, initialStartDate, initialEndDate]);

  if (!isOpen) return null;

  const fixedProject = projects.find((p) => p.id === initialProjectId);
  const fixedResource = resources.find((r) => r.id === initialResourceId);
  const selectedProject = projects.find((p) => p.id === projectId);
  const billingProject = fromProject || fromBoth ? fixedProject : selectedProject;
  const billingLabel = billingProject
    ? getProjectCategoryLabel(getProjectCategory(billingProject))
    : '—';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedResourceId = fromProject ? resourceId : initialResourceId;
    const resolvedProjectId = fromResource ? projectId : initialProjectId;
    const project = projects.find((p) => p.id === resolvedProjectId);
    if (!resolvedResourceId || !resolvedProjectId || !project || !startDate || !endDate) return;

    onSave({
      resourceId: resolvedResourceId,
      projectId: resolvedProjectId,
      startDate,
      endDate,
      daysPerWeek,
      billableType: getBillableTypeFromProject(project),
      bookingType: 'hard',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4" id="schedule-modal-container">
      <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-md w-full flex flex-col overflow-hidden">
        <div className="app-card-header px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            {fromProject ? 'Assign Resource' : fromResource ? 'Assign Project' : 'Schedule Allocation'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg transition-colors text-tertiary hover:text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {fromProject && (
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Resource</label>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              >
                <option value="" disabled>-- Select Resource --</option>
                {resources.map((res) => (
                  <option key={res.id} value={res.id}>
                    {res.name} ({res.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {fromResource && (
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              >
                <option value="" disabled>-- Select Project --</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} - {proj.client}
                  </option>
                ))}
              </select>
              {billingProject && (
                <p className="text-xs text-secondary mt-1.5">
                  Billing: <span className="font-semibold text-primary">{billingLabel}</span>
                  <span className="text-tertiary"> (from project)</span>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-1">Days per week (0–5)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-bold text-primary w-12 text-right">{daysPerWeek}d</span>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-default text-secondary hover:bg-gray-50 rounded-lg text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium cursor-pointer"
            >
              Save Allocation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: Resource[];
  projects: Project[];
  onSave: (request: Omit<BookingRequest, 'id' | 'status'>) => void;
}

const JOB_CATEGORY_OPTIONS: JobCategory[] = [
  'B0- Fresher',
  'L0', 'L1', 'L2', 'L3', 'L4', 'L5',
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5',
];

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
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [billableType, setBillableType] = useState<BillableType>('Billable');
  const [notes, setNotes] = useState('');
  const [consultingUnitId, setConsultingUnitId] = useState('');
  const [practiceAreaId, setPracticeAreaId] = useState('');
  const [competencyCenterId, setCompetencyCenterId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [jobCategory, setJobCategory] = useState('');
  const { data: lookups } = useLookups();

  useEffect(() => {
    if (isOpen) {
      setResourceId(resources[0]?.id || '');
      setProjectId(projects[0]?.id || '');
      setStartDate('2026-06-15');
      setEndDate('2026-06-30');
      setDaysPerWeek(5);
      setBillableType('Billable');
      setNotes('');
      setConsultingUnitId('');
      setPracticeAreaId('');
      setCompetencyCenterId('');
      setSiteId('');
      setJobCategory('');
    }
  }, [isOpen, resources, projects]);

  if (!isOpen) return null;

  const filteredCompetencyCenters = (lookups?.competencyCenters || []).filter(
    (entry) => !practiceAreaId || entry.practice_area_id === practiceAreaId,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceId || !projectId || !startDate || !endDate) return;
    const weeks = dateRangeToWeeks(startDate, endDate).map((w) => ({ ...w, daysPerWeek }));
    onSave({
      resourceId,
      projectId,
      billableType,
      referenceId: crypto.randomUUID(),
      bookingType: 'hard',
      probability: 100,
      notes,
      consultingUnitId: consultingUnitId || null,
      practiceAreaId: practiceAreaId || null,
      competencyCenterId: competencyCenterId || null,
      siteId: siteId || null,
      jobCategory: (jobCategory as JobCategory) || null,
      weeks,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4" id="request-modal-container">
      <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-lg w-full flex flex-col overflow-hidden max-h-[90vh]">
        <div className="app-card-header px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500" />
            Request Project Booking
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg transition-colors text-tertiary hover:text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold text-secondary mb-1">Allocate Resource</label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              required
            >
              {resources.map((res) => (
                <option key={res.id} value={res.id}>
                  {res.name} ({res.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-1">Select Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              required
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} - {proj.client}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Type</label>
              <select
                value={billableType}
                onChange={(e) => setBillableType(e.target.value as BillableType)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="Billable">Billable</option>
                <option value="Opportunity">Opportunity</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Days per week</label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.5"
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">CU</label>
              <select
                value={consultingUnitId}
                onChange={(e) => setConsultingUnitId(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="">Any</option>
                {(lookups?.consultingUnits || []).map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Practice</label>
              <select
                value={practiceAreaId}
                onChange={(e) => {
                  setPracticeAreaId(e.target.value);
                  setCompetencyCenterId('');
                }}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="">Any</option>
                {(lookups?.practiceAreas || []).map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">CC</label>
              <select
                value={competencyCenterId}
                onChange={(e) => setCompetencyCenterId(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="">Any</option>
                {filteredCompetencyCenters.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="">Any</option>
                {(lookups?.sites || []).map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-secondary mb-1">Level</label>
              <select
                value={jobCategory}
                onChange={(e) => setJobCategory(e.target.value)}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="">Any</option>
                {JOB_CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-1">Justification / Request Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Support project launch workload buffer, replacing vacant head count."
              rows={3}
              className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-default text-secondary hover:bg-gray-50 rounded-lg text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium cursor-pointer"
            >
              Submit Approval Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


interface EditAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: AllocationBlock | null;
  projects: Project[];
  resources: Resource[];
  onUpdate: (block: AllocationBlock, applyStartDate: string, applyEndDate: string, daysPerWeek: number) => void;
  onDelete: (block: AllocationBlock, applyStartDate: string, applyEndDate: string) => void;
}

export const EditAllocationModal: React.FC<EditAllocationModalProps> = ({
  isOpen,
  onClose,
  block,
  projects,
  resources,
  onUpdate,
  onDelete,
}) => {
  const [applyStartDate, setApplyStartDate] = useState('');
  const [applyEndDate, setApplyEndDate] = useState('');
  const [useFullBlock, setUseFullBlock] = useState(true);
  const [daysPerWeek, setDaysPerWeek] = useState(5);

  useEffect(() => {
    if (isOpen && block) {
      setApplyStartDate(block.startDate);
      setApplyEndDate(block.endDate);
      setUseFullBlock(true);
      setDaysPerWeek(block.daysPerWeek);
    }
  }, [isOpen, block]);

  if (!isOpen || !block) return null;

  const resource = resources.find((r) => r.id === block.resourceId);
  const project = projects.find((p) => p.id === block.projectId);
  const billingLabel = project ? getProjectCategoryLabel(getProjectCategory(project)) : block.billableType;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyStartDate || !applyEndDate) return;
    onUpdate(block, applyStartDate, applyEndDate, daysPerWeek);
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4" id="edit-allocation-modal-container">
      <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-md w-full flex flex-col overflow-hidden">
        <div className="app-card-header px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Edit Allocation
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg transition-colors text-tertiary hover:text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-surface-muted rounded-lg border border-subtle space-y-2">
            <div>
              <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-0.5">Resource</p>
              <p className="text-sm font-bold text-primary">{resource?.name || 'Unknown'}</p>
            </div>
            <div className="border-t border-subtle pt-2">
              <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-0.5">Project</p>
              <p className="text-sm font-bold text-primary">{project?.name || 'Unknown'}</p>
            </div>
            <div className="border-t border-subtle pt-2">
              <p className="text-[10px] font-bold text-tertiary uppercase tracking-wider mb-0.5">Block span</p>
              <p className="text-sm text-primary">{block.startDate} – {block.endDate}</p>
              <p className="text-xs text-secondary">{block.weeks.length} week(s) @ {block.daysPerWeek}d/wk · {billingLabel}</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={useFullBlock}
              onChange={(e) => {
                setUseFullBlock(e.target.checked);
                if (e.target.checked) {
                  setApplyStartDate(block.startDate);
                  setApplyEndDate(block.endDate);
                }
              }}
            />
            Use full block span
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Apply from</label>
              <input
                type="date"
                value={applyStartDate}
                onChange={(e) => { setApplyStartDate(e.target.value); setUseFullBlock(false); }}
                min={block.startDate}
                max={block.endDate}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1">Apply to</label>
              <input
                type="date"
                value={applyEndDate}
                onChange={(e) => { setApplyEndDate(e.target.value); setUseFullBlock(false); }}
                min={block.startDate}
                max={block.endDate}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-secondary mb-1">Days per week (0–5)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-bold text-primary w-12 text-right">{daysPerWeek}d</span>
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-subtle">
            <button
              type="button"
              onClick={() => {
                if (safeConfirm('Delete weeks in the selected apply range?')) {
                  onDelete(block, applyStartDate, applyEndDate);
                  onClose();
                }
              }}
              className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete range
            </button>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-default text-secondary hover:bg-gray-50 rounded-lg text-sm font-medium cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium cursor-pointer">
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ResourceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource?: Resource | null;
  onSave: (resource: Omit<Resource, 'id'> | Resource) => void;
}

const JOB_CATEGORIES = ['B0- Fresher', 'L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5'] as const;

export const ResourceFormModal: React.FC<ResourceFormModalProps> = ({ isOpen, onClose, resource, onSave }) => {
  const isEdit = Boolean(resource?.id);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('Consultant');
  const [jobCategory, setJobCategory] = useState<string>('L1');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  useEffect(() => {
    if (!isOpen) return;
    if (resource) {
      const names = resource.name.split(/\s+/);
      setFirstName(resource.firstName || names[0] || '');
      setLastName(resource.lastName || names.slice(1).join(' ') || '');
      setEmail(resource.email || '');
      setEmployeeId(resource.employeeId || '');
      setRole(resource.role || 'Consultant');
      setJobCategory(resource.jobCategory || 'L1');
      setStatus(resource.status || 'Active');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setEmployeeId('');
      setRole('Consultant');
      setJobCategory('L1');
      setStatus('Active');
    }
  }, [isOpen, resource]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    const payload = {
      name: `${firstName.trim()} ${lastName.trim()}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      employeeId: employeeId.trim() || undefined,
      role: role.trim(),
      jobCategory: jobCategory as Resource['jobCategory'],
      status,
    };

    if (isEdit && resource) {
      onSave({ ...resource, ...payload });
    } else {
      onSave(payload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-md w-full flex flex-col overflow-hidden">
        <div className="app-card-header px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            {isEdit ? 'Edit Resource' : 'Add Resource'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg transition-colors text-tertiary hover:text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-secondary mb-1 uppercase">First Name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-secondary mb-1 uppercase">Last Name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-secondary mb-1 uppercase">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane.doe@example.com" className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-secondary mb-1 uppercase">Employee ID</label>
            <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-1006" className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-secondary mb-1 uppercase">Designation</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-secondary mb-1 uppercase">Job Category</label>
              <select value={jobCategory} onChange={(e) => setJobCategory(e.target.value)} className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                {JOB_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-secondary mb-1 uppercase">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')} className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-subtle">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-default text-secondary hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">{isEdit ? 'Save Changes' : 'Add Resource'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (resource: Omit<Resource, 'id'>) => void;
}

export const AddResourceModal: React.FC<AddResourceModalProps> = ({ isOpen, onClose, onAdd }) => (
  <ResourceFormModal isOpen={isOpen} onClose={onClose} onSave={(data) => onAdd(data as Omit<Resource, 'id'>)} />
);

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
  onSave: (project: Omit<Project, 'id'> | Project) => void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ isOpen, onClose, project, onSave }) => {
  const isEdit = Boolean(project?.id);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [winProbability, setWinProbability] = useState(100);
  const [isOpportunity, setIsOpportunity] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
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

    if (isEdit && project) {
      onSave({ ...project, ...payload, color: categoryColor });
    } else {
      onSave({ ...payload, color: categoryColor, textColor: 'text-white' });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-md w-full flex flex-col overflow-hidden">
        <div className="app-card-header px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            {isEdit ? 'Edit Project' : 'Add Project'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg transition-colors text-tertiary hover:text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-secondary mb-1 uppercase">Project Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Phoenix Platform" className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-secondary mb-1 uppercase">Project ID</label>
            <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="e.g. PRJ-DEMO-001" className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is-opportunity" checked={isOpportunity} onChange={(e) => setIsOpportunity(e.target.checked)} className="rounded border-default" />
            <label htmlFor="is-opportunity" className="text-sm text-primary">Opportunity (not yet committed)</label>
          </div>
          {isOpportunity && (
            <div>
              <label className="block text-xs font-bold text-secondary mb-1 uppercase">Win Probability (%)</label>
              <input type="number" min={0} max={99} value={winProbability} onChange={(e) => setWinProbability(Number(e.target.value))} className="w-full text-xs border border-default rounded-lg p-2.5 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
          )}
          <div className="pt-4 flex justify-end gap-3 border-t border-subtle">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-default text-secondary hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">{isEdit ? 'Save Changes' : 'Add Project'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (project: Omit<Project, 'id'>) => void;
}

export const AddProjectModal: React.FC<AddProjectModalProps> = ({ isOpen, onClose, onAdd }) => (
  <ProjectFormModal isOpen={isOpen} onClose={onClose} onSave={(data) => onAdd(data as Omit<Project, 'id'>)} />
);
