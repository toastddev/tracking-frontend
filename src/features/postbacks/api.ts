import { api } from '@/lib/api';
import type { ConversionRecord, ClickRecord, Network, Page } from '@/types';

export interface ListNetworkParams {
  q?: string;
  cursor?: string | null;
  limit?: number;
}

export interface ListConversionParams {
  cursor?: string | null;
  limit?: number;
  verified?: boolean;
  from?: string; // ISO
  to?: string;   // ISO
}

export interface NetworkUpsert {
  network_id?: string;
  name: string;
  status?: 'active' | 'paused';
  mapping_click_id: string;
  mapping_payout?: string;
  mapping_currency?: string;
  mapping_status?: string;
  mapping_txn_id?: string;
  mapping_timestamp?: string;
  extra_mappings?: Record<string, string>;
  default_status?: string;
}

export const networksApi = {
  list(params: ListNetworkParams = {}) {
    return api<Page<Network>>('/api/networks', {
      query: { q: params.q, cursor: params.cursor ?? undefined, limit: params.limit },
    });
  },
  get(id: string) {
    return api<Network>(`/api/networks/${encodeURIComponent(id)}`);
  },
  create(payload: NetworkUpsert & { network_id: string }) {
    return api<Network>('/api/networks', { method: 'POST', body: payload });
  },
  update(id: string, patch: Partial<NetworkUpsert>) {
    return api<Network>(`/api/networks/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
  },
  delete(id: string) {
    return api<{ ok: true }>(`/api/networks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  conversions(network_id: string, params: ListConversionParams = {}) {
    return api<Page<ConversionRecord>>(`/api/networks/${encodeURIComponent(network_id)}/conversions`, {
      query: {
        cursor: params.cursor ?? undefined,
        limit: params.limit,
        verified: params.verified === undefined ? undefined : String(params.verified),
        from: params.from,
        to: params.to,
      },
    });
  },
};

export const conversionsApi = {
  get(id: string) {
    return api<{ conversion: ConversionRecord; click: ClickRecord | null }>(
      `/api/conversions/${encodeURIComponent(id)}`
    );
  },
};
