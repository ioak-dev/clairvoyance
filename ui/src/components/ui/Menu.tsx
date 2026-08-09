import {
  Menu as HuiMenu,
  MenuButton,
  MenuItem,
  MenuItems,
  type MenuItemsProps,
} from '@headlessui/react';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button, type ButtonProps } from './Button';

type HuiMenuProps = ComponentProps<typeof HuiMenu>;

export function Menu({ className, ...props }: HuiMenuProps & { className?: string }) {
  return <HuiMenu as="div" className={cn('relative inline-block text-left', className)} {...props} />;
}

export function DropdownMenuButton({
  className,
  variant = 'ghost',
  ...props
}: ButtonProps) {
  return <MenuButton as={Button} variant={variant} className={className} {...props} />;
}

export function DropdownMenuItems({
  className,
  anchor = 'bottom end',
  ...props
}: MenuItemsProps) {
  return (
    <MenuItems
      transition
      anchor={anchor}
      className={cn(
        'z-[70] mt-1 min-w-[10rem] origin-top-right rounded-lg border border-default',
        'bg-surface-raised shadow-app-md py-1 focus:outline-none',
        'transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

export type DropdownMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
};

export function DropdownMenuItem({
  className,
  destructive,
  children,
  ...props
}: DropdownMenuItemProps) {
  return (
    <MenuItem
      as="button"
      type="button"
      {...props}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-[13px] text-left cursor-pointer',
        'data-focus:bg-surface-hover data-active:bg-surface-hover',
        destructive ? 'text-red-600 dark:text-red-400' : 'text-primary',
        'data-disabled:opacity-40 data-disabled:cursor-not-allowed',
        className,
      )}
    >
      {children}
    </MenuItem>
  );
}

export type { ReactNode };
