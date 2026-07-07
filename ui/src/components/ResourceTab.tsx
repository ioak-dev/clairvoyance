/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Resource } from '../types';
import { ResourceFormModal } from './Modals';
import { Search, Briefcase, Plus, Pencil, Trash2 } from 'lucide-react';

interface ResourceTabProps {
  resources: Resource[];
  onAddResource: (resource: Omit<Resource, 'id'>) => void | Promise<void>;
  onUpdateResource: (resource: Resource) => void | Promise<void>;
  onDeleteResource: (id: string) => void | Promise<void>;
}

export const ResourceTab: React.FC<ResourceTabProps> = ({
  resources,
  onAddResource,
  onUpdateResource,
  onDeleteResource,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPracticeArea, setSelectedPracticeArea] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  const practiceAreas = useMemo(() => {
    const areas = new Set(resources.map((r) => r.practiceArea).filter(Boolean) as string[]);
    return Array.from(areas).sort();
  }, [resources]);

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const haystack = `${res.name} ${res.role} ${res.email || ''} ${res.employeeId || ''}`.toLowerCase();
      if (searchQuery && !haystack.includes(searchQuery.toLowerCase())) return false;

      if (selectedPracticeArea !== 'all' && res.practiceArea !== selectedPracticeArea) return false;

      const status = res.status || 'Active';
      if (selectedStatus !== 'all' && status !== selectedStatus) return false;

      return true;
    });
  }, [resources, searchQuery, selectedPracticeArea, selectedStatus]);

  const handleDelete = async (res: Resource) => {
    if (!window.confirm(`Delete resource "${res.name}"? This will remove related schedules and vacations.`)) return;
    await onDeleteResource(res.id);
  };

  const handleSave = async (data: Omit<Resource, 'id'> | Resource) => {
    if ('id' in data && data.id) {
      await onUpdateResource(data as Resource);
    } else {
      await onAddResource(data as Omit<Resource, 'id'>);
    }
    setEditingResource(null);
  };

  return (
    <div className="space-y-6" id="resource-tab-container">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Resources</h2>
          <p className="text-sm text-gray-500">Manage people master data</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingResource(null); setIsFormOpen(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Resource
        </button>
      </div>

      <div className="app-card p-5" id="resource-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">Search Resources</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
              <input
                id="resource-tab-search-input"
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">Filter by Practice Area</label>
            <select value={selectedPracticeArea} onChange={(e) => setSelectedPracticeArea(e.target.value)} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100">
              <option value="all">All Practice Areas</option>
              {practiceAreas.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">Filter by Status</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100">
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden" id="resource-tab-list-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto" id="resource-tab-details-table">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800/80 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Resource Name</th>
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Practice Area</th>
                <th className="px-6 py-4">Job Level</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-sm">
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm" id="resource-tab-empty-state">
                    No resources found matching the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredResources.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-colors" id={`resource-tab-row-${res.id}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center shrink-0 text-xs">
                          {res.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">{res.name}</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{res.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-600 dark:text-gray-300">{res.employeeId || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center text-xs font-medium text-gray-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 mr-1" />
                        {res.practiceArea || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-900/50">
                        {res.jobCategory || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                        res.status === 'Inactive'
                          ? 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200'
                          : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100/50'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${res.status === 'Inactive' ? 'bg-gray-500' : 'bg-emerald-500'}`} />
                        {res.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => { setEditingResource(res); setIsFormOpen(true); }} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(res)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ResourceFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingResource(null); }}
        resource={editingResource}
        onSave={handleSave}
      />
    </div>
  );
};
