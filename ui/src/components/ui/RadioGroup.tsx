import {
  Radio,
  RadioGroup as HuiRadioGroup,
} from '@headlessui/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type RadioOption<T extends string | number = string> = {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

export type RadioGroupProps<T extends string | number = string> = {
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  name?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

export function RadioGroup<T extends string | number = string>({
  value,
  onChange,
  options,
  className,
  orientation = 'vertical',
  name,
  disabled,
  'aria-label': ariaLabel,
}: RadioGroupProps<T>) {
  return (
    <HuiRadioGroup
      value={value as string | number}
      onChange={onChange as (value: string | number) => void}
      name={name}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        orientation === 'horizontal' ? 'flex flex-wrap gap-3' : 'flex flex-col gap-2',
        className,
      )}
    >
      {options.map((option) => (
        <Radio
          key={String(option.value)}
          value={option.value}
          disabled={option.disabled}
          className={({ checked, disabled: isDisabled, focus }) =>
            cn(
              'flex items-start gap-2.5 cursor-pointer rounded-lg border px-3 py-2 text-[13px] transition-colors',
              checked
                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 text-primary'
                : 'border-default bg-input text-secondary hover:bg-surface-hover',
              focus && 'ring-2 ring-blue-500/25',
              isDisabled && 'opacity-40 cursor-not-allowed',
            )
          }
        >
          {({ checked }) => (
            <>
              <span
                className={cn(
                  'mt-0.5 size-3.5 rounded-full border shrink-0',
                  checked
                    ? 'border-blue-600 bg-blue-600 shadow-[inset_0_0_0_3px_white]'
                    : 'border-default bg-surface',
                )}
              />
              <span className="min-w-0">
                <span className="block font-medium text-primary">{option.label}</span>
                {option.description != null && (
                  <span className="block text-xs text-tertiary mt-0.5">{option.description}</span>
                )}
              </span>
            </>
          )}
        </Radio>
      ))}
    </HuiRadioGroup>
  );
}
