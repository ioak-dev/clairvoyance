import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Description,
  type DialogProps,
} from '@headlessui/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
};

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
  panelClassName?: string;
  showClose?: boolean;
  initialFocus?: DialogProps['initialFocus'];
  id?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  panelClassName,
  showClose = true,
  initialFocus,
  id,
}: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} initialFocus={initialFocus} className="relative z-50">
      <div className="fixed inset-0 bg-[var(--app-overlay)] backdrop-blur-sm" aria-hidden="true" />
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto',
          className,
        )}
        id={id}
      >
        <DialogPanel
          className={cn(
            'w-full bg-surface border border-subtle dark:border-default rounded-xl shadow-app-md',
            'flex flex-col max-h-[min(90vh,900px)]',
            sizeClasses[size],
            panelClassName,
          )}
        >
          {(title != null || showClose) && (
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-subtle dark:border-default bg-surface-muted rounded-t-xl shrink-0">
              <div className="min-w-0 space-y-1">
                {title != null && (
                  <DialogTitle className="text-sm font-semibold text-primary tracking-[0.01em]">
                    {title}
                  </DialogTitle>
                )}
                {description != null && (
                  <Description className="text-xs text-secondary">{description}</Description>
                )}
              </div>
              {showClose && (
                <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1 -mt-0.5">
                  <X className="w-4 h-4" />
                </IconButton>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">{children}</div>
          {footer != null && (
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-subtle dark:border-default shrink-0">
              {footer}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export { Dialog, DialogPanel, DialogTitle };
