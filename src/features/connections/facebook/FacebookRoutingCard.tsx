import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Trash2, RefreshCw, Info } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { ApiError } from '@/lib/api';
import { facebookAdsApi } from './api';
import type { FacebookRouteScope } from './types';

interface Props {
  scopeType: FacebookRouteScope;
  scopeId: string;
}

export function FacebookRoutingCard({ scopeType, scopeId }: Props) {
  const qc = useQueryClient();

  const connectionsQ = useQuery({
    queryKey: ['fb-connections'],
    queryFn: () => facebookAdsApi.listConnections(),
  });

  const [targetId, setTargetId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [saleEvent, setSaleEvent] = useState('');
  const [clickEvent, setClickEvent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const routeQ = useQuery({
    queryKey: ['fb-route', scopeType, scopeId],
    queryFn: () => facebookAdsApi.getRoute(scopeType, scopeId),
    enabled: !!scopeId,
  });

  useEffect(() => {
    const r = routeQ.data?.route;
    if (r) {
      setTargetId(r.target_connection_id);
      setDatasetId(r.sale_event_dataset_id || r.click_event_dataset_id || '');
      setSaleEvent(r.sale_event_name ?? '');
      setClickEvent(r.click_event_name ?? '');
    }
  }, [routeQ.data?.route?.route_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const datasetsQ = useQuery({
    queryKey: ['fb-datasets', targetId],
    queryFn: () => facebookAdsApi.listDatasets(targetId),
    enabled: !!targetId,
  });

  const eventsQ = useQuery({
    queryKey: ['fb-custom-events', targetId, datasetId],
    queryFn: () => facebookAdsApi.listCustomEvents(targetId, { dataset_id: datasetId || undefined }),
    enabled: !!targetId,
  });

  const refreshEvents = useMutation({
    mutationFn: () => facebookAdsApi.listCustomEvents(targetId, { dataset_id: datasetId || undefined, refresh: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fb-custom-events', targetId, datasetId] }),
  });

  const saveMutation = useMutation({
    mutationFn: () => facebookAdsApi.upsertRoute({
      scope_type: scopeType,
      scope_id: scopeId,
      target_connection_id: targetId,
      sale_event_name: saleEvent || undefined,
      sale_event_dataset_id: saleEvent ? (datasetId || undefined) : undefined,
      click_event_name: clickEvent || undefined,
      click_event_dataset_id: clickEvent ? (datasetId || undefined) : undefined,
      enabled: true,
    }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['fb-route', scopeType, scopeId] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.code ?? err.message : err instanceof Error ? err.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!routeQ.data?.route) return Promise.resolve({ ok: true as const });
      return facebookAdsApi.deleteRoute(routeQ.data.route.route_id);
    },
    onSuccess: () => {
      setTargetId('');
      setDatasetId('');
      setSaleEvent('');
      setClickEvent('');
      qc.invalidateQueries({ queryKey: ['fb-route', scopeType, scopeId] });
    },
  });

  if (connectionsQ.isLoading) return null;

  const connections = connectionsQ.data?.items ?? [];
  const adAccountConnections = connections.filter((c) => c.type === 'ad_account' && (c.status === 'active' || c.status === 'expiring'));
  const bmConnections = connections.filter((c) => c.type === 'business' && (c.status === 'active' || c.status === 'expiring'));
  const existingRoute = routeQ.data?.route;

  if (connections.length === 0) return null;

  if (adAccountConnections.length === 0 && bmConnections.length > 0) {
    return (
      <Card>
        <CardHeader title="Facebook forwarding" />
        <CardBody>
          <div className="flex items-start gap-3 rounded-md bg-brand-50/60 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Cross-account Business Manager handles this {scopeType} automatically.</div>
              <div className="mt-1">
                Conversions and FB-tagged outbound clicks are forwarded to the BM{bmConnections.length > 1 ? 's' : ''}{' '}
                you connected on the <Link to="/connections" className="font-medium underline">Connections page</Link>.
                Per-{scopeType} mapping isn’t needed unless you also connect specific ad accounts individually.
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Facebook forwarding"
        subtitle={
          scopeType === 'offer'
            ? 'Pick which ad account this offer’s conversions and outbound clicks should go to. Offer-level routing overrides any network default.'
            : 'Default forwarding for any conversion on this network. Offers can override per-offer.'
        }
        actions={
          existingRoute && (
            <Badge tone={existingRoute.enabled ? 'green' : 'gray'}>
              {existingRoute.enabled ? 'Active' : 'Disabled'}
            </Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        <div>
          <label className="label">Destination ad account</label>
          <Select
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setDatasetId('');
              setSaleEvent('');
              setClickEvent('');
            }}
          >
            <option value="">— Select an ad account —</option>
            {adAccountConnections.map((c) => (
              <option key={c.connection_id} value={c.connection_id}>
                {c.name || c.ad_account_id} · {c.ad_account_id}
              </option>
            ))}
          </Select>
        </div>

        {targetId && (
          <div>
            <label className="label">Dataset / Pixel</label>
            <Select
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              disabled={datasetsQ.isLoading}
            >
              <option value="">— Use connection default —</option>
              {(datasetsQ.data?.items ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name || '(unnamed)'} · {d.id}</option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label flex items-center justify-between">
              <span>Sale event <span className="text-slate-400">(postback)</span></span>
              {targetId && (
                <button
                  type="button"
                  onClick={() => refreshEvents.mutate()}
                  disabled={refreshEvents.isPending}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-neutral-400"
                >
                  {refreshEvents.isPending ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                  Refresh
                </button>
              )}
            </label>
            <Select
              value={saleEvent}
              onChange={(e) => setSaleEvent(e.target.value)}
              disabled={!targetId || eventsQ.isLoading}
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
            <label className="label">Click event <span className="text-slate-400">(outbound clicks)</span></label>
            <Select
              value={clickEvent}
              onChange={(e) => setClickEvent(e.target.value)}
              disabled={!targetId || eventsQ.isLoading}
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

        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-neutral-950/40 dark:text-neutral-400">
          Conversions are forwarded only when the postback's <code className="font-mono">click_id</code> resolves
          to a tracked click (the <strong>verified</strong> flag). Outbound clicks fire whenever the click carried
          a Facebook identifier (<code className="font-mono">fbclid</code>, <code className="font-mono">_fbc</code>
          or <code className="font-mono">_fbp</code>).
        </div>

        {bmConnections.length > 0 && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
            <strong>Heads up:</strong> you also have a Business Manager connection. Conversions and clicks fire to BOTH
            the BM (cross-account) and the ad account you pick here, which can double-count in Meta. Pick one or the other.
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!targetId || (!saleEvent && !clickEvent) || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Spinner /> : <Save className="h-4 w-4" />} Save routing
          </Button>
          {existingRoute && (
            <Button
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
