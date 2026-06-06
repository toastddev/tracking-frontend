import { api, apiDownload } from '@/lib/api';
import type {
  FacebookCandidate,
  FacebookConnection,
  FacebookConnectionType,
  FacebookCustomEvent,
  FacebookDataset,
  FacebookBusinessChild,
  FacebookRoute,
  FacebookRouteScope,
  FacebookSyncState,
  FacebookUpload,
} from './types';

const BASE = '/api/integrations/facebook';

export interface FbExchangeResponse {
  grant_token: string;
  type: FacebookConnectionType;
  meta_user_email: string;
  access_token_expires_at?: string;
  candidates: FacebookCandidate[];
}

export interface FbConnectionDetail {
  connection: FacebookConnection;
  business_children?: FacebookBusinessChild[];
}

export const facebookAdsApi = {
  oauthStart(type: FacebookConnectionType) {
    return api<{ auth_url: string; state: string }>(`${BASE}/oauth/start`, {
      method: 'POST',
      body: { type },
    });
  },

  oauthExchange(code: string, state: string) {
    return api<FbExchangeResponse>(`${BASE}/oauth/exchange`, {
      method: 'POST',
      body: { code, state },
    });
  },

  // Server-side OAuth callback flow: the backend already exchanged Meta's
  // code → tokens at the public /oauth/facebook/callback route and stashed
  // the result in a Firestore session. The frontend (now back on a normal
  // in-app page with auth intact) calls this to fetch the candidates +
  // grant_token and continue the modal flow.
  consumeOauthSession(session_id: string) {
    return api<FbExchangeResponse>(`${BASE}/oauth/consume-session/${encodeURIComponent(session_id)}`);
  },

  finalize(payload: {
    grant_token: string;
    picks: Array<{
      type: FacebookConnectionType;
      id: string;
      business_id?: string;
      name: string;
      currency_code: string;
      time_zone: string;
      account_status?: string;
    }>;
    business_children?: Array<{
      ad_account_id: string;
      name: string;
      currency_code: string;
      time_zone: string;
      account_status?: string;
    }>;
  }) {
    return api<{ items: FacebookConnection[] }>(`${BASE}/finalize`, {
      method: 'POST',
      body: payload,
    });
  },

  listConnections() {
    return api<{ items: FacebookConnection[] }>(`${BASE}/connections`);
  },

  getConnection(id: string) {
    return api<FbConnectionDetail>(`${BASE}/connections/${encodeURIComponent(id)}`);
  },

  patchConnection(id: string, patch: Partial<Pick<
    FacebookConnection,
    | 'dataset_id'
    | 'dataset_name'
    | 'sale_event_name'
    | 'sale_event_dataset_id'
    | 'click_event_name'
    | 'click_event_dataset_id'
  >>) {
    return api<FacebookConnection>(`${BASE}/connections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    });
  },

  deleteConnection(id: string) {
    return api<{ ok: true }>(`${BASE}/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  refreshBusinessChildren(id: string) {
    return api<{ business_children: FacebookBusinessChild[] }>(
      `${BASE}/connections/${encodeURIComponent(id)}/business-children/refresh`,
      { method: 'POST' }
    );
  },

  listDatasets(connection_id: string, opts: { refresh?: boolean } = {}) {
    return api<{ items: FacebookDataset[] }>(
      `${BASE}/connections/${encodeURIComponent(connection_id)}/datasets`,
      { query: { refresh: opts.refresh ? 'true' : undefined } }
    );
  },

  listCustomEvents(connection_id: string, opts: { dataset_id?: string; refresh?: boolean } = {}) {
    return api<{ items: FacebookCustomEvent[] }>(
      `${BASE}/connections/${encodeURIComponent(connection_id)}/custom-events`,
      {
        query: {
          dataset_id: opts.dataset_id,
          refresh: opts.refresh ? 'true' : undefined,
        },
      }
    );
  },

  getRoute(scope_type: FacebookRouteScope, scope_id: string) {
    return api<{ route: FacebookRoute | null }>(`${BASE}/routes`, {
      query: { scope_type, scope_id },
    });
  },

  upsertRoute(payload: {
    scope_type: FacebookRouteScope;
    scope_id: string;
    target_connection_id: string;
    sale_event_name?: string;
    sale_event_dataset_id?: string;
    click_event_name?: string;
    click_event_dataset_id?: string;
    enabled?: boolean;
  }) {
    return api<FacebookRoute>(`${BASE}/routes`, { method: 'POST', body: payload });
  },

  deleteRoute(route_id: string) {
    return api<{ ok: true }>(`${BASE}/routes/${encodeURIComponent(route_id)}`, { method: 'DELETE' });
  },

  listUploadsForSource(source_id: string) {
    return api<{ items: FacebookUpload[] }>(`${BASE}/uploads`, { query: { source_id } });
  },

  retryUpload(conversion_id: string) {
    return api<{ ok: true }>(`${BASE}/uploads/${encodeURIComponent(conversion_id)}/retry`, { method: 'POST' });
  },

  async exportUploadsCsv(params: {
    from: string;
    to: string;
    kind?: 'conversion' | 'click';
    status?: 'pending' | 'sent' | 'partial_failure' | 'failed' | 'skipped';
  }): Promise<{ blob: Blob; filename: string; rowCount: number; truncated: boolean }> {
    const res = await apiDownload(`${BASE}/uploads/export`, {
      query: { from: params.from, to: params.to, kind: params.kind, status: params.status },
    });
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const filename = match?.[1] ?? `fb_uploads_${Date.now()}.csv`;
    return {
      blob,
      filename,
      rowCount: Number(res.headers.get('x-row-count') ?? 0),
      truncated: res.headers.get('x-export-truncated') === '1',
    };
  },

  // Sync (manual trigger from FB Campaigns toolbar)
  sync(from: string, to: string) {
    return api<{
      ok: true;
      from: string;
      to: string;
      campaigns_updated: number;
      total_spend_inr: number;
      total_clicks: number;
      total_impressions: number;
      duration_ms: number;
    }>(`${BASE}/sync`, { method: 'POST', body: { from, to } });
  },

  getSyncState() {
    return api<FacebookSyncState>(`${BASE}/sync/state`);
  },

  saveSyncPrefs(from: string, to: string) {
    return api<FacebookSyncState>(`${BASE}/sync/prefs`, { method: 'POST', body: { from, to } });
  },
};

// ── FB Campaign Reports (dashboard API) ────────────────────────────
export interface FbCampaignDailyPoint {
  date: string;
  clicks: number;
  postbacks: number;
  conversions: number;
  revenue: number;
  spend: number;
  profit: number;
  fb_clicks: number;
  fb_impressions: number;
  fb_ctr: number;
  fb_cpc: number;
}

export interface FbCampaignReportSummary {
  campaign_id: string;
  campaign_name?: string;
  source: string;
  clicks: number;
  postbacks: number;
  conversions: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
  revenue_usd: number;
  spend: number;
  profit: number;
  cvr: number;
  epc: number;
  cpc: number;
  cpa: number;
  roas: number;
  roi: number;
  approval_rate: number;
  spend_coverage: number;
  offers: string[];
  fb_clicks: number;
  fb_impressions: number;
  fb_ctr: number;
  fb_cpc: number;
  series: FbCampaignDailyPoint[];
}

export interface FbCampaignInsight {
  severity: 'info' | 'success' | 'warn' | 'critical';
  title: string;
  detail: string;
  campaign_id?: string;
}

export interface FbCampaignDailyTotal {
  date: string;
  total_revenue_inr: number | null;
}

export interface FbCampaignReportsResponse {
  from: string;
  to: string;
  campaigns: FbCampaignReportSummary[];
  totals: {
    clicks: number;
    postbacks: number;
    conversions: number;
    unverified: number;
    revenue: number;
    spend: number;
    profit: number;
    cvr: number;
    epc: number;
    roas: number;
    roi: number;
    campaigns: number;
    profitable_campaigns: number;
    unprofitable_campaigns: number;
    spend_coverage: number;
    fb_clicks: number;
    fb_impressions: number;
    fb_ctr: number;
    fb_cpc: number;
    total_revenue_inr: number;
  };
  daily_totals: FbCampaignDailyTotal[];
  insights: FbCampaignInsight[];
}

const REPORTS_BASE = '/api/fb-campaign-reports';

export const fbCampaignReportsApi = {
  summary(params: { from: string; to: string; campaign_ids?: string[] }) {
    return api<FbCampaignReportsResponse>(`${REPORTS_BASE}/summary`, {
      query: {
        from: params.from,
        to: params.to,
        campaign_ids: params.campaign_ids?.join(','),
      },
    });
  },
  byCampaign(id: string) {
    return api<{ items: Array<{
      campaign_id: string;
      campaign_name?: string;
      date: string;
      clicks: number;
      postbacks: number;
      conversions: number;
      revenue: number;
      spend: number;
      approved: number;
      pending: number;
      rejected: number;
      offers: string[];
      fb_clicks?: number;
      fb_impressions?: number;
      fb_cpc?: number;
      fb_ctr?: number;
      fb_cpm?: number;
      fb_reach?: number;
    }> }>(`${REPORTS_BASE}/by-campaign/${encodeURIComponent(id)}`);
  },
  setSpend(payload: { campaign_id: string; date: string; spend: number }) {
    return api<{ ok: true }>(`${REPORTS_BASE}/spend`, { method: 'POST', body: payload });
  },
  syncFromReports(from: string, to: string) {
    return api<{
      ok: true;
      from: string;
      to: string;
      campaigns_updated: number;
      total_spend_inr: number;
    }>(`${REPORTS_BASE}/sync`, { method: 'POST', body: { from, to } });
  },
};
