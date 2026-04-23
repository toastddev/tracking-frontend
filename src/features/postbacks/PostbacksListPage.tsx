import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Webhook } from 'lucide-react';
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
import { networksApi } from './api';
import { PostbackFormModal } from './PostbackFormModal';

const PAGE_SIZE = 20;

export function PostbacksListPage() {
  const [q, setQ] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [createOpen, setCreateOpen] = useState(false);

  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const query = useQuery({
    queryKey: ['networks', { q: searchTerm, cursor }],
    queryFn: () => networksApi.list({ q: searchTerm || undefined, cursor: cursor ?? undefined, limit: PAGE_SIZE }),
  });

  function applySearch() {
    setSearchTerm(q.trim());
    setCursorStack([null]);
  }

  return (
    <>
      <PageHeader
        title="Postbacks"
        description="Each postback is a per-network mapping. The URL is what you give to the network (Kelkoo, Admedia, …) so they can fire conversions back to you."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create postback
          </Button>
        }
      />

      <Card>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="Search by name…"
              className="pl-8"
            />
          </div>
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
          {query.isFetching && <Spinner className="ml-2 text-slate-400" />}
        </div>

        {query.isLoading ? (
          <CenteredSpinner />
        ) : query.data && query.data.items.length === 0 ? (
          <EmptyState
            icon={<Webhook className="h-10 w-10" />}
            title={searchTerm ? 'No postbacks match your search' : 'No postbacks yet'}
            description={searchTerm ? 'Try a different name.' : 'Create one and copy its URL into your network dashboard.'}
            action={
              !searchTerm && (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Create postback
                </Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Network</TH>
                  <TH>Status</TH>
                  <TH>Postback URL</TH>
                  <TH>Created</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {query.data?.items.map((n) => (
                  <TR key={n.network_id}>
                    <TD>
                      <Link
                        to={`/postbacks/${encodeURIComponent(n.network_id)}`}
                        className="font-medium text-slate-900 hover:text-brand-600"
                      >
                        {n.name}
                      </Link>
                      <div className="text-xs text-slate-500">{n.network_id}</div>
                    </TD>
                    <TD>
                      <Badge tone={n.status === 'active' ? 'green' : 'gray'}>{n.status}</Badge>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <code className="truncate font-mono text-xs text-slate-600 max-w-[280px]">
                          {n.postback_url}
                        </code>
                        {n.postback_url && <CopyButton value={n.postback_url} />}
                      </div>
                    </TD>
                    <TD className="text-xs text-slate-500">{fmtRelative(n.created_at)}</TD>
                    <TD className="text-right">
                      <Link
                        to={`/postbacks/${encodeURIComponent(n.network_id)}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        Open →
                      </Link>
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
      </Card>

      <PostbackFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
