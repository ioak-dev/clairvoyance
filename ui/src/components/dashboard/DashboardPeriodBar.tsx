import React from 'react';
import type { DashboardPeriodMode } from '../../lib/dateUtils';
import { Button, Card, Field, Input, Label } from '../ui';

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
  <Card padded className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 className="text-lg font-semibold text-primary tracking-tight">Dashboard</h2>
      <p className="text-xs text-secondary mt-0.5 tracking-wide">{periodLabel}</p>
    </div>

    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 p-1 bg-surface-muted rounded-lg border border-subtle">
        {MODES.map((m) => (
          <Button
            key={m.id}
            type="button"
            variant={mode === m.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onModeChange(m.id)}
            className={
              mode === m.id
                ? 'bg-surface text-primary shadow-app-sm'
                : 'text-secondary hover:text-primary'
            }
          >
            {m.label}
          </Button>
        ))}
      </div>

      {mode === 'custom' && (
        <div className="flex items-center gap-3">
          <Field className="flex-row items-center gap-1.5 !gap-1.5">
            <Label className="whitespace-nowrap">From</Label>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="h-8 w-auto text-xs"
            />
          </Field>
          <Field className="flex-row items-center gap-1.5 !gap-1.5">
            <Label className="whitespace-nowrap">To</Label>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="h-8 w-auto text-xs"
            />
          </Field>
        </div>
      )}
    </div>
  </Card>
);
