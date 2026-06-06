import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
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

type TrafficSource = 'google' | 'facebook' | '';
type LinkType = 'direct' | 'normal' | '';

export function OfferFormModal({ open, onClose, initial }: Props) {
  const editing = !!initial;
  const qc = useQueryClient();
  const [offerId, setOfferId] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [defaultParamsText, setDefaultParamsText] = useState('');
  // Linkage state — kept as '' to represent "unset". Submit converts '' → null
  // on update (clears the field) or omits the field on create.
  const [trafficSource, setTrafficSource] = useState<TrafficSource>('');
  const [linkedCampaignId, setLinkedCampaignId] = useState('');
  const [linkedCampaignName, setLinkedCampaignName] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);
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
      setTrafficSource((initial.traffic_source as TrafficSource) ?? '');
      setLinkedCampaignId(initial.linked_campaign_id ?? '');
      setLinkedCampaignName('');
      setLinkType((initial.link_type as LinkType) ?? '');
    } else {
      setOfferId('');
      setName('');
      setBaseUrl('');
      setStatus('active');
      setDefaultParamsText('');
      setTrafficSource('');
      setLinkedCampaignId('');
      setLinkedCampaignName('');
      setLinkType('');
    }
    setCampaignQuery('');
    setCampaignPickerOpen(false);
  }, [open, initial]);

  // Debounced live search for the campaign picker. Only enabled once a source
  // is chosen so we don't fire useless lookups while the form is half-filled.
  const debouncedQuery = useDebounced(campaignQuery, 200);
  const campaignSearch = useQuery({
    queryKey: ['campaign-search', trafficSource, debouncedQuery],
    queryFn: () =>
      offersApi.searchCampaigns({
        source: trafficSource as 'google' | 'facebook',
        q: debouncedQuery || undefined,
        limit: 25,
      }),
    enabled: open && campaignPickerOpen && (trafficSource === 'google' || trafficSource === 'facebook'),
    staleTime: 30_000,
  });

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
        // Send all three linkage fields every time so the operator can clear
        // a previously-set link by emptying the picker. '' → null erases it
        // server-side; a set value writes through.
        return offersApi.update(initial!.offer_id, {
          name,
          base_url: baseUrl,
          status,
          default_params,
          traffic_source: trafficSource === '' ? null : trafficSource,
          linked_campaign_id: linkedCampaignId === '' ? null : linkedCampaignId,
          link_type: linkType === '' ? null : linkType,
        });
      }
      if (!SLUG_RE.test(offerId)) throw new Error('Offer id must be lowercase letters/digits/_- (2-64 chars)');
      return offersApi.create({
        offer_id: offerId,
        name,
        base_url: baseUrl,
        status,
        default_params,
        ...(trafficSource ? { traffic_source: trafficSource } : {}),
        ...(linkedCampaignId ? { linked_campaign_id: linkedCampaignId } : {}),
        ...(linkType ? { link_type: linkType } : {}),
      });
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

  function pickCampaign(c: { campaign_id: string; campaign_name?: string }) {
    setLinkedCampaignId(c.campaign_id);
    setLinkedCampaignName(c.campaign_name ?? '');
    setCampaignPickerOpen(false);
    setCampaignQuery('');
  }

  function clearCampaign() {
    setLinkedCampaignId('');
    setLinkedCampaignName('');
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
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30">
            Offer created. You can copy the tracking URL below.
          </div>
          <div>
            <label className="label">Tracking URL</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                readOnly
                value={created.tracking_url ?? ''}
                className="font-mono text-xs"
              />
              <CopyButton
                value={created.tracking_url ?? ''}
                className="self-start sm:self-auto"
              />
            </div>
            <p className="hint">
              Affiliates can also append <code>?s1=…&amp;gclid=…</code> sub-params and ad-platform IDs.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {/* Linkage — for ease only, doesn't change attribution */}
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900/40">
            <div className="mb-2 flex items-baseline justify-between">
              <div className="text-sm font-medium text-slate-700 dark:text-neutral-200">Campaign linkage</div>
              <div className="text-xs text-slate-500 dark:text-neutral-400">organisational · doesn't affect attribution</div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="traffic_source">Traffic source</label>
                <Select
                  id="traffic_source"
                  value={trafficSource}
                  onChange={(e) => {
                    const next = e.target.value as TrafficSource;
                    setTrafficSource(next);
                    // Drop any previously picked campaign when the source
                    // changes — campaigns are filtered by source so the
                    // existing choice is no longer valid.
                    if (next !== trafficSource) clearCampaign();
                  }}
                >
                  <option value="">— none —</option>
                  <option value="google">Google Ads</option>
                  <option value="facebook">Facebook</option>
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="link_type">Link type</label>
                <Select
                  id="link_type"
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value as LinkType)}
                >
                  <option value="">— none —</option>
                  <option value="direct">Direct</option>
                  <option value="normal">Normal</option>
                </Select>
              </div>
              <div>
                <label className="label">Linked campaign</label>
                {linkedCampaignId ? (
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800">
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-slate-900 dark:text-neutral-100">
                        {linkedCampaignName || linkedCampaignId}
                      </span>
                      {linkedCampaignName && (
                        <span className="ml-1 text-xs text-slate-500 dark:text-neutral-400">
                          ({linkedCampaignId})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearCampaign}
                      className="text-slate-400 hover:text-slate-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                      title="Unlink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setCampaignPickerOpen(true)}
                    disabled={!trafficSource}
                    className="w-full justify-start"
                  >
                    <Search className="h-3.5 w-3.5" />
                    {trafficSource ? 'Choose a campaign…' : 'Pick a source first'}
                  </Button>
                )}
              </div>
            </div>
            {campaignPickerOpen && (trafficSource === 'google' || trafficSource === 'facebook') && (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-800">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
                  <Input
                    autoFocus
                    value={campaignQuery}
                    onChange={(e) => setCampaignQuery(e.target.value)}
                    placeholder={`Search ${trafficSource === 'google' ? 'Google Ads' : 'Facebook'} campaigns…`}
                    className="pl-8"
                  />
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto">
                  {campaignSearch.isLoading ? (
                    <div className="flex items-center justify-center px-2 py-4">
                      <Spinner className="text-slate-400 dark:text-neutral-500" />
                    </div>
                  ) : campaignSearch.data && campaignSearch.data.items.length === 0 ? (
                    <div className="px-2 py-3 text-center text-sm text-slate-500 dark:text-neutral-400">
                      No campaigns match.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-neutral-700">
                      {campaignSearch.data?.items.map((c) => (
                        <li key={c.campaign_id}>
                          <button
                            type="button"
                            onClick={() => pickCampaign(c)}
                            className="block w-full px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-neutral-700/50"
                          >
                            <div className="font-medium text-slate-900 dark:text-neutral-100">
                              {c.campaign_name || c.campaign_id}
                            </div>
                            {c.campaign_name && (
                              <div className="text-xs text-slate-500 dark:text-neutral-400">{c.campaign_id}</div>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCampaignPickerOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
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

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
