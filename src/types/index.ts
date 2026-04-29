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
  query_params?: Record<string, string>;
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

export interface AffiliateApiRunRecord {
  run_id: string;
  api_id: string;
  status: 'ok' | 'partial' | 'error' | 'running' | 'skipped';
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
}
