import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { ApiError } from '@/lib/api';
import { facebookAdsApi } from './api';
import type { FacebookCandidate, FacebookConnectionType } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  onFinalized: () => void;
  type: FacebookConnectionType;
  grantToken: string;
  metaUserEmail: string;
  candidates: FacebookCandidate[];
}

export function FacebookAccountsModal({
  open, onClose, onFinalized, type, grantToken, metaUserEmail, candidates,
}: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  // For 'business': pick BM nodes (each becomes 1 cross-account connection).
  // For 'ad_account': pick individual ad accounts (one connection each).
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const want = candidates.filter((c) => c.type === type);
    if (!q) return want;
    return want.filter((c) =>
      c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [candidates, search, type]);

  const finalizeMutation = useMutation({
    mutationFn: () => {
      const picksList = visible.filter((c) => picked.has(c.id));
      // For 'business' picks, snapshot the ad accounts beneath them so the
      // panel can show "this BM covers N ad accounts".
      let business_children: { ad_account_id: string; name: string; currency_code: string; time_zone: string; account_status?: string }[] | undefined;
      if (type === 'business') {
        const bmIds = new Set(picksList.map((p) => p.id));
        business_children = candidates
          .filter((c) => c.type === 'ad_account' && c.business_id && bmIds.has(c.business_id))
          .map((c) => ({
            ad_account_id: c.id,
            name: c.name,
            currency_code: c.currency_code,
            time_zone: c.time_zone,
            account_status: c.account_status,
          }));
      }
      return facebookAdsApi.finalize({
        grant_token: grantToken,
        picks: picksList.map((c) => ({
          type: c.type,
          id: c.id,
          business_id: c.business_id,
          name: c.name,
          currency_code: c.currency_code,
          time_zone: c.time_zone,
          account_status: c.account_status,
        })),
        business_children,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-connections'] });
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

  const guidance = type === 'business'
    ? 'Pick the **Business Manager(s)** you want to enable cross-account CAPI forwarding under. Conversions fire to the BM-level pixel — Meta attributes them to whichever ad account ran the ad. No per-offer mapping needed.'
    : 'Pick the **ad accounts** you want to forward conversions into individually. Each pick becomes its own connection. You will set per-offer / per-network mappings on the Offer and Postback pages.';

  return (
    <Modal
      open={open}
      onClose={() => !finalizeMutation.isPending && onClose()}
      size="lg"
      title={type === 'business' ? 'Connect Facebook Business Manager' : 'Connect Facebook ad accounts'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={finalizeMutation.isPending}>Cancel</Button>
          <Button
            onClick={() => finalizeMutation.mutate()}
            disabled={finalizeMutation.isPending || picked.size === 0}
          >
            {finalizeMutation.isPending && <Spinner />}
            {type === 'business'
              ? `Connect BM ${picked.size > 0 ? `(${picked.size})` : ''}`
              : `Connect ${picked.size} ${picked.size === 1 ? 'account' : 'accounts'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-brand-50/60 px-3 py-2 text-sm text-brand-900 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30">
          {guidance.split('**').map((part, i) =>
            i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-neutral-400">
          Authenticated as <strong className="text-slate-700 dark:text-neutral-200">{metaUserEmail || '(no email)'}</strong>.
        </p>

        <Input
          placeholder="Filter by name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200 dark:border-neutral-800">
          {visible.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-neutral-400">
              {type === 'business'
                ? 'No Business Managers visible to this Facebook login. Switch to "Connect Facebook ad account" if you want to connect personal ad accounts directly.'
                : 'No ad accounts visible to this Facebook login.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
              {visible.map((c) => {
                const checked = picked.has(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(c.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-neutral-600 dark:bg-neutral-900"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-neutral-100">
                            {c.name || 'Unnamed account'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-neutral-400">
                            <code className="font-mono">{c.id}</code>
                            {c.business_id && c.business_id !== c.id && (
                              <> · under BM <code className="font-mono">{c.business_id}</code></>
                            )}
                            {c.currency_code && <> · {c.currency_code}</>}
                            {c.time_zone && <> · {c.time_zone}</>}
                            {c.account_status && <> · status {c.account_status}</>}
                          </div>
                        </div>
                      </div>
                      {c.type === 'business' && <Badge tone="amber">BM</Badge>}
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
