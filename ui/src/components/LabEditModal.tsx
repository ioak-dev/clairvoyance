import React, { useState, useRef, useEffect } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_ROSTER, type Roster } from '../types';
import { normalizeRoster, WEEKDAY_LABELS } from '../lib/rosterUtils';

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

function SearchableSelect({
    options = [],
    value,
    nullable,
    readOnly,
    onChange,
}: {
    options: Array<{ value: string; label: string }>;
    value: string;
    nullable?: boolean;
    readOnly?: boolean;
    onChange: (val: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

    const filtered = query.trim()
        ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
        : options;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setOpen(false);
        setQuery('');
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                disabled={readOnly}
                onClick={() => !readOnly && setOpen((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 text-left"
            >
                <span className={selectedLabel ? 'text-primary' : 'text-tertiary'}>
                    {selectedLabel || (nullable ? 'None' : 'Select opportunity…')}
                </span>
                <ChevronDown className={`w-4 h-4 text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-default bg-surface shadow-app-md overflow-hidden">
                    {/* Search input */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-default">
                        <Search className="w-3.5 h-3.5 text-tertiary shrink-0" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="flex-1 bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                        />
                    </div>

                    {/* Options list */}
                    <ul className="max-h-56 overflow-y-auto py-1">
                        {nullable && (
                            <li
                                onClick={() => handleSelect('')}
                                className="px-3 py-2 text-sm text-tertiary hover:bg-surface-hover cursor-pointer"
                            >
                                None
                            </li>
                        )}
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-tertiary">No results</li>
                        ) : (
                            filtered.map((o) => (
                                <li
                                    key={o.value}
                                    onClick={() => handleSelect(o.value)}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-surface-hover ${
                                        o.value === value ? 'font-semibold text-blue-600' : 'text-primary'
                                    }`}
                                >
                                    {o.label}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
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
                    <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={roster[index]}
                        onChange={(e) => updateDay(index, e.target.value)}
                        className="w-full rounded-md border border-default bg-surface px-1.5 py-1.5 text-sm text-primary text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
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
            <SearchableSelect
                options={field.options || []}
                value={value}
                nullable={field.nullable}
                readOnly={field.readOnly}
                onChange={(val) => onFieldChange(field.key, val)}
            />
        );
    }

    if (field.type === 'select') {
        return (
            <select
                value={value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                disabled={field.readOnly}
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
            >
                <option value="">{field.nullable ? 'None' : 'Select'}</option>
                {(field.options || []).map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        );
    }

    if (field.type === 'roster') {
        return <RosterEditor value={value} onChange={(val) => onFieldChange(field.key, val)} />;
    }

    if (field.type === 'textarea') {
        return (
            <textarea
                value={value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                disabled={field.readOnly}
                rows={3}
                className="w-full resize-y rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
            />
        );
    }

    if (field.type === 'text' && field.canGenerateUuid) {
        return (
            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onFieldChange(field.key, e.target.value)}
                    readOnly={field.readOnly}
                    className="w-full rounded-lg border border-default bg-surface pl-3 pr-24 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                    type="button"
                    onClick={generateUuid}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md border border-default bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-secondary hover:bg-surface-hover"
                >
                    Generate
                </button>
            </div>
        );
    }

    return (
        <input
            type={field.type}
            value={value}
            onChange={(e) => onFieldChange(field.key, e.target.value)}
            readOnly={field.readOnly}
            disabled={field.readOnly}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
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
    if (!isOpen || !editingType) {
        return null;
    }

    return (
        <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto">
            <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-4xl w-full flex flex-col overflow-hidden max-h-[90vh]">
                <div className="app-card-header px-5 py-4 flex justify-between items-center">
                    <div>
                        <h3 className="text-base font-semibold text-primary">Edit {editingType} Payload</h3>
                        <p className="text-xs text-tertiary mt-1">
                            {editingType === 'Request'
                                ? isRepublishAsNewRequest
                                    ? 'This published request will be republished as a new request with your updated field values.'
                                    : 'Use Prefill Request to load an existing request, then Publish to overwrite it.'
                                : 'This form edits one payload object and publishes it with your current field values.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-surface-hover rounded-lg text-tertiary"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto">
                    {editingType === 'Request' && onSelectPrefillRequest && (
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-secondary mb-1.5">Prefill Request</label>
                            <select
                                value={selectedPrefillRequestId}
                                onChange={(e) => onSelectPrefillRequest(e.target.value)}
                                disabled={isPublishing || requestPrefillOptions.length === 0}
                                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                            >
                                <option value="">Select existing request</option>
                                {requestPrefillOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fields.map((field) => (
                            <div
                                key={field.key}
                                className={field.type === 'textarea' || field.type === 'roster' ? 'md:col-span-2' : ''}
                            >
                                <label className="block text-xs font-medium text-secondary mb-1.5">{field.label}</label>
                                {renderField(field, editValues[field.key] || '', onFieldChange)}
                            </div>
                        ))}
                    </div>

                    {editError && <p className="mt-4 text-xs font-semibold text-red-600">{editError}</p>}
                </div>

                <div className="px-5 py-4 border-t border-subtle flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPublishing}
                        className="px-4 py-2 rounded-lg border border-default text-sm font-semibold text-secondary hover:bg-surface-hover disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onPublish}
                        disabled={isPublishing}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                    >
                        {isPublishing
                            ? isRepublishAsNewRequest
                                ? 'Republishing as new request…'
                                : 'Publishing…'
                            : isRepublishAsNewRequest
                              ? 'Republish as new request'
                              : 'Publish'}
                    </button>
                </div>
            </div>
        </div>
    );
};
