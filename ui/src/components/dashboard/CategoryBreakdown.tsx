import React from 'react';
import type { CategoryHours } from '../../lib/dashboardMetrics';
import { Card } from '../ui';

type CategoryBreakdownProps = {
  categories: CategoryHours[];
  totalHours: number;
};

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ categories, totalHours }) => {
  const maxHours = Math.max(...categories.map((c) => c.hours), 1);

  return (
    <Card padded className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-primary tracking-[0.02em] mb-1">Category Mix</h3>
      <p className="text-xs text-secondary mb-4">Planned hours by project type</p>

      {categories.length === 0 ? (
        <p className="text-sm text-tertiary text-center py-12">No planned hours in this period.</p>
      ) : (
        <>
          <div className="flex h-3 rounded-full overflow-hidden bg-surface-muted mb-5">
            {categories.map((cat) => (
              <div
                key={cat.category}
                className={`h-full ${cat.colorClass}`}
                style={{ width: `${(cat.hours / totalHours) * 100}%` }}
                title={`${cat.category}: ${cat.hours}h`}
              />
            ))}
          </div>

          <div className="space-y-3 flex-1">
            {categories.map((cat) => {
              const pct = totalHours > 0 ? Math.round((cat.hours / totalHours) * 100) : 0;
              const barWidth = Math.max(4, (cat.hours / maxHours) * 100);
              return (
                <div key={cat.category}>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cat.colorClass}`} />
                      <span className="font-medium text-primary truncate">{cat.category}</span>
                    </div>
                    <span className="text-secondary shrink-0 ml-2">
                      {cat.hours}h · {pct}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${cat.colorClass}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
};
