import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Plus, X } from 'lucide-react';
import { LabCreateModal } from './LabCreateModal.tsx';
import { labService, type SimulationLogEntry } from '../lib/services/lab';

interface SimulationRow {
  id: string;
  timestamp: string;
  simulationType: string;
  recordCount: number;
  rawPayloadText: string;
}

function toSimulationRow(entry: SimulationLogEntry): SimulationRow {
  return {
    id: entry.id,
    timestamp: new Date(entry.createdAt).toLocaleString(),
    simulationType: entry.simulationType,
    recordCount: entry.recordCount,
    rawPayloadText: JSON.stringify({ type: entry.simulationType, payload: entry.payload }, null, 2),
  };
}

export const LabTab: React.FC = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [simulationRows, setSimulationRows] = useState<SimulationRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<SimulationRow | null>(null);
  const [loadError, setLoadError] = useState('');

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

  const handleCreate = async (input: { type: string; payload: Record<string, unknown>[] }) => {
    await labService.publish({ type: input.type, payload: input.payload });
    await refreshSimulations();
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
            {simulationRows.length} item{simulationRows.length === 1 ? '' : 's'}
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
                <th className="px-6 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {simulationRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-sm text-tertiary" colSpan={4}>
                    No simulation rows yet. Use Create and publish a JSON payload.
                  </td>
                </tr>
              ) : (
                simulationRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-muted/40 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-primary whitespace-nowrap">{row.timestamp}</td>
                    <td className="px-6 py-4 text-sm text-secondary">{row.simulationType}</td>
                    <td className="px-6 py-4 text-sm text-secondary">{row.recordCount}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedRow(row)}
                        className="px-3 py-1.5 rounded-md border border-default text-xs font-semibold text-secondary hover:bg-surface-hover"
                      >
                        View
                      </button>
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
