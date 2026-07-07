import React from 'react';
import type { DashboardPeriodMode } from '../../lib/dateUtils';

type DashboardPeriodBarProps = {
  mode: DashboardPeriodMode;
  customStart: string;
  customEnd: string;
  periodLabel: string;
  onModeChange: (mode: DashboardPeriodMode) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
};

const MODES: { id: DashboardPeriodMode; label: string }[] = [
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'custom', label: 'Custom' },
];

export const DashboardPeriodBar: React.FC<DashboardPeriodBarProps> = ({
  mode,
  customStart,
  customEnd,
  periodLabel,
  onModeChange,
  onCustomStartChange,
  onCustomEndChange,
}) => (
  <div className="app-card p-5 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 className="text-lg font-semibold text-primary tracking-tight">Dashboard</h2>
      <p className="text-xs text-secondary mt-0.5 tracking-wide">{periodLabel}</p>
    </div>

    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 p-1 bg-surface-muted rounded-lg border border-subtle">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium tracking-[0.02em] transition-colors cursor-pointer ${
              mode === m.id
                ? 'bg-surface text-primary shadow-app-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'custom' && (
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-secondary font-medium">
            From
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="bg-surface-muted border border-default rounded-lg px-2 py-1.5 text-primary text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-secondary font-medium">
            To
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="bg-surface-muted border border-default rounded-lg px-2 py-1.5 text-primary text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </label>
        </div>
      )}
    </div>
  </div>
);
