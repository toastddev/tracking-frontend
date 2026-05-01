import { api } from '@/lib/api';
import type {
  ClickRecord,
  ConversionRecord,
  OfferDetailResponse,
  OfferReportsResponse,
  Page,
  PostbackDetailResponse,
  PostbackReportsResponse,
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

export const reportsApi = {
  summary(params: ReportParams = {}) {
    return api<ReportSummary>('/api/reports/summary', { query: params });
  },
  timeseries(params: ReportParams = {}) {
    return api<{ points: TimeseriesPoint[] }>('/api/reports/timeseries', { query: params });
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
  postbackDetail(network_id: string, params: { from?: string; to?: string } = {}) {
    return api<PostbackDetailResponse>(
      `/api/reports/postbacks/${encodeURIComponent(network_id)}/detail`,
      { query: { from: params.from, to: params.to } }
    );
  },
  backfillOffers(params: { from?: string; to?: string } = {}) {
    return api<{
      ok: true;
      from: string;
      to: string;
      clicks_scanned: number;
      conversions_scanned: number;
      buckets_written: number;
      duration_ms: number;
    }>('/api/reports/offers/backfill', {
      method: 'POST',
      body: { from: params.from, to: params.to },
    });
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
        network_id: params.network_id,
        verified: params.verified === undefined ? undefined : String(params.verified),
        status: params.status,
        cursor: params.cursor ?? undefined,
        limit: params.limit,
      },
    });
  },
};
