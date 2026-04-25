import { api } from '@/lib/api';
import type { Offer, Page, ClickRecord } from '@/types';

export interface ListParams {
  q?: string;
  cursor?: string | null;
  limit?: number;
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
  }) {
    return api<Offer>('/api/offers', { method: 'POST', body: payload });
  },
  update(id: string, patch: Partial<Omit<Offer, 'offer_id' | 'created_at' | 'updated_at' | 'tracking_url'>>) {
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
};
