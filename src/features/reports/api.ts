import { api } from '@/lib/api';
import type {
  CampaignDetailResponse,
  CampaignReportsResponse,
  ClickRecord,
  ConversionRecord,
  OfferDetailResponse,
  OfferReportsResponse,
  Page,
  PostbackDetailResponse,
  PostbackReportsResponse,
  RefreshRun,
  RefreshStartResponse,
  RefreshStatus,
  ReportSummary,
  TimeseriesPoint,
} from '@/types';

export type ReportParams = {
  from?: string; // ISO
  to?: string;   // ISO
  offer_id?: string;
  network_id?: string;
};

export interface ClickListParams {
  from?: string;
  to?: string;
  offer_id?: string;
  aff_id?: string;
  cursor?: string | null;
  limit?: number;
}

export interface ConversionListParams {
  from?: string;
  to?: string;
  offer_id?: string;
  offer_ids?: string[];
  network_id?: string;
  verified?: boolean;
  status?: string;
  cursor?: string | null;
  limit?: number;
}

export interface OfferReportParams {
  from?: string;
  to?: string;
  offer_ids?: string[];   // serialised as a comma-separated string
}

export interface PostbackReportParams {
  from?: string;
  to?: string;
  network_ids?: string[];
}

export interface CampaignReportParams {
  from?: string;
  to?: string;
  campaign_ids?: string[];
}

export interface ReportOverview {
  summary: ReportSummary;
  points: TimeseriesPoint[];
}

export const reportsApi = {
  summary(params: ReportParams = {}) {
    return api<ReportSummary>('/api/reports/summary', { query: params });
  },
  timeseries(params: ReportParams = {}) {
    return api<{ points: TimeseriesPoint[] }>('/api/reports/timeseries', { query: params });
  },
  // Combined endpoint: one HTTP round-trip + one rollup scan covers both
  // summary cards and timeseries charts on /reports.
  overview(params: ReportParams = {}) {
    return api<ReportOverview>('/api/reports/overview', { query: params });
  },
  offers(params: OfferReportParams = {}) {
    return api<OfferReportsResponse>('/api/reports/offers', {
      query: {
        from: params.from,
        to: params.to,
        offer_ids: params.offer_ids && params.offer_ids.length > 0
          ? params.offer_ids.join(',')
          : undefined,
      },
    });
  },
  offerDetail(offer_id: string, params: { from?: string; to?: string } = {}) {
    return api<OfferDetailResponse>(
      `/api/reports/offers/${encodeURIComponent(offer_id)}/detail`,
      { query: { from: params.from, to: params.to } }
    );
  },
  postbacks(params: PostbackReportParams = {}) {
    return api<PostbackReportsResponse>('/api/reports/postbacks', {
      query: {
        from: params.from,
        to: params.to,
        network_ids: params.network_ids && params.network_ids.length > 0
          ? params.network_ids.join(',')
          : undefined,
      },
    });
  },
  postbackDetail(
    network_id: string,
    params: { from?: string; to?: string; offer_ids?: string[] } = {},
  ) {
    return api<PostbackDetailResponse>(
      `/api/reports/postbacks/${encodeURIComponent(network_id)}/detail`,
      {
        query: {
          from: params.from,
          to: params.to,
          offer_ids: params.offer_ids && params.offer_ids.length > 0
            ? params.offer_ids.join(',')
            : undefined,
        },
      },
    );
  },
  backfillOffers(params: { from?: string; to?: string } = {}) {
    return api<{
      ok: true;
      from: string;
      to: string;
      clicks_scanned: number;
      clicks_untouched: true;
      existing_buckets_scanned: number;
      conversions_scanned: number;
      buckets_written: number;
      duration_ms: number;
      truncated?: boolean;
      truncated_reason?: string;
    }>('/api/reports/offers/backfill', {
      method: 'POST',
      body: { from: params.from, to: params.to },
    });
  },
  campaigns(params: CampaignReportParams = {}) {
    return api<CampaignReportsResponse>('/api/reports/campaigns', {
      query: {
        from: params.from,
        to: params.to,
        campaign_ids: params.campaign_ids && params.campaign_ids.length > 0
          ? params.campaign_ids.join(',')
          : undefined,
      },
    });
  },
  campaignDetail(campaign_id: string, params: { from?: string; to?: string } = {}) {
    return api<CampaignDetailResponse>(
      `/api/reports/campaigns/${encodeURIComponent(campaign_id)}/detail`,
      { query: { from: params.from, to: params.to } }
    );
  },
  updateCampaignSpend(campaign_id: string, date: string, spend: number) {
    return api<{ ok: true; campaign_id: string; date: string; spend: number }>(
      `/api/reports/campaigns/${encodeURIComponent(campaign_id)}/spend`,
      { method: 'PATCH', body: { date, spend } }
    );
  },
  updateCampaignName(campaign_id: string, campaign_name: string) {
    return api<{ ok: true; campaign_id: string; campaign_name: string }>(
      `/api/reports/campaigns/${encodeURIComponent(campaign_id)}/name`,
      { method: 'PATCH', body: { campaign_name } }
    );
  },
  backfillCampaigns(params: { from?: string; to?: string } = {}) {
    return api<{
      ok: true;
      from: string;
      to: string;
      clicks_scanned: number;
      clicks_untouched: true;
      click_metadata_scanned: number;
      clicks_with_campaign: number;
      existing_buckets_scanned: number;
      conversions_scanned: number;
      conversions_with_campaign: number;
      conversions_orphan_lookups: number;
      buckets_written: number;
      duration_ms: number;
      truncated?: boolean;
      truncated_reason?: string;
      campaign_spends?: Array<{
        campaign_id: string;
        campaign_name: string;
        total_spend: number;
      }>;
    }>('/api/reports/campaigns/backfill', {
      method: 'POST',
      body: { from: params.from, to: params.to },
    });
  },
  syncGoogleAdsCampaigns(params: { from?: string; to?: string } = {}) {
    return api<{
      ok: true;
      from: string;
      to: string;
      campaigns_updated: number;
      total_spend_inr: number;
      total_spend_micros: number;
      total_clicks: number;
      total_impressions: number;
      duration_ms: number;
    }>('/api/reports/campaigns/google-ads-sync', {
      method: 'POST',
      body: { from: params.from, to: params.to },
    });
  },
  getGoogleAdsSyncState() {
    return api<GoogleAdsSyncState>('/api/reports/campaigns/google-ads-sync-state');
  },
  saveGoogleAdsSyncPrefs(prefs: { from: string; to: string }) {
    return api<GoogleAdsSyncState>('/api/reports/campaigns/google-ads-sync-state', {
      method: 'PUT',
      body: prefs,
    });
  },
  // Orchestrated refresh: runs every affiliate API and then backfills offer
  // + campaign reports from the last successful refresh. Long-running — the
  // HTTP request blocks until completion, but the client should also poll
  // refreshRun() in parallel to surface live progress. Returns 409 (via an
  // ApiError) when another Cloud Run instance already holds the lock; the
  // error body's `active_run_id` lets the UI attach to the in-flight run.
  refreshAll() {
    return api<RefreshStartResponse>('/api/refresh', { method: 'POST' });
  },
  refreshStatus() {
    return api<RefreshStatus>('/api/refresh/status');
  },
  refreshRun(run_id: string) {
    return api<RefreshRun>(`/api/refresh/runs/${encodeURIComponent(run_id)}`);
  },
  // Force-clear a stuck refresh lock. Use when a holder instance died mid-run
  // and the operator doesn't want to wait out the 30-min lease.
  refreshUnlock() {
    return api<{ ok: true; cleared_run_id: string | null }>('/api/refresh/unlock', { method: 'POST' });
  },
};

export interface GoogleAdsSyncState {
  pref_from: string | null;
  pref_to: string | null;
  pref_updated_at: string | null;
  last_synced_at: string | null;
  last_sync_from: string | null;
  last_sync_to: string | null;
}

export const clicksApi = {
  list(params: ClickListParams = {}) {
    return api<Page<ClickRecord>>('/api/clicks', {
      query: {
        from: params.from,
        to: params.to,
        offer_id: params.offer_id,
        aff_id: params.aff_id,
        cursor: params.cursor ?? undefined,
        limit: params.limit,
      },
    });
  },
  get(id: string) {
    return api<{ click: ClickRecord; conversions: ConversionRecord[] }>(
      `/api/clicks/${encodeURIComponent(id)}`
    );
  },
};

export const allConversionsApi = {
  list(params: ConversionListParams = {}) {
    return api<Page<ConversionRecord>>('/api/conversions', {
      query: {
        from: params.from,
        to: params.to,
        offer_id: params.offer_id,
        offer_ids: params.offer_ids && params.offer_ids.length > 0
          ? params.offer_ids.join(',')
          : undefined,
        network_id: params.network_id,
        verified: params.verified === undefined ? undefined : String(params.verified),
        status: params.status,
        cursor: params.cursor ?? undefined,
        limit: params.limit,
      },
    });
  },
};
