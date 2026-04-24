import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: ReactNode;
}

export function PageHeader({ title, description, actions, back }: Props) {
  return (
    <div className="mb-6">
      {back && <div className="mb-2">{back}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-neutral-100">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
