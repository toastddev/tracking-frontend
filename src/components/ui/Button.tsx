import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-400',
  ghost:     'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
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
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium shadow-sm transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
