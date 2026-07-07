/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Search, X, Plus, MoreVertical, Pencil } from 'lucide-react';
import type { FilterKind, SavedFilter } from '../types';
import type { Lookups } from '../lib/services/lookups';
import { FilterFormModal, type FilterFormValues } from './FilterFormModal';

const safeConfirm = (msg: string): boolean => {
  try {
    return window.confirm(msg);
  } catch {
    return true;
  }
};

export type FilterViewContext = 'projects' | 'resources' | 'requests';

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  viewContext: FilterViewContext;
  filters: SavedFilter[];
  activeFilterId: string | null;
  lookups?: Lookups;
  onSelectFilter: (filter: SavedFilter | null) => void;
  onCreateFilter: (values: FilterFormValues) => void | Promise<void>;
  onUpdateFilter: (id: string, values: FilterFormValues) => void | Promise<void>;
  onDeleteFilter: (id: string) => void | Promise<void>;
}

function contextToKind(context: FilterViewContext): FilterKind {
  if (context === 'projects') return 'project';
  if (context === 'resources') return 'person';
  return 'request';
}

function contextLabel(context: FilterViewContext): string {
  if (context === 'projects') return 'Project filters';
  if (context === 'resources') return 'People filters';
  return 'Request filters';
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  isOpen,
  onClose,
  viewContext,
  filters,
  activeFilterId,
  lookups,
  onSelectFilter,
  onCreateFilter,
  onUpdateFilter,
  onDeleteFilter,
}) => {
  const [search, setSearch] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);

  const filterKind = contextToKind(viewContext);

  const filteredList = useMemo(() => {
    if (!search.trim()) return filters;
    const q = search.toLowerCase();
    return filters.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q),
    );
  }, [filters, search]);

  const activeFilter = filters.find((f) => f.id === activeFilterId) || null;

  const openCreate = () => {
    setEditingFilter(null);
    setFormOpen(true);
    setMenuOpenId(null);
  };

  const openEdit = (filter: SavedFilter) => {
    setEditingFilter(filter);
    setFormOpen(true);
    setMenuOpenId(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed left-[110px] top-14 bottom-0 w-80 bg-surface border-r border-default shadow-app-md z-50 flex flex-col">
        <div className="app-card-header px-4 py-3 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-primary">Filters</h3>
            <p className="text-[11px] text-tertiary mt-0.5">{contextLabel(viewContext)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-hover rounded-lg text-tertiary hover:text-primary transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-3 border-b border-subtle space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-tertiary absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search saved filters…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-default rounded-lg text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none bg-input"
            />
          </div>

          {activeFilter && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-tertiary font-medium uppercase tracking-wide">Active</span>
              <div className="inline-flex items-center gap-1 tint-blue pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium min-w-0">
                <span className="truncate">{activeFilter.name}</span>
                <button
                  onClick={() => onSelectFilter(null)}
                  className="p-0.5 hover:bg-surface-hover rounded-full shrink-0"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {filteredList.length === 0 ? (
            <p className="text-xs text-tertiary text-center py-8">No filters match your search.</p>
          ) : (
            filteredList.map((filter) => {
              const isSelected = activeFilterId === filter.id;
              const count = filter.itemCount ?? 0;
              return (
                <div
                  key={filter.id}
                  className={`relative rounded-xl border p-3 transition-all cursor-pointer group ${
                    isSelected
                      ? 'tint-blue shadow-app-sm'
                      : 'border-subtle bg-surface hover:border-default hover:shadow-app-sm'
                  }`}
                  onClick={() => onSelectFilter(isSelected ? null : filter)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-primary truncate">{filter.name}</h4>
                        <span
                          className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-surface-muted text-secondary'
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                      {filter.description && (
                        <p className="text-[11px] text-secondary mt-1 line-clamp-2 leading-snug">
                          {filter.description}
                        </p>
                      )}
                    </div>

                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === filter.id ? null : filter.id)}
                        className="p-1 rounded-md text-tertiary hover:text-primary hover:bg-surface-hover opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpenId === filter.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-surface-raised border border-subtle rounded-lg shadow-app-md py-1 z-10">
                          <button
                            onClick={() => openEdit(filter)}
                            className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-surface-muted flex items-center gap-2"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={async () => {
                              setMenuOpenId(null);
                              if (safeConfirm(`Delete filter "${filter.name}"?`)) {
                                if (activeFilterId === filter.id) {
                                  onSelectFilter(null);
                                }
                                await onDeleteFilter(filter.id);
                              }
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-surface-muted"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 p-3 border-t border-subtle bg-surface">
          <button
            onClick={openCreate}
            className="w-full py-2.5 px-3 rounded-lg border border-dashed border-default text-sm font-medium text-secondary hover:text-blue-500 hover:border-blue-500/40 hover:bg-surface-muted flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> New filter
          </button>
        </div>
      </div>

      <FilterFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingFilter(null);
        }}
        filterKind={filterKind}
        filter={editingFilter}
        lookups={lookups}
        onSave={async (values) => {
          if (editingFilter) {
            await onUpdateFilter(editingFilter.id, values);
          } else {
            await onCreateFilter(values);
          }
        }}
        onDelete={editingFilter ? onDeleteFilter : undefined}
      />
    </>
  );
};
