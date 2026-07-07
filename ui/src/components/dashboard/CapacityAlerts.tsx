import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import type { PersonUtilization } from '../../lib/dashboardMetrics';

type CapacityAlertsProps = {
  overAllocated: PersonUtilization[];
  underUtilized: PersonUtilization[];
};

function PersonChip({
  person,
  variant,
}: {
  person: PersonUtilization;
  variant: 'over' | 'under';
}) {
  const isOver = variant === 'over';
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
        isOver
          ? 'border-amber-500/30 bg-amber-500/10 text-primary'
          : 'border-blue-500/20 bg-blue-500/8 text-primary'
      }`}
    >
      {isOver ? (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      ) : (
        <TrendingDown className="w-3.5 h-3.5 text-blue-500 shrink-0" />
      )}
      <div className="min-w-0">
        <span className="font-semibold block truncate">{person.name}</span>
        {person.practiceArea && (
          <span className="text-[10px] text-secondary block truncate">{person.practiceArea}</span>
        )}
      </div>
      <span
        className={`font-bold shrink-0 ml-1 ${isOver ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}
      >
        {person.utilizationPercent}%
      </span>
    </div>
  );
}

export const CapacityAlerts: React.FC<CapacityAlertsProps> = ({
  overAllocated,
  underUtilized,
}) => (
  <div className="app-card p-5">
    <h3 className="text-sm font-semibold text-primary tracking-[0.02em] mb-1">Capacity Alerts</h3>
    <p className="text-xs text-secondary mb-4">People over-allocated or under-utilized</p>

    {overAllocated.length === 0 && underUtilized.length === 0 ? (
      <p className="text-sm text-tertiary text-center py-6">Team utilization looks balanced.</p>
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-semibold text-tertiary uppercase tracking-[0.08em] mb-2">
            Over-allocated (&gt;100%)
          </p>
          {overAllocated.length === 0 ? (
            <p className="text-xs text-tertiary">None</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {overAllocated.map((p) => (
                <PersonChip key={p.resourceId} person={p} variant="over" />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold text-tertiary uppercase tracking-[0.08em] mb-2">
            Under-utilized (&lt;50%)
          </p>
          {underUtilized.length === 0 ? (
            <p className="text-xs text-tertiary">None</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {underUtilized.map((p) => (
                <PersonChip key={p.resourceId} person={p} variant="under" />
              ))}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
