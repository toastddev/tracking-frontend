import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { Plus, Search, Package, Trash2 } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { fmtRelative } from '@/lib/format';
import { offersApi } from './api';
import { OfferFormModal } from './OfferFormModal';

const PAGE_SIZE = 20;
// When the operator is searching, we pull a wider pool from the backend (no
// server-side filter) and run Fuse over it locally. 500 is well above the
// dashboard's expected offer count — searches stay snappy even at the cap.
const SEARCH_POOL_SIZE = 500;

export function OffersListPage() {
  const [q, setQ] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOffer, setDeleteOffer] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const qc = useQueryClient();

  // Live debounce — operator can type freely; the list filters as they go
  // without needing to hit Enter or click Search.
  const liveQuery = useDebouncedString(q.trim(), 150);
  useEffect(() => {
    setSearchTerm(liveQuery);
    setCursorStack([null]);
  }, [liveQuery]);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;
  const searching = !!searchTerm;

  // Paginated list for idle (no-search) browsing. Disabled while searching to
  // avoid an unnecessary round-trip — the fuzzy pool below replaces it.
  const pagedQuery = useQuery({
    queryKey: ['offers', { cursor }],
    queryFn: () => offersApi.list({ cursor: cursor ?? undefined, limit: PAGE_SIZE }),
    enabled: !searching,
  });

  // Search pool — one shot fetch of up to SEARCH_POOL_SIZE offers. Cached for
  // 60s so back-to-back searches don't re-fetch.
  const poolQuery = useQuery({
    queryKey: ['offers', 'fuzzy-pool'],
    queryFn: () => offersApi.list({ limit: SEARCH_POOL_SIZE }),
    enabled: searching,
    staleTime: 60_000,
  });

  // Fuse handles typos, word-order swaps and matches across hyphenated slugs
  // ("office depot" finds "office-depot", "direct-office-depot-2"). We index
  // both `name` and `offer_id` so the operator can type either form. The
  // tokenizer treats hyphens as word boundaries via `useExtendedSearch: false`
  // + `ignoreLocation: true` so partial matches don't penalise position.
  const fuse = useMemo(() => {
    if (!poolQuery.data) return null;
    return new Fuse(poolQuery.data.items, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'offer_id', weight: 1 },
      ],
      threshold: 0.4,
      ignoreLocation: true,
      includeScore: false,
      minMatchCharLength: 2,
    });
  }, [poolQuery.data]);

  const fuzzyResults = useMemo(() => {
    if (!searching || !fuse) return null;
    // Replace hyphens/underscores with spaces so "office-depot" and
    // "office depot" score equivalently — without this, Fuse penalises the
    // token-boundary difference on slug-shaped offer_ids.
    const normalised = searchTerm.replace(/[-_]+/g, ' ').trim();
    return fuse.search(normalised).map((r) => r.item);
  }, [searching, fuse, searchTerm]);

  const query = searching ? poolQuery : pagedQuery;
  const displayItems = searching ? (fuzzyResults ?? []) : (pagedQuery.data?.items ?? []);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => offersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      setDeleteOffer(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setDeleteError(err.code ?? err.message);
      else if (err instanceof Error) setDeleteError(err.message);
      else setDeleteError('Could not delete offer');
    },
  });

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
              placeholder="Search offers (typos OK)…"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ('');
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
        ) : displayItems.length === 0 ? (
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
              {displayItems.map((offer) => {
                const fullUrl = offer.tracking_url ?? '';
                return (
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
                        {fullUrl}
                      </code>
                      {fullUrl && <CopyButton value={fullUrl} />}
                    </div>
                    {(offer.traffic_source || offer.linked_campaign_id || offer.link_type) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {offer.traffic_source && (
                          <Badge tone={offer.traffic_source === 'google' ? 'blue' : 'amber'}>
                            {offer.traffic_source === 'google' ? 'Google Ads' : 'Facebook'}
                          </Badge>
                        )}
                        {offer.linked_campaign_id && (
                          <span className="truncate font-mono text-slate-600 dark:text-neutral-400" title={offer.linked_campaign_id}>
                            {offer.linked_campaign_id}
                          </span>
                        )}
                        {offer.link_type && (
                          <Badge tone={offer.link_type === 'direct' ? 'green' : 'gray'}>{offer.link_type}</Badge>
                        )}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
                      <span>{fmtRelative(offer.created_at)}</span>
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/offers/${encodeURIComponent(offer.offer_id)}`}
                          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Open →
                        </Link>
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteOffer({ id: offer.offer_id, name: offer.name });
                          }}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete offer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Status</TH>
                    <TH>Source</TH>
                    <TH>Linked campaign</TH>
                    <TH>Link type</TH>
                    <TH>Tracking URL</TH>
                    <TH>Created</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {displayItems.map((offer) => {
                    const fullUrl = offer.tracking_url ?? '';
                    return (
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
                          {offer.traffic_source ? (
                            <Badge tone={offer.traffic_source === 'google' ? 'blue' : 'amber'}>
                              {offer.traffic_source === 'google' ? 'Google Ads' : 'Facebook'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
                          )}
                        </TD>
                        <TD>
                          {offer.linked_campaign_id ? (
                            <span className="font-mono text-xs text-slate-700 dark:text-neutral-300" title={offer.linked_campaign_id}>
                              {offer.linked_campaign_id}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
                          )}
                        </TD>
                        <TD>
                          {offer.link_type ? (
                            <Badge tone={offer.link_type === 'direct' ? 'green' : 'gray'}>
                              {offer.link_type}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
                          )}
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <code className="max-w-[280px] truncate font-mono text-xs text-slate-600 dark:text-neutral-400">
                              {fullUrl}
                            </code>
                            {fullUrl && <CopyButton value={fullUrl} />}
                          </div>
                        </TD>
                        <TD className="text-xs text-slate-500 dark:text-neutral-400">{fmtRelative(offer.created_at)}</TD>
                        <TD className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              to={`/offers/${encodeURIComponent(offer.offer_id)}`}
                              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                            >
                              Open →
                            </Link>
                            <button
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteOffer({ id: offer.offer_id, name: offer.name });
                              }}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete offer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
            {!searching && (
              <Pagination
                hasPrev={cursorStack.length > 1}
                hasNext={!!pagedQuery.data?.nextCursor}
                onPrev={() => setCursorStack((s) => s.slice(0, -1))}
                onNext={() => pagedQuery.data?.nextCursor && setCursorStack((s) => [...s, pagedQuery.data!.nextCursor!])}
                pageLabel={`Page ${cursorStack.length}`}
              />
            )}
          </>
        )}
      </Card>

      <OfferFormModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {deleteOffer && (
        <ConfirmDialog
          open={!!deleteOffer}
          onCancel={() => !deleteMutation.isPending && setDeleteOffer(null)}
          onConfirm={() => deleteMutation.mutate(deleteOffer.id)}
          title="Delete offer?"
          description={
            <>
              This permanently removes <strong>{deleteOffer.name}</strong> ({deleteOffer.id}). Existing clicks and conversions
              already linked to it stay in the database, but the offer itself can no longer be edited or fired against.
            </>
          }
          confirmLabel="Delete offer"
          variant="danger"
          busy={deleteMutation.isPending}
          error={deleteError}
        />
      )}
    </>
  );
}

function useDebouncedString(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
