import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Play, RefreshCw, TestTube2, Trash2, Unlock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { ApiError } from '@/lib/api';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { affiliateApisApi } from './api';
import { AffApiFormModal } from './AffApiFormModal';
import type { AffiliateApiRunRecord } from '@/types';

export function AffApiDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AffiliateApiRunRecord | null>(null);

  const apiQ = useQuery({
    queryKey: ['affiliate-api', id],
    queryFn: () => affiliateApisApi.get(id),
    enabled: !!id,
  });

  const runsQ = useQuery({
    queryKey: ['affiliate-api-runs', id],
    queryFn: () => affiliateApisApi.runs(id, 25),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const runNow = useMutation({
    mutationFn: () => affiliateApisApi.runNow(id),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['affiliate-api-runs', id] });
      qc.invalidateQueries({ queryKey: ['affiliate-api', id] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const msg = err.code === 'locked'
          ? 'A run is already in progress.'
          : err.code === 'run_failed'
            ? 'Run failed — check Cloud Run logs for details.'
            : err.code ?? err.message;
        setActionError(msg);
      }
      else if (err instanceof Error) setActionError(err.message);
    },
  });

  const testRun = useMutation({
    mutationFn: () => affiliateApisApi.testRun(id),
    onSuccess: (res) => {
      setActionError(null);
      setTestResult(res.run);
    },
    onError: (err) => {
      if (err instanceof ApiError) setActionError(err.code ?? err.message);
      else if (err instanceof Error) setActionError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => affiliateApisApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affiliate-apis'] });
      qc.removeQueries({ queryKey: ['affiliate-api', id] });
      navigate('/aff-api', { replace: true });
    },
  });

  const forceUnlock = useMutation({
    mutationFn: () => affiliateApisApi.forceUnlock(id),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['affiliate-api', id] });
      qc.invalidateQueries({ queryKey: ['affiliate-api-runs', id] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setActionError(err.code ?? err.message);
      else if (err instanceof Error) setActionError(err.message);
    },
  });

  if (apiQ.isLoading) return <CenteredSpinner />;
  if (apiQ.isError || !apiQ.data) {
    return (
      <Card>
        <div className="px-5 py-4 text-sm text-slate-600 dark:text-neutral-300">API integration not found.</div>
      </Card>
    );
  }

  const api = apiQ.data;
  const intervalMin = Math.round((24 * 60) / Math.max(1, api.schedule.runs_per_day));

  return (
    <>
      <PageHeader
        title={api.name}
        description={`API integration · ${api.kind.toUpperCase()} · ${api.api_id}`}
        back={
          <Link to="/aff-api" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200">
            <ArrowLeft className="h-4 w-4" /> All integrations
          </Link>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => testRun.mutate()} disabled={testRun.isPending}>
              <TestTube2 className="h-4 w-4" /> {testRun.isPending ? 'Testing…' : 'Dry run'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
              <Play className="h-4 w-4" /> {runNow.isPending ? 'Running…' : 'Run now'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Overview" subtitle={`Runs ${api.schedule.runs_per_day}× per day (~ every ${intervalMin} min)`} />
          <CardBody>
            <Row label="Status">
              <Badge tone={api.status === 'active' ? 'green' : 'gray'}>{api.status}</Badge>
              <Badge tone={api.schedule.enabled ? 'blue' : 'gray'} className="ml-2">
                schedule {api.schedule.enabled ? 'on' : 'off'}
              </Badge>
            </Row>
            <Row label="Kind">{api.kind.toUpperCase()}</Row>
            <Row label="Response format">{(api.response_format ?? 'auto').toUpperCase()}</Row>
            <Row label="Base URL"><code className="break-all font-mono text-xs">{api.base_url}</code></Row>
            <Row label="Auth">{api.auth.type}{api.auth.has_secret && <Badge tone="gray" className="ml-2">secret stored</Badge>}</Row>
            <Row label="Pagination">{api.pagination.type}{api.pagination.page_size ? ` · ${api.pagination.page_size}/page` : ''}</Row>
            <Row label="Incremental">{api.incremental.enabled ? `${api.incremental.from_param ?? 'from'} → ${api.incremental.to_param ?? 'to'} (${api.incremental.format})` : 'off'}</Row>
            <Row label="Mapped network">{api.network_id ?? <span className="text-slate-400">—</span>}</Row>
            <Row label="Last run">
              {api.schedule.last_run_at ? (
                <>
                  {fmtRelative(api.schedule.last_run_at)}
                  {api.schedule.last_status && (
                    <Badge
                      tone={api.schedule.last_status === 'ok' ? 'green' : api.schedule.last_status === 'partial' ? 'amber' : 'red'}
                      className="ml-2"
                    >
                      {api.schedule.last_status}
                    </Badge>
                  )}
                </>
              ) : (
                'never'
              )}
            </Row>
            <Row label="Next run">{api.schedule.next_run_at ? fmtDateTime(api.schedule.next_run_at) : <span className="text-slate-400">—</span>}</Row>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mapping" subtitle="Response paths used to extract conversion fields" />
          <CardBody>
            <Row label="items_path"><code className="font-mono text-xs">{api.mapping.items_path}</code></Row>
            <Row label="external_id"><code className="font-mono text-xs">{api.mapping.external_id_path}</code></Row>
            <Row label="click_id"><code className="font-mono text-xs">{api.mapping.click_id_path}</code></Row>
            {api.mapping.payout_path && <Row label="payout"><code className="font-mono text-xs">{api.mapping.payout_path}</code></Row>}
            {api.mapping.currency_path && <Row label="currency"><code className="font-mono text-xs">{api.mapping.currency_path}</code></Row>}
            {api.mapping.status_path && <Row label="status"><code className="font-mono text-xs">{api.mapping.status_path}</code></Row>}
            {api.mapping.txn_id_path && <Row label="txn_id"><code className="font-mono text-xs">{api.mapping.txn_id_path}</code></Row>}
            {api.mapping.event_time_path && <Row label="event_time"><code className="font-mono text-xs">{api.mapping.event_time_path}</code></Row>}
            <Row label="default_status">{api.mapping.default_status ?? 'approved'}</Row>
          </CardBody>
        </Card>
      </div>

      {actionError && (
        <div className="mt-4 flex items-center gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
          <span className="flex-1">{actionError}</span>
          {actionError.includes('already in progress') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => forceUnlock.mutate()}
              disabled={forceUnlock.isPending}
              className="shrink-0"
            >
              <Unlock className="h-4 w-4" /> {forceUnlock.isPending ? 'Unlocking…' : 'Force unlock'}
            </Button>
          )}
        </div>
      )}

      {testResult && (
        <Card className="mt-6">
          <CardHeader title="Last dry run" subtitle="Mapping is exercised end-to-end but nothing is written." />
          <CardBody>
            <RunStatsRow run={testResult} />
            {testResult.error && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
                {testResult.error}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Run history"
          subtitle="Most recent first, refreshes every 15s while open."
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ['affiliate-api-runs', id] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          }
        />
        {runsQ.data && runsQ.data.items.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-500 dark:text-neutral-400">No runs yet. Trigger one with “Run now”.</div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Started</TH>
                <TH>Status</TH>
                <TH>Trigger</TH>
                <TH>Inserted</TH>
                <TH>Duplicates</TH>
                <TH>Unknown click</TH>
                <TH>Failed</TH>
                <TH>HTTP</TH>
                <TH>Duration</TH>
              </TR>
            </THead>
            <TBody>
              {runsQ.data?.items.map((r) => (
                <TR key={r.run_id}>
                  <TD className="text-xs">{fmtDateTime(r.started_at)}</TD>
                  <TD>
                    <Badge tone={r.status === 'ok' ? 'green' : r.status === 'partial' ? 'amber' : r.status === 'error' ? 'red' : 'gray'}>
                      {r.status}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-slate-500 dark:text-neutral-400">{r.triggered_by ?? '—'}</TD>
                  <TD className="text-xs">{r.records_inserted ?? 0}</TD>
                  <TD className="text-xs text-slate-500 dark:text-neutral-400">{r.records_skipped_duplicate ?? 0}</TD>
                  <TD className="text-xs text-slate-500 dark:text-neutral-400">{r.records_skipped_unknown_click ?? 0}</TD>
                  <TD className="text-xs text-slate-500 dark:text-neutral-400">{r.records_failed ?? 0}</TD>
                  <TD className="text-xs text-slate-500 dark:text-neutral-400">{r.http_calls ?? 0}</TD>
                  <TD className="text-xs text-slate-500 dark:text-neutral-400">{r.duration_ms != null ? `${r.duration_ms}ms` : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <AffApiFormModal open={editOpen} onClose={() => setEditOpen(false)} initial={api} />
      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete this integration?"
        description="This stops scheduled runs and removes the configuration. Conversions already pulled remain in reports."
        confirmLabel="Delete"
        variant="danger"
        busy={deleteMutation.isPending}
      />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500 dark:text-neutral-400">{label}</span>
      <span className="text-right font-medium text-slate-900 dark:text-neutral-100">{children}</span>
    </div>
  );
}

function RunStatsRow({ run }: { run: AffiliateApiRunRecord }) {
  const items: { k: string; v: number | string }[] = [
    { k: 'Pages', v: run.pages_fetched ?? 0 },
    { k: 'Seen', v: run.records_seen ?? 0 },
    { k: 'Inserted (sim)', v: run.records_inserted ?? 0 },
    { k: 'Duplicates', v: run.records_skipped_duplicate ?? 0 },
    { k: 'Unknown click', v: run.records_skipped_unknown_click ?? 0 },
    { k: 'Failed', v: run.records_failed ?? 0 },
    { k: 'HTTP calls', v: run.http_calls ?? 0 },
    { k: 'Duration', v: run.duration_ms != null ? `${run.duration_ms}ms` : '—' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.k} className="rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-neutral-950/60">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">{i.k}</div>
          <div className="font-medium text-slate-900 dark:text-neutral-100">{i.v}</div>
        </div>
      ))}
    </div>
  );
}
