import { api } from '@/lib/api';
import type {
  ClickRecord,
  ConversionRecord,
  Page,
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
  network_id?: string;
  verified?: boolean;
  status?: string;
  cursor?: string | null;
  limit?: number;
}

export const reportsApi = {
  summary(params: ReportParams = {}) {
    return api<ReportSummary>('/api/reports/summary', { query: params });
  },
  timeseries(params: ReportParams = {}) {
    return api<{ points: TimeseriesPoint[] }>('/api/reports/timeseries', { query: params });
  },
};

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
};

export const allConversionsApi = {
  list(params: ConversionListParams = {}) {
    return api<Page<ConversionRecord>>('/api/conversions', {
      query: {
        from: params.from,
        to: params.to,
        offer_id: params.offer_id,
        network_id: params.network_id,
        verified: params.verified === undefined ? undefined : String(params.verified),
        status: params.status,
        cursor: params.cursor ?? undefined,
        limit: params.limit,
      },
    });
  },
};
