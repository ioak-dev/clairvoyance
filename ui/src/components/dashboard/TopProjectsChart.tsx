import React from 'react';
import type { ProjectHoursRow } from '../../lib/dashboardMetrics';

type TopProjectsChartProps = {
  projects: ProjectHoursRow[];
};

export const TopProjectsChart: React.FC<TopProjectsChartProps> = ({ projects }) => {
  const maxHours = Math.max(...projects.map((p) => p.hours), 1);

  return (
    <div className="app-card p-5">
      <h3 className="text-sm font-semibold text-primary tracking-[0.02em] mb-1">Top Projects</h3>
      <p className="text-xs text-secondary mb-4">Ranked by planned hours in period</p>

      {projects.length === 0 ? (
        <p className="text-sm text-tertiary text-center py-8">No project allocations in this period.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((proj, idx) => {
            const width = Math.max(6, (proj.hours / maxHours) * 100);
            return (
              <div key={proj.projectId} className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-tertiary w-4 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${proj.colorClass}`} />
                      <span className="text-xs font-medium text-primary truncate">{proj.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-secondary shrink-0">{proj.hours}h</span>
                  </div>
                  <div className="w-full bg-surface-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${proj.colorClass}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
