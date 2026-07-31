/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Project } from '../types';
import { ProjectFormModal } from './Modals';
import { Search, Folder, Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { getProjectCategory, getProjectCategoryIconClass } from '../lib/projectCategory';

interface ProjectTabProps {
  projects: Project[];
  onAddProject: (project: Omit<Project, 'id'>) => void | Promise<void>;
  onUpdateProject: (project: Project) => void | Promise<void>;
  onDeleteProject: (id: string) => void | Promise<void>;
}

export const ProjectTab: React.FC<ProjectTabProps> = ({
  projects,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const getProjectStatus = (proj: Project): 'Active' | 'Completed' | 'On Hold' | 'Pipeline' => {
    if (proj.isOpportunity || (proj.winProbability ?? 100) < 100) return 'Pipeline';
    if (proj.name.toLowerCase().includes('support')) return 'Completed';
    return 'Active';
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const haystack = `${proj.name} ${proj.projectId || ''} ${proj.client}`.toLowerCase();
      if (searchQuery && !haystack.includes(searchQuery.toLowerCase())) return false;

      const category = getProjectCategory(proj);
      if (selectedCategory !== 'all' && category !== selectedCategory) return false;

      const status = getProjectStatus(proj);
      if (selectedStatus !== 'all' && status !== selectedStatus) return false;

      return true;
    });
  }, [projects, searchQuery, selectedCategory, selectedStatus]);

  const handleDelete = async (proj: Project) => {
    if (!window.confirm(`Delete project "${proj.name}"? This will remove related schedules and requests.`)) return;
    await onDeleteProject(proj.id);
  };

  const handleSave = async (data: Omit<Project, 'id'> | Project) => {
    if ('id' in data && data.id) {
      await onUpdateProject(data as Project);
    } else {
      await onAddProject(data as Omit<Project, 'id'>);
    }
    setEditingProject(null);
  };

  return (
    <div className="space-y-6" id="project-tab-container">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Projects</h2>
          <p className="text-sm text-gray-500">
            Manage project master data · {filteredProjects.length} entr{filteredProjects.length === 1 ? 'y' : 'ies'} in view
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingProject(null); setIsFormOpen(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>

      <div className="app-card p-5" id="project-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">Search Projects</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
              <input
                id="project-search-input"
                type="text"
                placeholder="Search by name or project ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">Filter by Category</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100">
              <option value="all">All Categories</option>
              <option value="Billable">Billable</option>
              <option value="Non-billable">Non-billable</option>
              <option value="Internal">Internal</option>
              <option value="Opportunity">Opportunity</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-450 dark:text-slate-400 uppercase tracking-wide mb-1.5">Filter by Status</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer font-medium text-gray-800 dark:text-gray-100">
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Pipeline">Pipeline</option>
            </select>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden" id="project-list-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto" id="project-details-table">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800/80 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Project ID</th>
                <th className="px-6 py-4">Consulting Unit</th>
                <th className="px-6 py-4">Win %</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-sm">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm" id="project-empty-state">
                    No projects found matching the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((proj) => {
                  const category = getProjectCategory(proj);
                  const status = getProjectStatus(proj);

                  return (
                    <tr key={proj.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-colors" id={`project-row-${proj.id}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg ${getProjectCategoryIconClass(category)} flex items-center justify-center text-white shrink-0`}>
                            <Folder className="w-4.5 h-4.5 stroke-[2.5]" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">{proj.name}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{proj.client}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-600 dark:text-gray-300">{proj.projectId || '—'}</td>
                      <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300">{proj.group || '—'}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-gray-700 dark:text-gray-200">{proj.winProbability ?? 100}%</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${
                          category === 'Opportunity'
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900/40'
                            : category === 'Internal'
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/40'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40'
                        }`}>
                          <Layers className="w-3.5 h-3.5 opacity-80" />
                          {category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                          status === 'Active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100/50'
                            : status === 'Pipeline'
                            ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100/50'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-500' : status === 'Pipeline' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => { setEditingProject(proj); setIsFormOpen(true); }} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(proj)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProjectFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingProject(null); }}
        project={editingProject}
        onSave={handleSave}
      />
    </div>
  );
};
