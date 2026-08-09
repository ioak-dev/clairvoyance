/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Resource, Vacation } from '../types';
import { Search, Calendar, Briefcase } from 'lucide-react';
import {
  Badge,
  Card,
  Field,
  Input,
  Label,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from './ui';

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

  const groupOptions = useMemo(
    () => [
      { value: 'all', label: 'All Groups' },
      ...groups.map((g) => ({ value: g, label: g })),
    ],
    [groups],
  );

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Pending', label: 'Pending Approvals' },
    { value: 'Approved', label: 'Approved Leaves' },
    { value: 'Rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6" id="vacation-tab-container">
      <Card padded id="vacation-filter-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field>
            <Label>Search Team Member</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-tertiary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                id="vacation-search-input"
                type="text"
                placeholder="Search resource name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </Field>

          <Field id="vacation-group-select">
            <Label>Filter by Team Group</Label>
            <Select<string>
              value={selectedGroup}
              onChange={setSelectedGroup}
              options={groupOptions}
              aria-label="Filter by Team Group"
            />
          </Field>

          <Field id="vacation-status-select">
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

      <Card className="overflow-hidden" id="vacation-list-wrapper">
        <Table id="vacation-details-table" className="table-auto">
          <THead>
            <TR className="hover:bg-transparent">
              <TH className="px-6 py-4">Resource</TH>
              <TH className="px-6 py-4">Calendar Duration</TH>
              <TH className="px-6 py-4">Job Level</TH>
              <TH className="px-6 py-4">Practice Area</TH>
            </TR>
          </THead>
          <TBody>
            {filteredVacations.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={4} className="text-center py-16 text-tertiary text-sm" id="vacation-empty-state">
                  No vacation leave registrations found matching the specified filter criteria.
                </TD>
              </TR>
            ) : (
              filteredVacations.map((v) => {
                const name = getResourceName(v.resourceId);
                const role = getResourceRole(v.resourceId);
                const avatar = getResourceAvatar(v.resourceId);

                return (
                  <TR key={v.id} id={`vacation-row-${v.id}`}>
                    <TD className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {avatar ? (
                          <img
                            referrerPolicy="no-referrer"
                            src={avatar}
                            alt={name}
                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-subtle"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-surface-muted text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                            {name.split(' ').map((n) => n[0]).join('')}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-primary text-sm leading-tight">{name}</p>
                          <p className="text-[11px] text-tertiary mt-0.5">{role}</p>
                        </div>
                      </div>
                    </TD>

                    <TD className="px-6 py-4">
                      <div className="flex flex-col text-xs font-semibold text-secondary">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-tertiary" />
                          {v.startDate} to {v.endDate}
                        </span>
                      </div>
                    </TD>

                    <TD className="px-6 py-4">
                      <Badge tone="blue">{getJobLevel(v.resourceId)}</Badge>
                    </TD>

                    <TD className="px-6 py-4">
                      <Badge tone="neutral">
                        <Briefcase className="w-3.5 h-3.5 text-tertiary" />
                        {getPracticeArea(v.resourceId)}
                      </Badge>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
};
