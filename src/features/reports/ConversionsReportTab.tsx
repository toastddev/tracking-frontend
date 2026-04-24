import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
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
}

export function ConversionsReportTab({ range, verifiedOnly }: Props) {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [offerId, setOfferId] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [appliedOfferId, setAppliedOfferId] = useState('');
  const [appliedNetworkId, setAppliedNetworkId] = useState('');
  const [openConversionId, setOpenConversionId] = useState<string | null>(null);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const query = useQuery({
    queryKey: ['conversions-all', { from: range.from, to: range.to, appliedOfferId, appliedNetworkId, verifiedOnly, cursor }],
    queryFn: () =>
      allConversionsApi.list({
        from: range.from,
        to: range.to,
        offer_id: appliedOfferId || undefined,
        network_id: appliedNetworkId || undefined,
        verified: verifiedOnly ? true : undefined,
        cursor: cursor ?? undefined,
        limit: PAGE_SIZE,
      }),
  });

  function applyFilters() {
    setAppliedOfferId(offerId.trim());
    setAppliedNetworkId(networkId.trim());
    setCursorStack([null]);
  }

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
          <label className="label mb-1 text-xs">Network ID</label>
          <Input
            value={networkId}
            onChange={(e) => setNetworkId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            placeholder="e.g. kelkoo"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={applyFilters}>Apply</Button>
          {(appliedOfferId || appliedNetworkId) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOfferId('');
                setNetworkId('');
                setAppliedOfferId('');
                setAppliedNetworkId('');
                setCursorStack([null]);
              }}
            >
              Clear
            </Button>
          )}
          {query.isFetching && <Spinner className="text-slate-400 dark:text-neutral-500" />}
        </div>
      </div>

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
