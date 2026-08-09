import {
  Description as HuiDescription,
  Field as HuiField,
  Label as HuiLabel,
  type DescriptionProps as HuiDescriptionProps,
  type FieldProps as HuiFieldProps,
  type LabelProps as HuiLabelProps,
} from '@headlessui/react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Field({ className, ...props }: HuiFieldProps) {
  return <HuiField className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

export function Label({ className, ...props }: HuiLabelProps) {
  return (
    <HuiLabel
      className={cn('text-xs font-medium text-secondary tracking-[0.01em]', className)}
      {...props}
    />
  );
}

export function Description({ className, ...props }: HuiDescriptionProps) {
  return <HuiDescription className={cn('text-xs text-tertiary', className)} {...props} />;
}

export function ErrorMessage({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      role="alert"
      className={cn('text-xs text-red-600 dark:text-red-400', className)}
      {...props}
    />
  );
}
