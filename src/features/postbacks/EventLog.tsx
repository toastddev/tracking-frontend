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
import { fmtDateTime, fmtMoney, shortId } from '@/lib/format';
import { networksApi } from './api';
import { ConversionDetailDrawer } from '../conversions/ConversionDetailDrawer';

const PAGE_SIZE = 25;

interface Props {
  networkId: string;
}

type VerifiedFilter = 'all' | 'verified' | 'unverified';

export function EventLog({ networkId }: Props) {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [openConversionId, setOpenConversionId] = useState<string | null>(null);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;
  const verified = verifiedFilter === 'all' ? undefined : verifiedFilter === 'verified';

  const query = useQuery({
    queryKey: ['network-conversions', networkId, { cursor, verified, from, to }],
    queryFn: () =>
      networksApi.conversions(networkId, {
        cursor: cursor ?? undefined,
        limit: PAGE_SIZE,
        verified,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      }),
  });

  function resetPagination() {
    setCursorStack([null]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <label className="label">Verified</label>
          <Select
            value={verifiedFilter}
            onChange={(e) => {
              setVerifiedFilter(e.target.value as VerifiedFilter);
              resetPagination();
            }}
          >
            <option value="all">All</option>
            <option value="verified">Verified only</option>
            <option value="unverified">Unverified only</option>
          </Select>
        </div>
        <div>
          <label className="label">From</label>
          <Input
            type="datetime-local"
            value={from}
            onChange={(e) => { setFrom(e.target.value); resetPagination(); }}
          />
        </div>
        <div>
          <label className="label">To</label>
          <Input
            type="datetime-local"
            value={to}
            onChange={(e) => { setTo(e.target.value); resetPagination(); }}
          />
        </div>
        {query.isFetching && <Spinner className="ml-auto text-slate-400" />}
      </div>

      {query.isLoading ? (
        <CenteredSpinner />
      ) : query.data && query.data.items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title="No events yet"
          description="Once this network fires a postback, it will appear here within a second."
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Received</TH>
                <TH>Click ID</TH>
                <TH>Status</TH>
                <TH>Payout</TH>
                <TH>Verified</TH>
                <TH>Method</TH>
                <TH className="text-right">Detail</TH>
              </TR>
            </THead>
            <TBody>
              {query.data?.items.map((c) => (
                <TR
                  key={c.conversion_id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setOpenConversionId(c.conversion_id)}
                >
                  <TD className="whitespace-nowrap text-xs text-slate-600">{fmtDateTime(c.created_at)}</TD>
                  <TD>
                    <code className="font-mono text-xs text-slate-700">{shortId(c.click_id, 12)}</code>
                  </TD>
                  <TD>
                    <span className="text-sm">{c.status ?? '—'}</span>
                  </TD>
                  <TD className="font-medium text-slate-900">{fmtMoney(c.payout, c.currency)}</TD>
                  <TD>
                    {c.verified ? (
                      <Badge tone="green">verified</Badge>
                    ) : (
                      <Badge tone="amber">unverified</Badge>
                    )}
                  </TD>
                  <TD className="text-xs text-slate-500">{c.method}</TD>
                  <TD className="text-right">
                    <span className="text-sm font-medium text-brand-600">View →</span>
                  </TD>
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

      <ConversionDetailDrawer
        conversionId={openConversionId}
        onClose={() => setOpenConversionId(null)}
      />
    </div>
  );
}
