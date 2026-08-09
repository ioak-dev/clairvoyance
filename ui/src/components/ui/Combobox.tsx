import {
  Combobox as HuiCombobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/cn';

export type ComboboxOption<T extends string | number = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type ComboboxProps<T extends string | number = string> = {
  value: T | null;
  onChange: (value: T | null) => void;
  options: ComboboxOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  nullable?: boolean;
  /** Min characters before filtering large lists. Default 3. Ignored when options.length <= maxResults. */
  minQueryLength?: number;
  /** Max options rendered after filter. Default 50. */
  maxResults?: number;
  /** Debounce for query filtering. Default 250ms. */
  debounceMs?: number;
  'aria-label'?: string;
};

export function Combobox<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  invalid,
  className,
  nullable = true,
  minQueryLength = 3,
  maxResults = 50,
  debounceMs = 250,
  'aria-label': ariaLabel,
}: ComboboxProps<T>) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (debounceMs <= 0) {
      setDebouncedQuery(query);
      return;
    }
    const timer = window.setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, debounceMs]);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  /** Small lists stay browseable; large lists require typeahead. */
  const isLargeList = options.length > maxResults;

  const { visible, totalMatches, needsMoreChars, emptySearch } = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();

    if (isLargeList && q.length < minQueryLength) {
      return {
        visible: [] as ComboboxOption<T>[],
        totalMatches: 0,
        needsMoreChars: true,
        emptySearch: false,
      };
    }

    const matches = !q
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(q));

    let next = matches.slice(0, maxResults);

    // Keep the current selection in the list when it matches the query but fell outside the cap.
    if (
      selected &&
      matches.some((m) => m.value === selected.value) &&
      !next.some((m) => m.value === selected.value)
    ) {
      next = [selected, ...next.slice(0, Math.max(0, maxResults - 1))];
    }

    return {
      visible: next,
      totalMatches: matches.length,
      needsMoreChars: false,
      emptySearch: Boolean(q) && matches.length === 0,
    };
  }, [debouncedQuery, options, isLargeList, minQueryLength, maxResults, selected]);

  const truncated = totalMatches > visible.length;
  const effectivePlaceholder =
    placeholder ??
    (isLargeList ? `Type at least ${minQueryLength} characters…` : 'Search…');


  const resetQuery = () => {
    setQuery('');
    setDebouncedQuery('');
  };

  return (
    <HuiCombobox
      value={value}
      onChange={(next) => onChange(next)}
      onClose={resetQuery}
      disabled={disabled}
      nullable={nullable as true}
    >
      <div className={cn('relative', className)}>
        <div className="relative">
          <ComboboxInput
            aria-label={ariaLabel}
            displayValue={() => selected?.label ?? ''}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={effectivePlaceholder}
            className={cn(
              'w-full h-9 rounded-lg border border-default bg-input text-primary text-[13px]',
              'pl-3 pr-9 placeholder:text-tertiary',
              'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25',
              'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
              invalid && 'border-red-500 focus:border-red-500 focus:ring-red-500/25',
            )}
          />
          <ComboboxButton className="absolute inset-y-0 right-0 px-2.5 text-tertiary">
            <ChevronDown className="w-4 h-4" />
          </ComboboxButton>
        </div>
        <ComboboxOptions
          anchor="bottom start"
          className={cn(
            'z-[80] mt-1 max-h-60 w-[var(--input-width)] overflow-auto rounded-lg',
            'border border-default bg-surface-raised shadow-app-md py-1',
            'focus:outline-none',
          )}
        >
          {needsMoreChars && (
            <div className="px-3 py-2 text-[13px] text-tertiary">
              Type at least {minQueryLength} characters to search
              {options.length > 0 ? ` (${options.length.toLocaleString()} options)` : ''}
            </div>
          )}
          {emptySearch && (
            <div className="px-3 py-2 text-[13px] text-tertiary">No matches</div>
          )}
          {visible.map((option) => (
            <ComboboxOption
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
            </ComboboxOption>
          ))}
          {truncated && (
            <div className="px-3 py-2 text-[11px] text-tertiary border-t border-subtle">
              Showing {visible.length} of {totalMatches.toLocaleString()} — refine your search
            </div>
          )}
        </ComboboxOptions>
      </div>
    </HuiCombobox>
  );
}
