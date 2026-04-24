import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'gray' | 'green' | 'red' | 'amber' | 'blue';

const tones: Record<Tone, string> = {
  gray:  'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
  red:   'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30',
  blue:  'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/30',
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'gray', className, ...props }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
