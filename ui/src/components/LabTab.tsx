import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlaskConical, Plus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { LabCreateModal } from './LabCreateModal.tsx';
import { LabEditModal, type EditField, type SimulationType } from './LabEditModal.tsx';
import {
  buildProjectFields,
  buildRequestFields,
  getFilteredCompetencyCenterOptions,
  type ValidationEditField,
} from './labEditFieldConfig';
import { labService, type SimulationLogEntry } from '../lib/services/lab';
import { useLookups } from '../hooks/useLookups';
import { usePeople } from '../hooks/usePeople';
import { useProjects } from '../hooks/useProjects';
import { requestQueryKeys, useRequests } from '../hooks/useRequests';
import { requestsService } from '../lib/services/requests';
import type { ApprovalStatus } from '../types/api';
import { toLabRequestPayloadItem } from '../types/api';
import type { BookingRequest, JobCategory } from '../types';

function normalizeSimulationType(value: string): SimulationType {
  return value.trim().toLowerCase() === 'project' ? 'Project' : 'Request';
}

function toRawPayloadText(simulationType: string, payload: Record<string, unknown>[]) {
  return JSON.stringify({
    type: normalizeSimulationType(simulationType),
    payload,
  }, null, 2);
}

function toEditablePayloadObject(row: SimulationRow): Record<string, unknown> {
  const item = Array.isArray(row.payload) ? row.payload[0] : null;
  if (!item || typeof item !== 'object') {
    return {};
  }
  return { ...item };
}

function toFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function parseFieldValue(field: EditField, rawValue: string): unknown {
  if (field.type === 'number') {
    if (!rawValue.trim()) {
      return field.nullable ? null : 0;
    }
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? rawValue : parsed;
  }

  if (!rawValue.trim() && field.nullable) {
    return null;
  }

  return rawValue;
}

interface SimulationRow {
  id: string;
  timestamp: string;
  simulationType: string;
  payload: Record<string, unknown>[];
  recordCount: number;
  rawPayloadText: string;
  isDraft?: boolean;
}

function toSimulationRow(entry: SimulationLogEntry): SimulationRow {
  return {
    id: entry.id,
    timestamp: new Date(entry.createdAt).toLocaleString(),
    simulationType: normalizeSimulationType(entry.simulationType),
    payload: entry.payload,
    recordCount: entry.recordCount,
    rawPayloadText: toRawPayloadText(entry.simulationType, entry.payload),
  };
}

export const LabTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [simulationRows, setSimulationRows] = useState<SimulationRow[]>([]);
  const [draftRows, setDraftRows] = useState<SimulationRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<SimulationRow | null>(null);
  const [editingRow, setEditingRow] = useState<SimulationRow | null>(null);
  const [selectedPrefillRequestId, setSelectedPrefillRequestId] = useState('');
  const [prefilledRequestReferenceId, setPrefilledRequestReferenceId] = useState('');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState('');
  const [isPublishingEdit, setIsPublishingEdit] = useState(false);
  const [loadError, setLoadError] = useState('');
  const { data: lookups } = useLookups();
  const { data: projects = [] } = useProjects();
  const { data: people = [] } = usePeople();
  const { data: requests = [] } = useRequests();

  const rows = useMemo(() => {
    return [...draftRows, ...simulationRows];
  }, [draftRows, simulationRows]);

  const editingType = useMemo<SimulationType | null>(() => {
    if (!editingRow) return null;
    return normalizeSimulationType(editingRow.simulationType);
  }, [editingRow]);

  const competencyCenterOptions = useMemo(() => {
    return getFilteredCompetencyCenterOptions(lookups, editValues.practice_area_id || '');
  }, [editValues.practice_area_id, lookups]);

  const requestFields = useMemo<ValidationEditField[]>(() => {
    return buildRequestFields({
      projects,
      people,
      lookups,
      competencyCenterOptions,
    });
  }, [competencyCenterOptions, lookups, people, projects]);

  const projectFields = useMemo<ValidationEditField[]>(() => {
    return buildProjectFields({ people, lookups });
  }, [lookups, people]);

  const requestPrefillOptions = useMemo(() => {
    return requests.map((request) => ({
      value: request.id,
      label: `${request.referenceId} (${request.startDate} to ${request.endDate})`,
    }));
  }, [requests]);

  const refreshSimulations = useCallback(async () => {
    try {
      setLoadError('');
      const entries = await labService.listSimulations();
      setSimulationRows(entries.map(toSimulationRow));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load simulations.');
    }
  }, []);

  useEffect(() => {
    void refreshSimulations();
  }, [refreshSimulations]);

  const openEdit = (row: SimulationRow) => {
    const simulationType = normalizeSimulationType(row.simulationType);
    const firstPayload = toEditablePayloadObject(row);
    const nextValues: Record<string, string> = {};
    Object.entries(firstPayload).forEach(([key, value]) => {
      nextValues[key] = toFieldValue(value);
    });

    if (simulationType === 'Request') {
      nextValues.billable_type = 'Opportunity';
      nextValues.booking_type = 'soft';
      nextValues.person_id = '';
    }

    setEditValues(nextValues);
    setSelectedPrefillRequestId('');
    setPrefilledRequestReferenceId('');
    setEditError('');
    setEditingRow(row);
  };

  const toRequestPatch = (
    payload: Record<string, unknown>,
  ): Partial<BookingRequest> & { status?: ApprovalStatus } => {
    return {
      referenceId: toFieldValue(payload.id),
      projectId: toFieldValue(payload.project_id),
      resourceId: toFieldValue(payload.person_id),
      startDate: toFieldValue(payload.start_date),
      endDate: toFieldValue(payload.end_date),
      billablePercent: Number(payload.billable_percent ?? 0),
      billableType: 'Opportunity',
      bookingType: toFieldValue(payload.booking_type) as BookingRequest['bookingType'],
      probability: Number(payload.probability ?? 100),
      status: toFieldValue(payload.status) as ApprovalStatus,
      requiredSkill: toFieldValue(payload.required_skill) || undefined,
      notes: toFieldValue(payload.notes) || undefined,
      consultingUnitId: toFieldValue(payload.consulting_unit_id) || null,
      practiceAreaId: toFieldValue(payload.practice_area_id) || null,
      competencyCenterId: toFieldValue(payload.competency_center_id) || null,
      siteId: toFieldValue(payload.site_id) || null,
      jobCategory: (toFieldValue(payload.job_category) || null) as JobCategory | null,
    };
  };

  const toRequestCreateInput = (
    payload: Record<string, unknown>,
  ): Omit<BookingRequest, 'id' | 'status'> => {
    return {
      referenceId: toFieldValue(payload.id),
      resourceId: toFieldValue(payload.person_id),
      projectId: toFieldValue(payload.project_id),
      startDate: toFieldValue(payload.start_date),
      endDate: toFieldValue(payload.end_date),
      billablePercent: Number(payload.billable_percent ?? 0),
      billableType: 'Opportunity',
      bookingType: toFieldValue(payload.booking_type) as BookingRequest['bookingType'],
      probability: Number(payload.probability ?? 100),
      notes: toFieldValue(payload.notes) || undefined,
      requiredSkill: toFieldValue(payload.required_skill) || undefined,
      consultingUnitId: toFieldValue(payload.consulting_unit_id) || null,
      practiceAreaId: toFieldValue(payload.practice_area_id) || null,
      competencyCenterId: toFieldValue(payload.competency_center_id) || null,
      siteId: toFieldValue(payload.site_id) || null,
      jobCategory: (toFieldValue(payload.job_category) || null) as JobCategory | null,
    };
  };

  const handlePrefillRequestChange = (requestId: string) => {
    setSelectedPrefillRequestId(requestId);

    if (!requestId) {
      setPrefilledRequestReferenceId('');
      return;
    }

    const selectedRequest = requests.find((request) => request.id === requestId);
    if (!selectedRequest) {
      return;
    }

    const payloadItem = toLabRequestPayloadItem(selectedRequest);
    const nextValues: Record<string, string> = {};
    Object.entries(payloadItem).forEach(([key, value]) => {
      nextValues[key] = toFieldValue(value);
    });
    nextValues.billable_type = 'Opportunity';
    nextValues.booking_type = 'soft';
    nextValues.person_id = '';

    setPrefilledRequestReferenceId(selectedRequest.referenceId);
    setEditValues(nextValues);
    setEditError('');
  };

  const handleCreate = async (
    input: { type: string; payload: Record<string, unknown>[] },
    rawText: string,
    mode: 'draft' | 'publish',
  ) => {
    const simulationType = normalizeSimulationType(input.type);
    const payload = Array.isArray(input.payload) && input.payload.length > 0 ? input.payload : [{}];

    if (mode === 'draft') {
      const draftRow: SimulationRow = {
        id: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toLocaleString(),
        simulationType,
        payload,
        recordCount: payload.length,
        rawPayloadText: rawText || toRawPayloadText(simulationType, payload),
        isDraft: true,
      };
      setDraftRows((current) => [draftRow, ...current]);
      return;
    }

    await labService.publish({ type: simulationType, payload });
    await refreshSimulations();
  };

  const handlePublishEdit = async () => {
    if (!editingRow || !editingType) return;

    const activeFields = editingType === 'Project' ? projectFields : requestFields;
    const payloadObject: Record<string, unknown> = {};

    for (const field of activeFields) {
      const rawValue = editValues[field.key] || '';
      if (field.required && !rawValue.trim()) {
        setEditError(`${field.label} is required.`);
        return;
      }

      if (field.type === 'number' && rawValue.trim()) {
        const parsed = Number(rawValue);
        if (Number.isNaN(parsed)) {
          setEditError(`${field.label} must be a valid number.`);
          return;
        }
      }

      payloadObject[field.key] = parseFieldValue(field, rawValue);
    }

    if (editingType === 'Request') {
      payloadObject.billable_type = 'Opportunity';
      payloadObject.booking_type = 'soft';
    }

    try {
      setIsPublishingEdit(true);
      setEditError('');

      if (editingType === 'Request' && selectedPrefillRequestId) {
        const nextReferenceId = toFieldValue(payloadObject.id).trim();
        const originalReferenceId = prefilledRequestReferenceId.trim();
        const shouldCreateNewRequest = nextReferenceId !== originalReferenceId;

        if (shouldCreateNewRequest) {
          await requestsService.create(toRequestCreateInput(payloadObject));
        } else {
          await requestsService.update(
            selectedPrefillRequestId,
            toRequestPatch(payloadObject),
          );
        }

        await queryClient.invalidateQueries({ queryKey: requestQueryKeys.all });
      } else {
        await labService.publish({
          type: editingType,
          payload: [payloadObject],
        });

        if (editingRow.isDraft) {
          setDraftRows((current) => current.filter((row) => row.id !== editingRow.id));
        }

        await refreshSimulations();
      }

      setEditingRow(null);
      setSelectedPrefillRequestId('');
      setPrefilledRequestReferenceId('');
      setEditValues({});
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save row.');
    } finally {
      setIsPublishingEdit(false);
    }
  };

  const handleEditFieldChange = (key: string, value: string) => {
    setEditValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'practice_area_id') {
        next.competency_center_id = '';
      }
      return next;
    });
  };

  return (
    <div className="space-y-6" id="lab-workspace">
      <div className="app-card p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 tint-blue rounded-lg">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Lab</h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>

      <div className="app-card overflow-hidden">
        <div className="px-6 py-4 border-b border-subtle flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Simulations</h3>
          </div>
          <span className="text-xs font-semibold text-secondary">
            {rows.length} item{rows.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadError && (
          <div className="px-6 py-3 text-sm text-red-600 border-b border-subtle">{loadError}</div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-surface-muted/70 text-[11px] uppercase tracking-wider text-tertiary">
              <tr>
                <th className="px-6 py-3 font-semibold">Timestamp</th>
                <th className="px-6 py-3 font-semibold">Simulation Type</th>
                <th className="px-6 py-3 font-semibold">Number of Records</th>
                <th className="px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-sm text-tertiary" colSpan={4}>
                    No simulation rows yet. Use Create and publish a JSON payload.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-muted/40 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-primary whitespace-nowrap">{row.timestamp}</td>
                    <td className="px-6 py-4 text-sm text-secondary">
                      <div className="inline-flex items-center gap-2">
                        <span>{row.simulationType}</span>
                        {row.isDraft && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Draft
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-secondary">{row.recordCount}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(row)}
                          className="px-3 py-1.5 rounded-md border border-default text-xs font-semibold text-secondary hover:bg-surface-hover"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="px-3 py-1.5 rounded-md border border-default text-xs font-semibold text-secondary hover:bg-surface-hover"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LabCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />

      <LabEditModal
        isOpen={Boolean(editingRow && editingType)}
        editingType={editingType}
        fields={editingType === 'Project' ? projectFields : requestFields}
        requestPrefillOptions={requestPrefillOptions}
        selectedPrefillRequestId={selectedPrefillRequestId}
        editValues={editValues}
        editError={editError}
        isPublishing={isPublishingEdit}
        onSelectPrefillRequest={handlePrefillRequestChange}
        onFieldChange={handleEditFieldChange}
        onClose={() => {
          setEditingRow(null);
          setSelectedPrefillRequestId('');
          setPrefilledRequestReferenceId('');
          setEditValues({});
          setEditError('');
        }}
        onPublish={() => void handlePublishEdit()}
      />

      {selectedRow && (
        <div className="fixed inset-0 modal-overlay backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-surface rounded-xl shadow-app-md border border-subtle max-w-3xl w-full flex flex-col overflow-hidden max-h-[90vh]">
            <div className="app-card-header px-5 py-4 flex justify-between items-center">
              <h3 className="text-base font-semibold text-primary">Payload Details</h3>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="p-1 hover:bg-surface-hover rounded-lg text-tertiary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-auto">
              <pre className="text-xs text-primary bg-surface-muted/60 border border-subtle rounded-lg p-4 whitespace-pre-wrap break-all">
                {selectedRow.rawPayloadText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
