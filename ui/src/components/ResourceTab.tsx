/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Resource } from '../types';
import { Search, User, Briefcase, Award, CheckCircle } from 'lucide-react';

interface ResourceTabProps {
  resources: Resource[];
}

export const ResourceTab: React.FC<ResourceTabProps> = ({ resources }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPracticeArea, setSelectedPracticeArea] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Stable Job Level mapper
  const getJobLevel = (resourceId: string): string => {
    const customMap: Record<string, string> = {
      'res-1': 'L3',
      'res-2': 'L2',
      'res-3': 'L1',
      'res-4': 'L3',
      'res-5': 'L2',
    };
    if (customMap[resourceId]) return customMap[resourceId];
    const levels = ['L1', 'L2', 'L3'];
    const charSum = resourceId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return levels[charSum % levels.length];
  };

  // Stable Practice Area mapper
  const getPracticeArea = (resourceId: string): string => {
    const customMap: Record<string, string> = {
      'res-1': 'Java',
      'res-2': 'Consulting',
      'res-3': 'Consulting',
      'res-4': 'Consulting',
      'res-5': 'Java',
    };
    if (customMap[resourceId]) return customMap[resourceId];
    const areas = ['Consulting', 'Java'];
    const charSum = resourceId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return areas[charSum % areas.length];
  };

  // Stable Status mapper
  const getResourceStatus = (resourceId: string): 'Active' | 'On Bench' | 'On Leave' => {
    const customMap: Record<string, 'Active' | 'On Bench' | 'On Leave'> = {
      'res-1': 'Active',
      'res-2': 'Active',
      'res-3': 'On Bench',
      'res-4': 'On Leave',
      'res-5': 'Active',
    };
    return customMap[resourceId] || 'Active';
  };

  // Filter resources based on search, practice area, and status
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      // Name or role search
      if (
        searchQuery &&
        !res.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !res.role.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Practice Area filter
      const area = getPracticeArea(res.id);
      if (selectedPracticeArea !== 'all' && area !== selectedPracticeArea) {
        return false;
      }

      // Status filter
      const status = getResourceStatus(res.id);
      if (selectedStatus !== 'all' && status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [resources, searchQuery, selectedPracticeArea, selectedStatus]);

  return (
    <div className="space-y-6" id="resource-tab-container">
      {/* Modern Filter Section */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm" id="resource-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Resource Search */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Search Resources
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
              <input
                id="resource-tab-search-input"
                type="text"
                placeholder="Search by name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Practice Area Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Filter by Practice Area
            </label>
            <select
              id="resource-practice-area-select"
              value={selectedPracticeArea}
              onChange={(e) => setSelectedPracticeArea(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100"
            >
              <option value="all">All Practice Areas</option>
              <option value="Consulting">Consulting</option>
              <option value="Java">Java</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Filter by Status
            </label>
            <select
              id="resource-tab-status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="On Bench">On Bench</option>
              <option value="On Leave">On Leave</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resource Table View */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm overflow-hidden" id="resource-tab-list-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto" id="resource-tab-details-table">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800/80 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Resource Name</th>
                <th className="px-6 py-4">Practice Area</th>
                <th className="px-6 py-4">Job Level</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-sm">
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm" id="resource-tab-empty-state">
                    No resources found matching the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredResources.map((res) => {
                  const area = getPracticeArea(res.id);
                  const level = getJobLevel(res.id);
                  const status = getResourceStatus(res.id);

                  return (
                    <tr key={res.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-colors" id={`resource-tab-row-${res.id}`}>
                      {/* Resource details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {res.avatarUrl ? (
                            <img
                              referrerPolicy="no-referrer"
                              src={res.avatarUrl}
                              alt={res.name}
                              className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-100 dark:border-slate-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center shrink-0 text-xs">
                              {res.name.split(' ').map((n) => n[0]).join('')}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">{res.name}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{res.role}</p>
                          </div>
                        </div>
                      </td>

                      {/* Practice Area */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-xs font-medium text-gray-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                          <Briefcase className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 mr-1" />
                          {area}
                        </span>
                      </td>

                      {/* Job Level */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-900/50">
                          {level}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                            status === 'Active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/30'
                              : status === 'On Bench'
                              ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30'
                              : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 border-rose-100/50 dark:border-rose-900/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === 'Active'
                                ? 'bg-emerald-500'
                                : status === 'On Bench'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
