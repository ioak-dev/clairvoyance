/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Resource } from '../types';
import { Search, RefreshCw } from 'lucide-react';
import { useLookups } from '../hooks/useLookups';

interface ResourceTabProps {
  resources: Resource[];
  onAddResource: (resource: Omit<Resource, 'id'>) => void | Promise<void>;
  onUpdateResource: (resource: Resource) => void | Promise<void>;
  onDeleteResource: (id: string) => void | Promise<void>;
}

type ResourceSortKey = 'name' | 'employeeId' | 'practiceArea' | 'jobLevel' | 'status';
type SortDirection = 'asc' | 'desc';

type SyncHistoryRow = {
  runAt: string;
  created: number;
  updated: number;
  archived: number;
};

export const ResourceTab: React.FC<ResourceTabProps> = ({
  resources,
  onAddResource,
  onUpdateResource,
  onDeleteResource,
}) => {
  const { data: lookups } = useLookups();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPracticeArea, setSelectedPracticeArea] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortKey, setSortKey] = useState<ResourceSortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [selectedHistoryRunLabel, setSelectedHistoryRunLabel] = useState('');
  const [confirmSyncToLatest, setConfirmSyncToLatest] = useState(false);
  const [isSyncInProgress, setIsSyncInProgress] = useState(false);

  const syncAgeHours = useMemo(() => Math.floor(Math.random() * 9) + 4, []);
  const syncHistoryRows = useMemo<SyncHistoryRow[]>(() => {
    let created = 24;
    let updated = 88;
    let archived = 4;

    return Array.from({ length: 10 }).map((_, index) => {
      created = Math.max(0, created + (Math.floor(Math.random() * 11) - 5));
      updated = Math.max(0, updated + (Math.floor(Math.random() * 25) - 12));
      archived = Math.max(0, archived + (Math.floor(Math.random() * 5) - 2));

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

  const jobLevelNameById = useMemo(() => {
    return new Map((lookups?.jobLevels || []).map((entry) => [entry.id, entry.name]));
  }, [lookups]);

  const sortedResources = useMemo(() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

    const sorted = [...filteredResources].sort((a, b) => {
      const aJobLevel = a.jobLevelId ? (jobLevelNameById.get(a.jobLevelId) || a.jobLevelId) : '';
      const bJobLevel = b.jobLevelId ? (jobLevelNameById.get(b.jobLevelId) || b.jobLevelId) : '';
      const aStatus = a.status || 'Active';
      const bStatus = b.status || 'Active';

      let comparison = 0;
      switch (sortKey) {
        case 'employeeId':
          comparison = collator.compare(a.employeeId || '', b.employeeId || '');
          break;
        case 'practiceArea':
          comparison = collator.compare(a.practiceArea || '', b.practiceArea || '');
          break;
        case 'jobLevel':
          comparison = collator.compare(aJobLevel, bJobLevel);
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
  }, [filteredResources, jobLevelNameById, sortDirection, sortKey]);

  const handleSort = (key: ResourceSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const sortIndicator = (key: ResourceSortKey) => {
    if (sortKey !== key) return '';
    return sortDirection === 'asc' ? '^' : 'v';
  };

  return (
    <div className="space-y-6" id="resource-tab-container">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary">Resources</h2>
          <p className="text-sm text-gray-500">
            Manage people master data · {filteredResources.length} entr{filteredResources.length === 1 ? 'y' : 'ies'} in view
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
                  setConfirmSyncToLatest(false);
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

      <div className="app-card p-5" id="resource-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-[10px] font-bold text-tertiary uppercase tracking-wide mb-1.5">Search Resources</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
              <input
                id="resource-tab-search-input"
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-input border border-default rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-tertiary uppercase tracking-wide mb-1.5">Filter by Practice Area</label>
            <select value={selectedPracticeArea} onChange={(e) => setSelectedPracticeArea(e.target.value)} className="w-full text-xs bg-input border border-default rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer font-medium text-primary">
              <option value="all">All Practice Areas</option>
              {practiceAreas.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-tertiary uppercase tracking-wide mb-1.5">Filter by Status</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full text-xs bg-input border border-default rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer font-medium text-primary">
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
              <tr className="bg-surface-muted border-b border-subtle text-[10px] font-bold text-tertiary uppercase tracking-wider">
                <th className="px-6 py-4">
                  <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                    Resource Name <span className="text-[10px]">{sortIndicator('name')}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button type="button" onClick={() => handleSort('employeeId')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                    Employee ID <span className="text-[10px]">{sortIndicator('employeeId')}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button type="button" onClick={() => handleSort('practiceArea')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                    Practice Area <span className="text-[10px]">{sortIndicator('practiceArea')}</span>
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button type="button" onClick={() => handleSort('jobLevel')} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                    Job Level <span className="text-[10px]">{sortIndicator('jobLevel')}</span>
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
              {sortedResources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-tertiary text-sm" id="resource-tab-empty-state">
                    No resources found matching the specified filter criteria.
                  </td>
                </tr>
              ) : (
                sortedResources.map((res) => (
                  <tr key={res.id} className="hover:bg-surface-muted/50 transition-colors" id={`resource-tab-row-${res.id}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-surface-muted text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                          {res.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-bold text-primary text-sm leading-tight">{res.name}</p>
                          <p className="text-[11px] text-tertiary mt-0.5">{res.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-secondary">{res.employeeId || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center text-xs font-medium text-secondary bg-surface-muted px-2.5 py-1 rounded-md">
                        {res.practiceArea || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-900/50">
                        {res.jobLevelId ? (jobLevelNameById.get(res.jobLevelId) || res.jobLevelId) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                        res.status === 'Inactive'
                          ? 'text-secondary'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${res.status === 'Inactive' ? 'bg-gray-500' : 'bg-emerald-500'}`} />
                        {res.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isSyncModalOpen && (
        <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="app-card w-full max-w-md p-5">
            <h3 className="text-base font-bold text-primary">Synchronize Resources</h3>
            <p className="text-sm text-secondary mt-2">Last synchronized: {syncAgeHours} hours ago</p>

            {!isSyncInProgress ? (
              <>
                <label className="mt-4 flex items-start gap-2 text-sm text-secondary">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={confirmSyncToLatest}
                    onChange={(e) => setConfirmSyncToLatest(e.target.checked)}
                  />
                  <span>Confirm synchronization to the latest data from Hibob.</span>
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
                    disabled={!confirmSyncToLatest}
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
                  Synchronization is in progress and will finish in the next 5 minutes.
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
                    <tr key={`resource-sync-run-${index}`}>
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
