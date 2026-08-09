/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Resource } from '../types';
import { Search, RefreshCw } from 'lucide-react';
import { useLookups } from '../hooks/useLookups';
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

  const practiceAreaOptions = useMemo(
    () => [
      { value: 'all', label: 'All Practice Areas' },
      ...practiceAreas.map((area) => ({ value: area, label: area })),
    ],
    [practiceAreas],
  );

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];

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
                  setConfirmSyncToLatest(false);
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

      <Card padded id="resource-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field>
            <Label>Search Resources</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-tertiary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                id="resource-tab-search-input"
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </Field>
          <Field>
            <Label>Filter by Practice Area</Label>
            <Select<string>
              value={selectedPracticeArea}
              onChange={setSelectedPracticeArea}
              options={practiceAreaOptions}
              aria-label="Filter by Practice Area"
            />
          </Field>
          <Field>
            <Label>Filter by Status</Label>
            <Select<string>
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={statusOptions}
              aria-label="Filter by Status"
            />
          </Field>
        </div>
      </Card>

      <Card className="overflow-hidden" id="resource-tab-list-wrapper">
        <Table id="resource-tab-details-table" className="table-auto">
          <THead>
            <TR className="hover:bg-transparent">
              <TH className="px-6 py-4">
                <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                  Resource Name <span className="text-[10px]">{sortIndicator('name')}</span>
                </button>
              </TH>
              <TH className="px-6 py-4">
                <button type="button" onClick={() => handleSort('employeeId')} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                  Employee ID <span className="text-[10px]">{sortIndicator('employeeId')}</span>
                </button>
              </TH>
              <TH className="px-6 py-4">
                <button type="button" onClick={() => handleSort('practiceArea')} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                  Practice Area <span className="text-[10px]">{sortIndicator('practiceArea')}</span>
                </button>
              </TH>
              <TH className="px-6 py-4">
                <button type="button" onClick={() => handleSort('jobLevel')} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                  Job Level <span className="text-[10px]">{sortIndicator('jobLevel')}</span>
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
            {sortedResources.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={5} className="text-center py-16 text-tertiary text-sm" id="resource-tab-empty-state">
                  No resources found matching the specified filter criteria.
                </TD>
              </TR>
            ) : (
              sortedResources.map((res) => (
                <TR key={res.id} id={`resource-tab-row-${res.id}`}>
                  <TD className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-muted text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                        {res.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-bold text-primary text-sm leading-tight">{res.name}</p>
                        <p className="text-[11px] text-tertiary mt-0.5">{res.email || '—'}</p>
                      </div>
                    </div>
                  </TD>
                  <TD className="px-6 py-4 text-xs font-mono text-secondary">{res.employeeId || '—'}</TD>
                  <TD className="px-6 py-4">
                    <Badge tone="neutral">{res.practiceArea || '—'}</Badge>
                  </TD>
                  <TD className="px-6 py-4">
                    <Badge tone="blue">
                      {res.jobLevelId ? (jobLevelNameById.get(res.jobLevelId) || res.jobLevelId) : '—'}
                    </Badge>
                  </TD>
                  <TD className="px-6 py-4">
                    <Badge tone={res.status === 'Inactive' ? 'neutral' : 'emerald'}>
                      <span className={`w-1.5 h-1.5 rounded-full ${res.status === 'Inactive' ? 'bg-gray-500' : 'bg-emerald-500'}`} />
                      {res.status || 'Active'}
                    </Badge>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>

      <Modal
        open={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        title="Synchronize Resources"
        size="sm"
        footer={
          !isSyncInProgress ? (
            <>
              <Button variant="secondary" onClick={() => setIsSyncModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!confirmSyncToLatest}
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
        <p className="text-sm text-secondary">Last synchronized: {syncAgeHours} hours ago</p>

        {!isSyncInProgress ? (
          <label className="mt-4 flex items-start gap-2 text-sm text-secondary cursor-pointer">
            <Checkbox
              checked={confirmSyncToLatest}
              onChange={setConfirmSyncToLatest}
              className="mt-0.5"
            />
            <span>Confirm synchronization to the latest data from Hibob.</span>
          </label>
        ) : (
          <p className="text-sm text-secondary mt-2">
            Synchronization is in progress and will finish in the next 5 minutes.
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
              <TR key={`resource-sync-run-${index}`}>
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
