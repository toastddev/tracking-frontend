import { api, apiDownload } from '@/lib/api';

const BASE = '/api/integrations/ga4';

export interface Ga4LinkedStream {
  measurement_id: string;
  connection_id: string;
  account_name?: string;
  property_id: string;
  property_name?: string;
  stream_id: string;
  stream_name?: string;
  default_uri?: string;
  currency_code?: string;
  time_zone?: string;
  /** GA4 counterpart of the Google Ads sale conversion action. */
  sale_event_name: string;
  /** GA4 counterpart of the Google Ads click conversion action; unset = clicks not uploaded. */
  click_event_name?: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export type Ga4UploadKind = 'conversion' | 'click';
export type Ga4UploadStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface Ga4Upload {
  upload_id: string;
  kind: Ga4UploadKind;
  source_id: string;
  conversion_id?: string;
  click_id?: string;
  measurement_id?: string;
  identifier_value?: string;
  session_id?: string;
  event_name?: string;
  transaction_id?: string;
  value?: number;
  currency?: string;
  event_time?: string;
  status: Ga4UploadStatus;
  attempts: number;
  last_error?: string;
  skip_reason?: string;
  sent_at?: string;
  created_at?: string;
}

export interface Ga4Settings {
  audit_enabled: boolean;
  updated_at: string | null;
}

export interface Ga4Connection {
  connection_id: string;
  google_user_email: string;
  status: 'active' | 'error';
  last_error?: string;
  created_at?: string;
  updated_at?: string;
  streams: Ga4LinkedStream[];
}

export interface Ga4StreamOption {
  measurement_id: string;
  account_name: string;
  property_id: string;
  property_name: string;
  stream_id: string;
  stream_name: string;
  default_uri?: string;
  linked: boolean;
  linked_connection_id?: string;
  enabled: boolean;
}

export const ga4Api = {
  oauthStart() {
    return api<{ auth_url: string }>(`${BASE}/oauth/start`, { method: 'POST', body: {} });
  },

  oauthExchange(code: string, state: string) {
    return api<{ connection: Omit<Ga4Connection, 'streams'> }>(`${BASE}/oauth/exchange`, {
      method: 'POST',
      body: { code, state },
    });
  },

  getSettings() {
    return api<Ga4Settings>(`${BASE}/settings`);
  },

  updateSettings(patch: { audit_enabled: boolean }) {
    return api<Ga4Settings>(`${BASE}/settings`, { method: 'PATCH', body: patch });
  },

  listUploads(params: {
    kind?: Ga4UploadKind;
    status?: Ga4UploadStatus;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }) {
    return api<{ items: Ga4Upload[]; next_cursor: string | null; audit_enabled: boolean }>(
      `${BASE}/uploads/list`,
      { query: { ...params } },
    );
  },

  listConnections() {
    return api<{ items: Ga4Connection[] }>(`${BASE}/connections`);
  },

  deleteConnection(id: string) {
    return api<{ ok: true }>(`${BASE}/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  listStreams(connectionId: string) {
    return api<{ items: Ga4StreamOption[] }>(`${BASE}/connections/${encodeURIComponent(connectionId)}/streams`);
  },

  linkStream(connectionId: string, measurementId: string) {
    return api<{ stream: Ga4LinkedStream; secret_created: boolean }>(
      `${BASE}/connections/${encodeURIComponent(connectionId)}/streams`,
      { method: 'POST', body: { measurement_id: measurementId, acknowledge_user_data_collection: true } },
    );
  },

  updateStream(
    measurementId: string,
    patch: { enabled?: boolean; sale_event_name?: string; click_event_name?: string },
  ) {
    return api<{ stream: Ga4LinkedStream }>(`${BASE}/streams/${encodeURIComponent(measurementId)}`, {
      method: 'PATCH',
      body: patch,
    });
  },

  retryUpload(conversionId: string) {
    return api<{ ok: true }>(`${BASE}/uploads/${encodeURIComponent(conversionId)}/retry`, {
      method: 'POST',
      body: {},
    });
  },

  // Same contract as googleAdsApi.exportUploadsCsv.
  async exportUploadsCsv(params: {
    from: string;
    to: string;
    kind?: Ga4UploadKind;
    status?: Ga4UploadStatus;
  }): Promise<{ blob: Blob; filename: string; rowCount: number; truncated: boolean }> {
    const res = await apiDownload(`${BASE}/uploads/export`, {
      query: { from: params.from, to: params.to, kind: params.kind, status: params.status },
    });
    const blob = await res.blob();
    const match = /filename="?([^"]+)"?/.exec(res.headers.get('content-disposition') ?? '');
    return {
      blob,
      filename: match?.[1] ?? `ga4_uploads_${Date.now()}.csv`,
      rowCount: Number(res.headers.get('x-row-count') ?? 0),
      truncated: res.headers.get('x-export-truncated') === '1',
    };
  },

  unlinkStream(measurementId: string) {
    return api<{ ok: true }>(`${BASE}/streams/${encodeURIComponent(measurementId)}`, { method: 'DELETE' });
  },

  testStream(measurementId: string) {
    return api<{ ok: boolean; messages: string[] }>(`${BASE}/streams/${encodeURIComponent(measurementId)}/test`, {
      method: 'POST',
      body: {},
    });
  },
};

export function ga4ErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'body' in err) {
    const body = (err as { body?: { message?: string; error?: string } }).body;
    if (body?.message) return `${body.error ?? 'error'}: ${body.message}`;
    if (body?.error) return body.error;
  }
  return err instanceof Error ? err.message : 'request_failed';
}
