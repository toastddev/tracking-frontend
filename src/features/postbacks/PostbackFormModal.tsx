import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { CopyButton } from '@/components/ui/CopyButton';
import { ApiError } from '@/lib/api';
import { networksApi } from './api';
import type { Network } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Network | null;
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const CANONICAL_RE = /^[a-z][a-z0-9_]{0,31}$/;

// Canonical names used by the built-in fields. Extra mappings cannot collide.
const RESERVED_CANONICALS = new Set([
  'click_id', 'payout', 'currency', 'status', 'transaction_id', 'event_time',
]);

interface ExtraRow {
  id: string;
  canonical: string;
  param: string;
}

interface FormState {
  network_id: string;
  name: string;
  status: 'active' | 'paused';
  mapping_click_id: string;
  mapping_payout: string;
  mapping_currency: string;
  mapping_status: string;
  mapping_txn_id: string;
  mapping_timestamp: string;
  default_status: string;
  extras: ExtraRow[];
}

const empty: FormState = {
  network_id: '', name: '', status: 'active',
  mapping_click_id: 'click_id', mapping_payout: '', mapping_currency: '',
  mapping_status: '', mapping_txn_id: '', mapping_timestamp: '', default_status: 'approved',
  extras: [],
};

function extrasFromNetwork(n?: Network | null): ExtraRow[] {
  if (!n?.extra_mappings) return [];
  return Object.entries(n.extra_mappings).map(([canonical, param], i) => ({
    id: `init-${i}`,
    canonical,
    param,
  }));
}

function genRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PostbackFormModal({ open, onClose, initial }: Props) {
  const editing = !!initial;
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Network | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCreated(null);
    if (initial) {
      setForm({
        network_id: initial.network_id,
        name: initial.name ?? '',
        status: initial.status ?? 'active',
        mapping_click_id: initial.mapping_click_id ?? 'click_id',
        mapping_payout: initial.mapping_payout ?? '',
        mapping_currency: initial.mapping_currency ?? '',
        mapping_status: initial.mapping_status ?? '',
        mapping_txn_id: initial.mapping_txn_id ?? '',
        mapping_timestamp: initial.mapping_timestamp ?? '',
        default_status: initial.default_status ?? 'approved',
        extras: extrasFromNetwork(initial),
      });
    } else {
      setForm(empty);
    }
  }, [open, initial]);

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const addExtra = () =>
    setForm((f) => ({ ...f, extras: [...f.extras, { id: genRowId(), canonical: '', param: '' }] }));

  const removeExtra = (id: string) =>
    setForm((f) => ({ ...f, extras: f.extras.filter((r) => r.id !== id) }));

  const updateExtra = (id: string, patch: Partial<Omit<ExtraRow, 'id'>>) =>
    setForm((f) => ({
      ...f,
      extras: f.extras.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

  const validateExtras = (): { ok: true; value: Record<string, string> } | { ok: false; reason: string } => {
    const out: Record<string, string> = {};
    const seenParams = new Set<string>();
    for (const row of form.extras) {
      const canonical = row.canonical.trim().toLowerCase();
      const param = row.param.trim();
      if (!canonical && !param) continue; // allow empty trailing rows
      if (!canonical || !param) {
        return { ok: false, reason: 'Each custom field needs both a canonical name and a parameter name.' };
      }
      if (!CANONICAL_RE.test(canonical)) {
        return { ok: false, reason: `Invalid canonical name "${canonical}": lowercase letters, digits, underscore; must start with a letter.` };
      }
      if (RESERVED_CANONICALS.has(canonical)) {
        return { ok: false, reason: `"${canonical}" is reserved — it's already a built-in field.` };
      }
      if (canonical in out) {
        return { ok: false, reason: `Duplicate canonical name "${canonical}".` };
      }
      const paramLower = param.toLowerCase();
      if (seenParams.has(paramLower)) {
        return { ok: false, reason: `Duplicate parameter name "${param}".` };
      }
      seenParams.add(paramLower);
      out[canonical] = param;
    }
    return { ok: true, value: out };
  };

  const mutation = useMutation({
    mutationFn: () => {
      const extras = validateExtras();
      if (!extras.ok) throw new Error(extras.reason);

      const payload = {
        name: form.name.trim(),
        status: form.status,
        mapping_click_id: form.mapping_click_id.trim(),
        mapping_payout: form.mapping_payout.trim() || undefined,
        mapping_currency: form.mapping_currency.trim() || undefined,
        mapping_status: form.mapping_status.trim() || undefined,
        mapping_txn_id: form.mapping_txn_id.trim() || undefined,
        mapping_timestamp: form.mapping_timestamp.trim() || undefined,
        default_status: form.default_status.trim() || undefined,
        extra_mappings: extras.value,
      };
      if (editing) return networksApi.update(initial!.network_id, payload);
      if (!SLUG_RE.test(form.network_id)) {
        throw new Error('Network id must be lowercase letters/digits/_- (2-64 chars)');
      }
      return networksApi.create({ network_id: form.network_id.trim(), ...payload });
    },
    onSuccess: (network) => {
      qc.invalidateQueries({ queryKey: ['networks'] });
      qc.invalidateQueries({ queryKey: ['network', network.network_id] });
      if (editing) onClose();
      else setCreated(network);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.code ?? err.message);
      else if (err instanceof Error) setError(err.message);
      else setError('Something went wrong');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  const extraCanonicalConflicts = useMemo(() => {
    const s = new Set<string>();
    for (const r of form.extras) {
      const c = r.canonical.trim().toLowerCase();
      if (c && RESERVED_CANONICALS.has(c)) s.add(r.id);
    }
    return s;
  }, [form.extras]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit postback · ${initial?.name}` : 'Create postback'}
      size="lg"
      footer={
        created ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
            <Button onClick={onSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create postback'}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30">
            Postback created. Configure this URL in your network's dashboard.
          </div>
          <div>
            <label className="label">Postback URL</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input readOnly value={created.postback_url ?? ''} className="font-mono text-xs" />
              <CopyButton value={created.postback_url ?? ''} className="self-start sm:self-auto" />
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Network ID (slug)</label>
              <Input
                value={form.network_id}
                onChange={update('network_id')}
                placeholder="kelkoo"
                disabled={editing}
                required
              />
              <p className="hint">Used in the postback URL path.</p>
            </div>
            <div>
              <label className="label">Status</label>
              <Select value={form.status} onChange={update('status')}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="label">Display name</label>
            <Input value={form.name} onChange={update('name')} placeholder="Kelkoo" required />
          </div>

          <div className="rounded-md bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-neutral-950/60 dark:ring-neutral-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Parameter mapping</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
              Each value is the <em>macro</em> this network uses for that field — e.g. Kelkoo{' '}
              <code className="rounded bg-white px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">ClickId</code>, TUNE{' '}
              <code className="rounded bg-white px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">aff_sub</code>. URL parameter names
              (<code className="rounded bg-white px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">click_id</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">payout</code>, …) stay fixed.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Click ID *" value={form.mapping_click_id} onChange={update('mapping_click_id')} placeholder="cid" required />
              <Field label="Payout" value={form.mapping_payout} onChange={update('mapping_payout')} placeholder="revenue" />
              <Field label="Currency" value={form.mapping_currency} onChange={update('mapping_currency')} placeholder="currency" />
              <Field label="Status" value={form.mapping_status} onChange={update('mapping_status')} placeholder="goal" />
              <Field label="Transaction ID" value={form.mapping_txn_id} onChange={update('mapping_txn_id')} placeholder="tx" />
              <Field label="Event timestamp" value={form.mapping_timestamp} onChange={update('mapping_timestamp')} placeholder="ts" />
            </div>
            <div className="mt-3">
              <Field
                label="Default status fallback"
                value={form.default_status}
                onChange={update('default_status')}
                placeholder="approved"
              />
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-neutral-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Custom fields</h4>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
                    Extra URL parameters. Left is the parameter name that appears in the URL;
                    right is the macro the network substitutes.
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addExtra}>
                  <Plus className="h-4 w-4" /> Add field
                </Button>
              </div>

              {form.extras.length > 0 && (
                <div className="mt-3 space-y-2">
                  {form.extras.map((row) => {
                    const conflict = extraCanonicalConflicts.has(row.id);
                    return (
                      <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                        <div>
                          <Input
                            value={row.canonical}
                            onChange={(e) => updateExtra(row.id, { canonical: e.target.value })}
                            placeholder="sub1"
                            aria-label="URL parameter name"
                          />
                          {conflict && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Reserved — built-in field.</p>
                          )}
                        </div>
                        <Input
                          value={row.param}
                          onChange={(e) => updateExtra(row.id, { param: e.target.value })}
                          placeholder="aff_sub1"
                          aria-label="Network macro"
                        />
                        <button
                          type="button"
                          onClick={() => removeExtra(row.id)}
                          className="mt-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                          aria-label="Remove custom field"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-0.5 text-[11px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                    <span>URL parameter</span>
                    <span>Network macro</span>
                    <span className="w-8" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
              {error}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

function Field(
  props: { label: string } & React.InputHTMLAttributes<HTMLInputElement>
) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="label">{label}</label>
      <Input {...rest} />
    </div>
  );
}
