/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Resource, Vacation } from '../types';
import { Search, SlidersHorizontal, Plane, Calendar, User, Users, Briefcase } from 'lucide-react';

interface VacationTabProps {
  vacations: Vacation[];
  resources: Resource[];
  onApproveVacation?: (id: string) => void;
  onRejectVacation?: (id: string) => void;
  onSubmitVacation?: (vacation: Omit<Vacation, 'id' | 'status'>) => void;
  onDeleteVacation?: (id: string) => void;
}

export const VacationTab: React.FC<VacationTabProps> = ({
  vacations,
  resources,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Extract unique groups from resources
  const groups = useMemo(() => {
    const allGroups = resources
      .map((r) => r.group)
      .filter((g): g is string => !!g);
    return Array.from(new Set(allGroups));
  }, [resources]);

  const getResourceName = (id: string) => {
    return resources.find((r) => r.id === id)?.name || 'Unknown Resource';
  };

  const getResourceRole = (id: string) => {
    return resources.find((r) => r.id === id)?.role || 'Specialist';
  };

  const getResourceGroup = (id: string) => {
    return resources.find((r) => r.id === id)?.group || 'N/A';
  };

  const getResourceAvatar = (id: string) => {
    return resources.find((r) => r.id === id)?.avatarUrl;
  };

  const getJobLevel = (resourceId: string) => {
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

  const getPracticeArea = (resourceId: string) => {
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

  // Filter vacations based on search query, group, and status
  const filteredVacations = useMemo(() => {
    return vacations.filter((v) => {
      const resource = resources.find((r) => r.id === v.resourceId);
      
      // Resource Name Search Filter
      const resName = resource?.name || 'Unknown Resource';
      if (searchQuery && !resName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Group Filter
      const resGroup = resource?.group || '';
      if (selectedGroup !== 'all' && resGroup !== selectedGroup) {
        return false;
      }

      // Status Filter
      if (selectedStatus !== 'all' && v.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [vacations, resources, searchQuery, selectedGroup, selectedStatus]);

  return (
    <div className="space-y-6" id="vacation-tab-container">
      {/* Modern Filter Section */}
      <div className="app-card p-5" id="vacation-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Resource Search */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Search Team Member
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
              <input
                id="vacation-search-input"
                type="text"
                placeholder="Search resource name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Group Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Filter by Team Group
            </label>
            <select
              id="vacation-group-select"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100"
            >
              <option value="all">All Groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Filter by Status
            </label>
            <select
              id="vacation-status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending Approvals</option>
              <option value="Approved">Approved Leaves</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

       {/* Vacation Table View */}
      <div className="app-card overflow-hidden" id="vacation-list-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto" id="vacation-details-table">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800/80 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Resource</th>
                <th className="px-6 py-4">Calendar Duration</th>
                <th className="px-6 py-4">Job Level</th>
                <th className="px-6 py-4">Practice Area</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-sm">
              {filteredVacations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm" id="vacation-empty-state">
                    No vacation leave registrations found matching the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredVacations.map((v) => {
                  const name = getResourceName(v.resourceId);
                  const role = getResourceRole(v.resourceId);
                  const avatar = getResourceAvatar(v.resourceId);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-colors" id={`vacation-row-${v.id}`}>
                      {/* Resource details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {avatar ? (
                            <img
                              referrerPolicy="no-referrer"
                              src={avatar}
                              alt={name}
                              className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-100 dark:border-slate-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center shrink-0 text-xs">
                              {name.split(' ').map((n) => n[0]).join('')}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">{name}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{role}</p>
                          </div>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs font-semibold text-gray-700 dark:text-gray-300">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                            {v.startDate} to {v.endDate}
                          </span>
                        </div>
                      </td>

                      {/* Job Level */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-900/50">
                          {getJobLevel(v.resourceId)}
                        </span>
                      </td>

                      {/* Practice Area */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-xs font-medium text-gray-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                          <Briefcase className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 mr-1" />
                          {getPracticeArea(v.resourceId)}
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
