import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Description,
  type DialogProps,
} from '@headlessui/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  panelClassName?: string;
  initialFocus?: DialogProps['initialFocus'];
  /** Offset from the left rail (default 110px). */
  leftOffsetClassName?: string;
};

/**
 * Side drawer built on Headless UI Dialog — Escape and outside-click call onClose.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  header,
  children,
  footer,
  className,
  panelClassName,
  initialFocus,
  leftOffsetClassName = 'left-[110px]',
}: DrawerProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      initialFocus={initialFocus}
      className={cn('relative z-50', className)}
    >
      {/* Transparent scrim over the main work area (not the left rail) */}
      <div
        className={cn('fixed inset-y-0 right-0 top-14 bg-transparent', leftOffsetClassName)}
        aria-hidden="true"
      />

      <DialogPanel
        className={cn(
          'fixed top-14 bottom-0 w-80 bg-surface border-r border-default shadow-app-md',
          'flex flex-col outline-none',
          leftOffsetClassName,
          panelClassName,
        )}
      >
        {header != null ? (
          header
        ) : (title != null || description != null) ? (
          <div className="shrink-0 px-5 py-4 border-b border-subtle bg-surface-muted">
            {title != null && (
              <DialogTitle className="text-sm font-semibold text-primary tracking-[0.01em]">
                {title}
              </DialogTitle>
            )}
            {description != null && (
              <Description className="text-[11px] text-tertiary mt-0.5">{description}</Description>
            )}
          </div>
        ) : null}

        {children}

        {footer != null && (
          <div className="shrink-0 p-3 border-t border-subtle bg-surface">{footer}</div>
        )}
      </DialogPanel>
    </Dialog>
  );
}

export { DialogTitle };
