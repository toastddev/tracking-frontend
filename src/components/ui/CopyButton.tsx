import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  value: string;
  className?: string;
  label?: string;
}

export function CopyButton({ value, className, label = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — silently ignore */
        }
      }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors',
        'hover:bg-slate-50 active:bg-slate-100',
        'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700',
        className
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}
