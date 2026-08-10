import type { ReactNode } from 'react';
import { Dialog, DialogPanel } from '@headlessui/react';
import { Button, type ButtonVariant } from './Button';

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
};

/** Compact confirmation dialog: message + actions in one padded panel. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-[var(--app-overlay)] backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <DialogPanel className="w-full max-w-sm bg-surface border border-subtle dark:border-default rounded-xl shadow-app-md p-5 space-y-4">
          {typeof children === 'string' || typeof children === 'number' ? (
            <p className="text-sm text-primary">{children}</p>
          ) : (
            children
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              onClick={() => void onConfirm()}
              loading={loading}
            >
              {loading ? `${confirmLabel}…` : confirmLabel}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
