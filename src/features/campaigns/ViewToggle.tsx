import { cn } from '@/lib/cn';

export type CampaignsViewMode = 'campaigns' | 'offers';

interface Props {
  value: CampaignsViewMode;
  onChange: (next: CampaignsViewMode) => void;
  // Optional labels — the offer-level view is shared between the GAds and FB
  // pages but the picker label reads slightly differently in each context.
  campaignsLabel?: string;
  offersLabel?: string;
}

// Compact segmented control. Sits above the table on the campaigns + FB
// pages and switches between the existing "per-campaign" view (`campaigns`)
// and the new offer-level breakdown (`offers`).
export function ViewToggle({ value, onChange, campaignsLabel = 'Per campaign', offersLabel = 'Per offer' }: Props) {
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 text-xs dark:border-neutral-800 dark:bg-neutral-900/40"
    >
      <button
        role="tab"
        aria-selected={value === 'campaigns'}
        onClick={() => onChange('campaigns')}
        className={cn(
          'rounded-sm px-3 py-1 font-medium transition',
          value === 'campaigns'
            ? 'bg-white text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
            : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-100',
        )}
      >
        {campaignsLabel}
      </button>
      <button
        role="tab"
        aria-selected={value === 'offers'}
        onClick={() => onChange('offers')}
        className={cn(
          'rounded-sm px-3 py-1 font-medium transition',
          value === 'offers'
            ? 'bg-white text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
            : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-100',
        )}
      >
        {offersLabel}
      </button>
    </div>
  );
}
