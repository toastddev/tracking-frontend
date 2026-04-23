import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
}

const empty: FormState = {
  network_id: '', name: '', status: 'active',
  mapping_click_id: 'click_id', mapping_payout: '', mapping_currency: '',
  mapping_status: '', mapping_txn_id: '', mapping_timestamp: '', default_status: 'approved',
};

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
      });
    } else {
      setForm(empty);
    }
  }, [open, initial]);

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
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
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100">
            Postback created. Configure this URL in your network's dashboard.
          </div>
          <div>
            <label className="label">Postback URL</label>
            <div className="flex items-center gap-2">
              <Input readOnly value={created.postback_url ?? ''} className="font-mono text-xs" />
              <CopyButton value={created.postback_url ?? ''} />
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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

          <div className="rounded-md bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Parameter mapping</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Each value is the parameter name the network will <em>actually send</em>. The backend uses these to
              extract the canonical fields.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4">
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
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
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
