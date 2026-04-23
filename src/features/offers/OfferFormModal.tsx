import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { CopyButton } from '@/components/ui/CopyButton';
import { ApiError } from '@/lib/api';
import { offersApi } from './api';
import type { Offer } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Offer | null;
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;

export function OfferFormModal({ open, onClose, initial }: Props) {
  const editing = !!initial;
  const qc = useQueryClient();
  const [offerId, setOfferId] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [defaultParamsText, setDefaultParamsText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Offer | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCreated(null);
    if (initial) {
      setOfferId(initial.offer_id);
      setName(initial.name ?? '');
      setBaseUrl(initial.base_url ?? '');
      setStatus(initial.status ?? 'active');
      setDefaultParamsText(JSON.stringify(initial.default_params ?? {}, null, 2));
    } else {
      setOfferId('');
      setName('');
      setBaseUrl('');
      setStatus('active');
      setDefaultParamsText('');
    }
  }, [open, initial]);

  const mutation = useMutation({
    mutationFn: async () => {
      let default_params: Record<string, string> | undefined;
      if (defaultParamsText.trim()) {
        try {
          const parsed = JSON.parse(defaultParamsText);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            default_params = parsed as Record<string, string>;
          } else {
            throw new Error('default_params must be a JSON object');
          }
        } catch {
          throw new Error('default_params must be valid JSON object');
        }
      }
      if (editing) {
        return offersApi.update(initial!.offer_id, { name, base_url: baseUrl, status, default_params });
      }
      if (!SLUG_RE.test(offerId)) throw new Error('Offer id must be lowercase letters/digits/_- (2-64 chars)');
      return offersApi.create({ offer_id: offerId, name, base_url: baseUrl, status, default_params });
    },
    onSuccess: (offer) => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      qc.invalidateQueries({ queryKey: ['offer', offer.offer_id] });
      if (editing) onClose();
      else setCreated(offer);
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
      title={editing ? `Edit offer · ${initial?.name}` : 'Create offer'}
      size="lg"
      footer={
        created ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
            <Button onClick={onSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create offer'}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100">
            Offer created successfully. Share the tracking link below with your affiliates.
          </div>
          <div>
            <label className="label">Tracking URL</label>
            <div className="flex items-center gap-2">
              <Input readOnly value={created.tracking_url ?? ''} className="font-mono text-xs" />
              <CopyButton value={created.tracking_url ?? ''} />
            </div>
            <p className="hint">
              Affiliates append <code>?aff_id=THEIR_ID&amp;s1=...&amp;gclid=...</code> when linking.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="offer_id">Offer ID</label>
              <Input
                id="offer_id"
                value={offerId}
                onChange={(e) => setOfferId(e.target.value)}
                placeholder="summer_deal"
                disabled={editing}
                required
              />
              <p className="hint">Used in the tracking URL path. Lowercase, no spaces.</p>
            </div>
            <div>
              <label className="label" htmlFor="status">Status</label>
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="name">Display name</label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Deal" required />
          </div>
          <div>
            <label className="label" htmlFor="base_url">Affiliate destination URL (template)</label>
            <Input
              id="base_url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://network.example/r/abc?cid={click_id}&s1={s1}&gclid={gclid}"
              required
              className="font-mono text-xs"
            />
            <p className="hint">
              Use <code>{'{click_id}'}</code>, <code>{'{aff_id}'}</code>, <code>{'{s1..sN}'}</code>, ad-id tokens
              (<code>{'{gclid}'}</code>, <code>{'{gbraid}'}</code>, etc.) and any keys defined in default params.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="default_params">Default params (JSON, optional)</label>
            <Textarea
              id="default_params"
              value={defaultParamsText}
              onChange={(e) => setDefaultParamsText(e.target.value)}
              placeholder={'{ "utm_source": "internal" }'}
            />
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
