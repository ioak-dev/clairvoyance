/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Resource, Project, Allocation, BillableType, BookingRequest, Vacation } from '../types';
import { Search, ShieldAlert, Check, Calendar, Plus, X, UserMinus, UserCheck, Trash2 } from 'lucide-react';

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
  allocations: Allocation[];
  onBookResource: (resourceId: string, startDate: string, endDate: string) => void;
}

export const CapacityFinderModal: React.FC<CapacityFinderModalProps> = ({
  isOpen,
  onClose,
  resources,
  projects,
  allocations,
  onBookResource,
}) => {
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-06-30');
  const [minAvailability, setMinAvailability] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Calculate available capacity per resource in the selected date range
  const resourceAvailabilities = resources.map((res) => {
    // Collect allocations overlapping the range
    const overlapping = allocations.filter((alloc) => {
      if (alloc.resourceId !== res.id) return false;
      return alloc.startDate <= endDate && alloc.endDate >= startDate;
    });

    // Simple aggregate calculation: sum up of allocation percentage
    // For a highly elegant model, let's calculate the weighted availability
    let totalAssigned = 0;
    overlapping.forEach((alloc) => {
      totalAssigned += alloc.billablePercent;
    });

    const availability = Math.max(0, 100 - totalAssigned);
    return {
      resource: res,
      assignedPercent: totalAssigned,
      availablePercent: availability,
      overlappingAllocations: overlapping,
    };
  });

  const filteredResults = resourceAvailabilities.filter((item) => {
    const q = searchQuery.toLowerCase();
    const nameStr = item.resource.name || '';
    const roleStr = item.resource.role || '';
    const matchesSearch = nameStr.toLowerCase().includes(q) ||
                          roleStr.toLowerCase().includes(q);
    const matchesCapacity = item.availablePercent >= minAvailability;
    return matchesSearch && matchesCapacity;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="capacity-finder-modal-container">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" />
            Resource Capacity Finder
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Query Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Min Availability %</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={minAvailability}
                  onChange={(e) => setMinAvailability(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-sm font-semibold text-gray-700 w-10 text-right">{minAvailability}%</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search resource name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          </div>

          {/* Results List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Available Resources ({filteredResults.length})</h4>
            {filteredResults.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No resources match the selected criteria or availability percentage.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto pr-1">
                {filteredResults.map((item) => (
                  <div key={item.resource.id} className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      {item.resource.avatarUrl ? (
                        <img referrerPolicy="no-referrer" src={item.resource.avatarUrl} alt={item.resource.name} className="w-10 h-10 rounded-full object-cover border border-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
                          {item.resource.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                      )}
                      <div>
                        <h5 className="text-sm font-semibold text-gray-800">{item.resource.name}</h5>
                        <p className="text-xs text-gray-500">{item.resource.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-600">{item.availablePercent}% Available</div>
                        <div className="text-xs text-gray-400">({item.assignedPercent}% Booked)</div>
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
  onSave: (allocation: Omit<Allocation, 'id'>) => void;
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
  const [resourceId, setResourceId] = useState(initialResourceId);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [billablePercent, setBillablePercent] = useState(100);
  const [billableType, setBillableType] = useState<BillableType>('Billable');

  useEffect(() => {
    if (isOpen) {
      setResourceId(initialResourceId || (resources[0]?.id || ''));
      setProjectId(initialProjectId || (projects[0]?.id || ''));
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      setBillablePercent(100);
      setBillableType('Billable');
    }
  }, [isOpen, initialResourceId, initialProjectId, initialStartDate, initialEndDate, resources, projects]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceId || !projectId || !startDate || !endDate) return;
    onSave({
      resourceId,
      projectId,
      startDate,
      endDate,
      billablePercent,
      billableType,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="schedule-modal-container">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Schedule Resource Allocation
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Select Resource</label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
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

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Select Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              required
            >
              <option value="" disabled>-- Select Project --</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} - {proj.client}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Billing Classification</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillableType('Billable')}
                className={`py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                  billableType === 'Billable'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Billable
              </button>
              <button
                type="button"
                onClick={() => setBillableType('Opportunity')}
                className={`py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                  billableType === 'Opportunity'
                    ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700/80 dark:text-amber-300'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-800'
                }`}
              >
                Opportunity
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Allocation Percentage %</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={billablePercent}
                onChange={(e) => setBillablePercent(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-bold text-gray-700 w-12 text-right">{billablePercent}%</span>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium cursor-pointer"
            >
              Allocate Space
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
  const [billablePercent, setBillablePercent] = useState(100);
  const [billableType, setBillableType] = useState<BillableType>('Billable');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setResourceId(resources[0]?.id || '');
      setProjectId(projects[0]?.id || '');
      setStartDate('2026-06-15');
      setEndDate('2026-06-30');
      setBillablePercent(100);
      setBillableType('Billable');
      setNotes('');
    }
  }, [isOpen, resources, projects]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceId || !projectId || !startDate || !endDate) return;
    onSave({
      resourceId,
      projectId,
      startDate,
      endDate,
      billablePercent,
      billableType,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="request-modal-container">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500" />
            Request Project Booking
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Allocate Resource</label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
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
            <label className="block text-sm font-semibold text-gray-600 mb-1">Select Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
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
              <label className="block text-sm font-semibold text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Type</label>
              <select
                value={billableType}
                onChange={(e) => setBillableType(e.target.value as BillableType)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="Billable">Billable</option>
                <option value="Opportunity">Opportunity</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Assign Rate %</label>
              <input
                type="number"
                min="10"
                max="100"
                value={billablePercent}
                onChange={(e) => setBillablePercent(Number(e.target.value))}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Justification / Request Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Support project launch workload buffer, replacing vacant head count."
              rows={3}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-400 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium cursor-pointer"
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
  allocation: Allocation | null;
  projects: Project[];
  resources: Resource[];
  onUpdate: (allocation: Allocation) => void;
  onDelete: (id: string) => void;
}

export const EditAllocationModal: React.FC<EditAllocationModalProps> = ({
  isOpen,
  onClose,
  allocation,
  projects,
  resources,
  onUpdate,
  onDelete,
}) => {
  const [resourceId, setResourceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billablePercent, setBillablePercent] = useState(100);
  const [billableType, setBillableType] = useState<BillableType>('Billable');

  useEffect(() => {
    if (isOpen && allocation) {
      setResourceId(allocation.resourceId);
      setProjectId(allocation.projectId);
      setStartDate(allocation.startDate);
      setEndDate(allocation.endDate);
      setBillablePercent(allocation.billablePercent);
      setBillableType(allocation.billableType);
    }
  }, [isOpen, allocation]);

  if (!isOpen || !allocation) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      ...allocation,
      resourceId,
      projectId,
      startDate,
      endDate,
      billablePercent,
      billableType,
    });
    onClose();
  };

  const selectedRes = resources.find((r) => r.id === resourceId);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="edit-allocation-modal-container">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" />
            Edit Resource Allocation
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 mb-2">
            {selectedRes?.avatarUrl ? (
              <img referrerPolicy="no-referrer" src={selectedRes.avatarUrl} alt={selectedRes?.name || ''} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center font-bold">
                {selectedRes?.name ? selectedRes.name.split(' ').map((n) => n[0]).join('') : 'R'}
              </div>
            )}
            <div>
              <h4 className="text-sm font-bold text-indigo-950">{selectedRes?.name}</h4>
              <p className="text-xs text-indigo-700 font-medium">{selectedRes?.role}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Assigned Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
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
              <label className="block text-sm font-semibold text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Billing Classification</label>
              <select
                value={billableType}
                onChange={(e) => setBillableType(e.target.value as BillableType)}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              >
                <option value="Billable">Billable</option>
                <option value="Opportunity">Opportunity</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Billable Rate %</label>
              <input
                type="number"
                min="10"
                max="100"
                value={billablePercent}
                onChange={(e) => setBillablePercent(Number(e.target.value))}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                if (safeConfirm('Are you sure you want to delete this allocation?')) {
                  onDelete(allocation.id);
                  onClose();
                }
              }}
              className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium cursor-pointer"
              >
                Save Changes
              </button>
            </div>
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

export const AddResourceModal: React.FC<AddResourceModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Consultant');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [group, setGroup] = useState('Win India Team');
  const [customGroup, setCustomGroup] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      role: role.trim(),
      avatarUrl: avatarUrl.trim() || undefined,
      group: group === 'Other' ? (customGroup.trim() || 'Other') : group,
    });
    setName('');
    setRole('Consultant');
    setAvatarUrl('');
    setGroup('Win India Team');
    setCustomGroup('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="add-resource-modal-container">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 font-sans">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500" />
            Add New Resource
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Role / Title</label>
            <input
              type="text"
              placeholder="e.g. Frontend Engineer, Product Owner, Consultant"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Team Group</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              required
            >
              <option value="Win India Team">Win India Team</option>
              <option value="Win Europe Team">Win Europe Team</option>
              <option value="Win US Team">Win US Team</option>
              <option value="Win Contractors">Win Contractors</option>
              <option value="Other">Other...</option>
            </select>
          </div>

          {group === 'Other' && (
            <div className="animate-fade-in">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Custom Group Name</label>
              <input
                type="text"
                placeholder="e.g. Win Design Team"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Avatar Image URL (Optional)</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/example-avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium cursor-pointer"
            >
              Add Resource
            </button>
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

export const AddProjectModal: React.FC<AddProjectModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [group, setGroup] = useState('');
  const [color, setColor] = useState('bg-[#4e82c2]');
  const [isOpportunity, setIsOpportunity] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !client.trim()) return;
    onAdd({
      name: name.trim(),
      client: client.trim(),
      color: color,
      textColor: 'text-white',
      isOpportunity: isOpportunity,
      group: group.trim() || 'Unassigned',
    });
    setName('');
    setClient('');
    setGroup('');
    setColor('bg-[#4e82c2]');
    setIsOpportunity(false);
    onClose();
  };

  const colorPalettes = [
    { class: 'bg-[#4e82c2]', name: 'Muted Blue' },
    { class: 'bg-[#22c55e]', name: 'Grass Green' },
    { class: 'bg-[#a855f7]', name: 'Deep Purple' },
    { class: 'bg-[#f97316]', name: 'Safety Orange' },
    { class: 'bg-[#ec4899]', name: 'Hot Pink' },
    { class: 'bg-[#06b6d4]', name: 'Cyan Waters' },
    { class: 'bg-[#facc15]', name: 'Sunny Yellow' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="add-project-modal-container">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 font-sans">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-500" />
            Add New Project
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Project Name</label>
            <input
              type="text"
              placeholder="e.g. Phoenix Redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Client</label>
            <input
              type="text"
              placeholder="e.g. Acme Corp"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Project Group</label>
            <input
              type="text"
              placeholder="e.g. Work Group 1"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Type</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="projectType"
                  checked={!isOpportunity}
                  onChange={() => setIsOpportunity(false)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                Active Project
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="projectType"
                  checked={isOpportunity}
                  onChange={() => setIsOpportunity(true)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                Opportunity
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Theme Color</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {colorPalettes.map((item) => (
                <button
                  key={item.class}
                  type="button"
                  onClick={() => setColor(item.class)}
                  title={item.name}
                  className={`w-6 h-6 rounded-full ${item.class} border-2 transition-all ${
                    color === item.class ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium cursor-pointer"
            >
              Add Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
