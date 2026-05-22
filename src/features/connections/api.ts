import { api, apiDownload } from '@/lib/api';
import type {
  GoogleAdsCandidate,
  GoogleAdsConnection,
  GoogleAdsConnectionType,
  GoogleAdsConversionAction,
  GoogleAdsMccChild,
  GoogleAdsRoute,
  GoogleAdsRouteScope,
  GoogleAdsUpload,
} from './types';

const BASE = '/api/integrations/google-ads';

export interface ExchangeResponse {
  grant_token: string;
  type: GoogleAdsConnectionType;
  google_user_email: string;
  candidates: GoogleAdsCandidate[];
}

export interface ConnectionDetail {
  connection: GoogleAdsConnection;
  mcc_children?: GoogleAdsMccChild[];
}

export const googleAdsApi = {
  oauthStart(type: GoogleAdsConnectionType) {
    return api<{ auth_url: string; state: string }>(`${BASE}/oauth/start`, {
      method: 'POST',
      body: { type },
    });
  },

  oauthExchange(code: string, state: string) {
    return api<ExchangeResponse>(`${BASE}/oauth/exchange`, {
      method: 'POST',
      body: { code, state },
    });
  },

  finalize(payload: {
    grant_token: string;
    picks: Array<{
      customer_id: string;
      manager_customer_id?: string;
      descriptive_name: string;
      currency_code: string;
      time_zone: string;
      is_manager: boolean;
    }>;
    mcc_children?: Array<{
      customer_id: string;
      descriptive_name: string;
      currency_code: string;
      time_zone: string;
    }>;
  }) {
    return api<{ items: GoogleAdsConnection[] }>(`${BASE}/finalize`, {
      method: 'POST',
      body: payload,
    });
  },

  listConnections() {
    return api<{ items: GoogleAdsConnection[] }>(`${BASE}/connections`);
  },

  getConnection(id: string) {
    return api<ConnectionDetail>(`${BASE}/connections/${encodeURIComponent(id)}`);
  },

  patchConnection(id: string, patch: Partial<Pick<
    GoogleAdsConnection,
    | 'sale_conversion_action_resource'
    | 'sale_conversion_action_name'
    | 'click_conversion_action_resource'
    | 'click_conversion_action_name'
    | 'convert_tz_to_account'
  >>) {
    return api<GoogleAdsConnection>(`${BASE}/connections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    });
  },

  deleteConnection(id: string) {
    return api<{ ok: true }>(`${BASE}/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  refreshMccChildren(id: string) {
    return api<{ mcc_children: GoogleAdsMccChild[] }>(`${BASE}/connections/${encodeURIComponent(id)}/mcc-children/refresh`, { method: 'POST' });
  },

  listConversionActions(connection_id: string, opts: { refresh?: boolean } = {}) {
    return api<{ items: GoogleAdsConversionAction[] }>(
      `${BASE}/connections/${encodeURIComponent(connection_id)}/conversion-actions`,
      { query: { refresh: opts.refresh ? 'true' : undefined } }
    );
  },

  getRoute(scope_type: GoogleAdsRouteScope, scope_id: string) {
    return api<{ route: GoogleAdsRoute | null }>(`${BASE}/routes`, {
      query: { scope_type, scope_id },
    });
  },

  upsertRoute(payload: {
    scope_type: GoogleAdsRouteScope;
    scope_id: string;
    target_connection_id: string;
    sale_conversion_action_resource?: string;
    sale_conversion_action_name?: string;
    click_conversion_action_resource?: string;
    click_conversion_action_name?: string;
    enabled?: boolean;
  }) {
    return api<GoogleAdsRoute>(`${BASE}/routes`, { method: 'POST', body: payload });
  },

  deleteRoute(route_id: string) {
    return api<{ ok: true }>(`${BASE}/routes/${encodeURIComponent(route_id)}`, { method: 'DELETE' });
  },

  listUploadsForSource(source_id: string) {
    return api<{ items: GoogleAdsUpload[] }>(`${BASE}/uploads`, { query: { source_id } });
  },

  retryUpload(conversion_id: string) {
    return api<{ ok: true }>(`${BASE}/uploads/${encodeURIComponent(conversion_id)}/retry`, { method: 'POST' });
  },

  // CSV export of the GAds upload audit trail in a date range. Optional
  // kind ('conversion' | 'click') and status filters narrow the scan before
  // the response is built. Returns the raw blob plus the parsed row count /
  // truncation flag — same shape as clicksApi.exportCsv so the campaigns
  // page can reuse the existing download-card UX.
  async exportUploadsCsv(params: {
    from: string;
    to: string;
    kind?: 'conversion' | 'click';
    status?: 'pending' | 'sent' | 'partial_failure' | 'failed' | 'skipped';
  }): Promise<{
    blob: Blob;
    filename: string;
    rowCount: number;
    truncated: boolean;
  }> {
    const res = await apiDownload(`${BASE}/uploads/export`, {
      query: {
        from: params.from,
        to: params.to,
        kind: params.kind,
        status: params.status,
      },
    });
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const filename = match?.[1] ?? `gads_uploads_${Date.now()}.csv`;
    return {
      blob,
      filename,
      rowCount: Number(res.headers.get('x-row-count') ?? 0),
      truncated: res.headers.get('x-export-truncated') === '1',
    };
  },
};
