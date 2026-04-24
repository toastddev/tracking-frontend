import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Package } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner, CenteredSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CopyButton } from '@/components/ui/CopyButton';
import { fmtRelative } from '@/lib/format';
import { offersApi } from './api';
import { OfferFormModal } from './OfferFormModal';

const PAGE_SIZE = 20;

export function OffersListPage() {
  const [q, setQ] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [createOpen, setCreateOpen] = useState(false);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const query = useQuery({
    queryKey: ['offers', { q: searchTerm, cursor }],
    queryFn: () => offersApi.list({ q: searchTerm || undefined, cursor: cursor ?? undefined, limit: PAGE_SIZE }),
  });

  function applySearch() {
    setSearchTerm(q.trim());
    setCursorStack([null]);
  }

  return (
    <>
      <PageHeader
        title="Offers"
        description="Stores and offers you're tracking. Each offer has a unique tracking URL you share with affiliates."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create offer
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:px-4 dark:border-neutral-800">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="Search by name…"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={applySearch}>Search</Button>
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ('');
                  setSearchTerm('');
                  setCursorStack([null]);
                }}
              >
                Clear
              </Button>
            )}
            {query.isFetching && <Spinner className="ml-auto text-slate-400 dark:text-neutral-500" />}
          </div>
        </div>

        {query.isLoading ? (
          <CenteredSpinner />
        ) : query.data && query.data.items.length === 0 ? (
          <EmptyState
            icon={<Package className="h-10 w-10" />}
            title={searchTerm ? 'No offers match your search' : 'No offers yet'}
            description={searchTerm ? 'Try a different name.' : 'Create your first offer to get a tracking link.'}
            action={
              !searchTerm && (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Create offer
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Mobile card list */}
            <ul className="divide-y divide-slate-100 sm:hidden dark:divide-neutral-800">
              {query.data?.items.map((offer) => (
                <li key={offer.offer_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/offers/${encodeURIComponent(offer.offer_id)}`}
                        className="block truncate font-medium text-slate-900 dark:text-neutral-100"
                      >
                        {offer.name}
                      </Link>
                      <div className="truncate text-xs text-slate-500 dark:text-neutral-400">{offer.offer_id}</div>
                    </div>
                    <Badge tone={offer.status === 'active' ? 'green' : 'gray'}>{offer.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600 dark:text-neutral-400">
                      {offer.tracking_url}
                    </code>
                    {offer.tracking_url && <CopyButton value={offer.tracking_url} />}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
                    <span>{fmtRelative(offer.created_at)}</span>
                    <Link
                      to={`/offers/${encodeURIComponent(offer.offer_id)}`}
                      className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Open →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Status</TH>
                    <TH>Tracking URL</TH>
                    <TH>Created</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {query.data?.items.map((offer) => (
                    <TR key={offer.offer_id} className="hover:bg-slate-50/60 dark:hover:bg-neutral-800/50">
                      <TD>
                        <Link
                          to={`/offers/${encodeURIComponent(offer.offer_id)}`}
                          className="font-medium text-slate-900 hover:text-brand-600 dark:text-neutral-100 dark:hover:text-brand-400"
                        >
                          {offer.name}
                        </Link>
                        <div className="text-xs text-slate-500 dark:text-neutral-400">{offer.offer_id}</div>
                      </TD>
                      <TD>
                        <Badge tone={offer.status === 'active' ? 'green' : 'gray'}>{offer.status}</Badge>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <code className="max-w-[280px] truncate font-mono text-xs text-slate-600 dark:text-neutral-400">
                            {offer.tracking_url}
                          </code>
                          {offer.tracking_url && <CopyButton value={offer.tracking_url} />}
                        </div>
                      </TD>
                      <TD className="text-xs text-slate-500 dark:text-neutral-400">{fmtRelative(offer.created_at)}</TD>
                      <TD className="text-right">
                        <Link
                          to={`/offers/${encodeURIComponent(offer.offer_id)}`}
                          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Open →
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <Pagination
              hasPrev={cursorStack.length > 1}
              hasNext={!!query.data?.nextCursor}
              onPrev={() => setCursorStack((s) => s.slice(0, -1))}
              onNext={() => query.data?.nextCursor && setCursorStack((s) => [...s, query.data!.nextCursor!])}
              pageLabel={`Page ${cursorStack.length}`}
            />
          </>
        )}
      </Card>

      <OfferFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
