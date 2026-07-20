import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface LabCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (notes: string) => void;
}

export const LabCreateModal: React.FC<LabCreateModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [draftNotes, setDraftNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            setDraftNotes('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCreate = () => {
        const notes = draftNotes.trim();
        if (!notes) return;

        onCreate(notes);
        setDraftNotes('');
        onClose();
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
                        <label className="block text-sm font-medium text-secondary mb-2">Notes</label>
                        <textarea
                            value={draftNotes}
                            onChange={(e) => setDraftNotes(e.target.value)}
                            rows={8}
                            className="w-full resize-y rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="Write the draft content here..."
                        />
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