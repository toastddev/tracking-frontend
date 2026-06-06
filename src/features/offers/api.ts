import { api } from '@/lib/api';
import type { Offer, Page, ClickRecord, CampaignSearchResult } from '@/types';

export interface ListParams {
  q?: string;
  cursor?: string | null;
  limit?: number;
}

export interface OfferLinkagePayload {
  traffic_source?: 'google' | 'facebook' | null;
  linked_campaign_id?: string | null;
  link_type?: 'direct' | 'normal' | null;
}

export const offersApi = {
  list(params: ListParams = {}) {
    return api<Page<Offer>>('/api/offers', {
      query: { q: params.q, cursor: params.cursor ?? undefined, limit: params.limit },
    });
  },
  get(id: string) {
    return api<Offer>(`/api/offers/${encodeURIComponent(id)}`);
  },
  create(payload: {
    offer_id: string;
    name: string;
    base_url: string;
    status?: 'active' | 'paused';
    default_params?: Record<string, string>;
    traffic_source?: 'google' | 'facebook';
    linked_campaign_id?: string;
    link_type?: 'direct' | 'normal';
  }) {
    return api<Offer>('/api/offers', { method: 'POST', body: payload });
  },
  update(
    id: string,
    patch: Partial<Omit<Offer, 'offer_id' | 'created_at' | 'updated_at' | 'tracking_url' | 'traffic_source' | 'linked_campaign_id' | 'link_type'>> & OfferLinkagePayload,
  ) {
    return api<Offer>(`/api/offers/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
  },
  delete(id: string) {
    return api<{ ok: true }>(`/api/offers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  clicks(offerId: string, params: { cursor?: string | null; limit?: number; from?: string; to?: string } = {}) {
    return api<Page<ClickRecord>>('/api/clicks', {
      query: { offer_id: offerId, cursor: params.cursor ?? undefined, limit: params.limit, from: params.from, to: params.to },
    });
  },
  searchCampaigns(params: { source: 'google' | 'facebook'; q?: string; limit?: number }) {
    return api<{ items: CampaignSearchResult[] }>('/api/campaigns/search', {
      query: { source: params.source, q: params.q, limit: params.limit },
    });
  },
};
