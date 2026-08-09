import { forwardRef } from 'react';
import { Button, type ButtonProps } from './Button';
import { cn } from '../../lib/cn';

export type IconButtonProps = Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'size'> & {
  size?: 'sm' | 'md' | 'lg';
  label: string;
};

const iconSizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', label, variant = 'ghost', children, ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size="icon"
      aria-label={label}
      title={props.title ?? label}
      className={cn(iconSizeClasses[size], className)}
      {...props}
    >
      {children}
    </Button>
  ),
);

IconButton.displayName = 'IconButton';
