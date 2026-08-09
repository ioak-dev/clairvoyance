/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Project } from '../types';
import { Search, RefreshCw, TrendingUp, Circle, CircleDollarSign } from 'lucide-react';
import { getProjectCategory, getProjectCategoryBadgeClass } from '../lib/projectCategory';

interface ProjectTabProps {
  projects: Project[];
  onAddProject: (project: Omit<Project, 'id'>) => void | Promise<void>;
  onUpdateProject: (project: Project) => void | Promise<void>;
  onDeleteProject: (id: string) => void | Promise<void>;
}

type ProjectSortKey = 'name' | 'marketUnit' | 'probability' | 'category' | 'status';
type SortDirection = 'asc' | 'desc';

type SyncHistoryRow = {
  runAt: string;
  created: number;
  updated: number;
  archived: number;
};

export const ProjectTab: React.FC<ProjectTabProps> = ({
  projects,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortKey, setSortKey] = useState<ProjectSortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [selectedHistoryRunLabel, setSelectedHistoryRunLabel] = useState('');
  const [syncProjectsFromSap, setSyncProjectsFromSap] = useState(false);
  const [syncOpportunitiesFromCrm, setSyncOpportunitiesFromCrm] = useState(false);
  const [isSyncInProgress, setIsSyncInProgress] = useState(false);

  const projectsSyncAgeHours = useMemo(() => Math.floor(Math.random() * 9) + 4, []);
  const opportunitiesSyncAgeHours = useMemo(() => Math.floor(Math.random() * 9) + 4, []);
  const syncHistoryRows = useMemo<SyncHistoryRow[]>(() => {
    let created = 18;
    let updated = 72;
    let archived = 6;

    return Array.from({ length: 10 }).map((_, index) => {
      created = Math.max(0, created + (Math.floor(Math.random() * 9) - 4));
      updated = Math.max(0, updated + (Math.floor(Math.random() * 21) - 10));
      archived = Math.max(0, archived + (Math.floor(Math.random() * 7) - 3));

      const dayOffset = index;
      const hourOffset = Math.floor(Math.random() * 8);
      const runAt = dayOffset === 0
        ? `${hourOffset + 1} hours ago`
        : hourOffset === 0
          ? `${dayOffset} day${dayOffset === 1 ? '' : 's'} ago`
          : `${dayOffset} day${dayOffset === 1 ? '' : 's'} ${hourOffset} hour${hourOffset === 1 ? '' : 's'} ago`;

      return {
        runAt,
        created,
        updated,
        archived,
      };
    });
  }, []);

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

      return true;
    });
  }, [projects, searchQuery, selectedCategory]);

  const sortedProjects = useMemo(() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

    const sorted = [...filteredProjects].sort((a, b) => {
      const aCategory = getProjectCategory(a);
      const bCategory = getProjectCategory(b);
      const aStatus = getProjectStatus(a);
      const bStatus = getProjectStatus(b);

      let comparison = 0;
      switch (sortKey) {
        case 'marketUnit':
          comparison = collator.compare(a.client || '', b.client || '');
          break;
        case 'probability':
          comparison = (a.winProbability ?? 100) - (b.winProbability ?? 100);
          break;
        case 'category':
          comparison = collator.compare(aCategory, bCategory);
          break;
        case 'status':
          comparison = collator.compare(aStatus, bStatus);
          break;
        case 'name':
        default:
          comparison = collator.compare(a.name, b.name);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredProjects, sortDirection, sortKey]);

  const getCategoryIcon = (category: ReturnType<typeof getProjectCategory>) => {
    if (category === 'Opportunity') return TrendingUp;
    if (category === 'Non-billable') return Circle;
    return CircleDollarSign;
  };

  const handleSort = (key: ProjectSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const sortIndicator = (key: ProjectSortKey) => {
    if (sortKey !== key) return '';
    return sortDirection === 'asc' ? '^' : 'v';
  };

  return (
    <div className="space-y-6" id="project-tab-container">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">Projects</h2>
          <p className="text-sm text-gray-500">
            Manage project master data · {filteredProjects.length} entr{filteredProjects.length === 1 ? 'y' : 'ies'} in view
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface-muted hover:bg-surface-hover text-secondary rounded-lg text-sm font-medium"
            >
              History
            </button>
            <button
              type="button"
              disabled={isSyncInProgress}
              onClick={() => {
                if (!isSyncInProgress) {
                  setSyncProjectsFromSap(false);
                  setSyncOpportunitiesFromCrm(false);
                }
                setIsSyncModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Synchronize
            </button>
          </div>
          {isSyncInProgress && (
            <p className="text-xs text-tertiary mt-1">Synchronization is already in progress.</p>
          )}
        </div>
      </div>

      <div className="app-card p-5" id="project-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-[10px] font-bold text-tertiary uppercase tracking-wide mb-1.5">Search Projects</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
              <input
                id="project-search-input"
                type="text"
                placeholder="Search by name or project ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-input border border-default rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-tertiary uppercase tracking-wide mb-1.5">Filter by Category</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full text-xs bg-input border border-default rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer font-medium text-primary">
              <option value="all">All Categories</option>
              <option value="Billable">Billable</option>
              <option value="Non-billable">Non-billable</option>
              <option value="Internal">Internal</option>
              <option value="Opportunity">Opportunity</option>
            </select>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden" id="project-list-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto" id="project-details-table">
            <thead>
              <tr className="bg-surface-muted border-b border-subtle text-[10px] font-bold text-tertiary uppercase tracking-wider">
                <th className="px-6 py-4">
                  <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                    Project Name <span className="text-[10px]">{sortIndicator('name')}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button type="button" onClick={() => handleSort('marketUnit')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                    Market Unit <span className="text-[10px]">{sortIndicator('marketUnit')}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button type="button" onClick={() => handleSort('probability')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                    Probability <span className="text-[10px]">{sortIndicator('probability')}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button type="button" onClick={() => handleSort('category')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                    Category <span className="text-[10px]">{sortIndicator('category')}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                    Status <span className="text-[10px]">{sortIndicator('status')}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-sm">
              {sortedProjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-tertiary text-sm" id="project-empty-state">
                    No projects found matching the specified filter criteria.
                  </td>
                </tr>
              ) : (
                sortedProjects.map((proj) => {
                  const category = getProjectCategory(proj);
                  const status = getProjectStatus(proj);
                  const CategoryIcon = getCategoryIcon(category);

                  return (
                    <tr key={proj.id} className="hover:bg-surface-muted/50 transition-colors" id={`project-row-${proj.id}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-primary text-sm leading-tight">{proj.name}</p>
                          <p className="text-[11px] text-tertiary mt-0.5 font-mono">{proj.projectId || '—'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-secondary">{proj.client || '—'}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-primary">{proj.winProbability ?? 100}%</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border whitespace-nowrap ${getProjectCategoryBadgeClass(category)}`}>
                          <CategoryIcon className="w-3.5 h-3.5 opacity-90" />
                          {category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                          status === 'Active'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : status === 'Pipeline'
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-secondary'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-500' : status === 'Pipeline' ? 'bg-blue-500' : 'bg-gray-500'}`} />
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

      {isSyncModalOpen && (
        <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="app-card w-full max-w-md p-5">
            <h3 className="text-base font-bold text-primary">Synchronize Projects</h3>
            <p className="text-sm text-secondary mt-2">Projects (SAP) last synchronized: {projectsSyncAgeHours} hours ago</p>
            <p className="text-sm text-secondary mt-1">Opportunities (CRM) last synchronized: {opportunitiesSyncAgeHours} hours ago</p>

            {!isSyncInProgress ? (
              <>
                <label className="mt-4 flex items-start gap-2 text-sm text-secondary">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={syncProjectsFromSap}
                    onChange={(e) => setSyncProjectsFromSap(e.target.checked)}
                  />
                  <span>Synchronize latest Projects data from SAP.</span>
                </label>

                <label className="mt-3 flex items-start gap-2 text-sm text-secondary">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={syncOpportunitiesFromCrm}
                    onChange={(e) => setSyncOpportunitiesFromCrm(e.target.checked)}
                  />
                  <span>Synchronize latest Opportunities data from CRM.</span>
                </label>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSyncModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-surface-muted hover:bg-surface-hover text-secondary text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!syncProjectsFromSap && !syncOpportunitiesFromCrm}
                    onClick={() => setIsSyncInProgress(true)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium"
                  >
                    Proceed
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-secondary mt-4">
                  Synchronization is in progress and will finish in the next 15 minutes.
                </p>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsSyncModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isHistoryModalOpen && (
        <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="app-card w-full max-w-2xl p-5">
            <h3 className="text-base font-bold text-primary">Last 10 Synchronization Runs</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-surface-muted border-b border-subtle text-[10px] font-bold text-tertiary uppercase tracking-wider">
                    <th className="px-4 py-3">Run</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Archived</th>
                    <th className="px-4 py-3 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-sm">
                  {syncHistoryRows.map((row, index) => (
                    <tr key={`project-sync-run-${index}`}>
                      <td className="px-4 py-3 text-secondary">{row.runAt}</td>
                      <td className="px-4 py-3 text-primary font-medium">{row.created}</td>
                      <td className="px-4 py-3 text-primary font-medium">{row.updated}</td>
                      <td className="px-4 py-3 text-primary font-medium">{row.archived}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHistoryRunLabel(row.runAt);
                            setIsDownloadModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-secondary text-xs font-medium"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isDownloadModalOpen && (
        <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="app-card w-full max-w-md p-5">
            <h3 className="text-base font-bold text-primary">Download Change Log</h3>
            <p className="text-sm text-secondary mt-2">Selected run: {selectedHistoryRunLabel}</p>
            <p className="text-sm text-secondary mt-2">An Excel file with full change log will be downloaded here.</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
