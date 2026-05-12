import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Download, Inbox, RotateCcw } from 'lucide-react';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { fmtDateTime, shortId } from '@/lib/format';
import { clicksApi } from './api';
import type { ReportRange } from './ReportFilters';

const PAGE_SIZE = 25;

interface Props {
  range: ReportRange;
}

// ISO → date input value (`YYYY-MM-DD`, UTC). The Refine panel uses date-only
// inputs because the operator picks calendar days, not wall-clock minutes.
function toUtcDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// `YYYY-MM-DD` → `Date` at start-of-UTC-day. Returns null on invalid input.
function startOfUtcDayFromInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
function endOfUtcDayFromInput(value: string): Date | null {
  const d = startOfUtcDayFromInput(value);
  if (!d) return null;
  return new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function ClicksReportTab({ range }: Props) {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [offerId, setOfferId] = useState('');
  const [affId, setAffId] = useState('');
  const [appliedOfferId, setAppliedOfferId] = useState('');
  const [appliedAffId, setAppliedAffId] = useState('');

  // Inline date-range override. Date-only inputs (UTC) — picking "8 May"
  // means 8 May 00:00:00 → 8 May 23:59:59.999 UTC, regardless of the
  // browser's local timezone. Operators were getting IST day-spans before
  // because datetime-local was being parsed against the browser's TZ.
  const [overrideFrom, setOverrideFrom] = useState('');
  const [overrideTo, setOverrideTo] = useState('');
  const [appliedOverride, setAppliedOverride] = useState<{ from: string; to: string } | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const effectiveFrom = appliedOverride?.from ?? range.from;
  const effectiveTo = appliedOverride?.to ?? range.to;

  // Reset paging whenever the parent range changes — otherwise a stale cursor
  // from a wider window points into nothing.
  useEffect(() => {
    setCursorStack([null]);
  }, [range.from, range.to]);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const query = useQuery({
    queryKey: ['clicks', effectiveFrom, effectiveTo, appliedOfferId, appliedAffId, cursor],
    queryFn: () => clicksApi.list({
      from: effectiveFrom,
      to: effectiveTo,
      offer_id: appliedOfferId || undefined,
      aff_id: appliedAffId || undefined,
      cursor: cursor ?? undefined,
      limit: PAGE_SIZE,
    }),
  });

  function applyFilters() {
    setAppliedOfferId(offerId.trim());
    setAppliedAffId(affId.trim());
    setCursorStack([null]);
  }

  function applyOverride() {
    if (!overrideFrom || !overrideTo) return;
    // Date-only inputs are interpreted as full UTC days. Picking 8 May → 8 May
    // gives 8 May 00:00:00 → 8 May 23:59:59.999 UTC.
    const f = startOfUtcDayFromInput(overrideFrom);
    const t = endOfUtcDayFromInput(overrideTo);
    if (!f || !t) return;
    if (f.getTime() > t.getTime()) return;
    setAppliedOverride({ from: f.toISOString(), to: t.toISOString() });
    setCursorStack([null]);
  }
  function clearOverride() {
    setOverrideFrom('');
    setOverrideTo('');
    setAppliedOverride(null);
    setCursorStack([null]);
  }

  // Single round-trip to /api/clicks/export — the backend runs ONE Firestore
  // query over the [from,to] window and streams CSV back. No cursor walking
  // on the client (that was the source of mismatched IST/UTC counts since
  // the date inputs above are now strict UTC days). The blob is written to
  // disk via an object URL; nothing is persisted server-side.
  async function downloadReport() {
    setDownloadMsg(null);
    setDownloading(true);
    try {
      const result = await clicksApi.exportCsv({
        from: effectiveFrom,
        to: effectiveTo,
        offer_id: appliedOfferId || undefined,
        aff_id: appliedAffId || undefined,
      });
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);

      const rowsLabel = result.rowCount.toLocaleString();
      setDownloadMsg(
        result.truncated
          ? `Downloaded ${rowsLabel} rows (capped — narrow the date range or filters for a complete export).`
          : `Downloaded ${rowsLabel} rows.`,
      );
    } catch (e) {
      setDownloadMsg(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDownloading(false);
    }
  }

  const hasFilters = appliedOfferId || appliedAffId;

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-end sm:px-4 dark:border-neutral-800">
        <div className="min-w-[10rem] flex-1">
          <label className="label mb-1 text-xs">Offer ID</label>
          <Input
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            placeholder="e.g. summer_deal"
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="label mb-1 text-xs">Affiliate ID</label>
          <Input
            value={affId}
            onChange={(e) => setAffId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            placeholder="e.g. aff_123"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={applyFilters}>Apply</Button>
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOfferId('');
                setAffId('');
                setAppliedOfferId('');
                setAppliedAffId('');
                setCursorStack([null]);
              }}
            >
              Clear
            </Button>
          )}
          {query.isFetching && <Spinner className="text-slate-400 dark:text-neutral-500" />}
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={downloadReport}
            disabled={downloading || !query.data || query.data.items.length === 0}
            title="Download every click matching the current filters as a CSV (capped at 10,000 rows)."
          >
            {downloading ? <Spinner /> : <Download className="h-3.5 w-3.5" />}
            {downloading ? 'Downloading…' : 'Download'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/40 px-3 py-3 sm:flex-row sm:items-end sm:px-4 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-neutral-200">
          <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500" />
          Refine date range (UTC)
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="label mb-1 text-xs">From date</label>
          <Input
            type="date"
            value={overrideFrom}
            onChange={(e) => setOverrideFrom(e.target.value)}
            placeholder={toUtcDate(range.from)}
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="label mb-1 text-xs">To date</label>
          <Input
            type="date"
            value={overrideTo}
            onChange={(e) => setOverrideTo(e.target.value)}
            placeholder={toUtcDate(range.to)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={applyOverride} disabled={!overrideFrom || !overrideTo}>
            Apply
          </Button>
          {appliedOverride && (
            <Button size="sm" variant="ghost" onClick={clearOverride}>
              <RotateCcw className="mr-1 h-3 w-3" /> Reset
            </Button>
          )}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-neutral-500 sm:ml-auto">
          {appliedOverride
            ? `Active: ${fmtDateTime(appliedOverride.from)} – ${fmtDateTime(appliedOverride.to)} (full UTC days)`
            : 'Inheriting page range. Picking a date covers its full UTC day (00:00 → 23:59).'}
        </div>
      </div>

      {downloadMsg && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {downloadMsg}
        </div>
      )}

      {query.isLoading ? (
        <CenteredSpinner />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title="No clicks in this range"
          description="Try widening the date range or clearing the filters."
        />
      ) : (
        <>
          <div className="hidden sm:block">
            <Table>
              <THead>
                <TR>
                  <TH>Clicked</TH>
                  <TH>Click ID</TH>
                  <TH>Offer</TH>
                  <TH>Affiliate</TH>
                  <TH>Tracking</TH>
                  <TH>Country</TH>
                  <TH>Referrer</TH>
                </TR>
              </THead>
              <TBody>
                {query.data?.items.map((c) => {
                  const adIdKeys = Object.keys(c.ad_ids ?? {}).filter((k) => c.ad_ids?.[k]);
                  const subCount = Object.keys(c.sub_params ?? {}).length;
                  const extraCount = Object.keys(c.extra_params ?? {}).length;
                  return (
                    <TR key={c.click_id} className="hover:bg-slate-50/60 dark:hover:bg-neutral-800/50">
                      <TD className="whitespace-nowrap text-xs text-slate-600 dark:text-neutral-400">
                        {fmtDateTime(c.created_at)}
                      </TD>
                      <TD>
                        <Link
                          to={`/clicks/${encodeURIComponent(c.click_id)}`}
                          className="font-mono text-xs text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {shortId(c.click_id, 12)}
                        </Link>
                      </TD>
                      <TD className="text-sm">{c.offer_id}</TD>
                      <TD className="text-sm">{c.aff_id}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {adIdKeys.map((k) => (
                            <Badge key={k} tone="blue" className="text-[10px]">{k}</Badge>
                          ))}
                          {subCount > 0 && <Badge tone="gray" className="text-[10px]">{subCount} sub</Badge>}
                          {extraCount > 0 && <Badge tone="gray" className="text-[10px]">{extraCount} extra</Badge>}
                          {adIdKeys.length === 0 && subCount === 0 && extraCount === 0 && (
                            <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
                          )}
                        </div>
                      </TD>
                      <TD className="text-xs text-slate-500 dark:text-neutral-400">{c.country ?? '—'}</TD>
                      <TD className="max-w-[200px] truncate text-xs text-slate-500 dark:text-neutral-400" title={c.referrer ?? ''}>
                        {c.referrer ?? '—'}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
          <ul className="divide-y divide-slate-100 sm:hidden dark:divide-neutral-800">
            {query.data?.items.map((c) => (
              <li key={c.click_id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/clicks/${encodeURIComponent(c.click_id)}`}
                    className="font-mono text-xs text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {shortId(c.click_id, 12)}
                  </Link>
                  <span className="text-xs text-slate-500 dark:text-neutral-400">{fmtDateTime(c.created_at)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-neutral-300">
                  {c.offer_id} · <span className="text-slate-500 dark:text-neutral-400">{c.aff_id}</span>
                </div>
                {(c.country || c.referrer) && (
                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-neutral-400">
                    {c.country ?? '—'} · {c.referrer ?? ''}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            hasPrev={cursorStack.length > 1}
            hasNext={!!query.data?.nextCursor}
            onPrev={() => setCursorStack((s) => s.slice(0, -1))}
            onNext={() => query.data?.nextCursor && setCursorStack((s) => [...s, query.data!.nextCursor!])}
            pageLabel={`Page ${cursorStack.length}`}
          />
        </>
      )}
    </div>
  );
}
