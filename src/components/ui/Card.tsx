import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-card',
        'dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-card-dark',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title, subtitle, actions,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5 dark:border-neutral-800">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-neutral-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-neutral-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}
