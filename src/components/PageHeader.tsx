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
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
