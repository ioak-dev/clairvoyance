/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Project } from '../types';
import { Search, RefreshCw, TrendingUp, Circle, CircleDollarSign } from 'lucide-react';
import { getProjectCategory, getProjectCategoryBadgeClass } from '../lib/projectCategory';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Label,
  Modal,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from './ui';

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

function statusTone(status: string): 'emerald' | 'blue' | 'neutral' {
  if (status === 'Active') return 'emerald';
  if (status === 'Pipeline') return 'blue';
  return 'neutral';
}

export const ProjectTab: React.FC<ProjectTabProps> = ({
  projects,
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

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'Billable', label: 'Billable' },
    { value: 'Non-billable', label: 'Non-billable' },
    { value: 'Internal', label: 'Internal' },
    { value: 'Opportunity', label: 'Opportunity' },
  ];

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
            <Button type="button" variant="secondary" onClick={() => setIsHistoryModalOpen(true)}>
              History
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isSyncInProgress}
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={() => {
                if (!isSyncInProgress) {
                  setSyncProjectsFromSap(false);
                  setSyncOpportunitiesFromCrm(false);
                }
                setIsSyncModalOpen(true);
              }}
            >
              Synchronize
            </Button>
          </div>
          {isSyncInProgress && (
            <p className="text-xs text-tertiary mt-1">Synchronization is already in progress.</p>
          )}
        </div>
      </div>

      <Card padded id="project-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field>
            <Label>Search Projects</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-tertiary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                id="project-search-input"
                type="text"
                placeholder="Search by name or project ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </Field>
          <Field>
            <Label>Filter by Category</Label>
            <Select<string>
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categoryOptions}
              aria-label="Filter by Category"
            />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden" id="project-list-wrapper">
        <Table id="project-details-table" className="table-auto">
          <THead>
            <TR className="hover:bg-transparent">
              <TH className="px-6 py-4">
                <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                  Project Name <span className="text-[10px]">{sortIndicator('name')}</span>
                </button>
              </TH>
              <TH className="px-6 py-4">
                <button type="button" onClick={() => handleSort('marketUnit')} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                  Market Unit <span className="text-[10px]">{sortIndicator('marketUnit')}</span>
                </button>
              </TH>
              <TH className="px-6 py-4">
                <button type="button" onClick={() => handleSort('probability')} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                  Probability <span className="text-[10px]">{sortIndicator('probability')}</span>
                </button>
              </TH>
              <TH className="px-6 py-4">
                <button type="button" onClick={() => handleSort('category')} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                  Category <span className="text-[10px]">{sortIndicator('category')}</span>
                </button>
              </TH>
              <TH className="px-6 py-4">
                <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                  Status <span className="text-[10px]">{sortIndicator('status')}</span>
                </button>
              </TH>
            </TR>
          </THead>
          <TBody>
            {sortedProjects.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={5} className="text-center py-16 text-tertiary text-sm" id="project-empty-state">
                  No projects found matching the specified filter criteria.
                </TD>
              </TR>
            ) : (
              sortedProjects.map((proj) => {
                const category = getProjectCategory(proj);
                const status = getProjectStatus(proj);
                const CategoryIcon = getCategoryIcon(category);

                return (
                  <TR key={proj.id} id={`project-row-${proj.id}`}>
                    <TD className="px-6 py-4">
                      <div>
                        <p className="font-bold text-primary text-sm leading-tight">{proj.name}</p>
                        <p className="text-[11px] text-tertiary mt-0.5 font-mono">{proj.projectId || '—'}</p>
                      </div>
                    </TD>
                    <TD className="px-6 py-4 text-xs text-secondary">{proj.client || '—'}</TD>
                    <TD className="px-6 py-4 text-xs font-semibold text-primary">{proj.winProbability ?? 100}%</TD>
                    <TD className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-semibold border whitespace-nowrap ${getProjectCategoryBadgeClass(category)}`}>
                        <CategoryIcon className="w-3.5 h-3.5 opacity-90" />
                        {category}
                      </span>
                    </TD>
                    <TD className="px-6 py-4">
                      <Badge tone={statusTone(status)}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-500' : status === 'Pipeline' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                        {status}
                      </Badge>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </Card>

      <Modal
        open={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        title="Synchronize Projects"
        size="sm"
        footer={
          !isSyncInProgress ? (
            <>
              <Button variant="secondary" onClick={() => setIsSyncModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!syncProjectsFromSap && !syncOpportunitiesFromCrm}
                onClick={() => setIsSyncInProgress(true)}
              >
                Proceed
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setIsSyncModalOpen(false)}>
              Close
            </Button>
          )
        }
      >
        <p className="text-sm text-secondary">Projects (SAP) last synchronized: {projectsSyncAgeHours} hours ago</p>
        <p className="text-sm text-secondary mt-1">Opportunities (CRM) last synchronized: {opportunitiesSyncAgeHours} hours ago</p>

        {!isSyncInProgress ? (
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-2 text-sm text-secondary cursor-pointer">
              <Checkbox
                checked={syncProjectsFromSap}
                onChange={setSyncProjectsFromSap}
                className="mt-0.5"
              />
              <span>Synchronize latest Projects data from SAP.</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-secondary cursor-pointer">
              <Checkbox
                checked={syncOpportunitiesFromCrm}
                onChange={setSyncOpportunitiesFromCrm}
                className="mt-0.5"
              />
              <span>Synchronize latest Opportunities data from CRM.</span>
            </label>
          </div>
        ) : (
          <p className="text-sm text-secondary mt-4">
            Synchronization is in progress and will finish in the next 15 minutes.
          </p>
        )}
      </Modal>

      <Modal
        open={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Last 10 Synchronization Runs"
        size="xl"
        footer={
          <Button variant="primary" onClick={() => setIsHistoryModalOpen(false)}>
            Close
          </Button>
        }
      >
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Run</TH>
              <TH>Created</TH>
              <TH>Updated</TH>
              <TH>Archived</TH>
              <TH className="text-right">Download</TH>
            </TR>
          </THead>
          <TBody>
            {syncHistoryRows.map((row, index) => (
              <TR key={`project-sync-run-${index}`}>
                <TD className="text-secondary">{row.runAt}</TD>
                <TD className="font-medium">{row.created}</TD>
                <TD className="font-medium">{row.updated}</TD>
                <TD className="font-medium">{row.archived}</TD>
                <TD className="text-right">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedHistoryRunLabel(row.runAt);
                      setIsDownloadModalOpen(true);
                    }}
                  >
                    Download
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Modal>

      <Modal
        open={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        title="Download Change Log"
        size="sm"
        className="z-[60]"
        footer={
          <Button variant="primary" onClick={() => setIsDownloadModalOpen(false)}>
            Close
          </Button>
        }
      >
        <p className="text-sm text-secondary">Selected run: {selectedHistoryRunLabel}</p>
        <p className="text-sm text-secondary mt-2">An Excel file with full change log will be downloaded here.</p>
      </Modal>
    </div>
  );
};
