import { api } from '@/lib/api';
import type {
  AffiliateApi,
  AffiliateApiAuthType,
  AffiliateApiIncremental,
  AffiliateApiKind,
  AffiliateApiMapping,
  AffiliateApiPagination,
  AffiliateApiRequestConfig,
  AffiliateApiResponseFormat,
  AffiliateApiRunRecord,
  AffiliateApiSchedule,
  Page,
  Status,
} from '@/types';

// Upsert payload — `auth.value` is the *plaintext* secret. Only sent when
// the user enters/changes it, never echoed back from the server.
export interface AffiliateApiAuthPayload {
  type: AffiliateApiAuthType;
  in?: 'header' | 'query';
  key_name?: string;
  username?: string;
  value?: string;          // plaintext (write-only); omit to keep existing
  clear_secret?: boolean;  // set to true to wipe the stored secret
}

export interface AffiliateApiUpsert {
  api_id?: string;
  name: string;
  status?: Status;
  kind: AffiliateApiKind;
  response_format?: AffiliateApiResponseFormat;
  base_url: string;
  network_id?: string;
  auth: AffiliateApiAuthPayload;
  request: AffiliateApiRequestConfig;
  pagination: AffiliateApiPagination;
  incremental: AffiliateApiIncremental;
  mapping: AffiliateApiMapping;
  schedule: Pick<AffiliateApiSchedule, 'enabled' | 'runs_per_day'>;
  timeout_ms?: number;
  max_records_per_run?: number;
}

export const affiliateApisApi = {
  list(params: { q?: string; cursor?: string | null; limit?: number } = {}) {
    return api<Page<AffiliateApi>>('/api/affiliate-apis', {
      query: { q: params.q, cursor: params.cursor ?? undefined, limit: params.limit },
    });
  },
  get(id: string) {
    return api<AffiliateApi>(`/api/affiliate-apis/${encodeURIComponent(id)}`);
  },
  create(payload: AffiliateApiUpsert & { api_id: string }) {
    return api<AffiliateApi>('/api/affiliate-apis', { method: 'POST', body: payload });
  },
  update(id: string, patch: Partial<AffiliateApiUpsert>) {
    return api<AffiliateApi>(`/api/affiliate-apis/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
  },
  delete(id: string) {
    return api<{ ok: true }>(`/api/affiliate-apis/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  runNow(id: string) {
    return api<{ ok: true; run_id: string }>(`/api/affiliate-apis/${encodeURIComponent(id)}/run`, { method: 'POST' });
  },
  forceUnlock(id: string) {
    return api<{ ok: true }>(`/api/affiliate-apis/${encodeURIComponent(id)}/unlock`, { method: 'POST' });
  },
  testRun(id: string) {
    return api<{ ok: true; run: AffiliateApiRunRecord }>(`/api/affiliate-apis/${encodeURIComponent(id)}/test`, { method: 'POST' });
  },
  runs(id: string, limit = 25) {
    return api<{ items: AffiliateApiRunRecord[] }>(
      `/api/affiliate-apis/${encodeURIComponent(id)}/runs`,
      { query: { limit } }
    );
  },
};
