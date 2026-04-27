import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { ApiError } from '@/lib/api';
import { googleAdsApi } from './api';
import type { GoogleAdsCandidate, GoogleAdsConnectionType } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  onFinalized: () => void;
  type: GoogleAdsConnectionType;
  grantToken: string;
  googleUserEmail: string;
  candidates: GoogleAdsCandidate[];
}

function formatCustomerId(cid: string): string {
  if (cid.length !== 10) return cid;
  return `${cid.slice(0, 3)}-${cid.slice(3, 6)}-${cid.slice(6)}`;
}

export function GoogleAdsAccountsModal({
  open,
  onClose,
  onFinalized,
  type,
  grantToken,
  googleUserEmail,
  candidates,
}: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  // For MCC: pick *manager* accounts (each becomes 1 MCC connection that does
  // cross-account tracking over its children).
  // For Child: pick *non-manager* (leaf) accounts — each becomes its own
  // separate child connection that you can route to per-offer/per-network.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const want = type === 'mcc'
      ? candidates.filter((c) => c.is_manager)
      : candidates.filter((c) => !c.is_manager);
    if (!q) return want;
    return want.filter((c) =>
      c.descriptive_name.toLowerCase().includes(q) ||
      c.customer_id.includes(q.replace(/-/g, ''))
    );
  }, [candidates, search, type]);

  const finalizeMutation = useMutation({
    mutationFn: () => {
      const picksList = visible.filter((c) => picked.has(c.customer_id));
      // For MCC: also include the discovered children (non-managers under each
      // picked MCC) as the snapshot list — display only.
      let mcc_children: { customer_id: string; descriptive_name: string; currency_code: string; time_zone: string }[] | undefined = undefined;
      if (type === 'mcc') {
        const managerIds = new Set(picksList.map((p) => p.customer_id));
        mcc_children = candidates
          .filter((c) =>
            !c.is_manager &&
            c.manager_customer_id &&
            managerIds.has(c.manager_customer_id)
          )
          .map((c) => ({
            customer_id: c.customer_id,
            descriptive_name: c.descriptive_name,
            currency_code: c.currency_code,
            time_zone: c.time_zone,
          }));
      }
      return googleAdsApi.finalize({
        grant_token: grantToken,
        picks: picksList.map((c) => ({
          customer_id: c.customer_id,
          manager_customer_id: c.manager_customer_id,
          descriptive_name: c.descriptive_name,
          currency_code: c.currency_code,
          time_zone: c.time_zone,
          is_manager: c.is_manager,
        })),
        mcc_children,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-ads-connections'] });
      setPicked(new Set());
      onFinalized();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.code ?? err.message : err instanceof Error ? err.message : 'Connection failed');
    },
  });

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const guidance = type === 'mcc'
    ? 'Pick the **manager** account(s) you want to enable cross-account conversion tracking under. Conversions are forwarded to the manager — Google Ads attributes them back to whichever child account ran the ad. No per-offer mapping needed.'
    : 'Pick the **child** account(s) you want to forward conversions into individually. Each pick becomes its own connection. You will set per-offer / per-network mappings on the Offer and Postback pages so different conversions can land in different child accounts.';

  return (
    <Modal
      open={open}
      onClose={() => !finalizeMutation.isPending && onClose()}
      size="lg"
      title={type === 'mcc' ? 'Connect Google Ads MCC' : 'Connect Google Ads child accounts'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={finalizeMutation.isPending}>Cancel</Button>
          <Button
            onClick={() => finalizeMutation.mutate()}
            disabled={finalizeMutation.isPending || picked.size === 0}
          >
            {finalizeMutation.isPending && <Spinner />}
            {type === 'mcc'
              ? `Connect MCC ${picked.size > 0 ? `(${picked.size})` : ''}`
              : `Connect ${picked.size} ${picked.size === 1 ? 'account' : 'accounts'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-brand-50/60 px-3 py-2 text-sm text-brand-900 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30">
          {/* Render simple **bold** support */}
          {guidance.split('**').map((part, i) =>
            i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-neutral-400">
          Authenticated as <strong className="text-slate-700 dark:text-neutral-200">{googleUserEmail}</strong>.
        </p>

        <Input
          placeholder="Filter by name or CID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200 dark:border-neutral-800">
          {visible.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-neutral-400">
              {type === 'mcc'
                ? 'No manager (MCC) accounts visible to this Google login. Switch to "Connect Google Ads child" if you want to connect specific child accounts directly.'
                : 'No child accounts visible to this Google login.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
              {visible.map((c) => {
                const checked = picked.has(c.customer_id);
                return (
                  <li key={c.customer_id}>
                    <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(c.customer_id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-neutral-600 dark:bg-neutral-900"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-neutral-100">
                            {c.descriptive_name || 'Unnamed account'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-neutral-400">
                            <code className="font-mono">{formatCustomerId(c.customer_id)}</code>
                            {c.manager_customer_id && c.manager_customer_id !== c.customer_id && (
                              <> · under MCC <code className="font-mono">{formatCustomerId(c.manager_customer_id)}</code></>
                            )}
                            {c.currency_code && <> · {c.currency_code}</>}
                            {c.time_zone && <> · {c.time_zone}</>}
                          </div>
                        </div>
                      </div>
                      {c.is_manager && <Badge tone="amber">Manager</Badge>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
