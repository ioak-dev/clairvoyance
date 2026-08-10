/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { FilterKind, SavedFilter } from '../types';
import type { Lookups } from '../lib/services/lookups';
import type { LifecycleStatus, PersonStatus } from '../types';
import { Modal, ConfirmDialog, Button, Input, Select, Field, Label, Checkbox } from './ui';

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

const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  'Hired',
  'Employed',
  'Terminated',
  'Garden Leave',
  'Leave',
  'Parental Leave',
];

const PERSON_STATUSES: PersonStatus[] = ['Active', 'Inactive'];

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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(filter?.name || '');
      setDescription(filter?.description || '');
      setSortOrder(filter?.sortOrder ?? 0);
      setIsActive(filter?.isActive ?? true);
      setCriteria(filter?.criteria ? { ...filter.criteria } : emptyCriteria());
      setConfirmDeleteOpen(false);
      setIsDeleting(false);
    }
  }, [isOpen, filter]);

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

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), sortOrder, isActive, criteria });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!filter || !onDelete || saving || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(filter.id);
      setConfirmDeleteOpen(false);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const kindLabel =
    filterKind === 'project' ? 'Project' : filterKind === 'person' ? 'Person' : 'Request';

  const anyOptions = (entries?: { id: string; name: string }[]) => [
    { value: '', label: 'Any' },
    ...(entries || []).map((u) => ({ value: u.id, label: u.name })),
  ];

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        size="sm"
        title={filter ? `Edit ${kindLabel} Filter` : `New ${kindLabel} Filter`}
        footer={
          <div className="flex w-full items-center justify-between">
            {filter && onDelete ? (
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                leftIcon={<Trash2 className="w-4 h-4" />}
                disabled={saving || isDeleting}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving || isDeleting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={saving}
                disabled={isDeleting}
                onClick={() => void handleSubmit()}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Field>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label>Sort order</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </Field>
            <Field className="flex-row items-end gap-2 pb-2">
              <Checkbox checked={isActive} onChange={setIsActive} />
              <Label className="cursor-pointer">Active</Label>
            </Field>
          </div>

          <div className="border-t border-subtle pt-4 space-y-3">
            <p className="text-xs font-semibold text-tertiary uppercase tracking-wider">Criteria</p>

            {filterKind === 'project' && (
              <>
                <Field>
                  <Label>Consulting unit</Label>
                  <Select
                    value={(criteria.consulting_unit_id as string) || ''}
                    onChange={(v) => setCriterion('consulting_unit_id', v)}
                    options={anyOptions(lookups?.consultingUnits)}
                  />
                </Field>
                <Field>
                  <Label>Market unit</Label>
                  <Select
                    value={(criteria.market_unit_id as string) || ''}
                    onChange={(v) => setCriterion('market_unit_id', v)}
                    options={anyOptions(lookups?.marketUnits)}
                  />
                </Field>
                <Field>
                  <Label>Win probability below</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={criteria.win_probability_lt !== undefined ? String(criteria.win_probability_lt) : ''}
                    onChange={(e) =>
                      setCriterion('win_probability_lt', e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="e.g. 100 for opportunities"
                  />
                </Field>
              </>
            )}

            {filterKind === 'person' && (
              <>
                <Field>
                  <Label>Site</Label>
                  <Select
                    value={(criteria.site_id as string) || ''}
                    onChange={(v) => setCriterion('site_id', v)}
                    options={anyOptions(lookups?.sites)}
                  />
                </Field>
                <Field>
                  <Label>Consulting unit</Label>
                  <Select
                    value={(criteria.consulting_unit_id as string) || ''}
                    onChange={(v) => setCriterion('consulting_unit_id', v)}
                    options={anyOptions(lookups?.consultingUnits)}
                  />
                </Field>
                <Field>
                  <Label>Practice area</Label>
                  <Select
                    value={(criteria.practice_area_id as string) || ''}
                    onChange={(v) => setCriterion('practice_area_id', v)}
                    options={anyOptions(lookups?.practiceAreas)}
                  />
                </Field>
                <Field>
                  <Label>Lifecycle status</Label>
                  <Select
                    value={(criteria.lifecycle_status as string) || ''}
                    onChange={(v) => setCriterion('lifecycle_status', v)}
                    options={[
                      { value: '', label: 'Any' },
                      ...LIFECYCLE_STATUSES.map((s) => ({ value: s, label: s })),
                    ]}
                  />
                </Field>
                <Field>
                  <Label>Status</Label>
                  <Select
                    value={(criteria.status as string) || ''}
                    onChange={(v) => setCriterion('status', v)}
                    options={[
                      { value: '', label: 'Any' },
                      ...PERSON_STATUSES.map((s) => ({ value: s, label: s })),
                    ]}
                  />
                </Field>
              </>
            )}

            {filterKind === 'request' && (
              <>
                <Field>
                  <Label>Status</Label>
                  <Select
                    value={(criteria.status as string) || ''}
                    onChange={(v) => setCriterion('status', v)}
                    options={[
                      { value: '', label: 'Any' },
                      { value: 'Pending', label: 'Pending' },
                      { value: 'Approved', label: 'Approved' },
                      { value: 'Rejected', label: 'Rejected' },
                    ]}
                  />
                </Field>
                <Field>
                  <Label>Billable type</Label>
                  <Select
                    value={(criteria.billable_type as string) || ''}
                    onChange={(v) => setCriterion('billable_type', v)}
                    options={[
                      { value: '', label: 'Any' },
                      { value: 'Billable', label: 'Billable' },
                      { value: 'Opportunity', label: 'Opportunity' },
                    ]}
                  />
                </Field>
                <Field>
                  <Label>Project consulting unit</Label>
                  <Select
                    value={(criteria.project_consulting_unit_id as string) || ''}
                    onChange={(v) => setCriterion('project_consulting_unit_id', v)}
                    options={anyOptions(lookups?.consultingUnits)}
                  />
                </Field>
                <Field className="flex-row items-center gap-2">
                  <Checkbox
                    checked={criteria.unassigned_only === true}
                    onChange={(checked) => setCriterion('unassigned_only', checked ? true : undefined)}
                  />
                  <Label className="cursor-pointer">Unassigned only</Label>
                </Field>
              </>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      >
        Delete filter &quot;{filter?.name}&quot;? This cannot be undone.
      </ConfirmDialog>
    </>
  );
};
