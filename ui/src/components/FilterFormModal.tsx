/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { FilterKind, SavedFilter } from '../types';
import type { Lookups } from '../lib/services/lookups';
import type { LifecycleStatus, PersonStatus } from '../types';

const safeConfirm = (msg: string): boolean => {
  try {
    return window.confirm(msg);
  } catch {
    return true;
  }
};

export interface FilterFormValues {
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  criteria: Record<string, unknown>;
}

interface FilterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterKind: FilterKind;
  filter?: SavedFilter | null;
  lookups?: Lookups;
  onSave: (values: FilterFormValues) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
}

const emptyCriteria = (): Record<string, unknown> => ({});

export const FilterFormModal: React.FC<FilterFormModalProps> = ({
  isOpen,
  onClose,
  filterKind,
  filter,
  lookups,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [criteria, setCriteria] = useState<Record<string, unknown>>(emptyCriteria());

  useEffect(() => {
    if (isOpen) {
      setName(filter?.name || '');
      setDescription(filter?.description || '');
      setSortOrder(filter?.sortOrder ?? 0);
      setIsActive(filter?.isActive ?? true);
      setCriteria(filter?.criteria ? { ...filter.criteria } : emptyCriteria());
    }
  }, [isOpen, filter]);

  if (!isOpen) return null;

  const setCriterion = (key: string, value: unknown) => {
    setCriteria((prev) => {
      const next = { ...prev };
      if (value === '' || value === null || value === undefined || value === false) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave({ name: name.trim(), description: description.trim(), sortOrder, isActive, criteria });
    onClose();
  };

  const kindLabel =
    filterKind === 'project' ? 'Project' : filterKind === 'person' ? 'Person' : 'Request';

  return (
    <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-md w-full flex flex-col overflow-hidden max-h-[90vh]">
        <div className="app-card-header px-5 py-4 flex justify-between items-center">
          <h3 className="text-base font-semibold text-primary">
            {filter ? `Edit ${kindLabel} Filter` : `New ${kindLabel} Filter`}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg text-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Sort order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Active
              </label>
            </div>
          </div>

          <div className="border-t border-subtle pt-4 space-y-3">
            <p className="text-xs font-semibold text-tertiary uppercase tracking-wider">Criteria</p>

            {filterKind === 'project' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Consulting unit</label>
                  <select
                    value={(criteria.consulting_unit_id as string) || ''}
                    onChange={(e) => setCriterion('consulting_unit_id', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    {lookups?.consultingUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Market unit</label>
                  <select
                    value={(criteria.market_unit_id as string) || ''}
                    onChange={(e) => setCriterion('market_unit_id', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    {lookups?.marketUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Win probability below</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={criteria.win_probability_lt !== undefined ? String(criteria.win_probability_lt) : ''}
                    onChange={(e) =>
                      setCriterion('win_probability_lt', e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="e.g. 100 for opportunities"
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
              </>
            )}

            {filterKind === 'person' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Site</label>
                  <select
                    value={(criteria.site_id as string) || ''}
                    onChange={(e) => setCriterion('site_id', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    {lookups?.sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Consulting unit</label>
                  <select
                    value={(criteria.consulting_unit_id as string) || ''}
                    onChange={(e) => setCriterion('consulting_unit_id', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    {lookups?.consultingUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Practice area</label>
                  <select
                    value={(criteria.practice_area_id as string) || ''}
                    onChange={(e) => setCriterion('practice_area_id', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    {lookups?.practiceAreas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Lifecycle status</label>
                  <select
                    value={(criteria.lifecycle_status as string) || ''}
                    onChange={(e) => setCriterion('lifecycle_status', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    {(['Hired', 'Employed', 'Terminated', 'Garden Leave', 'Leave', 'Parental Leave'] as LifecycleStatus[]).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Status</label>
                  <select
                    value={(criteria.status as string) || ''}
                    onChange={(e) => setCriterion('status', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    {(['Active', 'Inactive'] as PersonStatus[]).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {filterKind === 'request' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Status</label>
                  <select
                    value={(criteria.status as string) || ''}
                    onChange={(e) => setCriterion('status', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Billable type</label>
                  <select
                    value={(criteria.billable_type as string) || ''}
                    onChange={(e) => setCriterion('billable_type', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    <option value="Billable">Billable</option>
                    <option value="Opportunity">Opportunity</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Project consulting unit</label>
                  <select
                    value={(criteria.project_consulting_unit_id as string) || ''}
                    onChange={(e) => setCriterion('project_consulting_unit_id', e.target.value)}
                    className="w-full text-sm border border-default rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Any</option>
                    {lookups?.consultingUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={criteria.unassigned_only === true}
                    onChange={(e) => setCriterion('unassigned_only', e.target.checked ? true : undefined)}
                    className="rounded border-gray-300"
                  />
                  Unassigned only
                </label>
              </>
            )}
          </div>

          <div className="pt-2 flex justify-between items-center border-t border-subtle">
            {filter && onDelete ? (
              <button
                type="button"
                onClick={async () => {
                  if (safeConfirm(`Delete filter "${filter.name}"?`)) {
                    await onDelete(filter.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-default text-secondary hover:bg-surface-muted rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
