import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_ROSTER, type Roster, type ScheduleUnit } from '../types';
import { normalizeRoster, WEEKDAY_LABELS } from '../lib/rosterUtils';
import { useLookups } from '../hooks/useLookups';
import { useProjects } from '../hooks/useProjects';
import { getFilteredCompetencyCenterOptions } from './labEditFieldConfig';

interface SimulationInput {
    type: string;
    payload: Record<string, unknown>[];
}

type CreateInputMode = 'form' | 'json';

interface LabCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (input: SimulationInput, rawText: string) => Promise<void>;
}

interface RequestFormState {
    id: string;
    project_id: string;
    start: string;
    end: string;
    unit: ScheduleUnit;
    roster: Roster;
    status: string;
    probability: string;
    request_name: string;
    notes: string;
    consulting_unit_id: string;
    practice_area_id: string;
    competency_center_id: string;
    site_id: string;
    job_level_id: string;
}

function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getNextMonthBounds() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
    };
}

function createInitialFormState(startDate: string, endDate: string): RequestFormState {
    return {
        id: '',
        project_id: '',
        start: startDate,
        end: endDate,
        unit: 'utilization',
        roster: [...DEFAULT_ROSTER] as Roster,
        status: 'Pending',
        probability: '100',
        request_name: '',
        notes: '',
        consulting_unit_id: '',
        practice_area_id: '',
        competency_center_id: '',
        site_id: '',
        job_level_id: '',
    };
}

function toRequestPayload(form: RequestFormState): Record<string, unknown> {
    return {
        id: form.id.trim(),
        project_id: form.project_id.trim(),
        person_id: '',
        billable_type: 'Opportunity',
        booking_type: 'soft',
        start: form.start,
        end: form.end,
        unit: form.unit,
        roster: form.roster,
        status: form.status,
        probability: Number(form.probability),
        request_name: form.request_name.trim() || null,
        notes: form.notes.trim() || null,
        consulting_unit_id: form.consulting_unit_id || null,
        practice_area_id: form.practice_area_id || null,
        competency_center_id: form.competency_center_id || null,
        site_id: form.site_id || null,
        job_level_id: form.job_level_id || null,
    };
}

function toRawRequestText(payload: Record<string, unknown>): string {
    return JSON.stringify(
        {
            type: 'Request',
            payload: [payload],
        },
        null,
        2,
    );
}

export const LabCreateModal: React.FC<LabCreateModalProps> = ({ isOpen, onClose, onCreate }) => {
    const nextMonthBounds = useMemo(() => getNextMonthBounds(), []);
    const [inputMode, setInputMode] = useState<CreateInputMode>('form');
    const [form, setForm] = useState<RequestFormState>(() =>
        createInitialFormState(nextMonthBounds.startDate, nextMonthBounds.endDate),
    );
    const [jsonText, setJsonText] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { data: lookups } = useLookups();
    const { data: projects = [] } = useProjects();

    const opportunityOptions = useMemo(() => {
        return projects
            .filter((project) => project.billableType === 'Opportunity')
            .map((project) => ({
                value: project.id,
                label: project.name,
            }));
    }, [projects]);

    const competencyCenterOptions = useMemo(() => {
        return getFilteredCompetencyCenterOptions(lookups, form.practice_area_id);
    }, [form.practice_area_id, lookups]);

    useEffect(() => {
        if (!isOpen) return;

        const nextBounds = getNextMonthBounds();
        const initialForm = createInitialFormState(nextBounds.startDate, nextBounds.endDate);
        const initialPayload = toRequestPayload(initialForm);

        setInputMode('form');
        setForm(initialForm);
        setJsonText(toRawRequestText(initialPayload));
        setError('');
        setIsSubmitting(false);
    }, [isOpen]);

    if (!isOpen) return null;

    const updateFormField = <K extends keyof RequestFormState>(key: K, value: RequestFormState[K]) => {
        setForm((current) => {
            const next = { ...current, [key]: value };
            if (key === 'practice_area_id' && current.practice_area_id !== value) {
                next.competency_center_id = '';
            }
            return next;
        });
        setError('');
    };

    const updateRosterDay = (index: number, raw: string) => {
        const parsed = Number(raw);
        const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        setForm((current) => {
            const nextRoster = [...current.roster] as Roster;
            nextRoster[index] = value;
            return { ...current, roster: nextRoster };
        });
        setError('');
    };

    const generateRequestReferenceId = () => {
        updateFormField('id', crypto.randomUUID());
    };

    const handleCreate = async () => {
        if (inputMode === 'form') {
            if (!form.id.trim()) {
                setError('Request Reference ID is required.');
                return;
            }
            if (!form.project_id.trim()) {
                setError('Opportunity is required.');
                return;
            }
            if (!form.start || !form.end) {
                setError('Start and End dates are required.');
                return;
            }
            if (form.start > form.end) {
                setError('End must be on or after Start.');
                return;
            }
            if (!form.status.trim()) {
                setError('Status is required.');
                return;
            }
            const probability = Number(form.probability);
            if (!form.probability.trim() || Number.isNaN(probability)) {
                setError('Probability must be a valid number.');
                return;
            }
            if (normalizeRoster(form.roster).length !== 7) {
                setError('Roster must have 7 values (Mon–Sun).');
                return;
            }

            setIsSubmitting(true);

            try {
                const payload = toRequestPayload(form);
                const rawText = toRawRequestText(payload);
                await onCreate({ type: 'Request', payload: [payload] }, rawText);
                onClose();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Publish failed.');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        const text = jsonText.trim();
        if (!text) {
            setError('Simulation JSON is required.');
            return;
        }

        try {
            const parsed = JSON.parse(text) as { type?: unknown; payload?: unknown };
            if (typeof parsed.type !== 'string' || !parsed.type.trim()) {
                setError('The field "type" is required and must be a non-empty string.');
                return;
            }

            if (parsed.type.trim().toLowerCase() !== 'request') {
                setError('Simulation type must be "Request".');
                return;
            }

            if (!Array.isArray(parsed.payload)) {
                setError('The field "payload" is required and must be an array.');
                return;
            }

            for (const item of parsed.payload) {
                if (!item || typeof item !== 'object') continue;
                const row = item as Record<string, unknown>;
                if ('weeks' in row || 'days_per_week' in row) {
                    setError('payload must use start/end/unit/roster; weeks are not supported.');
                    return;
                }
            }

            setIsSubmitting(true);
            setError('');

            await onCreate({ type: 'Request', payload: parsed.payload as Record<string, unknown>[] }, text);
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
            <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-4xl w-full flex flex-col overflow-hidden max-h-[92vh]">
                <div className="app-card-header px-5 py-4 flex justify-between items-center">
                    <div>
                        <h3 className="text-base font-semibold text-primary">Create Request Payload</h3>
                        <p className="text-xs text-tertiary mt-1">Type is fixed to Request. Creating immediately publishes.</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg text-tertiary">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Input mode</label>
                        <div className="inline-flex rounded-lg border border-default bg-surface-muted p-1">
                            <button
                                type="button"
                                onClick={() => {
                                    const payload = toRequestPayload(form);
                                    setJsonText(toRawRequestText(payload));
                                    setInputMode('form');
                                    setError('');
                                }}
                                disabled={isSubmitting}
                                className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
                                    inputMode === 'form' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:bg-surface'
                                }`}
                            >
                                Form
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const payload = toRequestPayload(form);
                                    setJsonText(toRawRequestText(payload));
                                    setInputMode('json');
                                    setError('');
                                }}
                                disabled={isSubmitting}
                                className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
                                    inputMode === 'json' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:bg-surface'
                                }`}
                            >
                                JSON
                            </button>
                        </div>
                    </div>

                    {inputMode === 'form' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Request Reference ID</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={form.id}
                                            onChange={(e) => updateFormField('id', e.target.value)}
                                            disabled={isSubmitting}
                                            className="flex-1 rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                        />
                                        <button
                                            type="button"
                                            onClick={generateRequestReferenceId}
                                            disabled={isSubmitting}
                                            className="shrink-0 rounded-lg border border-default px-3 py-2 text-xs font-semibold text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
                                        >
                                            Generate
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Opportunity</label>
                                    <select
                                        value={form.project_id}
                                        onChange={(e) => updateFormField('project_id', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    >
                                        <option value="">Select opportunity</option>
                                        {opportunityOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Start</label>
                                    <input
                                        type="date"
                                        value={form.start}
                                        onChange={(e) => updateFormField('start', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">End</label>
                                    <input
                                        type="date"
                                        value={form.end}
                                        onChange={(e) => updateFormField('end', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Unit</label>
                                    <select
                                        value={form.unit}
                                        onChange={(e) => updateFormField('unit', e.target.value as ScheduleUnit)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    >
                                        <option value="utilization">utilization</option>
                                        <option value="hours">hours</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Status</label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => updateFormField('status', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Probability</label>
                                    <input
                                        type="number"
                                        value={form.probability}
                                        onChange={(e) => updateFormField('probability', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Request Name</label>
                                    <input
                                        type="text"
                                        value={form.request_name}
                                        onChange={(e) => updateFormField('request_name', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Consulting Unit</label>
                                    <select
                                        value={form.consulting_unit_id}
                                        onChange={(e) => updateFormField('consulting_unit_id', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    >
                                        <option value="">None</option>
                                        {(lookups?.consultingUnits || []).map((entry) => (
                                            <option key={entry.id} value={entry.id}>{entry.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Practice Area</label>
                                    <select
                                        value={form.practice_area_id}
                                        onChange={(e) => updateFormField('practice_area_id', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    >
                                        <option value="">None</option>
                                        {(lookups?.practiceAreas || []).map((entry) => (
                                            <option key={entry.id} value={entry.id}>{entry.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Competency Center</label>
                                    <select
                                        value={form.competency_center_id}
                                        onChange={(e) => updateFormField('competency_center_id', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    >
                                        <option value="">None</option>
                                        {competencyCenterOptions.map((entry) => (
                                            <option key={entry.value} value={entry.value}>{entry.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Site</label>
                                    <select
                                        value={form.site_id}
                                        onChange={(e) => updateFormField('site_id', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    >
                                        <option value="">None</option>
                                        {(lookups?.sites || []).map((entry) => (
                                            <option key={entry.id} value={entry.id}>{entry.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary mb-1.5">Job Level</label>
                                    <select
                                        value={form.job_level_id}
                                        onChange={(e) => updateFormField('job_level_id', e.target.value)}
                                        disabled={isSubmitting}
                                        className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                    >
                                        <option value="">None</option>
                                        {(lookups?.jobLevels || []).map((entry) => (
                                            <option key={entry.id} value={entry.id}>{entry.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-secondary">
                                    Roster ({form.unit === 'hours' ? 'hours/day' : 'utilization'} Mon–Sun)
                                </label>
                                <div className="grid grid-cols-7 gap-2 p-3 rounded-lg border border-default bg-surface-muted">
                                    {WEEKDAY_LABELS.map((label, index) => (
                                        <div key={label}>
                                            <label className="block text-[10px] font-medium text-tertiary mb-1 text-center">{label}</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={form.unit === 'hours' ? 0.5 : 0.1}
                                                value={form.roster[index]}
                                                onChange={(e) => updateRosterDay(index, e.target.value)}
                                                disabled={isSubmitting}
                                                className="w-full rounded-md border border-default bg-surface px-1.5 py-1.5 text-sm text-primary text-center focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary mb-1.5">Notes</label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => updateFormField('notes', e.target.value)}
                                    rows={3}
                                    disabled={isSubmitting}
                                    className="w-full resize-y rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">Simulation JSON</label>
                            <textarea
                                value={jsonText}
                                onChange={(e) => setJsonText(e.target.value)}
                                rows={18}
                                disabled={isSubmitting}
                                className="w-full resize-y rounded-lg border border-default bg-surface px-3 py-2 text-sm font-mono text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                                placeholder='{"type":"Request","payload":[{"id":"NW-REQ-001","start":"2026-03-02","end":"2026-04-17","unit":"utilization","roster":[1,1,1,1,1,0,0]}]}'
                            />
                        </div>
                    )}

                    {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

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
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                        >
                            {isSubmitting ? 'Publishing…' : 'Publish'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
