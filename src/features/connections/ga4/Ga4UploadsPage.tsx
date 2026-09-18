import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtDateTime } from '@/lib/format';
import { ga4Api, ga4ErrorMessage, type Ga4Upload, type Ga4UploadKind, type Ga4UploadStatus } from './api';
import { Ga4UploadsExportPanel } from './Ga4UploadsExportPanel';

// Audit view for GA4 uploads - the counterpart of the Google Ads upload report.
// Only reachable while "Save upload audit data" is on (Connections → GA4);
// with it off there is nothing stored to show.

const PAGE_SIZE = 25;

const selectCls =
  'block h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200';
const labelCls = 'mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400';

function statusTone(status: Ga4UploadStatus): 'green' | 'red' | 'gray' | 'amber' {
  if (status === 'sent') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'skipped') return 'gray';
  return 'amber';
}

export function Ga4UploadsPage() {
  const [kind, setKind] = useState<'' | Ga4UploadKind>('');
  const [status, setStatus] = useState<'' | Ga4UploadStatus>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const query = useQuery({
    queryKey: ['ga4-uploads', { kind, status, from, to, cursor }],
    queryFn: () =>
      ga4Api.listUploads({
        kind: kind || undefined,
        status: status || undefined,
        from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
        limit: PAGE_SIZE,
        cursor: cursor ?? undefined,
      }),
  });

  function resetPaging<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setCursorStack([null]);
    };
  }

  const items = query.data?.items ?? [];
  const auditEnabled = query.data?.audit_enabled ?? true;

  return (
    <>
      <PageHeader
        title="GA4 Uploads"
        description="Every conversion and click this tracker pushed to GA4 — sent, failed, or skipped with the reason. Same audit trail as the Google Ads upload report."
      />

      {!auditEnabled && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Saving audit data is turned off, so nothing new is recorded here. Forwarding to GA4 continues as normal.
            Turn it back on under{' '}
            <Link to="/connections" className="underline hover:no-underline">
              Connections → Google Analytics 4
            </Link>
            .
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:px-4 dark:border-neutral-800">
          <div>
            <label className={labelCls}>From (UTC)</label>
            <Input type="date" value={from} max={to || undefined} onChange={(e) => resetPaging(setFrom)(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <label className={labelCls}>To (UTC)</label>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => resetPaging(setTo)(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <label className={labelCls}>Kind</label>
            <select value={kind} onChange={(e) => resetPaging(setKind)(e.target.value as '' | Ga4UploadKind)} className={selectCls}>
              <option value="">All</option>
              <option value="conversion">Conversion</option>
              <option value="click">Click</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(e) => resetPaging(setStatus)(e.target.value as '' | Ga4UploadStatus)} className={selectCls}>
              <option value="">All</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
        </div>

        {query.isLoading ? (
          <CenteredSpinner />
        ) : query.error ? (
          <div className="px-4 py-6 text-sm text-red-700 dark:text-red-400">{ga4ErrorMessage(query.error)}</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No GA4 uploads yet"
            description="Uploads appear once a conversion arrives on a click that carried the site's GA ids."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Kind</TH>
                <TH>Status</TH>
                <TH>Event</TH>
                <TH>Value</TH>
                <TH>Property</TH>
                <TH>Source</TH>
                <TH>Detail</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((u: Ga4Upload) => (
                <TR key={u.upload_id}>
                  <TD className="whitespace-nowrap text-xs">{fmtDateTime(u.created_at)}</TD>
                  <TD className="text-xs">{u.kind}</TD>
                  <TD>
                    <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                  </TD>
                  <TD className="text-xs">{u.event_name ?? '—'}</TD>
                  <TD className="whitespace-nowrap text-xs">
                    {typeof u.value === 'number' ? `${u.value} ${u.currency ?? ''}`.trim() : '—'}
                  </TD>
                  <TD className="font-mono text-[11px]">{u.measurement_id ?? '—'}</TD>
                  <TD className="max-w-[16rem] truncate font-mono text-[11px]" title={u.source_id}>
                    {u.conversion_id ? (
                      <Link to={`/clicks/${u.click_id ?? ''}`} className="hover:underline">
                        {u.source_id}
                      </Link>
                    ) : (
                      u.source_id
                    )}
                  </TD>
                  <TD className="max-w-[20rem] truncate text-xs text-slate-500 dark:text-neutral-400" title={u.last_error ?? u.skip_reason ?? ''}>
                    {u.skip_reason ?? u.last_error ?? '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <Pagination
          hasPrev={cursorStack.length > 1}
          hasNext={!!query.data?.next_cursor}
          busy={query.isFetching}
          pageLabel={`Page ${cursorStack.length}`}
          onPrev={() => setCursorStack((s) => (s.length > 1 ? s.slice(0, -1) : s))}
          onNext={() => {
            const next = query.data?.next_cursor;
            if (next) setCursorStack((s) => [...s, next]);
          }}
          onFirst={() => setCursorStack([null])}
        />
      </Card>

      <div className="mt-6">
        <Ga4UploadsExportPanel />
      </div>
    </>
  );
}
