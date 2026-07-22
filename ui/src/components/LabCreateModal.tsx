import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface SimulationInput {
    type: string;
    payload: Record<string, unknown>[];
}

interface LabCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (input: SimulationInput, rawText: string) => Promise<void>;
}

export const LabCreateModal: React.FC<LabCreateModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [draftNotes, setDraftNotes] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setDraftNotes('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCreate = async () => {
        const text = draftNotes.trim();
        if (!text) {
            setError('Paste a JSON object before creating.');
            return;
        }

        try {
            const parsed = JSON.parse(text) as { type?: unknown; payload?: unknown };
            if (typeof parsed.type !== 'string' || !parsed.type.trim()) {
                setError('The field "type" is required and must be a non-empty string.');
                return;
            }

            if (!Array.isArray(parsed.payload)) {
                setError('The field "payload" is required and must be an array.');
                return;
            }

            await onCreate(
                { type: parsed.type.trim(), payload: parsed.payload as Record<string, unknown>[] },
                text,
            );
            setDraftNotes('');
            setError('');
            onClose();
        } catch (err) {
            if (err instanceof SyntaxError) {
                setError('Invalid JSON. Please fix the JSON and try again.');
                return;
            }

            setError(err instanceof Error ? err.message : 'Failed to create request payload.');
        }
    };

    return (
        <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-lg w-full flex flex-col overflow-hidden max-h-[90vh]">
                <div className="app-card-header px-5 py-4 flex justify-between items-center">
                    <h3 className="text-base font-semibold text-primary">Create Draft</h3>
                    <button type="button" onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg text-tertiary">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Simulation JSON</label>
                        <textarea
                            value={draftNotes}
                            onChange={(e) => setDraftNotes(e.target.value)}
                            rows={8}
                            className="w-full resize-y rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder='{"type":"Request","payload":[{"id":"lab-row-001"}]}'
                        />
                        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-default text-sm font-semibold text-secondary hover:bg-surface-hover"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                        >
                            Create
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};