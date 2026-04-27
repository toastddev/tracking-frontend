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
import { googleAdsApi } from './api';
import type { GoogleAdsConnection } from './types';

function formatCustomerId(cid: string | undefined): string {
  if (!cid) return '';
  if (cid.length !== 10) return cid;
  return `${cid.slice(0, 3)}-${cid.slice(3, 6)}-${cid.slice(6)}`;
}

interface Props {
  connection: GoogleAdsConnection;
}

// Per-connection panel rendered inside ConnectCard. Lets the user pick the
// cross-account conversion actions (sale + click) for an MCC connection, OR
// optional defaults for a child connection.
export function GoogleAdsConnectionPanel({ connection }: Props) {
  const qc = useQueryClient();

  const [saleAction, setSaleAction] = useState(connection.sale_conversion_action_resource ?? '');
  const [clickAction, setClickAction] = useState(connection.click_conversion_action_resource ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detailQ = useQuery({
    queryKey: ['google-ads-connection-detail', connection.connection_id],
    queryFn: () => googleAdsApi.getConnection(connection.connection_id),
    enabled: connection.type === 'mcc',
  });

  const actionsQ = useQuery({
    queryKey: ['google-ads-conversion-actions', connection.connection_id],
    queryFn: () => googleAdsApi.listConversionActions(connection.connection_id),
  });

  const refreshActions = useMutation({
    mutationFn: () => googleAdsApi.listConversionActions(connection.connection_id, { refresh: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['google-ads-conversion-actions', connection.connection_id] }),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const actions = actionsQ.data?.items ?? [];
      const sale = actions.find((a) => a.resource_name === saleAction);
      const click = actions.find((a) => a.resource_name === clickAction);
      return googleAdsApi.patchConnection(connection.connection_id, {
        sale_conversion_action_resource: saleAction || undefined,
        sale_conversion_action_name: sale?.name ?? '',
        click_conversion_action_resource: clickAction || undefined,
        click_conversion_action_name: click?.name ?? '',
      });
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['google-ads-connections'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.code ?? err.message : err instanceof Error ? err.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => googleAdsApi.deleteConnection(connection.connection_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-ads-connections'] });
      setConfirmDelete(false);
    },
  });

  // Re-hydrate when the connection prop refreshes after a save.
  useEffect(() => {
    setSaleAction(connection.sale_conversion_action_resource ?? '');
    setClickAction(connection.click_conversion_action_resource ?? '');
  }, [connection.connection_id, connection.sale_conversion_action_resource, connection.click_conversion_action_resource]);

  const mccChildren = detailQ.data?.mcc_children ?? [];

  return (
    <div className="rounded-lg border border-slate-200 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-slate-900 dark:text-neutral-100">
              {connection.descriptive_name || formatCustomerId(connection.customer_id)}
            </span>
            <Badge tone={connection.status === 'active' ? 'green' : connection.status === 'error' ? 'red' : 'gray'}>
              {connection.status}
            </Badge>
            {connection.type === 'mcc' && <Badge tone="amber">MCC</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
            <code className="font-mono">{formatCustomerId(connection.customer_id)}</code>
            {connection.manager_customer_id && connection.manager_customer_id !== connection.customer_id && (
              <> · accessed via MCC <code className="font-mono">{formatCustomerId(connection.manager_customer_id)}</code></>
            )}
            {connection.currency_code && <> · {connection.currency_code}</>}
            {connection.time_zone && <> · {connection.time_zone}</>}
            <> · connected as {connection.google_user_email} on {fmtDateTime(connection.created_at)}</>
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
          {connection.type === 'mcc' ? (
            <>
              <strong className="text-slate-800 dark:text-neutral-200">Cross-account conversion tracking.</strong>{' '}
              Pick one conversion action per type. Every verified conversion / Google-tagged outbound click is forwarded to
              this MCC; Google Ads attributes it back to whichever child account ran the ad.
              No per-offer or per-network mapping is needed when only MCC connections are in use.
            </>
          ) : (
            <>
              <strong className="text-slate-800 dark:text-neutral-200">Per-account routing.</strong>{' '}
              Set the conversion actions you want fired for this child account. Per-offer / per-network mappings on the
              Offer and Postback pages override these defaults.
            </>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label flex items-center justify-between">
              <span>Sale conversion action <span className="text-slate-400">(for postback conversions)</span></span>
              <button
                type="button"
                onClick={() => refreshActions.mutate()}
                disabled={refreshActions.isPending}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-neutral-400"
              >
                {refreshActions.isPending ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                Refresh
              </button>
            </label>
            <Select
              value={saleAction}
              onChange={(e) => setSaleAction(e.target.value)}
              disabled={actionsQ.isLoading}
            >
              <option value="">— None (skip sale forwarding) —</option>
              {(actionsQ.data?.items ?? []).map((a) => (
                <option key={a.resource_name} value={a.resource_name}>
                  {a.name} · {a.status}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Click conversion action <span className="text-slate-400">(for outbound clicks)</span></label>
            <Select
              value={clickAction}
              onChange={(e) => setClickAction(e.target.value)}
              disabled={actionsQ.isLoading}
            >
              <option value="">— None (skip click forwarding) —</option>
              {(actionsQ.data?.items ?? []).map((a) => (
                <option key={a.resource_name} value={a.resource_name}>
                  {a.name} · {a.status}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-neutral-400">
          Both actions must be created in Google Ads first with the import method
          <strong> "Conversions from clicks"</strong> (the API type is <code className="font-mono">UPLOAD_CLICKS</code>).
          We only send Google-originated clicks (those that arrived with <code className="font-mono">gclid</code>,
          <code className="font-mono"> gbraid</code>, or <code className="font-mono">wbraid</code>) — non-Google clicks are
          silently ignored.
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
          {(actionsQ.data?.items ?? []).length === 0 && !actionsQ.isLoading && (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              No <code className="font-mono">UPLOAD_CLICKS</code> conversion actions exist on this account yet — create one in Google Ads first.
            </span>
          )}
        </div>

        {connection.type === 'mcc' && mccChildren.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600 dark:text-neutral-400">
              Cross-account coverage — {mccChildren.length} child accounts under this MCC
            </summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {mccChildren.map((c) => (
                <li key={c.ga_child_id} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:bg-neutral-950/40 dark:text-neutral-300">
                  <span className="font-medium">{c.descriptive_name || '—'}</span>
                  <span className="text-slate-500 dark:text-neutral-400"> · <code className="font-mono">{formatCustomerId(c.customer_id)}</code></span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => !deleteMutation.isPending && setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Disconnect this Google Ads account?"
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
