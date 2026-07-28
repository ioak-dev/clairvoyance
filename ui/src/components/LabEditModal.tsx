import React from 'react';
import { X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export type SimulationType = 'Request' | 'Project';

interface SelectOption {
    value: string;
    label: string;
}

export interface EditField {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'textarea';
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

function renderField(
    field: EditField,
    value: string,
    onFieldChange: (key: string, value: string) => void,
) {
    const generateUuid = () => {
        onFieldChange(field.key, uuidv4());
    };

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
                            <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
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
