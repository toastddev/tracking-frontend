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
  ip?: string;
  user_agent?: string;
  referrer?: string;
  country?: string;
  redirect_url: string;
  created_at: string;
}

export type VerificationReason = 'click_found' | 'unknown_click_id';

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
  raw_payload: Record<string, string>;
  source_ip?: string;
  method: 'GET' | 'POST';
  verified: boolean;
  verification_reason: VerificationReason;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
