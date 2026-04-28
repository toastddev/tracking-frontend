import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plug, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtRelative } from '@/lib/format';
import { affiliateApisApi } from './api';
import { AffApiFormModal } from './AffApiFormModal';

const PAGE_SIZE = 20;

export function AffApiListPage() {
  const [q, setQ] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [createOpen, setCreateOpen] = useState(false);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const query = useQuery({
    queryKey: ['affiliate-apis', { q: searchTerm, cursor }],
    queryFn: () =>
      affiliateApisApi.list({
        q: searchTerm || undefined,
        cursor: cursor ?? undefined,
        limit: PAGE_SIZE,
      }),
  });

  function applySearch() {
    setSearchTerm(q.trim());
    setCursorStack([null]);
  }

  return (
    <>
      <PageHeader
        title="Affiliate APIs"
        description="Pull conversions from networks that expose an API (REST or GraphQL). When mapped to a postback, the API becomes the source of truth for that network."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add integration
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
            icon={<Plug className="h-10 w-10" />}
            title={searchTerm ? 'No integrations match your search' : 'No API integrations yet'}
            description={
              searchTerm
                ? 'Try a different name.'
                : 'Add an integration for any affiliate network that exposes a conversions API.'
            }
            action={
              !searchTerm && (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Add integration
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden sm:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Kind</TH>
                    <TH>Schedule</TH>
                    <TH>Last run</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {query.data?.items.map((a) => (
                    <TR key={a.api_id} className="hover:bg-slate-50/60 dark:hover:bg-neutral-800/50">
                      <TD>
                        <Link
                          to={`/aff-api/${encodeURIComponent(a.api_id)}`}
                          className="font-medium text-slate-900 hover:text-brand-600 dark:text-neutral-100 dark:hover:text-brand-400"
                        >
                          {a.name}
                        </Link>
                        <div className="text-xs text-slate-500 dark:text-neutral-400">{a.api_id}</div>
                      </TD>
                      <TD>
                        <Badge tone={a.kind === 'graphql' ? 'amber' : 'gray'}>{a.kind}</Badge>
                      </TD>
                      <TD className="text-xs text-slate-500 dark:text-neutral-400">
                        {a.schedule.enabled ? `${a.schedule.runs_per_day}× / day` : 'Off'}
                      </TD>
                      <TD className="text-xs text-slate-500 dark:text-neutral-400">
                        {a.schedule.last_run_at ? (
                          <>
                            {fmtRelative(a.schedule.last_run_at)}
                            {a.schedule.last_status && (
                              <Badge
                                tone={
                                  a.schedule.last_status === 'ok'
                                    ? 'green'
                                    : a.schedule.last_status === 'partial'
                                      ? 'amber'
                                      : 'red'
                                }
                                className="ml-1"
                              >
                                {a.schedule.last_status}
                              </Badge>
                            )}
                          </>
                        ) : (
                          'Never'
                        )}
                      </TD>
                      <TD>
                        <Badge tone={a.status === 'active' ? 'green' : 'gray'}>{a.status}</Badge>
                      </TD>
                      <TD className="text-right">
                        <Link
                          to={`/aff-api/${encodeURIComponent(a.api_id)}`}
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

            <ul className="divide-y divide-slate-100 sm:hidden dark:divide-neutral-800">
              {query.data?.items.map((a) => (
                <li key={a.api_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/aff-api/${encodeURIComponent(a.api_id)}`}
                        className="block truncate font-medium text-slate-900 dark:text-neutral-100"
                      >
                        {a.name}
                      </Link>
                      <div className="truncate text-xs text-slate-500 dark:text-neutral-400">{a.api_id}</div>
                    </div>
                    <Badge tone={a.status === 'active' ? 'green' : 'gray'}>{a.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
                    <span>{a.schedule.enabled ? `${a.schedule.runs_per_day}× / day` : 'Off'}</span>
                    <span>
                      {a.schedule.last_run_at ? fmtRelative(a.schedule.last_run_at) : 'never'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              hasPrev={cursorStack.length > 1}
              hasNext={!!query.data?.nextCursor}
              onPrev={() => setCursorStack((s) => s.slice(0, -1))}
              onNext={() =>
                query.data?.nextCursor && setCursorStack((s) => [...s, query.data!.nextCursor!])
              }
              pageLabel={`Page ${cursorStack.length}`}
            />
          </>
        )}
      </Card>

      <AffApiFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
