export type Status = 'active' | 'paused';

export interface Offer {
  offer_id: string;
  name: string;
  base_url: string;
  status: Status;
  default_params?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  tracking_url?: string;
}

export interface Network {
  network_id: string;
  name: string;
  status: Status;
  mapping_click_id: string;
  mapping_payout?: string;
  mapping_currency?: string;
  mapping_status?: string;
  mapping_txn_id?: string;
  mapping_timestamp?: string;
  extra_mappings?: Record<string, string>;
  default_status?: string;
  postback_timezone?: string;
  postback_api_id?: string;
  created_at?: string;
  updated_at?: string;
  postback_url?: string;
}

export interface AdIds {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  ttclid?: string;
  msclkid?: string;
  [key: string]: string | undefined;
}

export interface ClickRecord {
  click_id: string;
  offer_id: string;
  aff_id: string;
  sub_params: Record<string, string>;
  ad_ids: AdIds;
  extra_params?: Record<string, string>;
  ip?: string;
  user_agent?: string;
  referrer?: string;
  country?: string;
  redirect_url: string;
  // True when the click was rejected by the referer blocklist — the user was
  // shown an error page instead of being redirected to the offer.
  blocked?: boolean;
  created_at: string;
}

export type VerificationReason = 'click_found' | 'unknown_click_id';
export type ConversionSource = 'postback' | 'api';

export interface ConversionRecord {
  conversion_id: string;
  network_id: string;
  click_id: string;
  offer_id?: string;
  payout?: number;
  currency?: string;
  status?: string;
  txn_id?: string;
  network_timestamp?: string;
  raw_payload: Record<string, unknown>;
  source_ip?: string;
  method: 'GET' | 'POST';
  verified: boolean;
  verification_reason: VerificationReason;
  source?: ConversionSource;
  shadow?: boolean;
  aff_api_id?: string;
  external_id?: string;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ReportSummary {
  from: string;
  to: string;
  clicks: number;
  postbacks: number;
  conversions: number;
  unverified: number;
  revenue: number;
  cvr: number;
  epc: number;
}

export interface TimeseriesPoint {
  date: string;
  clicks: number;
  postbacks: number;
  conversions: number;
  revenue: number;
}

// ── Per-offer reports (TTL-safe rollup collection) ────────────────────
export interface OfferDailyPoint {
  date: string;
  clicks: number;
  postbacks: number;
  conversions: number;
  revenue: number;
}

export interface OfferReportSummary {
  offer_id: string;
  offer_name?: string;
  status?: Status;
  clicks: number;
  postbacks: number;
  conversions: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
  cvr: number;
  epc: number;
  rpm: number;
  avg_payout: number;
  approval_rate: number;
  est_month_end_revenue: number;
  series: OfferDailyPoint[];
}

export interface OfferReportsResponse {
  from: string;
  to: string;
  offers: OfferReportSummary[];
  totals: {
    clicks: number;
    postbacks: number;
    conversions: number;
    unverified: number;
    revenue: number;
    est_month_end_revenue: number;
  };
}

// ── Single-offer drill-down (per-offer detail page) ──────────────────
export interface OfferDetailDailyPoint {
  date: string;
  clicks: number;
  postbacks: number;
  conversions: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
}

export interface OfferDetailSummary {
  clicks: number;
  postbacks: number;
  conversions: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
  cvr: number;
  epc: number;
  rpm: number;
  avg_payout: number;
  approval_rate: number;
}

export interface OfferDetailDeltas {
  revenue_pct: number | null;
  clicks_pct: number | null;
  conversions_pct: number | null;
  cvr_abs: number | null;
  epc_pct: number | null;
  approval_rate_abs: number | null;
}

export interface AffiliateBreakdown {
  aff_id: string;
  clicks: number;
  conversions: number;
  revenue: number;
  cvr: number;
  epc: number;
}

export interface CountryBreakdown {
  country: string;
  clicks: number;
  conversions: number;
  revenue: number;
  cvr: number;
}

export interface SubIdBreakdown {
  value: string;
  clicks: number;
  conversions: number;
  revenue: number;
  cvr: number;
}

export interface NetworkBreakdown {
  network_id: string;
  conversions: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
  approval_rate: number;
}

export type AdPlatform = 'google' | 'facebook' | 'tiktok' | 'microsoft' | 'organic';

export interface AdPlatformBreakdown {
  platform: AdPlatform;
  clicks: number;
  conversions: number;
  revenue: number;
  cvr: number;
}

export type HourHeatmap = number[][]; // [day_of_week 0=Sun][hour 0-23]

export interface PayoutBucket {
  label: string;
  count: number;
  revenue: number;
}

export type FlagSeverity = 'info' | 'warn' | 'critical';

export interface OfferDetailFlag {
  severity: FlagSeverity;
  title: string;
  detail: string;
}

export interface OfferDetailRecentConversion {
  conversion_id: string;
  network_id: string;
  status?: string;
  payout?: number;
  currency?: string;
  verified: boolean;
  created_at: string;
  click_id: string;
}

export interface OfferDetailResponse {
  offer: {
    offer_id: string;
    name?: string;
    status?: Status;
    base_url?: string;
    created_at?: string;
    updated_at?: string;
  };
  range: { from: string; to: string; days: number };
  previous_range: { from: string; to: string };

  summary: OfferDetailSummary;
  previous: OfferDetailSummary;
  deltas: OfferDetailDeltas;

  series: OfferDetailDailyPoint[];
  funnel: { clicks: number; postbacks: number; verified: number; approved: number };

  breakdowns: {
    affiliates: AffiliateBreakdown[];
    countries: CountryBreakdown[];
    sub_ids: { s1: SubIdBreakdown[]; s2: SubIdBreakdown[] };
    networks: NetworkBreakdown[];
    ad_platforms: AdPlatformBreakdown[];
    hour_heatmap: HourHeatmap;
  };

  payout_histogram: PayoutBucket[];
  flags: OfferDetailFlag[];
  samples: {
    clicks_sampled: number;
    conversions_sampled: number;
    clicks_truncated: boolean;
    conversions_truncated: boolean;
  };

  recent: {
    rejected: OfferDetailRecentConversion[];
    unverified: OfferDetailRecentConversion[];
  };
}

// ── Per-network postback reports ─────────────────────────────────────
export interface PostbackDailyPoint {
  date: string;
  postbacks: number;
  verified: number;
  unverified: number;
  revenue: number;
}

export interface PostbackNetworkSummary {
  network_id: string;
  network_name?: string;
  status?: Status;
  postbacks: number;
  verified: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
  match_rate: number;
  approval_rate: number;
  avg_payout: number;
  unique_offers: number;
  series: PostbackDailyPoint[];
}

export interface PostbackReportsResponse {
  from: string;
  to: string;
  networks: PostbackNetworkSummary[];
  totals: {
    postbacks: number;
    verified: number;
    unverified: number;
    revenue: number;
    networks: number;
  };
  truncated: boolean;
  conversions_scanned: number;
}

// ── Single-network postback drill-down ───────────────────────────────
export interface PostbackDetailDailyPoint {
  date: string;
  postbacks: number;
  verified: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
}

export interface PostbackDetailSummary {
  postbacks: number;
  verified: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
  avg_payout: number;
  match_rate: number;
  approval_rate: number;
  unique_offers: number;
  unique_click_ids: number;
  duplicate_click_ids: number;
}

export interface PostbackDetailDeltas {
  postbacks_pct: number | null;
  verified_pct: number | null;
  match_rate_abs: number | null;
  approval_rate_abs: number | null;
  revenue_pct: number | null;
}

export interface PostbackOfferBreakdown {
  offer_id: string;
  postbacks: number;
  verified: number;
  unverified: number;
  approved: number;
  rejected: number;
  revenue: number;
  match_rate: number;
}

export interface PostbackSourceBreakdown {
  source: 'postback' | 'api' | 'unknown';
  postbacks: number;
  verified: number;
  match_rate: number;
}

export interface PostbackMethodBreakdown {
  method: 'GET' | 'POST';
  postbacks: number;
  verified: number;
}

export interface PostbackStatusBreakdown {
  status: 'approved' | 'pending' | 'rejected';
  count: number;
  revenue: number;
  share: number;
}

export type PostbackHourHeatmap = number[][];

export interface PostbackDetailFlag {
  severity: FlagSeverity;
  title: string;
  detail: string;
}

export interface PostbackLatency {
  count: number;
  p50_minutes: number | null;
  p95_minutes: number | null;
  median_minutes: number | null;
}

export interface PostbackMappingHealth {
  has_payout_mapping: boolean;
  has_status_mapping: boolean;
  has_currency_mapping: boolean;
  has_txn_id_mapping: boolean;
  has_timestamp_mapping: boolean;
  fires_with_payout: number;
  fires_with_status: number;
  fires_with_txn_id: number;
}

export interface UnmatchedSample {
  conversion_id: string;
  created_at: string;
  click_id: string;
  status?: string;
  payout?: number;
  currency?: string;
  source?: 'postback' | 'api';
  method?: 'GET' | 'POST';
  raw_payload_keys: string[];
}

export interface RecentVerifiedSample {
  conversion_id: string;
  created_at: string;
  offer_id?: string;
  status?: string;
  payout?: number;
  currency?: string;
  source?: 'postback' | 'api';
  method?: 'GET' | 'POST';
  click_id: string;
}

export interface PostbackDetailResponse {
  network: {
    network_id: string;
    name?: string;
    status?: Status;
    mapping_click_id?: string;
    default_status?: string;
    has_postback_api?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  range: { from: string; to: string; days: number };
  previous_range: { from: string; to: string };

  summary: PostbackDetailSummary;
  previous: PostbackDetailSummary;
  deltas: PostbackDetailDeltas;

  series: PostbackDetailDailyPoint[];

  breakdowns: {
    offers: PostbackOfferBreakdown[];
    sources: PostbackSourceBreakdown[];
    methods: PostbackMethodBreakdown[];
    statuses: PostbackStatusBreakdown[];
    hour_heatmap: PostbackHourHeatmap;
  };

  latency: PostbackLatency;
  mapping_health: PostbackMappingHealth;

  flags: PostbackDetailFlag[];
  samples: {
    conversions_sampled: number;
    truncated: boolean;
  };

  recent: {
    verified: RecentVerifiedSample[];
    unmatched: UnmatchedSample[];
  };

  available_offers: PostbackAvailableOffer[];
  applied_offer_ids: string[];
  offer_filter_applied: boolean;
}

export interface PostbackAvailableOffer {
  offer_id: string;
  name?: string;
  postbacks: number;
}

// ── Per-campaign reports (TTL-safe rollup) ───────────────────────────
export interface CampaignDailyPoint {
  date: string;
  clicks: number;
  postbacks: number;
  conversions: number;
  revenue: number;
  spend: number;
  profit: number;
  gads_clicks: number;
  gads_impressions: number;
  gads_ctr: number;
  gads_cpc: number;
}

export interface CampaignReportSummary {
  campaign_id: string;
  campaign_name?: string;
  source: string;            // 'gad_campaignid' | 'utm_campaign'
  clicks: number;
  postbacks: number;
  conversions: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
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
  gads_clicks: number;
  gads_impressions: number;
  gads_ctr: number;
  gads_cpc: number;
  series: CampaignDailyPoint[];
}

export interface CampaignInsight {
  severity: 'info' | 'success' | 'warn' | 'critical';
  title: string;
  detail: string;
  campaign_id?: string;
}

// Per-day total revenue across ALL conversions (offer_reports), regardless of
// campaign attribution — converted to INR via the backend's toInr helper.
// Drives the dashed "total revenue" overlay on RevenueVsSpendChart so the
// operator can see the gap between campaign-attributed revenue (which excludes
// untagged traffic) and the true daily total. `null` means the day had FX
// failures and nothing converted — the chart leaves a gap rather than drawing 0.
export interface CampaignDailyTotal {
  date: string;
  total_revenue_inr: number | null;
}

export interface CampaignReportsResponse {
  from: string;
  to: string;
  campaigns: CampaignReportSummary[];
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
    gads_clicks: number;
    gads_impressions: number;
    gads_ctr: number;
    gads_cpc: number;
    total_revenue_inr: number;
  };
  daily_totals: CampaignDailyTotal[];
  insights: CampaignInsight[];
}

// ── Single-campaign drill-down ───────────────────────────────────────
export interface CampaignDetailDailyPoint {
  date: string;
  clicks: number;
  postbacks: number;
  conversions: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
  spend: number;
  profit: number;
  roas: number;
  gads_clicks: number;
  gads_impressions: number;
  gads_ctr: number;
  gads_cpc: number;
}

export interface CampaignDetailSummary {
  clicks: number;
  postbacks: number;
  conversions: number;
  unverified: number;
  approved: number;
  pending: number;
  rejected: number;
  revenue: number;
  spend: number;
  profit: number;
  cvr: number;
  epc: number;
  cpc: number;
  cpa: number;
  roas: number;
  roi: number;
  approval_rate: number;
  gads_clicks: number;
  gads_impressions: number;
  gads_ctr: number;
  gads_cpc: number;
}

export interface CampaignDetailDeltas {
  revenue_pct: number | null;
  spend_pct: number | null;
  profit_abs: number | null;
  clicks_pct: number | null;
  conversions_pct: number | null;
  cvr_abs: number | null;
  roas_abs: number | null;
}

export interface CampaignOfferBreakdown {
  offer_id: string;
  offer_name?: string;
  clicks: number;
  conversions: number;
  revenue: number;
  cvr: number;
  share_of_revenue: number;
}

export interface CampaignWeekdayBreakdown {
  dow: number;
  label: string;
  clicks: number;
  conversions: number;
  revenue: number;
  spend: number;
  profit: number;
}

export interface CampaignSpendDay {
  date: string;
  spend: number;
  revenue: number;
  profit: number;
}

export interface CampaignDetailFlag {
  severity: 'info' | 'success' | 'warn' | 'critical';
  title: string;
  detail: string;
}

export interface CampaignDetailResponse {
  campaign: {
    campaign_id: string;
    campaign_name?: string;
    source: string;
    first_seen?: string;
    last_seen?: string;
  };
  range: { from: string; to: string; days: number };
  previous_range: { from: string; to: string };
  summary: CampaignDetailSummary;
  previous: CampaignDetailSummary;
  deltas: CampaignDetailDeltas;
  series: CampaignDetailDailyPoint[];
  spend_days: CampaignSpendDay[];
  breakdowns: {
    offers: CampaignOfferBreakdown[];
    weekday: CampaignWeekdayBreakdown[];
  };
  flags: CampaignDetailFlag[];
  samples: {
    clicks_sampled: number;
    conversions_sampled: number;
    clicks_truncated: boolean;
    conversions_truncated: boolean;
  };
  best_day?: { date: string; profit: number; revenue: number; spend: number };
  worst_day?: { date: string; profit: number; revenue: number; spend: number };
}

// ── Affiliate API types ───────────────────────────────────────────────
export type AffiliateApiKind = 'rest' | 'graphql';
export type AffiliateApiResponseFormat = 'json' | 'xml' | 'auto';
export type AffiliateApiAuthType = 'none' | 'api_key' | 'bearer' | 'basic' | 'custom';
export type AffiliateApiPaginationType = 'none' | 'page' | 'offset' | 'cursor';

export interface AffiliateApiAuthView {
  type: AffiliateApiAuthType;
  in?: 'header' | 'query';
  key_name?: string;
  username?: string;
  has_secret?: boolean;
}

export interface AffiliateApiPagination {
  type: AffiliateApiPaginationType;
  page_param?: string;
  start_page?: number;
  offset_param?: string;
  cursor_param?: string;
  next_cursor_path?: string;
  size_param?: string;
  page_size?: number;
  max_pages?: number;
}

export interface AffiliateApiIncremental {
  enabled: boolean;
  from_param?: string;
  to_param?: string;
  format?: 'iso' | 'unix_ms' | 'unix_s' | 'date';
  lookback_minutes?: number;
}

export interface AffiliateApiMapping {
  items_path: string;
  external_id_path: string;
  click_id_path: string;
  payout_path?: string;
  currency_path?: string;
  status_path?: string;
  txn_id_path?: string;
  event_time_path?: string;
  status_map?: Record<string, string>;
  default_status?: string;
}

export interface AffiliateApiSchedule {
  enabled: boolean;
  runs_per_day: number;
  next_run_at?: string;
  last_run_at?: string;
  last_status?: 'ok' | 'partial' | 'error';
}

export interface AffiliateApiRequestConfig {
  http_method?: 'GET' | 'POST';
  // A value may be an array to emit a repeated query key (e.g. `fields[]`).
  query_params?: Record<string, string | string[]>;
  body_template?: string | null;
  headers?: Record<string, string>;
  graphql_query?: string;
  graphql_variables?: Record<string, unknown>;
}

export interface AffiliateApi {
  api_id: string;
  name: string;
  status: Status;
  kind: AffiliateApiKind;
  response_format?: AffiliateApiResponseFormat;
  base_url: string;
  network_id?: string;
  auth: AffiliateApiAuthView;
  request: AffiliateApiRequestConfig;
  pagination: AffiliateApiPagination;
  incremental: AffiliateApiIncremental;
  mapping: AffiliateApiMapping;
  schedule: AffiliateApiSchedule;
  timeout_ms?: number;
  max_records_per_run?: number;
  created_at?: string;
  updated_at?: string;
}

// ── Refresh (orchestrated) ───────────────────────────────────────────
export type RefreshRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RefreshPhase =
  | 'init'
  | 'apis'
  | 'backfill_offers'
  | 'backfill_campaigns'
  | 'finalising'
  | 'done';

export type RefreshStep =
  | { kind: 'init'; label: string }
  | {
      kind: 'api';
      api_id: string;
      name: string;
      ok: boolean;
      run_id?: string;
      reason?: string;
      duration_ms: number;
    }
  | {
      kind: 'backfill_offers';
      ok: boolean;
      conversions_scanned?: number;
      buckets_written?: number;
      duration_ms?: number;
      error?: string;
      truncated?: boolean;
      truncated_reason?: string;
    }
  | {
      kind: 'backfill_campaigns';
      ok: boolean;
      conversions_scanned?: number;
      buckets_written?: number;
      duration_ms?: number;
      error?: string;
      truncated?: boolean;
      truncated_reason?: string;
      campaign_spends_updated?: number;
    };

export interface RefreshError {
  phase: RefreshPhase;
  message: string;
  at: string;
}

export interface RefreshRun {
  run_id: string;
  holder: string;
  status: RefreshRunStatus;
  phase: RefreshPhase;
  current_step: string;
  apis_total: number;
  apis_done: number;
  apis_succeeded: number;
  apis_failed: number;
  apis_skipped: number;
  steps: RefreshStep[];
  errors: RefreshError[];
  backfill_from: string | null;
  backfill_to: string | null;
  previous_refresh_at: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface RefreshStartResponse {
  ok: true;
  run_id: string;
  run: RefreshRun | null;
}

export interface RefreshConflictResponse {
  error: 'already_running' | string;
  active_run_id?: string;
  active_started_at?: string;
}

export interface RefreshStatus {
  last_refresh_at: string | null;
  active_run_id: string | null;
}

// Per-page raw HTTP capture — populated only on dry runs for debugging.
export interface AffiliateApiHttpDebug {
  page: number;
  request_url: string;
  http_method: string;
  http_status: number;
  ok: boolean;
  content_type: string;
  duration_ms: number;
  body_snippet: string;
  body_truncated: boolean;
  parse_error?: string;
  items_found?: number;
}

export interface AffiliateApiRunRecord {
  run_id: string;
  api_id: string;
  status: 'ok' | 'partial' | 'error' | 'running' | 'skipped' | 'gads_upload_error';
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  pages_fetched?: number;
  records_seen?: number;
  records_inserted?: number;
  records_skipped_duplicate?: number;
  records_skipped_unknown_click?: number;
  records_failed?: number;
  http_calls?: number;
  error?: string;
  window_from?: string;
  window_to?: string;
  triggered_by?: 'schedule' | 'manual';
  gads_sent?: number;
  gads_skipped?: number;
  gads_failed?: number;
  gads_errors?: string[];
  debug?: AffiliateApiHttpDebug[];
}
