import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_ROSTER, type Roster } from '../types';
import { normalizeRoster, WEEKDAY_LABELS } from '../lib/rosterUtils';
import { Modal, Button, Input, Textarea, Select, Combobox, Field, Label } from './ui';

export type SimulationType = 'Request' | 'Project';

interface SelectOption {
    value: string;
    label: string;
}

export interface EditField {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'searchable-select' | 'textarea' | 'roster';
    options?: SelectOption[];
    nullable?: boolean;
    readOnly?: boolean;
    canGenerateUuid?: boolean;
}

interface LabEditModalProps {
    isOpen: boolean;
    editingType: SimulationType | null;
    fields: EditField[];
    requestPrefillOptions?: SelectOption[];
    selectedPrefillRequestId?: string;
    editValues: Record<string, string>;
    editError: string;
    isPublishing: boolean;
    isRepublishAsNewRequest?: boolean;
    onSelectPrefillRequest?: (requestId: string) => void;
    onFieldChange: (key: string, value: string) => void;
    onClose: () => void;
    onPublish: () => void;
}

function parseRosterEditValue(value: string): Roster {
    try {
        const parsed = JSON.parse(value.trim() || '[]');
        return normalizeRoster(parsed);
    } catch {
        return [...DEFAULT_ROSTER] as Roster;
    }
}

function RosterEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const roster = parseRosterEditValue(value);

    const updateDay = (index: number, raw: string) => {
        const parsed = Number(raw);
        const next = [...roster] as Roster;
        next[index] = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        onChange(JSON.stringify(next));
    };

    return (
        <div className="grid grid-cols-7 gap-2 p-3 rounded-lg border border-default bg-surface-muted">
            {WEEKDAY_LABELS.map((label, index) => (
                <div key={label}>
                    <label className="block text-[10px] font-medium text-tertiary mb-1 text-center">{label}</label>
                    <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={roster[index]}
                        onChange={(e) => updateDay(index, e.target.value)}
                        className="h-8 px-1.5 text-center"
                    />
                </div>
            ))}
        </div>
    );
}

function renderField(
    field: EditField,
    value: string,
    onFieldChange: (key: string, value: string) => void,
) {
    const generateUuid = () => {
        onFieldChange(field.key, uuidv4());
    };

    if (field.type === 'searchable-select') {
        return (
            <Combobox
                options={field.options || []}
                value={value || null}
                nullable={field.nullable}
                disabled={field.readOnly}
                placeholder={field.nullable ? 'None' : 'Select opportunity…'}
                onChange={(val) => onFieldChange(field.key, val ?? '')}
            />
        );
    }

    if (field.type === 'select') {
        return (
            <Select
                value={value || null}
                onChange={(v) => onFieldChange(field.key, v)}
                disabled={field.readOnly}
                placeholder={field.nullable ? 'None' : 'Select'}
                options={[
                    ...(field.nullable || !value
                        ? [{ value: '', label: field.nullable ? 'None' : 'Select' }]
                        : []),
                    ...(field.options || []),
                ]}
            />
        );
    }

    if (field.type === 'roster') {
        return <RosterEditor value={value} onChange={(val) => onFieldChange(field.key, val)} />;
    }

    if (field.type === 'textarea') {
        return (
            <Textarea
                value={value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                disabled={field.readOnly}
                rows={3}
            />
        );
    }

    if (field.type === 'text' && field.canGenerateUuid) {
        return (
            <div className="relative">
                <Input
                    type="text"
                    value={value}
                    onChange={(e) => onFieldChange(field.key, e.target.value)}
                    readOnly={field.readOnly}
                    className="pr-24"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={generateUuid}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2.5 text-[11px]"
                >
                    Generate
                </Button>
            </div>
        );
    }

    return (
        <Input
            type={field.type}
            value={value}
            onChange={(e) => onFieldChange(field.key, e.target.value)}
            readOnly={field.readOnly}
            disabled={field.readOnly}
        />
    );
}

export const LabEditModal: React.FC<LabEditModalProps> = ({
    isOpen,
    editingType,
    fields,
    requestPrefillOptions = [],
    selectedPrefillRequestId = '',
    editValues,
    editError,
    isPublishing,
    isRepublishAsNewRequest = false,
    onSelectPrefillRequest,
    onFieldChange,
    onClose,
    onPublish,
}) => {
    return (
        <Modal
            open={isOpen && !!editingType}
            onClose={onClose}
            size="xl"
            title={editingType ? `Edit ${editingType} Payload` : 'Edit Payload'}
            description={
                editingType === 'Request'
                    ? isRepublishAsNewRequest
                        ? 'This published request will be republished as a new request with your updated field values.'
                        : 'Use Prefill Request to load an existing request, then Publish to overwrite it.'
                    : 'This form edits one payload object and publishes it with your current field values.'
            }
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={isPublishing}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={onPublish} loading={isPublishing}>
                        {isPublishing
                            ? isRepublishAsNewRequest
                                ? 'Republishing as new request…'
                                : 'Publishing…'
                            : isRepublishAsNewRequest
                              ? 'Republish as new request'
                              : 'Publish'}
                    </Button>
                </>
            }
        >
            {editingType === 'Request' && onSelectPrefillRequest && (
                <Field className="mb-4">
                    <Label>Prefill Request</Label>
                    <Select
                        value={selectedPrefillRequestId || null}
                        onChange={onSelectPrefillRequest}
                        disabled={isPublishing || requestPrefillOptions.length === 0}
                        placeholder="Select existing request"
                        options={requestPrefillOptions}
                    />
                </Field>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((field) => (
                    <Field
                        key={field.key}
                        className={field.type === 'textarea' || field.type === 'roster' ? 'md:col-span-2' : ''}
                    >
                        <Label>{field.label}</Label>
                        {renderField(field, editValues[field.key] || '', onFieldChange)}
                    </Field>
                ))}
            </div>

            {editError && <p className="mt-4 text-xs font-semibold text-red-600">{editError}</p>}
        </Modal>
    );
};
