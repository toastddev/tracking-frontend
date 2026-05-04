import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Inbox, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { fmtDateTime, fmtMoney, shortId } from '@/lib/format';
import { ConversionDetailDrawer } from '../conversions/ConversionDetailDrawer';
import { allConversionsApi } from './api';
import type { ReportRange } from './ReportFilters';

const PAGE_SIZE = 25;

interface Props {
  range: ReportRange;
  /** When true, the tab only shows verified conversions (Conversions tab). */
  verifiedOnly?: boolean;
  /** When provided, locks the report to a specific network and hides the network filter. */
  fixedNetworkId?: string;
  /**
   * When provided, locks the report to this set of offer ids and hides the
   * single-offer text input. Used by the postback detail page so the bottom
   * log inherits the page's offer multi-select.
   */
  fixedOfferIds?: string[];
  /**
   * When true, render datetime-local inputs that override the parent `range`
   * for this card only. Lets an operator drill into a specific minute window
   * without leaving the page.
   */
  inlineDateTimeOverride?: boolean;
  /** When true, add a Click column with a link to the click detail page. */
  showClickColumn?: boolean;
}

// Convert ISO → `datetime-local` value (no TZ, minute precision). Mirrors the
// helper in ReportFilters.tsx.
function toLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ConversionsReportTab({
  range,
  verifiedOnly,
  fixedNetworkId,
  fixedOfferIds,
  inlineDateTimeOverride,
  showClickColumn,
}: Props) {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [offerId, setOfferId] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [appliedOfferId, setAppliedOfferId] = useState('');
  const [appliedNetworkId, setAppliedNetworkId] = useState(fixedNetworkId ?? '');
  const [openConversionId, setOpenConversionId] = useState<string | null>(null);

  // Inline time-window override. When both From and To are set we use them
  // instead of the parent range. Empty = inherit from parent.
  const [overrideFrom, setOverrideFrom] = useState<string>('');
  const [overrideTo, setOverrideTo] = useState<string>('');
  const [appliedOverride, setAppliedOverride] = useState<{ from: string; to: string } | null>(null);

  // Reset paging whenever the parent range or the locked offer set changes —
  // otherwise a stale cursor from a wider window points into nothing.
  const offerIdsKey = useMemo(
    () => (fixedOfferIds ? [...fixedOfferIds].sort().join(',') : ''),
    [fixedOfferIds],
  );
  useEffect(() => {
    setCursorStack([null]);
  }, [range.from, range.to, offerIdsKey]);

  const effectiveFrom = appliedOverride?.from ?? range.from;
  const effectiveTo = appliedOverride?.to ?? range.to;

  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const query = useQuery({
    queryKey: ['conversions-all', {
      from: effectiveFrom,
      to: effectiveTo,
      appliedOfferId,
      appliedNetworkId,
      verifiedOnly,
      cursor,
      offerIdsKey,
    }],
    queryFn: () =>
      allConversionsApi.list({
        from: effectiveFrom,
        to: effectiveTo,
        offer_id: appliedOfferId || undefined,
        offer_ids: fixedOfferIds && fixedOfferIds.length > 0 ? fixedOfferIds : undefined,
        network_id: appliedNetworkId || undefined,
        verified: verifiedOnly ? true : undefined,
        cursor: cursor ?? undefined,
        limit: PAGE_SIZE,
      }),
  });

  function applyFilters() {
    setAppliedOfferId(offerId.trim());
    if (!fixedNetworkId) {
      setAppliedNetworkId(networkId.trim());
    }
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

  // Hide the single-offer text filter when the parent already locks the
  // offer set — would just be a confusing second control.
  const showOfferIdInput = !fixedOfferIds;
  const showApplyBar = showOfferIdInput || !fixedNetworkId;

  return (
    <div>
      {showApplyBar && (
        <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-end sm:px-4 dark:border-neutral-800">
          {showOfferIdInput && (
            <div className="min-w-[10rem] flex-1">
              <label className="label mb-1 text-xs">Offer ID</label>
              <Input
                value={offerId}
                onChange={(e) => setOfferId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="e.g. summer_deal"
              />
            </div>
          )}
          {!fixedNetworkId && (
            <div className="min-w-[10rem] flex-1">
              <label className="label mb-1 text-xs">Network ID</label>
              <Input
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="e.g. kelkoo"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={applyFilters}>Apply</Button>
            {(appliedOfferId || (!fixedNetworkId && appliedNetworkId)) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOfferId('');
                  if (!fixedNetworkId) {
                    setNetworkId('');
                    setAppliedNetworkId('');
                  }
                  setAppliedOfferId('');
                  setCursorStack([null]);
                }}
              >
                Clear
              </Button>
            )}
            {query.isFetching && <Spinner className="text-slate-400 dark:text-neutral-500" />}
          </div>
        </div>
      )}

      {inlineDateTimeOverride && (
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/40 px-3 py-3 sm:flex-row sm:items-end sm:px-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-neutral-200">
            <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500" />
            Refine time window
          </div>
          <div className="min-w-[11rem] flex-1">
            <label className="label mb-1 text-xs">From</label>
            <Input
              type="datetime-local"
              value={overrideFrom}
              onChange={(e) => setOverrideFrom(e.target.value)}
              placeholder={toLocal(range.from)}
            />
          </div>
          <div className="min-w-[11rem] flex-1">
            <label className="label mb-1 text-xs">To</label>
            <Input
              type="datetime-local"
              value={overrideTo}
              onChange={(e) => setOverrideTo(e.target.value)}
              placeholder={toLocal(range.to)}
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
              : `Inheriting page range`}
          </div>
        </div>
      )}

      {query.isLoading ? (
        <CenteredSpinner />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title={verifiedOnly ? 'No verified conversions in this range' : 'No conversions in this range'}
          description="Try widening the date range or clearing the filters."
        />
      ) : (
        <>
          <div className="hidden sm:block">
            <Table>
              <THead>
                <TR>
                  <TH>Received</TH>
                  <TH>Network</TH>
                  <TH>Offer</TH>
                  <TH>Status</TH>
                  <TH>Payout</TH>
                  {!verifiedOnly && <TH>Verified</TH>}
                  {showClickColumn && <TH>Click</TH>}
                  <TH className="text-right">Detail</TH>
                </TR>
              </THead>
              <TBody>
                {query.data?.items.map((c) => (
                  <TR
                    key={c.conversion_id}
                    className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-neutral-800/50"
                    onClick={() => setOpenConversionId(c.conversion_id)}
                  >
                    <TD className="whitespace-nowrap text-xs text-slate-600 dark:text-neutral-400">
                      {fmtDateTime(c.created_at)}
                    </TD>
                    <TD className="text-sm">{c.network_id}</TD>
                    <TD className="text-sm text-slate-700 dark:text-neutral-300">{c.offer_id ?? '—'}</TD>
                    <TD className="text-sm">{c.status ?? '—'}</TD>
                    <TD className="font-medium text-slate-900 dark:text-neutral-100">
                      {fmtMoney(c.payout, c.currency)}
                    </TD>
                    {!verifiedOnly && (
                      <TD>
                        {c.verified ? (
                          <Badge tone="green">verified</Badge>
                        ) : (
                          <Badge tone="amber">unverified</Badge>
                        )}
                      </TD>
                    )}
                    {showClickColumn && (
                      <TD onClick={(e) => e.stopPropagation()}>
                        {c.click_id ? (
                          c.verified ? (
                            <Link
                              to={`/clicks/${encodeURIComponent(c.click_id)}`}
                              className="font-mono text-[11px] text-brand-600 hover:underline dark:text-brand-400"
                              title={c.click_id}
                            >
                              {shortId(c.click_id, 12)}
                            </Link>
                          ) : (
                            <span
                              className="font-mono text-[11px] text-slate-400 dark:text-neutral-500"
                              title={`No click matched this fire (${c.click_id})`}
                            >
                              {shortId(c.click_id, 12)}{' '}
                              <span className="ml-1 text-amber-600 dark:text-amber-400">unmatched</span>
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] italic text-slate-400 dark:text-neutral-500">
                            no click_id
                          </span>
                        )}
                      </TD>
                    )}
                    <TD className="text-right">
                      <span className="text-sm font-medium text-brand-600 dark:text-brand-400">View →</span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="divide-y divide-slate-100 sm:hidden dark:divide-neutral-800">
            {query.data?.items.map((c) => (
              <li
                key={c.conversion_id}
                onClick={() => setOpenConversionId(c.conversion_id)}
                className="cursor-pointer px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-neutral-800/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-neutral-200">
                      {c.network_id}
                      <span className="ml-2 text-slate-500 dark:text-neutral-400">· {c.offer_id ?? '—'}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-neutral-400">
                      <code className="font-mono">{shortId(c.click_id, 12)}</code>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-900 dark:text-neutral-100">
                      {fmtMoney(c.payout, c.currency)}
                    </div>
                    {!verifiedOnly && (
                      <Badge tone={c.verified ? 'green' : 'amber'} className="mt-1">
                        {c.verified ? 'verified' : 'unverified'}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
                  <span>{c.status ?? '—'}</span>
                  <span>{fmtDateTime(c.created_at)}</span>
                </div>
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

      <ConversionDetailDrawer
        conversionId={openConversionId}
        onClose={() => setOpenConversionId(null)}
      />
    </div>
  );
}
