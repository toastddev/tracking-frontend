import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { facebookAdsApi } from './api';
import type { FacebookConnection } from './types';

interface Props {
  connection: FacebookConnection;
}

function expiringSoon(iso: string | undefined): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime() - Date.now();
  return ms < 7 * 24 * 60 * 60 * 1000 && ms > 0;
}

export function FacebookConnectionPanel({ connection }: Props) {
  const qc = useQueryClient();

  const [datasetId, setDatasetId] = useState(connection.dataset_id ?? '');
  const [saleEvent, setSaleEvent] = useState(connection.sale_event_name ?? '');
  const [clickEvent, setClickEvent] = useState(connection.click_event_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detailQ = useQuery({
    queryKey: ['fb-connection-detail', connection.connection_id],
    queryFn: () => facebookAdsApi.getConnection(connection.connection_id),
    enabled: connection.type === 'business',
  });

  const datasetsQ = useQuery({
    queryKey: ['fb-datasets', connection.connection_id],
    queryFn: () => facebookAdsApi.listDatasets(connection.connection_id),
  });

  const eventsQ = useQuery({
    queryKey: ['fb-custom-events', connection.connection_id, datasetId],
    queryFn: () => facebookAdsApi.listCustomEvents(connection.connection_id, { dataset_id: datasetId || undefined }),
  });

  const refreshEvents = useMutation({
    mutationFn: () => facebookAdsApi.listCustomEvents(connection.connection_id, { dataset_id: datasetId || undefined, refresh: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fb-custom-events', connection.connection_id, datasetId] }),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const dsName = (datasetsQ.data?.items ?? []).find((d) => d.id === datasetId)?.name;
      return facebookAdsApi.patchConnection(connection.connection_id, {
        dataset_id: datasetId || undefined,
        dataset_name: dsName,
        sale_event_name: saleEvent || undefined,
        sale_event_dataset_id: saleEvent ? (datasetId || undefined) : undefined,
        click_event_name: clickEvent || undefined,
        click_event_dataset_id: clickEvent ? (datasetId || undefined) : undefined,
      });
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['fb-connections'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.code ?? err.message : err instanceof Error ? err.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => facebookAdsApi.deleteConnection(connection.connection_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-connections'] });
      setConfirmDelete(false);
    },
  });

  const refreshChildren = useMutation({
    mutationFn: () => facebookAdsApi.refreshBusinessChildren(connection.connection_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fb-connection-detail', connection.connection_id] }),
  });

  useEffect(() => {
    setDatasetId(connection.dataset_id ?? '');
    setSaleEvent(connection.sale_event_name ?? '');
    setClickEvent(connection.click_event_name ?? '');
  }, [
    connection.connection_id,
    connection.dataset_id,
    connection.sale_event_name,
    connection.click_event_name,
  ]);

  const businessChildren = detailQ.data?.business_children ?? [];
  const expiring = expiringSoon(connection.access_token_expires_at);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-slate-900 dark:text-neutral-100">
              {connection.name || connection.ad_account_id || connection.business_id}
            </span>
            <Badge tone={connection.status === 'active' ? 'green' : connection.status === 'error' ? 'red' : connection.status === 'expiring' ? 'amber' : 'gray'}>
              {connection.status}
            </Badge>
            {connection.type === 'business' && <Badge tone="amber">Business Manager</Badge>}
            {expiring && <Badge tone="amber">Token expiring soon</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
            {connection.type === 'business' ? (
              <>BM <code className="font-mono">{connection.business_id}</code></>
            ) : (
              <>Ad account <code className="font-mono">{connection.ad_account_id}</code></>
            )}
            {connection.currency_code && <> · {connection.currency_code}</>}
            {connection.time_zone && <> · {connection.time_zone}</>}
            <> · connected as {connection.meta_user_email} on {fmtDateTime(connection.created_at)}</>
            {connection.access_token_expires_at && (
              <> · token expires {fmtDateTime(connection.access_token_expires_at)}</>
            )}
          </div>
          {connection.last_error && (
            <div className="mt-1 text-xs text-red-600 dark:text-red-400">Last error: {connection.last_error}</div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" /> Disconnect
        </Button>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-neutral-950/40 dark:text-neutral-400">
          {connection.type === 'business' ? (
            <>
              <strong className="text-slate-800 dark:text-neutral-200">Cross-account CAPI forwarding.</strong>{' '}
              Every verified conversion / FB-tagged outbound click is forwarded to the dataset selected below; Meta attributes it
              to whichever ad account ran the ad.
            </>
          ) : (
            <>
              <strong className="text-slate-800 dark:text-neutral-200">Per-account routing.</strong>{' '}
              Pick the dataset (pixel) and standard / custom events to fire. Per-offer / per-network mappings on the
              Offer and Postback pages override these defaults.
            </>
          )}
        </div>

        <div>
          <label className="label">Dataset / Pixel</label>
          <Select
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            disabled={datasetsQ.isLoading}
          >
            <option value="">— Select a dataset (pixel) —</option>
            {(datasetsQ.data?.items ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name || '(unnamed)'} · {d.id}</option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label flex items-center justify-between">
              <span>Sale event <span className="text-slate-400">(for postback conversions)</span></span>
              <button
                type="button"
                onClick={() => refreshEvents.mutate()}
                disabled={refreshEvents.isPending}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-neutral-400"
              >
                {refreshEvents.isPending ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                Refresh
              </button>
            </label>
            <Select
              value={saleEvent}
              onChange={(e) => setSaleEvent(e.target.value)}
              disabled={eventsQ.isLoading}
            >
              <option value="">— None (skip sale forwarding) —</option>
              {(eventsQ.data?.items ?? []).map((a) => (
                <option key={`${a.kind}-${a.event_name}`} value={a.event_name}>
                  {a.event_name} · {a.kind === 'standard' ? 'Standard' : 'Custom'}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Click event <span className="text-slate-400">(optional — for outbound clicks)</span></label>
            <Select
              value={clickEvent}
              onChange={(e) => setClickEvent(e.target.value)}
              disabled={eventsQ.isLoading}
            >
              <option value="">— None (skip click forwarding) —</option>
              {(eventsQ.data?.items ?? []).map((a) => (
                <option key={`${a.kind}-${a.event_name}`} value={a.event_name}>
                  {a.event_name} · {a.kind === 'standard' ? 'Standard' : 'Custom'}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-neutral-400">
          Standard events ('Purchase', 'Lead', 'CompleteRegistration', ...) are available on every dataset. Custom events must be
          registered in Meta Events Manager first. We only send Facebook-originated clicks (those that arrived with
          <code className="font-mono"> fbclid</code> or carry an <code className="font-mono">_fbc</code> /
          <code className="font-mono">_fbp</code> cookie) — non-FB clicks are silently ignored.
        </p>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Spinner /> : <Save className="h-4 w-4" />} Save
          </Button>
        </div>

        {connection.type === 'business' && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600 dark:text-neutral-400">
              Cross-account coverage — {businessChildren.length} ad accounts under this BM
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  refreshChildren.mutate();
                }}
                disabled={refreshChildren.isPending}
                className="ml-4 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {refreshChildren.isPending ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                Refresh Accounts
              </button>
            </summary>
            {businessChildren.length > 0 ? (
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {businessChildren.map((c) => (
                  <li key={c.fb_child_id} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-neutral-950/40 dark:text-neutral-300">
                    <span className="font-medium">{c.name || '—'}</span>
                    <span className="text-slate-500 dark:text-neutral-400"> · <code className="font-mono">{c.ad_account_id}</code></span>
                  </li>
                ))}
              </ul>
            ) : null}
          </details>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => !deleteMutation.isPending && setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Disconnect this Facebook account?"
        description={
          <>
            This removes the connection and stops all conversion / click forwarding to it. Past upload audit records
            stay in the database. Existing routes that pointed at this connection will silently skip until you
            reconnect or repoint them.
          </>
        }
        confirmLabel="Disconnect"
        variant="danger"
        busy={deleteMutation.isPending}
      />
    </div>
  );
}
