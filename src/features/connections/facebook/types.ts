export type FacebookConnectionType = 'business' | 'ad_account';
export type FacebookConnectionStatus = 'active' | 'revoked' | 'error' | 'expiring';

export interface FacebookConnection {
  connection_id: string;
  type: FacebookConnectionType;
  meta_user_email: string;
  access_token_expires_at?: string;
  business_id?: string;
  ad_account_id: string;
  dataset_id?: string;
  dataset_name?: string;
  name: string;
  currency_code: string;
  time_zone: string;
  account_status?: string;
  sale_event_name?: string;
  sale_event_dataset_id?: string;
  click_event_name?: string;
  click_event_dataset_id?: string;
  status: FacebookConnectionStatus;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FacebookCandidate {
  type: FacebookConnectionType;
  id: string;
  business_id?: string;
  name: string;
  currency_code: string;
  time_zone: string;
  account_status?: string;
}

export interface FacebookBusinessChild {
  fb_child_id: string;
  connection_id: string;
  ad_account_id: string;
  name: string;
  currency_code: string;
  time_zone: string;
  account_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FacebookCustomEvent {
  dataset_id: string;
  event_name: string;
  kind: 'standard' | 'custom';
  description?: string;
}

export interface FacebookDataset {
  id: string;
  name: string;
}

export type FacebookRouteScope = 'offer' | 'network';

export interface FacebookRoute {
  route_id: string;
  scope_type: FacebookRouteScope;
  scope_id: string;
  target_connection_id: string;
  sale_event_name?: string;
  sale_event_dataset_id?: string;
  click_event_name?: string;
  click_event_dataset_id?: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export type FacebookUploadKind = 'conversion' | 'click';
export type FacebookUploadStatus = 'pending' | 'sent' | 'partial_failure' | 'failed' | 'skipped';

export interface FacebookUpload {
  upload_id: string;
  kind: FacebookUploadKind;
  source_id: string;
  conversion_id?: string;
  click_id?: string;
  connection_id?: string;
  ad_account_id?: string;
  dataset_id?: string;
  event_name?: string;
  event_id?: string;
  identifier_type?: 'fbc' | 'fbp' | 'fbclid';
  identifier_value?: string;
  status: FacebookUploadStatus;
  attempts: number;
  last_error?: string;
  skip_reason?: string;
  meta_response?: Record<string, unknown>;
  sent_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FacebookSyncState {
  pref_from: string | null;
  pref_to: string | null;
  pref_updated_at: string | null;
  last_synced_at: string | null;
  last_sync_from: string | null;
  last_sync_to: string | null;
}
