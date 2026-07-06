/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import { Search, Folder, Code, Layers, Award, ShieldAlert } from 'lucide-react';

interface ProjectTabProps {
  projects: Project[];
}

export const ProjectTab: React.FC<ProjectTabProps> = ({ projects }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Stable Category mapper
  const getProjectCategory = (proj: Project): 'Billable' | 'Non-billable' | 'Internal' | 'Opportunity' => {
    if (proj.isOpportunity) return 'Opportunity';
    if (proj.id.includes('internal') || proj.name.toLowerCase().includes('support')) return 'Internal';
    if (proj.id === 'proj-solventum') return 'Non-billable';
    return 'Billable';
  };

  // Stable Status mapper
  const getProjectStatus = (proj: Project): 'Active' | 'Completed' | 'On Hold' | 'Pipeline' => {
    if (proj.isOpportunity) return 'Pipeline';
    if (proj.id === 'proj-solventum') return 'On Hold';
    if (proj.id === 'proj-internal') return 'Completed';
    return 'Active';
  };

  // Stable Job Level mapper
  const getProjectJobLevel = (projId: string): string => {
    const levels = ['L1', 'L2', 'L3'];
    const charSum = projId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return levels[charSum % levels.length];
  };

  // Stable Skill Set mapper
  const getProjectSkills = (projId: string): string[] => {
    const skillMap: Record<string, string[]> = {
      'proj-tms': ['React', 'TypeScript', 'Tailwind CSS'],
      'proj-s4hana': ['SAP ABAP', 'SAP FICO', 'SQL'],
      'proj-solventum': ['UI/UX Design', 'Figma', 'HTML/CSS'],
      'proj-internal': ['Node.js', 'AWS', 'DevOps'],
      'proj-opp-honda': ['Project Management', 'Agile', 'Scrum'],
    };
    return skillMap[projId] || ['Consulting', 'Java'];
  };

  // Filter projects based on search, category, and status
  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      // Name or Client search
      if (
        searchQuery &&
        !proj.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !proj.client.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Category filter
      const category = getProjectCategory(proj);
      if (selectedCategory !== 'all' && category !== selectedCategory) {
        return false;
      }

      // Status filter
      const status = getProjectStatus(proj);
      if (selectedStatus !== 'all' && status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [projects, searchQuery, selectedCategory, selectedStatus]);

  return (
    <div className="space-y-6" id="project-tab-container">
      {/* Modern Filter Section */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm" id="project-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Project Search */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Search Projects
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
              <input
                id="project-search-input"
                type="text"
                placeholder="Search by project or client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Filter by Category
            </label>
            <select
              id="project-category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100"
            >
              <option value="all">All Categories</option>
              <option value="Billable">Billable</option>
              <option value="Non-billable">Non-billable</option>
              <option value="Internal">Internal</option>
              <option value="Opportunity">Opportunity</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Filter by Status
            </label>
            <select
              id="project-status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Pipeline">Pipeline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Project Table View */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm overflow-hidden" id="project-list-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto" id="project-details-table">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800/80 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Skill Set</th>
                <th className="px-6 py-4">Job Level</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-sm">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm" id="project-empty-state">
                    No projects found matching the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((proj) => {
                  const skills = getProjectSkills(proj.id);
                  const level = getProjectJobLevel(proj.id);
                  const category = getProjectCategory(proj);
                  const status = getProjectStatus(proj);

                  return (
                    <tr key={proj.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-colors" id={`project-row-${proj.id}`}>
                      {/* Project Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg ${proj.color || 'bg-blue-600'} flex items-center justify-center text-white shrink-0`}>
                            <Folder className="w-4.5 h-4.5 stroke-[2.5]" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">{proj.name}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{proj.client}</p>
                          </div>
                        </div>
                      </td>

                      {/* Skill Set */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {skills.map((skill, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded"
                            >
                              <Code className="w-2.5 h-2.5 text-slate-400" />
                              {skill}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Job Level */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-900/50">
                          {level}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${
                            category === 'Billable'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40'
                              : category === 'Opportunity'
                              ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900/40'
                              : category === 'Internal'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/40'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/40'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5 opacity-80" />
                          {category}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                            status === 'Active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/30'
                              : status === 'Completed'
                              ? 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700/80'
                              : status === 'On Hold'
                              ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 border-rose-100/50 dark:border-rose-900/30'
                              : 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === 'Active'
                                ? 'bg-emerald-500'
                                : status === 'Completed'
                                ? 'bg-gray-500'
                                : status === 'On Hold'
                                ? 'bg-rose-500'
                                : 'bg-blue-500'
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
