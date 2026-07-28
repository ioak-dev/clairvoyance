import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { projectsService } from '../lib/services/projects';
import { requestsService } from '../lib/services/requests';
import { toLabProjectPayloadItem, toLabRequestPayloadItem } from '../types/api';

export type LabSimulationType = 'Request' | 'Project';

interface SimulationInput {
    type: string;
    payload: Record<string, unknown>[];
}

type CreateMode = 'draft' | 'publish';

interface LabCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (input: SimulationInput, rawText: string, mode: CreateMode) => Promise<void>;
}

function isOpportunityProject(project: { winProbability?: number | null; isOpportunity?: boolean }) {
    if (project.winProbability != null) {
        return project.winProbability < 100;
    }
    return project.isOpportunity === true;
}

function isOpportunityRequest(
    request: { billableType: string; projectId: string },
    opportunityProjectIds: Set<string>,
) {
    return request.billableType === 'Opportunity' || opportunityProjectIds.has(request.projectId);
}

async function buildDefaultPayloadText(simulationType: LabSimulationType): Promise<string> {
    if (simulationType === 'Project') {
        const projects = await projectsService.list();
        const opportunities = projects.filter(isOpportunityProject);
        return JSON.stringify(
            {
                type: 'Project',
                payload: opportunities.map(toLabProjectPayloadItem),
            },
            null,
            2,
        );
    }

    const [projects, requests] = await Promise.all([
        projectsService.list(),
        requestsService.list(),
    ]);
    const opportunityProjectIds = new Set(
        projects.filter(isOpportunityProject).map((project) => project.id),
    );
    const opportunities = requests.filter((request) =>
        isOpportunityRequest(request, opportunityProjectIds),
    );

    return JSON.stringify(
        {
            type: 'Request',
            payload: opportunities.map(toLabRequestPayloadItem),
        },
        null,
        2,
    );
}

export const LabCreateModal: React.FC<LabCreateModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [simulationType, setSimulationType] = useState<LabSimulationType>('Request');
    const [draftNotes, setDraftNotes] = useState('');
    const [error, setError] = useState('');
    const [isLoadingDefault, setIsLoadingDefault] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        setError('');
        setIsSubmitting(false);
        setIsLoadingDefault(true);

        buildDefaultPayloadText(simulationType)
            .then((text) => {
                setDraftNotes(text);
            })
            .catch((err) => {
                setDraftNotes('');
                setError(err instanceof Error ? err.message : 'Failed to load default payload.');
            })
            .finally(() => {
                setIsLoadingDefault(false);
            });
    }, [isOpen, simulationType]);

    if (!isOpen) return null;

    const handleSimulationTypeChange = (nextType: LabSimulationType) => {
        setSimulationType(nextType);
        setError('');
    };

    const handleCreate = async () => {
        const text = draftNotes.trim();
        if (!text) {
            setIsSubmitting(true);
            setError('');
            const emptyPayload = [{}] as Record<string, unknown>[];
            const rawText = JSON.stringify(
                {
                    type: simulationType,
                    payload: emptyPayload,
                },
                null,
                2,
            );

            try {
                await onCreate(
                    { type: simulationType, payload: emptyPayload },
                    rawText,
                    'draft',
                );
                onClose();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create draft.');
            } finally {
                setIsSubmitting(false);
            }
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

            if (parsed.type.trim().toLowerCase() === 'project') {
                const invalid = (parsed.payload as Record<string, unknown>[]).find((item) => {
                    const winProbability = Number(item.win_probability ?? 100);
                    return Number.isNaN(winProbability) || winProbability >= 100;
                });
                if (invalid) {
                    setError('Project payloads must be opportunities only (win_probability below 100).');
                    return;
                }
            }

            setIsSubmitting(true);
            setError('');

            await onCreate(
                { type: parsed.type.trim(), payload: parsed.payload as Record<string, unknown>[] },
                text,
                'publish',
            );
            onClose();
        } catch (err) {
            if (err instanceof SyntaxError) {
                setError('Invalid JSON. Please fix the JSON and try again.');
            } else {
                setError(err instanceof Error ? err.message : 'Publish failed.');
            }
        } finally {
            setIsSubmitting(false);
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
                        <label className="block text-sm font-medium text-secondary mb-2">Simulation type</label>
                        <select
                            value={simulationType}
                            onChange={(e) => handleSimulationTypeChange(e.target.value as LabSimulationType)}
                            disabled={isLoadingDefault || isSubmitting}
                            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                        >
                            <option value="Request">Request</option>
                            <option value="Project">Project (opportunity only)</option>
                        </select>
                        {simulationType === 'Project' ? (
                            <p className="mt-1.5 text-xs text-tertiary">
                                Upserts opportunity projects by upstream id. Each item must have win_probability below 100.
                            </p>
                        ) : (
                            <p className="mt-1.5 text-xs text-tertiary">
                                Prefilled from opportunity requests (Opportunity billable type or linked opportunity project).
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Simulation JSON</label>
                        <textarea
                            value={draftNotes}
                            onChange={(e) => setDraftNotes(e.target.value)}
                            rows={12}
                            disabled={isLoadingDefault || isSubmitting}
                            className="w-full resize-y rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                            placeholder={
                                simulationType === 'Project'
                                    ? '{"type":"Project","payload":[{"id":"NW-PROJ-005","win_probability":35}]}'
                                    : '{"type":"Request","payload":[{"id":"NW-REQ-001"}]}'
                            }
                        />
                        {isLoadingDefault && (
                            <p className="mt-2 text-xs text-tertiary">
                                Loading current {simulationType === 'Project' ? 'opportunity projects' : 'opportunity requests'}…
                            </p>
                        )}
                        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-lg border border-default text-sm font-semibold text-secondary hover:bg-surface-hover disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={isLoadingDefault || isSubmitting}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                        >
                            {isSubmitting ? 'Publishing…' : draftNotes.trim() ? 'Publish' : 'Draft'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
