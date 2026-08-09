import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import type { PersonUtilization } from '../../lib/dashboardMetrics';
import { Badge, Card } from '../ui';

type CapacityAlertsProps = {
  overAllocated: PersonUtilization[];
  underUtilized: PersonUtilization[];
};

const MAX_ALERTS_SHOWN = 10;

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
      <Badge tone={isOver ? 'amber' : 'blue'} className="shrink-0 ml-1 font-bold">
        {person.utilizationPercent}%
      </Badge>
    </div>
  );
}

export const CapacityAlerts: React.FC<CapacityAlertsProps> = ({
  overAllocated,
  underUtilized,
}) => {
  const shownOverAllocated = overAllocated.slice(0, MAX_ALERTS_SHOWN);
  const shownUnderUtilized = underUtilized.slice(0, MAX_ALERTS_SHOWN);
  const remainingOverAllocated = Math.max(0, overAllocated.length - shownOverAllocated.length);
  const remainingUnderUtilized = Math.max(0, underUtilized.length - shownUnderUtilized.length);

  return (
    <Card padded>
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
              <>
                <div className="flex flex-wrap gap-2">
                  {shownOverAllocated.map((p) => (
                    <PersonChip key={p.resourceId} person={p} variant="over" />
                  ))}
                </div>
                {remainingOverAllocated > 0 && (
                  <p className="mt-2 text-xs text-tertiary">+ {remainingOverAllocated} more</p>
                )}
              </>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold text-tertiary uppercase tracking-[0.08em] mb-2">
              Under-utilized (&lt;50%)
            </p>
            {underUtilized.length === 0 ? (
              <p className="text-xs text-tertiary">None</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {shownUnderUtilized.map((p) => (
                    <PersonChip key={p.resourceId} person={p} variant="under" />
                  ))}
                </div>
                {remainingUnderUtilized > 0 && (
                  <p className="mt-2 text-xs text-tertiary">+ {remainingUnderUtilized} more</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
