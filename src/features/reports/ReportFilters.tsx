import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export type RangePreset = '24h' | '7d' | '30d' | '90d' | 'custom';

export interface ReportRange {
  from: string; // ISO
  to: string;   // ISO
  preset: RangePreset;
}

const PRESETS: { key: RangePreset; label: string; hours: number }[] = [
  { key: '24h', label: '24h', hours: 24 },
  { key: '7d',  label: '7d',  hours: 24 * 7 },
  { key: '30d', label: '30d', hours: 24 * 30 },
  { key: '90d', label: '90d', hours: 24 * 90 },
];

function preset(preset: RangePreset): ReportRange {
  const p = PRESETS.find((x) => x.key === preset);
  if (!p) throw new Error(`bad preset ${preset}`);
  const to = new Date();
  const from = new Date(to.getTime() - p.hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString(), preset };
}

// Convert ISO → the value datetime-local inputs want (no TZ, minute precision).
function toLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  value: ReportRange;
  onChange: (next: ReportRange) => void;
}

export function ReportFilters({ value, onChange }: Props) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const [from, setFrom] = useState(toLocal(value.from));
  const [to, setTo] = useState(toLocal(value.to));

  useEffect(() => {
    setFrom(toLocal(value.from));
    setTo(toLocal(value.to));
  }, [value.from, value.to]);

  function applyCustom() {
    const f = new Date(from);
    const t = new Date(to);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return;
    if (f.getTime() > t.getTime()) return;
    onChange({ from: f.toISOString(), to: t.toISOString(), preset: 'custom' });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-card-dark">
      <div className="inline-flex flex-wrap items-center gap-1">
        {PRESETS.map((p) => {
          const active = value.preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setCustomOpen(false);
                onChange(preset(p.key));
              }}
              className={cn(
                'inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors',
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              )}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustomOpen((o) => !o)}
          className={cn(
            'inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition-colors',
            value.preset === 'custom'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
          )}
        >
          Custom
        </button>
      </div>

      {customOpen && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[11rem] flex-1">
            <label className="label mb-1 text-xs">From</label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="min-w-[11rem] flex-1">
            <label className="label mb-1 text-xs">To</label>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button type="button" size="sm" onClick={applyCustom}>Apply</Button>
        </div>
      )}
    </div>
  );
}
