export type GoogleAdsConnectionType = 'mcc' | 'child';
export type GoogleAdsConnectionStatus = 'active' | 'revoked' | 'error';

export interface GoogleAdsConnection {
  connection_id: string;
  type: GoogleAdsConnectionType;
  google_user_email: string;
  customer_id: string;
  manager_customer_id?: string;
  descriptive_name: string;
  currency_code: string;
  time_zone: string;
  sale_conversion_action_resource?: string;
  sale_conversion_action_name?: string;
  click_conversion_action_resource?: string;
  click_conversion_action_name?: string;
  status: GoogleAdsConnectionStatus;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GoogleAdsCandidate {
  customer_id: string;
  manager_customer_id?: string;
  descriptive_name: string;
  currency_code: string;
  time_zone: string;
  is_manager: boolean;
  level: number;
}

export interface GoogleAdsMccChild {
  ga_child_id: string;
  connection_id: string;
  customer_id: string;
  descriptive_name: string;
  currency_code: string;
  time_zone: string;
  created_at?: string;
  updated_at?: string;
}

export interface GoogleAdsConversionAction {
  resource_name: string;
  id: string;
  name: string;
  status: string;
  type: string;
  category?: string;
}

export type GoogleAdsRouteScope = 'offer' | 'network';

export interface GoogleAdsRoute {
  route_id: string;
  scope_type: GoogleAdsRouteScope;
  scope_id: string;
  target_connection_id: string;
  sale_conversion_action_resource?: string;
  sale_conversion_action_name?: string;
  click_conversion_action_resource?: string;
  click_conversion_action_name?: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export type GoogleAdsUploadKind = 'conversion' | 'click';
export type GoogleAdsUploadStatus = 'pending' | 'sent' | 'partial_failure' | 'failed' | 'skipped';

export interface GoogleAdsUpload {
  upload_id: string;
  kind: GoogleAdsUploadKind;
  source_id: string;
  conversion_id?: string;
  click_id?: string;
  connection_id?: string;
  customer_id?: string;
  identifier_type?: 'gclid' | 'gbraid' | 'wbraid';
  identifier_value?: string;
  conversion_action_resource?: string;
  status: GoogleAdsUploadStatus;
  attempts: number;
  last_error?: string;
  skip_reason?: string;
  google_response?: Record<string, unknown>;
  sent_at?: string;
  created_at?: string;
  updated_at?: string;
}
