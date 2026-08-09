import {
  Checkbox as HuiCheckbox,
  type CheckboxProps as HuiCheckboxProps,
} from '@headlessui/react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export type CheckboxProps = HuiCheckboxProps & {
  className?: string;
};

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <HuiCheckbox
      className={cn(
        'group size-4 rounded border border-default bg-input',
        'data-checked:bg-blue-600 data-checked:border-blue-600',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
        'disabled:opacity-50 cursor-pointer',
        className,
      )}
      {...props}
    >
      <Check className="size-3 text-white opacity-0 group-data-checked:opacity-100 m-auto" strokeWidth={3} />
    </HuiCheckbox>
  );
}
