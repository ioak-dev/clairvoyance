import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_ROSTER, type Roster, type ScheduleUnit } from '../types';
import { normalizeRoster, WEEKDAY_LABELS } from '../lib/rosterUtils';
import { useLookups } from '../hooks/useLookups';
import { useProjects } from '../hooks/useProjects';
import { getFilteredCompetencyCenterOptions } from './labEditFieldConfig';
import { Modal, Button, Input, Textarea, Select, Field, Label } from './ui';

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

    const noneOptions = (entries?: { id: string; name: string }[]) => [
        { value: '', label: 'None' },
        ...(entries || []).map((entry) => ({ value: entry.id, label: entry.name })),
    ];

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="xl"
            title="Create Request Payload"
            description="Type is fixed to Request. Creating immediately publishes."
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => void handleCreate()} loading={isSubmitting}>
                        {isSubmitting ? 'Publishing…' : 'Publish'}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Field>
                    <Label>Input mode</Label>
                    <div className="inline-flex rounded-lg border border-default bg-surface-muted p-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={inputMode === 'form' ? 'secondary' : 'ghost'}
                            onClick={() => {
                                const payload = toRequestPayload(form);
                                setJsonText(toRawRequestText(payload));
                                setInputMode('form');
                                setError('');
                            }}
                            disabled={isSubmitting}
                            className={inputMode === 'form' ? 'shadow-sm' : ''}
                        >
                            Form
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={inputMode === 'json' ? 'secondary' : 'ghost'}
                            onClick={() => {
                                const payload = toRequestPayload(form);
                                setJsonText(toRawRequestText(payload));
                                setInputMode('json');
                                setError('');
                            }}
                            disabled={isSubmitting}
                            className={inputMode === 'json' ? 'shadow-sm' : ''}
                        >
                            JSON
                        </Button>
                    </div>
                </Field>

                {inputMode === 'form' ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field>
                                <Label>Request Reference ID</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        value={form.id}
                                        onChange={(e) => updateFormField('id', e.target.value)}
                                        disabled={isSubmitting}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={generateRequestReferenceId}
                                        disabled={isSubmitting}
                                        className="shrink-0 h-9"
                                    >
                                        Generate
                                    </Button>
                                </div>
                            </Field>
                            <Field>
                                <Label>Opportunity</Label>
                                <Select
                                    value={form.project_id || null}
                                    onChange={(v) => updateFormField('project_id', v)}
                                    disabled={isSubmitting}
                                    placeholder="Select opportunity"
                                    options={opportunityOptions}
                                />
                            </Field>
                            <Field>
                                <Label>Start</Label>
                                <Input
                                    type="date"
                                    value={form.start}
                                    onChange={(e) => updateFormField('start', e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </Field>
                            <Field>
                                <Label>End</Label>
                                <Input
                                    type="date"
                                    value={form.end}
                                    onChange={(e) => updateFormField('end', e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </Field>
                            <Field>
                                <Label>Unit</Label>
                                <Select
                                    value={form.unit}
                                    onChange={(v) => updateFormField('unit', v)}
                                    disabled={isSubmitting}
                                    options={[
                                        { value: 'utilization', label: 'utilization' },
                                        { value: 'hours', label: 'hours' },
                                    ]}
                                />
                            </Field>
                            <Field>
                                <Label>Status</Label>
                                <Select
                                    value={form.status}
                                    onChange={(v) => updateFormField('status', v)}
                                    disabled={isSubmitting}
                                    options={[
                                        { value: 'Pending', label: 'Pending' },
                                        { value: 'Approved', label: 'Approved' },
                                        { value: 'Rejected', label: 'Rejected' },
                                    ]}
                                />
                            </Field>
                            <Field>
                                <Label>Probability</Label>
                                <Input
                                    type="number"
                                    value={form.probability}
                                    onChange={(e) => updateFormField('probability', e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </Field>
                            <Field>
                                <Label>Request Name</Label>
                                <Input
                                    type="text"
                                    value={form.request_name}
                                    onChange={(e) => updateFormField('request_name', e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </Field>
                            <Field>
                                <Label>Consulting Unit</Label>
                                <Select
                                    value={form.consulting_unit_id}
                                    onChange={(v) => updateFormField('consulting_unit_id', v)}
                                    disabled={isSubmitting}
                                    options={noneOptions(lookups?.consultingUnits)}
                                />
                            </Field>
                            <Field>
                                <Label>Practice Area</Label>
                                <Select
                                    value={form.practice_area_id}
                                    onChange={(v) => updateFormField('practice_area_id', v)}
                                    disabled={isSubmitting}
                                    options={noneOptions(lookups?.practiceAreas)}
                                />
                            </Field>
                            <Field>
                                <Label>Competency Center</Label>
                                <Select
                                    value={form.competency_center_id}
                                    onChange={(v) => updateFormField('competency_center_id', v)}
                                    disabled={isSubmitting}
                                    options={[
                                        { value: '', label: 'None' },
                                        ...competencyCenterOptions,
                                    ]}
                                />
                            </Field>
                            <Field>
                                <Label>Site</Label>
                                <Select
                                    value={form.site_id}
                                    onChange={(v) => updateFormField('site_id', v)}
                                    disabled={isSubmitting}
                                    options={noneOptions(lookups?.sites)}
                                />
                            </Field>
                            <Field>
                                <Label>Job Level</Label>
                                <Select
                                    value={form.job_level_id}
                                    onChange={(v) => updateFormField('job_level_id', v)}
                                    disabled={isSubmitting}
                                    options={noneOptions(lookups?.jobLevels)}
                                />
                            </Field>
                        </div>

                        <Field>
                            <Label>
                                Roster ({form.unit === 'hours' ? 'hours/day' : 'utilization'} Mon–Sun)
                            </Label>
                            <div className="grid grid-cols-7 gap-2 p-3 rounded-lg border border-default bg-surface-muted">
                                {WEEKDAY_LABELS.map((label, index) => (
                                    <div key={label}>
                                        <label className="block text-[10px] font-medium text-tertiary mb-1 text-center">{label}</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={form.unit === 'hours' ? 0.5 : 0.1}
                                            value={form.roster[index]}
                                            onChange={(e) => updateRosterDay(index, e.target.value)}
                                            disabled={isSubmitting}
                                            className="h-8 px-1.5 text-center"
                                        />
                                    </div>
                                ))}
                            </div>
                        </Field>

                        <Field>
                            <Label>Notes</Label>
                            <Textarea
                                value={form.notes}
                                onChange={(e) => updateFormField('notes', e.target.value)}
                                rows={3}
                                disabled={isSubmitting}
                            />
                        </Field>
                    </>
                ) : (
                    <Field>
                        <Label>Simulation JSON</Label>
                        <Textarea
                            value={jsonText}
                            onChange={(e) => setJsonText(e.target.value)}
                            rows={18}
                            disabled={isSubmitting}
                            className="font-mono min-h-[320px]"
                            placeholder='{"type":"Request","payload":[{"id":"NW-REQ-001","start":"2026-03-02","end":"2026-04-17","unit":"utilization","roster":[1,1,1,1,1,0,0]}]}'
                        />
                    </Field>
                )}

                {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            </div>
        </Modal>
    );
};
