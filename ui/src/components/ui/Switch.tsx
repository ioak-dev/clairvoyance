import { Switch as HuiSwitch, type SwitchProps as HuiSwitchProps } from '@headlessui/react';
import { cn } from '../../lib/cn';

export type SwitchProps = HuiSwitchProps & {
  className?: string;
};

/** Headless UI switch with a compact, consistent track/thumb. */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <HuiSwitch
      className={cn(
        'group relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
        'bg-zinc-300/90 dark:bg-zinc-600 transition-colors duration-200 ease-out',
        'data-[checked]:bg-blue-600',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm ring-1 ring-black/5',
          'translate-x-0.5 transition duration-200 ease-out',
          'group-data-[checked]:translate-x-[18px]',
        )}
      />
    </HuiSwitch>
  );
}
