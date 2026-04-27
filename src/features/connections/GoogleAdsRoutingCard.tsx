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
import { googleAdsApi } from './api';
import type { GoogleAdsRouteScope } from './types';

interface Props {
  scopeType: GoogleAdsRouteScope;
  scopeId: string;
}

function formatCustomerId(cid: string | undefined): string {
  if (!cid) return '';
  if (cid.length !== 10) return cid;
  return `${cid.slice(0, 3)}-${cid.slice(3, 6)}-${cid.slice(6)}`;
}

export function GoogleAdsRoutingCard({ scopeType, scopeId }: Props) {
  const qc = useQueryClient();

  const connectionsQ = useQuery({
    queryKey: ['google-ads-connections'],
    queryFn: () => googleAdsApi.listConnections(),
  });

  const [targetId, setTargetId] = useState('');
  const [saleAction, setSaleAction] = useState('');
  const [clickAction, setClickAction] = useState('');
  const [error, setError] = useState<string | null>(null);

  const routeQ = useQuery({
    queryKey: ['google-ads-route', scopeType, scopeId],
    queryFn: () => googleAdsApi.getRoute(scopeType, scopeId),
    enabled: !!scopeId,
  });

  useEffect(() => {
    const r = routeQ.data?.route;
    if (r) {
      setTargetId(r.target_connection_id);
      setSaleAction(r.sale_conversion_action_resource ?? '');
      setClickAction(r.click_conversion_action_resource ?? '');
    }
  }, [routeQ.data?.route?.route_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const actionsQ = useQuery({
    queryKey: ['google-ads-conversion-actions', targetId],
    queryFn: () => googleAdsApi.listConversionActions(targetId),
    enabled: !!targetId,
  });

  const refreshActions = useMutation({
    mutationFn: () => googleAdsApi.listConversionActions(targetId, { refresh: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['google-ads-conversion-actions', targetId] }),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const actions = actionsQ.data?.items ?? [];
      const sale = actions.find((a) => a.resource_name === saleAction);
      const click = actions.find((a) => a.resource_name === clickAction);
      return googleAdsApi.upsertRoute({
        scope_type: scopeType,
        scope_id: scopeId,
        target_connection_id: targetId,
        sale_conversion_action_resource: saleAction || undefined,
        sale_conversion_action_name: sale?.name ?? '',
        click_conversion_action_resource: clickAction || undefined,
        click_conversion_action_name: click?.name ?? '',
        enabled: true,
      });
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['google-ads-route', scopeType, scopeId] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.code ?? err.message : err instanceof Error ? err.message : 'Save failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!routeQ.data?.route) return Promise.resolve({ ok: true as const });
      return googleAdsApi.deleteRoute(routeQ.data.route.route_id);
    },
    onSuccess: () => {
      setTargetId('');
      setSaleAction('');
      setClickAction('');
      qc.invalidateQueries({ queryKey: ['google-ads-route', scopeType, scopeId] });
    },
  });

  if (connectionsQ.isLoading) return null;

  const connections = connectionsQ.data?.items ?? [];
  const childConnections = connections.filter((c) => c.type === 'child' && c.status === 'active');
  const mccConnections = connections.filter((c) => c.type === 'mcc' && c.status === 'active');
  const existingRoute = routeQ.data?.route;

  // No Google Ads connection at all → don't render the card. The user is told
  // about this on the Connections page; we don't repeat the prompt here.
  if (connections.length === 0) return null;

  // MCC-only → cross-account tracking handles routing automatically.
  if (childConnections.length === 0 && mccConnections.length > 0) {
    return (
      <Card>
        <CardHeader title="Google Ads forwarding" />
        <CardBody>
          <div className="flex items-start gap-3 rounded-md bg-brand-50/60 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Cross-account MCC handles this {scopeType} automatically.</div>
              <div className="mt-1">
                Conversions and Google-tagged outbound clicks are forwarded to the MCC{mccConnections.length > 1 ? 's' : ''}{' '}
                you connected on the <Link to="/connections" className="font-medium underline">Connections page</Link>.
                Per-{scopeType} mapping isn’t needed unless you also connect specific child accounts individually.
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
        title="Google Ads forwarding"
        subtitle={
          scopeType === 'offer'
            ? 'Pick which child Google Ads account this offer’s conversions and outbound clicks should go to. Offer-level routing overrides any network default.'
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
          <label className="label">Destination child account</label>
          <Select
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setSaleAction('');
              setClickAction('');
            }}
          >
            <option value="">— Select a child Google Ads account —</option>
            {childConnections.map((c) => (
              <option key={c.connection_id} value={c.connection_id}>
                {c.descriptive_name || formatCustomerId(c.customer_id)} · {formatCustomerId(c.customer_id)}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label flex items-center justify-between">
              <span>Sale conversion action <span className="text-slate-400">(postback)</span></span>
              {targetId && (
                <button
                  type="button"
                  onClick={() => refreshActions.mutate()}
                  disabled={refreshActions.isPending}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-neutral-400"
                >
                  {refreshActions.isPending ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                  Refresh
                </button>
              )}
            </label>
            <Select
              value={saleAction}
              onChange={(e) => setSaleAction(e.target.value)}
              disabled={!targetId || actionsQ.isLoading}
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
            <label className="label">Click conversion action <span className="text-slate-400">(outbound clicks)</span></label>
            <Select
              value={clickAction}
              onChange={(e) => setClickAction(e.target.value)}
              disabled={!targetId || actionsQ.isLoading}
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

        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-neutral-950/40 dark:text-neutral-400">
          Conversions are forwarded only when the postback's <code className="font-mono">click_id</code> resolves
          to a tracked click in this dashboard (the <strong>verified</strong> flag). The network's own status string
          isn't used as a gate — verified is the real signal that this conversion belongs to one of your clicks.
          Outbound clicks fire whenever the click carried a Google ad-id (<code className="font-mono">gclid</code>,
          <code className="font-mono"> gbraid</code>, or <code className="font-mono">wbraid</code>).
        </div>

        {mccConnections.length > 0 && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
            <strong>Heads up:</strong> you also have an MCC connection. Conversions and clicks fire to BOTH the MCC
            (cross-account) and the child you pick here, which can double-count in Google Ads. Pick one or the other.
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
            disabled={!targetId || (!saleAction && !clickAction) || saveMutation.isPending}
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
