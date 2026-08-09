import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../ui';

type KpiCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accentClass?: string;
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  accentClass = 'text-blue-500',
}) => (
  <Card padded className="flex flex-col justify-between min-h-[120px]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-[10px] font-semibold text-tertiary uppercase tracking-[0.08em] block">
          {label}
        </span>
        <span className="text-2xl font-bold text-primary block mt-2 tracking-tight">{value}</span>
      </div>
      <div className={`p-2 rounded-lg bg-surface-muted shrink-0 ${accentClass}`}>
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
    </div>
    {subtitle && (
      <p className="text-xs text-secondary mt-3 pt-3 border-t border-subtle leading-relaxed">
        {subtitle}
      </p>
    )}
  </Card>
);
