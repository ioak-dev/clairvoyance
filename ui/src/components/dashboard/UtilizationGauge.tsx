import React from 'react';

type UtilizationGaugeProps = {
  percent: number;
  rawPercent: number;
  plannedHours: number;
  capacityHours: number;
};

export const UtilizationGauge: React.FC<UtilizationGaugeProps> = ({
  percent,
  rawPercent,
  plannedHours,
  capacityHours,
}) => {
  const strokeDash = `${percent} ${100 - percent}`;

  return (
    <div className="app-card p-5 flex flex-col">
      <h3 className="text-sm font-semibold text-primary tracking-[0.02em] mb-1">Team Utilization</h3>
      <p className="text-xs text-secondary mb-4">Planned hours vs available capacity</p>

      <div className="flex flex-col sm:flex-row items-center gap-6 flex-1">
        <div className="relative w-36 h-36 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 42 42">
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="currentColor"
              className="text-surface-muted"
              strokeWidth="3.5"
            />
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="currentColor"
              className="text-blue-500"
              strokeWidth="3.5"
              strokeDasharray={strokeDash}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-primary">{percent}%</span>
            {rawPercent > 100 && (
              <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-wider">
                {rawPercent}% actual
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 text-sm flex-1 w-full">
          <div className="flex justify-between items-baseline border-b border-subtle pb-2">
            <span className="text-secondary text-xs uppercase tracking-[0.06em]">Planned</span>
            <span className="font-semibold text-primary">{plannedHours.toLocaleString()}h</span>
          </div>
          <div className="flex justify-between items-baseline border-b border-subtle pb-2">
            <span className="text-secondary text-xs uppercase tracking-[0.06em]">Capacity</span>
            <span className="font-semibold text-primary">{capacityHours.toLocaleString()}h</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-secondary text-xs uppercase tracking-[0.06em]">Remaining</span>
            <span className="font-semibold text-primary">
              {Math.max(0, capacityHours - plannedHours).toLocaleString()}h
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
