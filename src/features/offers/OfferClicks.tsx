import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner, CenteredSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { fmtDateTime, shortId } from '@/lib/format';
import { offersApi } from './api';

const PAGE_SIZE = 25;

interface Props {
  offerId: string;
}

export function OfferClicks({ offerId }: Props) {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const query = useQuery({
    queryKey: ['offer-clicks', offerId, { cursor, from, to }],
    queryFn: () =>
      offersApi.clicks(offerId, {
        cursor: cursor ?? undefined,
        limit: PAGE_SIZE,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      }),
  });

  function resetPagination() {
    setCursorStack([null]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3 dark:border-neutral-800">
        {/* No verified filter for clicks */}
        <div className="min-w-[12rem] flex-1 sm:flex-none">
          <label className="label">From</label>
          <Input
            type="datetime-local"
            value={from}
            onChange={(e) => { setFrom(e.target.value); resetPagination(); }}
          />
        </div>
        <div className="min-w-[12rem] flex-1 sm:flex-none">
          <label className="label">To</label>
          <Input
            type="datetime-local"
            value={to}
            onChange={(e) => { setTo(e.target.value); resetPagination(); }}
          />
        </div>
        {query.isFetching && <Spinner className="ml-auto text-slate-400 dark:text-neutral-500" />}
      </div>

      {query.isLoading ? (
        <CenteredSpinner />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title="No clicks yet"
          description="Once an affiliate sends traffic, clicks will appear here."
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Click ID</TH>
                <TH>Affiliate ID</TH>
                <TH>IP</TH>
                <TH>Country</TH>
              </TR>
            </THead>
            <TBody>
              {query.data?.items.map((c) => (
                <TR
                  key={c.click_id}
                  className="hover:bg-slate-50/60 dark:hover:bg-neutral-800/50"
                >
                  <TD className="whitespace-nowrap text-xs text-slate-600 dark:text-neutral-400">{fmtDateTime(c.created_at)}</TD>
                  <TD>
                    <code className="font-mono text-xs text-slate-700 dark:text-neutral-300">{shortId(c.click_id, 12)}</code>
                  </TD>
                  <TD>
                    <span className="text-sm font-medium">{c.aff_id}</span>
                  </TD>
                  <TD className="text-xs text-slate-500 dark:text-neutral-400">{c.ip ?? '—'}</TD>
                  <TD className="text-xs text-slate-500 dark:text-neutral-400">{c.country ?? '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
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
