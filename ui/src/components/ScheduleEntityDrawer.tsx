/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Description } from '@headlessui/react';
import { Search, X, FolderKanban, Users, Settings } from 'lucide-react';
import type { Project, Resource, SavedFilter } from '../types';
import { filterPeople, filterProjects } from '../lib/filterEngine';
import {
  CardHeader,
  DialogTitle,
  Drawer,
  IconButton,
  Input,
  Select,
} from './ui';

export type EntityDrawerMode = 'projects' | 'resources';

interface ScheduleEntityDrawerProps {
  isOpen: boolean;
  mode: EntityDrawerMode;
  onClose: () => void;
  onManageFilters: () => void;
  projects: Project[];
  resources: Resource[];
  filters: SavedFilter[];
  activeFilterId: string | null;
  focusedEntityId: string | null;
  onSelectFilter: (filter: SavedFilter | null) => void;
  onFocusEntity: (entityId: string | null) => void;
}

export const ScheduleEntityDrawer: React.FC<ScheduleEntityDrawerProps> = ({
  isOpen,
  mode,
  onClose,
  onManageFilters,
  projects,
  resources,
  filters,
  activeFilterId,
  focusedEntityId,
  onSelectFilter,
  onFocusEntity,
}) => {
  const [search, setSearch] = useState('');

  const activeFilter = filters.find((f) => f.id === activeFilterId) || null;
  const criteria = activeFilter?.criteria ?? null;

  const filterOptions = useMemo(
    () => [
      { value: '', label: 'All (no filter)' },
      ...filters.map((f) => ({
        value: f.id,
        label: typeof f.itemCount === 'number' ? `${f.name} (${f.itemCount})` : f.name,
      })),
    ],
    [filters],
  );

  const entities = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (mode === 'projects') {
      let list = filterProjects(projects, criteria);
      if (q) {
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.client.toLowerCase().includes(q) ||
            (p.referenceId || '').toLowerCase().includes(q),
        );
      }
      return list
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: p.client,
        }));
    }

    let list = filterPeople(resources, criteria);
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q) ||
          (r.site || '').toLowerCase().includes(q) ||
          (r.employeeId || '').toLowerCase().includes(q),
      );
    }
    return list
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({
        id: r.id,
        title: r.name,
        subtitle: [r.role, r.site].filter(Boolean).join(' · '),
      }));
  }, [mode, projects, resources, criteria, search]);

  const title = mode === 'projects' ? 'Projects' : 'Resources';
  const TitleIcon = mode === 'projects' ? FolderKanban : Users;
  const showingAll = focusedEntityId == null;

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      header={
        <CardHeader className="shrink-0 rounded-none">
          <div className="flex items-center gap-2 min-w-0">
            <TitleIcon className="w-4 h-4 text-secondary shrink-0" />
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-primary">{title}</DialogTitle>
              <Description className="text-[11px] text-tertiary mt-0.5">
                {entities.length} matching the selected filter
              </Description>
            </div>
          </div>
          <IconButton label={`Close ${title.toLowerCase()}`} size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </IconButton>
        </CardHeader>
      }
    >
      <div className="px-3 py-3 border-b border-subtle space-y-2.5 shrink-0">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-tertiary mb-1">
            Filter
          </label>
          <div className="flex items-center gap-1.5">
            <Select
              aria-label="Choose filter"
              value={activeFilterId ?? ''}
              onChange={(id) => {
                onFocusEntity(null);
                if (!id) {
                  onSelectFilter(null);
                  return;
                }
                const match = filters.find((f) => f.id === id) || null;
                onSelectFilter(match);
              }}
              options={filterOptions}
              placeholder="Choose filter…"
              className="flex-1 min-w-0"
            />
            <IconButton
              label="Manage filters"
              size="sm"
              onClick={onManageFilters}
              className="h-9 w-9 shrink-0 border border-default bg-input hover:bg-surface-hover"
            >
              <Settings className="w-4 h-4" />
            </IconButton>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-tertiary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder={mode === 'projects' ? 'Search projects…' : 'Search resources…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => onFocusEntity(null)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
                showingAll
                  ? 'tint-blue shadow-app-sm'
                  : 'border-subtle hover:bg-surface-muted/70'
              }`}
            >
              <p className="text-[13px] font-semibold text-primary">All search results</p>
              <p className="text-[11px] text-secondary mt-0.5">
                Show all {entities.length} matching {mode} on the schedule
              </p>
            </button>
          </li>

          {entities.length === 0 ? (
            <li>
              <p className="text-xs text-tertiary text-center py-8 px-4">
                No {mode} match this filter{search.trim() ? ' and search' : ''}.
              </p>
            </li>
          ) : (
            entities.map((item) => {
              const isSelected = focusedEntityId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onFocusEntity(item.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'tint-blue shadow-app-sm'
                        : 'border-subtle hover:bg-surface-muted/70'
                    }`}
                  >
                    <p className="text-[13px] font-semibold text-primary truncate">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-[11px] text-secondary truncate mt-0.5">{item.subtitle}</p>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Drawer>
  );
};
