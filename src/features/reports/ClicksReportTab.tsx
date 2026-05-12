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
import { csvTimestamp, downloadCsv, toCsv } from '@/lib/csv';
import { clicksApi } from './api';
import type { ReportRange } from './ReportFilters';

const PAGE_SIZE = 25;
// Hard cap on rows pulled by "Download report" so a runaway export can't
// hammer the API or blow up the browser tab. Above this we surface a notice
// telling the operator to narrow the date range.
const DOWNLOAD_LIMIT = 10_000;
const DOWNLOAD_PAGE_SIZE = 200;

interface Props {
  range: ReportRange;
}

// ISO → `datetime-local` (no TZ, minute precision). The native input only
// understands this shape; the parent's range is full-precision ISO.
function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ClicksReportTab({ range }: Props) {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [offerId, setOfferId] = useState('');
  const [affId, setAffId] = useState('');
  const [appliedOfferId, setAppliedOfferId] = useState('');
  const [appliedAffId, setAppliedAffId] = useState('');

  // Inline date-range override. Mirrors the pattern used in ConversionsReportTab
  // for the postback drill-down — when both From and To are set we use them
  // instead of the parent range.
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
    const f = new Date(overrideFrom);
    const t = new Date(overrideTo);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return;
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

  // Pulls every page (within DOWNLOAD_LIMIT) for the *currently applied*
  // filters and writes a single CSV. Walking pages on the client keeps the
  // backend honest: the same cursor pagination the table uses, just with a
  // bigger page size to amortise the round-trips.
  async function downloadReport() {
    setDownloadMsg(null);
    setDownloading(true);
    const allRows: Array<Record<string, unknown>> = [];
    let nextCursor: string | null = null;
    try {
      do {
        const page = await clicksApi.list({
          from: effectiveFrom,
          to: effectiveTo,
          offer_id: appliedOfferId || undefined,
          aff_id: appliedAffId || undefined,
          cursor: nextCursor ?? undefined,
          limit: DOWNLOAD_PAGE_SIZE,
        });
        for (const c of page.items) allRows.push(c as unknown as Record<string, unknown>);
        nextCursor = page.nextCursor ?? null;
        if (allRows.length >= DOWNLOAD_LIMIT) {
          setDownloadMsg(`Capped at ${DOWNLOAD_LIMIT.toLocaleString()} rows. Narrow the date range or filters for a smaller, complete export.`);
          break;
        }
      } while (nextCursor);

      const headers = [
        'clicked_at', 'click_id', 'offer_id', 'aff_id', 'country', 'referrer',
        'gad_campaignid', 'utm_campaign', 'utm_source', 'utm_medium', 'utm_term', 'utm_content',
        'sub_count', 'extra_count',
      ];
      const rows = allRows.map((c) => {
        const extra = (c.extra_params as Record<string, string> | undefined) ?? {};
        const sub = (c.sub_params as Record<string, string> | undefined) ?? {};
        return [
          c.created_at as string,
          c.click_id as string,
          (c.offer_id as string) ?? '',
          (c.aff_id as string) ?? '',
          (c.country as string) ?? '',
          (c.referrer as string) ?? '',
          extra.gad_campaignid ?? '',
          extra.utm_campaign ?? '',
          extra.utm_source ?? '',
          extra.utm_medium ?? '',
          extra.utm_term ?? '',
          extra.utm_content ?? '',
          Object.keys(sub).length,
          Object.keys(extra).length,
        ];
      });
      const csv = toCsv(headers, rows);
      const stamp = csvTimestamp();
      const aff = appliedAffId ? `_${appliedAffId}` : '';
      const off = appliedOfferId ? `_${appliedOfferId}` : '';
      downloadCsv(`clicks${aff}${off}_${stamp}.csv`, csv);
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
          Refine date range
        </div>
        <div className="min-w-[11rem] flex-1">
          <label className="label mb-1 text-xs">From</label>
          <Input
            type="datetime-local"
            value={overrideFrom}
            onChange={(e) => setOverrideFrom(e.target.value)}
            placeholder={toLocalDateTime(range.from)}
          />
        </div>
        <div className="min-w-[11rem] flex-1">
          <label className="label mb-1 text-xs">To</label>
          <Input
            type="datetime-local"
            value={overrideTo}
            onChange={(e) => setOverrideTo(e.target.value)}
            placeholder={toLocalDateTime(range.to)}
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
            ? `Active: ${fmtDateTime(appliedOverride.from)} – ${fmtDateTime(appliedOverride.to)}`
            : 'Inheriting page range'}
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
