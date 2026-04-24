import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { fmtDateTime, shortId } from '@/lib/format';
import { clicksApi } from './api';
import type { ReportRange } from './ReportFilters';

const PAGE_SIZE = 25;

interface Props {
  range: ReportRange;
}

export function ClicksReportTab({ range }: Props) {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [offerId, setOfferId] = useState('');
  const [affId, setAffId] = useState('');
  const [appliedOfferId, setAppliedOfferId] = useState('');
  const [appliedAffId, setAppliedAffId] = useState('');

  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const query = useQuery({
    queryKey: ['clicks', range.from, range.to, appliedOfferId, appliedAffId, cursor],
    queryFn: () => clicksApi.list({
      from: range.from,
      to: range.to,
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
          {(appliedOfferId || appliedAffId) && (
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
      </div>

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
                  <TH>Country</TH>
                  <TH>Referrer</TH>
                </TR>
              </THead>
              <TBody>
                {query.data?.items.map((c) => (
                  <TR key={c.click_id}>
                    <TD className="whitespace-nowrap text-xs text-slate-600 dark:text-neutral-400">
                      {fmtDateTime(c.created_at)}
                    </TD>
                    <TD>
                      <code className="font-mono text-xs text-slate-700 dark:text-neutral-300">
                        {shortId(c.click_id, 12)}
                      </code>
                    </TD>
                    <TD className="text-sm">{c.offer_id}</TD>
                    <TD className="text-sm">{c.aff_id}</TD>
                    <TD className="text-xs text-slate-500 dark:text-neutral-400">{c.country ?? '—'}</TD>
                    <TD className="max-w-[200px] truncate text-xs text-slate-500 dark:text-neutral-400" title={c.referrer ?? ''}>
                      {c.referrer ?? '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="divide-y divide-slate-100 sm:hidden dark:divide-neutral-800">
            {query.data?.items.map((c) => (
              <li key={c.click_id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <code className="font-mono text-xs text-slate-700 dark:text-neutral-300">{shortId(c.click_id, 12)}</code>
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
