import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 ' +
    'disabled:bg-brand-300 dark:disabled:bg-brand-900/50 dark:disabled:text-neutral-400',
  secondary:
    'bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 active:bg-slate-100 ' +
    'disabled:text-slate-400 ' +
    'dark:bg-neutral-900 dark:text-neutral-200 dark:border-neutral-700 ' +
    'dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:disabled:text-neutral-500',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 ' +
    'dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 ' +
    'disabled:bg-red-300 dark:disabled:bg-red-900/50 dark:disabled:text-neutral-400',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950',
        'disabled:cursor-not-allowed',
        'active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
