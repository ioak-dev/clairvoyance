/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Description } from '@headlessui/react';
import { Search, X, Plus, MoreVertical, Pencil, ArrowLeft } from 'lucide-react';
import type { FilterKind, SavedFilter } from '../types';
import type { Lookups } from '../lib/services/lookups';
import { FilterFormModal, type FilterFormValues } from './FilterFormModal';
import {
  Badge,
  Button,
  CardHeader,
  ConfirmDialog,
  DialogTitle,
  Drawer,
  IconButton,
  Input,
  Menu,
  DropdownMenuButton,
  DropdownMenuItems,
  DropdownMenuItem,
} from './ui';

export type FilterViewContext = 'projects' | 'resources' | 'requests';

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
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
  onBack,
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
  const [formOpen, setFormOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);
  const [deletingFilterId, setDeletingFilterId] = useState<string | null>(null);
  const [confirmDeleteFilter, setConfirmDeleteFilter] = useState<SavedFilter | null>(null);

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
  };

  const openEdit = (filter: SavedFilter) => {
    setEditingFilter(filter);
    setFormOpen(true);
  };

  return (
    <>
      <Drawer
        open={isOpen}
        onClose={onClose}
        header={
          <CardHeader className="shrink-0 rounded-none">
            <div className="flex items-center gap-2 min-w-0">
              {onBack && (
                <IconButton label="Back to list" size="sm" onClick={onBack} className="-ml-1">
                  <ArrowLeft className="w-4 h-4" />
                </IconButton>
              )}
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold text-primary">Filters</DialogTitle>
                <Description className="text-[11px] text-tertiary mt-0.5">
                  {contextLabel(viewContext)}
                </Description>
              </div>
            </div>
            <IconButton label="Close filters" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </IconButton>
          </CardHeader>
        }
        footer={
          <Button
            onClick={openCreate}
            variant="outline"
            className="w-full border-dashed"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New filter
          </Button>
        }
      >
        <div className="px-3 py-3 border-b border-subtle space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-tertiary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search saved filters…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {activeFilter && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-tertiary font-medium uppercase tracking-wide">Active</span>
              <Badge tone="blue" className="pl-2 pr-1 gap-1 min-w-0 max-w-full">
                <span className="truncate">{activeFilter.name}</span>
                <IconButton
                  label="Clear filter"
                  size="sm"
                  onClick={() => onSelectFilter(null)}
                  className="h-5 w-5 -mr-0.5"
                >
                  <X className="w-3 h-3" />
                </IconButton>
              </Badge>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {filteredList.length === 0 ? (
            <p className="text-xs text-tertiary text-center py-8">No filters match your search.</p>
          ) : (
            filteredList.map((filter) => {
              const isSelected = activeFilterId === filter.id;
              const isBuiltInFilter = filter.id.startsWith('__dynamic_');
              const count = filter.itemCount;
              const showCount = typeof count === 'number' && count > 0;
              const isDeleting = deletingFilterId === filter.id;
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
                        {showCount && (
                          <Badge
                            tone={isSelected ? 'blue' : 'neutral'}
                            className={isSelected ? 'bg-blue-600 text-white border-blue-600' : ''}
                          >
                            {count}
                          </Badge>
                        )}
                      </div>
                      {filter.description && (
                        <p className="text-[11px] text-secondary mt-1 line-clamp-2 leading-snug">
                          {filter.description}
                        </p>
                      )}
                    </div>

                    {!isBuiltInFilter && (
                      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Menu>
                          <DropdownMenuButton
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 transition-opacity ${
                              isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            aria-label="Filter actions"
                            loading={isDeleting}
                            disabled={Boolean(deletingFilterId)}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuButton>
                          <DropdownMenuItems className="w-32">
                            <DropdownMenuItem
                              disabled={Boolean(deletingFilterId)}
                              onClick={() => openEdit(filter)}
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              destructive
                              disabled={Boolean(deletingFilterId)}
                              onClick={() => {
                                if (deletingFilterId) return;
                                setConfirmDeleteFilter(filter);
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuItems>
                        </Menu>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Drawer>

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

      <ConfirmDialog
        open={confirmDeleteFilter != null}
        onClose={() => setConfirmDeleteFilter(null)}
        confirmLabel="Delete"
        loading={Boolean(deletingFilterId)}
        onConfirm={async () => {
          const filter = confirmDeleteFilter;
          if (!filter || deletingFilterId) return;
          if (activeFilterId === filter.id) {
            onSelectFilter(null);
          }
          setDeletingFilterId(filter.id);
          try {
            await onDeleteFilter(filter.id);
            setConfirmDeleteFilter(null);
          } finally {
            setDeletingFilterId(null);
          }
        }}
      >
        Delete filter &quot;{confirmDeleteFilter?.name}&quot;? This cannot be undone.
      </ConfirmDialog>
    </>
  );
};
