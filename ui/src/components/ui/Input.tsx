import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const controlBase =
  'w-full rounded-lg border border-default bg-input text-primary text-[13px] placeholder:text-tertiary ' +
  'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        controlBase,
        'h-9 px-3',
        invalid && 'border-red-500 focus:border-red-500 focus:ring-red-500/25',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        controlBase,
        'min-h-[88px] px-3 py-2 resize-y',
        invalid && 'border-red-500 focus:border-red-500 focus:ring-red-500/25',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';
