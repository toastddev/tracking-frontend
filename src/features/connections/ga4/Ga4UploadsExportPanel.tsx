import { useState } from 'react';
import { AlertCircle, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { ga4Api, type Ga4UploadKind, type Ga4UploadStatus } from './api';

// GA4 upload report - the counterpart of GoogleAdsUploadsExportCard on the
// Campaigns page: a CSV of every upload attempt (conversions and clicks; sent,
// failed, skipped with reason) over full UTC days.

function utcDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function startOfUtcDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
function endOfUtcDay(value: string): Date | null {
  const d = startOfUtcDay(value);
  return d ? new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1) : null;
}

const selectCls =
  'block h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200';
const labelCls = 'mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400';

export function Ga4UploadsExportPanel() {
  const today = utcDateInput(new Date());
  const [from, setFrom] = useState(() => utcDateInput(new Date(Date.now() - 6 * 86_400_000)));
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState<'' | Ga4UploadKind>('');
  const [status, setStatus] = useState<'' | Ga4UploadStatus>('');
  const [downloading, setDownloading] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function download() {
    setMsg(null);
    const f = startOfUtcDay(from);
    const t = endOfUtcDay(to);
    if (!f || !t || f.getTime() > t.getTime()) {
      setMsg({ tone: 'error', text: 'Pick a valid From → To range (full UTC days).' });
      return;
    }
    setDownloading(true);
    try {
      const result = await ga4Api.exportUploadsCsv({
        from: f.toISOString(),
        to: t.toISOString(),
        kind: kind || undefined,
        status: status || undefined,
      });
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      const rows = result.rowCount.toLocaleString();
      setMsg({
        tone: 'success',
        text: result.truncated
          ? `Downloaded ${rows} rows (capped — narrow the window or filters for a complete export).`
          : `Downloaded ${rows} rows.`,
      });
    } catch (e) {
      setMsg({ tone: 'error', text: `Download failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-lg px-4 py-3 ring-1 ring-slate-200 dark:ring-neutral-800">
      <div className="text-sm font-medium text-slate-900 dark:text-neutral-100">GA4 upload report</div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
        CSV audit of every push to GA4 — conversion and click uploads, successes, failures, and skips (with reason). Same columns
        and joins as the Google Ads upload report.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[10rem]">
          <label className={labelCls}>From (UTC)</label>
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="min-w-[10rem]">
          <label className={labelCls}>To (UTC)</label>
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="min-w-[9rem]">
          <label className={labelCls}>Kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as '' | Ga4UploadKind)} className={selectCls}>
            <option value="">All</option>
            <option value="conversion">Conversion</option>
            <option value="click">Click</option>
          </select>
        </div>
        <div className="min-w-[10rem]">
          <label className={labelCls}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as '' | Ga4UploadStatus)} className={selectCls}>
            <option value="">All</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>
        <div className="sm:ml-auto">
          <Button size="sm" variant="secondary" onClick={download} disabled={downloading || !from || !to}>
            {downloading ? <Spinner /> : <Download className="h-3.5 w-3.5" />}
            {downloading ? 'Downloading…' : 'Download CSV'}
          </Button>
        </div>
      </div>
      {msg && (
        <div
          className={cn(
            'mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
            msg.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
          )}
        >
          {msg.tone === 'success' ? <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
          <span className="flex-1">{msg.text}</span>
        </div>
      )}
    </div>
  );
}
