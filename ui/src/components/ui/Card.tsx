import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({ className, padded = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-subtle dark:border-default rounded-xl shadow-app-sm',
        padded && 'p-5',
        className,
      )}
      {...props}
    />
  );
}

export type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  actions?: ReactNode;
};

export function CardHeader({ className, title, actions, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-5 py-4',
        'border-b border-subtle dark:border-default bg-surface-muted rounded-t-xl',
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          {title != null && (
            <h3 className="text-sm font-semibold text-primary tracking-[0.01em]">{title}</h3>
          )}
          {actions}
        </>
      )}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}
