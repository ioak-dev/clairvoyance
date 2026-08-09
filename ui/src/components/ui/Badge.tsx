import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'neutral' | 'blue' | 'emerald' | 'amber' | 'red' | 'purple';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-secondary border-default',
  blue: 'tint-blue',
  emerald: 'tint-emerald',
  amber: 'tint-amber',
  red: 'tint-red',
  purple: 'tint-purple',
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-none',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
