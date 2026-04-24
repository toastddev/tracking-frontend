import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Table(props: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm" {...props} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('group', className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
        'dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-400',
        className
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'border-b border-slate-100 px-4 py-3 align-middle text-slate-700',
        'dark:border-neutral-800 dark:text-neutral-300',
        className
      )}
      {...props}
    />
  );
}
