import React from 'react';
import type { WeeklyBucket } from '../../lib/dashboardMetrics';

type WeeklyTrendChartProps = {
  weeks: WeeklyBucket[];
};

export const WeeklyTrendChart: React.FC<WeeklyTrendChartProps> = ({ weeks }) => {
  const maxHours = Math.max(...weeks.map((w) => w.hours), 1);
  const chartHeight = 120;

  return (
    <div className="app-card p-5 flex flex-col h-full">
      <h3 className="text-sm font-semibold text-primary tracking-[0.02em] mb-1">Weekly Trend</h3>
      <p className="text-xs text-secondary mb-4">Planned hours per week</p>

      {weeks.length === 0 ? (
        <p className="text-sm text-tertiary text-center py-12">No weekly data for this period.</p>
      ) : (
        <div className="flex items-end gap-1.5 flex-1 min-h-[140px] pt-2">
          {weeks.map((week) => {
            const barHeight = Math.max(4, (week.hours / maxHours) * chartHeight);
            return (
              <div
                key={week.weekKey}
                className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 group"
                title={`${week.label}: ${week.hours}h`}
              >
                <span className="text-[9px] font-semibold text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                  {week.hours}
                </span>
                <div
                  className="w-full max-w-[32px] bg-blue-500/80 rounded-t-md transition-all"
                  style={{ height: `${barHeight}px` }}
                />
                <span className="text-[9px] text-tertiary truncate w-full text-center leading-none">
                  {week.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
