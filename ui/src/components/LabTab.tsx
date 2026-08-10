import React, { useMemo, useState } from 'react';
import { FlaskConical, Plus } from 'lucide-react';
import { LabCreateModal } from './LabCreateModal.tsx';
import { LabEditModal, type EditField, type SimulationType } from './LabEditModal.tsx';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Modal,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from './ui';
import {
  buildProjectFields,
  buildRequestFields,
  getFilteredCompetencyCenterOptions,
  type ValidationEditField,
} from './labEditFieldConfig';
import type { SimulationLogEntry } from '../lib/services/lab';
import { useLabSimulations, usePublishLab } from '../hooks/useLab';
import { useLookups } from '../hooks/useLookups';
import { usePeople } from '../hooks/usePeople';
import { useProjects } from '../hooks/useProjects';
import { useCreateRequest, useRequests, useUpdateRequest } from '../hooks/useRequests';
import type { ApprovalStatus } from '../types/api';
import { requestDateBounds, toLabRequestPayloadItem } from '../types/api';
import { DEFAULT_ROSTER, type BookingRequest, type Roster, type ScheduleUnit } from '../types';
import { normalizeRoster, rosterSummaryLabel } from '../lib/rosterUtils';

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

function parseRosterFromPayload(value: unknown): Roster {
  let raw = value;
  if (typeof raw === 'string') {
    raw = JSON.parse(raw.trim());
  }
  if (!Array.isArray(raw) || raw.length !== 7) {
    throw new Error('Roster must be a JSON array of length 7 (Mon–Sun).');
  }
  return normalizeRoster(raw);
}

function rosterToEditValue(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(normalizeRoster(JSON.parse(value)));
    } catch {
      return JSON.stringify(DEFAULT_ROSTER);
    }
  }
  return JSON.stringify(normalizeRoster(value));
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

  if (field.type === 'roster') {
    return parseRosterFromPayload(rawValue);
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

function resolveStartEnd(payload: Record<string, unknown>): { start: string; end: string } {
  const start = toFieldValue(payload.start ?? payload.start_date);
  const end = toFieldValue(payload.end ?? payload.end_date);
  return { start, end };
}

export const LabTab: React.FC = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<SimulationRow | null>(null);
  const [editingRow, setEditingRow] = useState<SimulationRow | null>(null);
  const [selectedPrefillRequestId, setSelectedPrefillRequestId] = useState('');
  const [prefilledRequestReferenceId, setPrefilledRequestReferenceId] = useState('');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState('');
  const [isPublishingEdit, setIsPublishingEdit] = useState(false);
  const { data: lookups } = useLookups();
  const { data: projects = [] } = useProjects();
  const { data: people = [] } = usePeople();
  const { data: requests = [] } = useRequests();
  const {
    data: simulationEntries = [],
    error: simulationsError,
  } = useLabSimulations();
  const publishLab = usePublishLab();
  const createRequest = useCreateRequest();
  const updateRequest = useUpdateRequest();

  const rows = useMemo(
    () => simulationEntries.map(toSimulationRow),
    [simulationEntries],
  );
  const loadError =
    simulationsError instanceof Error
      ? simulationsError.message
      : simulationsError
        ? 'Failed to load simulations.'
        : '';

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
    return requests.map((request) => {
      const bounds = requestDateBounds(request);
      const summary = rosterSummaryLabel(request.unit, request.roster);
      const rangeLabel = bounds ? `${bounds.startDate} to ${bounds.endDate}` : 'no dates';
      return {
        value: request.id,
        label: `${request.requestName || 'Request'} (${rangeLabel}, ${summary})`,
      };
    });
  }, [requests]);

  const openEdit = (row: SimulationRow) => {
    const simulationType = normalizeSimulationType(row.simulationType);
    const firstPayload = toEditablePayloadObject(row);
    const nextValues: Record<string, string> = {};
    Object.entries(firstPayload).forEach(([key, value]) => {
      if (key === 'weeks' || key === 'days_per_week') {
        return;
      }
      if (key === 'roster') {
        nextValues.roster = rosterToEditValue(value);
      } else if (key === 'start_date') {
        nextValues.start = toFieldValue(value);
      } else if (key === 'end_date') {
        nextValues.end = toFieldValue(value);
      } else {
        nextValues[key] = toFieldValue(value);
      }
    });

    const { start, end } = resolveStartEnd(firstPayload);
    if (start) nextValues.start = start;
    if (end) nextValues.end = end;
    if (!nextValues.unit) nextValues.unit = 'utilization';
    if (!nextValues.roster) nextValues.roster = JSON.stringify(DEFAULT_ROSTER);

    if (simulationType === 'Request') {
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
    const { start, end } = resolveStartEnd(payload);
    return {
      referenceId: toFieldValue(payload.id),
      projectId: toFieldValue(payload.project_id),
      resourceId: toFieldValue(payload.person_id),
      bookingType: toFieldValue(payload.booking_type) as BookingRequest['bookingType'],
      probability: Number(payload.probability ?? 100),
      status: toFieldValue(payload.status) as ApprovalStatus,
      requestName: toFieldValue(payload.request_name) || undefined,
      notes: toFieldValue(payload.notes) || undefined,
      consultingUnitId: toFieldValue(payload.consulting_unit_id) || null,
      practiceAreaId: toFieldValue(payload.practice_area_id) || null,
      competencyCenterId: toFieldValue(payload.competency_center_id) || null,
      siteId: toFieldValue(payload.site_id) || null,
      jobLevelId: toFieldValue(payload.job_level_id) || null,
      startDate: start,
      endDate: end,
      unit: (toFieldValue(payload.unit) || 'utilization') as ScheduleUnit,
      roster: normalizeRoster(payload.roster),
    };
  };

  const toRequestCreateInput = (
    payload: Record<string, unknown>,
  ): Omit<BookingRequest, 'id' | 'status'> => {
    const { start, end } = resolveStartEnd(payload);
    return {
      referenceId: toFieldValue(payload.id),
      resourceId: toFieldValue(payload.person_id),
      projectId: toFieldValue(payload.project_id),
      billableType: 'Opportunity',
      bookingType: toFieldValue(payload.booking_type) as BookingRequest['bookingType'],
      probability: Number(payload.probability ?? 100),
      notes: toFieldValue(payload.notes) || undefined,
      requestName: toFieldValue(payload.request_name) || undefined,
      consultingUnitId: toFieldValue(payload.consulting_unit_id) || null,
      practiceAreaId: toFieldValue(payload.practice_area_id) || null,
      competencyCenterId: toFieldValue(payload.competency_center_id) || null,
      siteId: toFieldValue(payload.site_id) || null,
      jobLevelId: toFieldValue(payload.job_level_id) || null,
      startDate: start,
      endDate: end,
      unit: (toFieldValue(payload.unit) || 'utilization') as ScheduleUnit,
      roster: normalizeRoster(payload.roster),
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
      if (key === 'roster') {
        nextValues.roster = rosterToEditValue(value);
      } else {
        nextValues[key] = toFieldValue(value);
      }
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
    _rawText: string,
  ) => {
    const simulationType = normalizeSimulationType(input.type);
    const payload = Array.isArray(input.payload) && input.payload.length > 0 ? input.payload : [{}];

    await publishLab.mutateAsync({ type: simulationType, payload });
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

      try {
        payloadObject[field.key] = parseFieldValue(field, rawValue);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : `Invalid ${field.label}.`);
        return;
      }
    }

    if (editingType === 'Request') {
      payloadObject.billable_type = 'Opportunity';
      payloadObject.booking_type = 'soft';

      const start = toFieldValue(payloadObject.start);
      const end = toFieldValue(payloadObject.end);
      if (!start || !end) {
        setEditError('Start and End dates are required.');
        return;
      }
      if (start > end) {
        setEditError('End must be on or after Start.');
        return;
      }

      if ('weeks' in payloadObject || 'days_per_week' in payloadObject) {
        setEditError('payload must use start/end/unit/roster; weeks are not supported.');
        return;
      }
    }

    try {
      setIsPublishingEdit(true);
      setEditError('');

      if (editingType === 'Request' && selectedPrefillRequestId) {
        const nextReferenceId = toFieldValue(payloadObject.id).trim();
        const originalReferenceId = prefilledRequestReferenceId.trim();
        const shouldCreateNewRequest = nextReferenceId !== originalReferenceId;

        if (shouldCreateNewRequest) {
          await createRequest.mutateAsync(toRequestCreateInput(payloadObject));
        } else {
          await updateRequest.mutateAsync({
            id: selectedPrefillRequestId,
            patch: toRequestPatch(payloadObject),
          });
        }
      }

      await publishLab.mutateAsync({
        type: editingType,
        payload: [payloadObject],
      });

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
      <Card padded className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 tint-blue rounded-lg">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Lab</h2>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Create
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Simulations"
          actions={
            <Badge tone="neutral">
              {rows.length} item{rows.length === 1 ? '' : 's'}
            </Badge>
          }
        />

        {loadError && (
          <div className="px-6 py-3 text-sm text-red-600 border-b border-subtle">{loadError}</div>
        )}

        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH className="px-6">Timestamp</TH>
              <TH className="px-6">Simulation Type</TH>
              <TH className="px-6">Number of Records</TH>
              <TH className="px-6">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD className="px-6 py-10 text-sm text-tertiary" colSpan={4}>
                  No simulation rows yet. Use Create and publish a request payload.
                </TD>
              </TR>
            ) : (
              rows.map((row) => (
                <TR key={row.id}>
                  <TD className="px-6 py-4 text-sm font-medium whitespace-nowrap">{row.timestamp}</TD>
                  <TD className="px-6 py-4 text-sm text-secondary">
                    <Badge tone="blue">{row.simulationType}</Badge>
                  </TD>
                  <TD className="px-6 py-4 text-sm text-secondary">{row.recordCount}</TD>
                  <TD className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRow(row)}
                      >
                        View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>

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
        isRepublishAsNewRequest={Boolean(
          editingRow && editingType === 'Request',
        )}
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

      <Modal
        open={Boolean(selectedRow)}
        onClose={() => setSelectedRow(null)}
        title="Payload Details"
        size="xl"
        className="z-[60]"
      >
        <pre className="text-xs text-primary bg-surface-muted/60 border border-subtle rounded-lg p-4 whitespace-pre-wrap break-all">
          {selectedRow?.rawPayloadText}
        </pre>
      </Modal>
    </div>
  );
};
