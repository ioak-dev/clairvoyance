import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export type SelectOption<T extends string | number = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type SelectProps<T extends string | number = string> = {
  value: T | null;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  buttonClassName?: string;
  'aria-label'?: string;
};

export function Select<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  invalid,
  className,
  buttonClassName,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={cn('relative', className)}>
        <ListboxButton
          aria-label={ariaLabel}
          className={cn(
            'relative w-full h-9 rounded-lg border border-default bg-input text-primary text-[13px] text-left',
            'pl-3 pr-9 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25',
            'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            invalid && 'border-red-500 focus:border-red-500 focus:ring-red-500/25',
            buttonClassName,
          )}
        >
          <span className={cn('block truncate', !selected && 'text-tertiary')}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          className={cn(
            'z-[80] mt-1 max-h-60 w-[var(--button-width)] overflow-auto rounded-lg',
            'border border-default bg-surface-raised shadow-app-md py-1',
            'focus:outline-none empty:invisible',
          )}
        >
          {options.map((option) => (
            <ListboxOption
              key={String(option.value)}
              value={option.value}
              disabled={option.disabled}
              className={({ focus, selected: isSelected, disabled: optDisabled }) =>
                cn(
                  'relative cursor-pointer select-none py-2 pl-3 pr-9 text-[13px]',
                  focus && 'bg-surface-hover',
                  isSelected ? 'text-primary font-medium' : 'text-secondary',
                  optDisabled && 'opacity-40 cursor-not-allowed',
                )
              }
            >
              {({ selected: isSelected }) => (
                <>
                  <span className="block truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                  )}
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
