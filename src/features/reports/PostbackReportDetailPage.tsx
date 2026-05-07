import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Info,
  Layers,
  Link2,
  ListChecks,
  Search,
  Settings2,
  Target,
  Webhook,
  X,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { fmtMoney, fmtDateTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import type {
  PostbackAvailableOffer,
  PostbackDetailDailyPoint,
  PostbackDetailDeltas,
  PostbackDetailFlag,
  PostbackDetailResponse,
  PostbackDetailSummary,
  PostbackHourHeatmap,
  PostbackLatency,
  PostbackMappingHealth,
  PostbackMethodBreakdown,
  PostbackOfferBreakdown,
  PostbackSourceBreakdown,
  PostbackStatusBreakdown,
  RecentVerifiedSample,
  UnmatchedSample,
} from '@/types';
import { reportsApi } from './api';
import { type ReportRange } from './ReportFilters';
import { useUrlSyncedDateRange } from '@/lib/dateRange';
import { ConversionsReportTab } from './ConversionsReportTab';

const fmtCount = (v: number) =>
  new Intl.NumberFormat(undefined, {
    notation: v >= 10_000 ? 'compact' : 'standard',
  }).format(v);

const fmtPct = (v: number) => (v * 100).toFixed(1) + '%';

function fmtDeltaPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}
function fmtDeltaAbs(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}pp`;
}

function fmtMinutes(m: number | null): string {
  if (m == null) return '—';
  if (m < 1) return `${(m * 60).toFixed(0)}s`;
  if (m < 60) return `${m.toFixed(1)}m`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)}h`;
  return `${(m / (60 * 24)).toFixed(1)}d`;
}

function fmtDateShort(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${dt.toLocaleDateString(undefined, { month: 'short' })} ${dt.getDate()}`;
}

function offerIdsFromQuery(qp: URLSearchParams): string[] {
  const raw = qp.get('offer_ids');
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function PostbackReportDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [search, setSearch] = useSearchParams();
  // Adopts ?from/?to on first mount and keeps the URL synced with the
  // global filter thereafter. offer_ids stays managed by this page directly
  // via setSearch — they compose correctly because each setSearch reads the
  // current URL state.
  const range: ReportRange = useUrlSyncedDateRange();
  const selectedOfferIds = useMemo(() => offerIdsFromQuery(search), [search]);

  // Stable, sorted+joined key so query cache hits regardless of selection order.
  const offerCacheKey = useMemo(
    () => [...selectedOfferIds].sort().join(','),
    [selectedOfferIds],
  );

  function setSelectedOfferIds(next: string[]) {
    const params = new URLSearchParams(search);
    if (next.length === 0) params.delete('offer_ids');
    else params.set('offer_ids', next.join(','));
    setSearch(params, { replace: true });
  }

  const detailQuery = useQuery({
    queryKey: ['report-postback-detail', id, range.from, range.to, offerCacheKey],
    queryFn: () => reportsApi.postbackDetail(id, {
      from: range.from,
      to: range.to,
      offer_ids: selectedOfferIds.length > 0 ? selectedOfferIds : undefined,
    }),
    enabled: !!id,
    staleTime: 30_000,
  });

  return (
    <>
      <PageHeader
        back={
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <ArrowLeft className="h-4 w-4" /> Reports
          </Link>
        }
        title={detailQuery.data?.network.name ?? id}
        description={
          detailQuery.data
            ? `${id} • Postback delivery health • ${fmtDateShort(detailQuery.data.range.from)} – ${fmtDateShort(detailQuery.data.range.to)} (${detailQuery.data.range.days} days)`
            : id
        }
        actions={
          <div className="flex items-center gap-2">
            {detailQuery.data?.network.status === 'active' && (
              <Badge tone="green">active</Badge>
            )}
            {detailQuery.data?.network.status === 'paused' && (
              <Badge tone="amber">paused</Badge>
            )}
            <Link
              to={`/postbacks/${encodeURIComponent(id)}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Settings2 className="h-3.5 w-3.5" /> Configure
            </Link>
            {detailQuery.isFetching && (
              <Spinner className="text-slate-400 dark:text-neutral-500" />
            )}
          </div>
        }
      />

      {detailQuery.isLoading ? (
        <CenteredSpinner />
      ) : detailQuery.isError || !detailQuery.data ? (
        <Card>
          <div className="flex items-start gap-2 p-5 text-sm text-slate-600 dark:text-neutral-300">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div>
              Couldn't load the postback report.{' '}
              {detailQuery.error instanceof Error ? detailQuery.error.message : 'Please try again.'}
            </div>
          </div>
        </Card>
      ) : (
        <DetailBody
          data={detailQuery.data}
          range={range}
          selectedOfferIds={selectedOfferIds}
          onSelectedOfferIdsChange={setSelectedOfferIds}
        />
      )}
    </>
  );
}

function DetailBody({
  data,
  range,
  selectedOfferIds,
  onSelectedOfferIdsChange,
}: {
  data: PostbackDetailResponse;
  range: ReportRange;
  selectedOfferIds: string[];
  onSelectedOfferIdsChange: (next: string[]) => void;
}) {
  // The filter scopes summary/series/deltas/offer-table only. Cards backed by
  // network-level dimensions (sources, methods, heatmap, latency, mapping)
  // stay network-wide — drilldowns don't store those per-offer. The notice
  // below makes that distinction explicit.
  const filterActive = data.offer_filter_applied;
  const networkWideNotice = filterActive ? (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <div>
        These metrics aren't scoped by the offer filter — they aggregate across
        every offer this network fired for. The drilldown rollup doesn't track
        them per-offer.
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <OfferFilterBar
        offers={data.available_offers}
        selectedOfferIds={selectedOfferIds}
        onChange={onSelectedOfferIdsChange}
        range={range}
      />

      <FlagsList flags={data.flags} />

      <KpiGrid summary={data.summary} previous={data.previous} deltas={data.deltas} />

      <SamplesNotice
        sampled={data.samples.conversions_sampled}
        truncated={data.samples.truncated}
      />

      <DeliveryChart series={data.series} />

      <div className="grid gap-6 lg:grid-cols-2">
        <StatusGradingChart series={data.series} />
        <MatchHealthCard
          summary={data.summary}
          mapping={data.network.mapping_click_id}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <OffersFiredTable rows={data.breakdowns.offers} availableOffers={data.available_offers} />
        <StatusBreakdownCard rows={data.breakdowns.statuses} verified={data.summary.verified} />
      </div>

      {networkWideNotice}

      <div className="grid gap-6 lg:grid-cols-2">
        <SourceMixCard rows={data.breakdowns.sources} />
        <MethodMixCard rows={data.breakdowns.methods} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LatencyCard latency={data.latency} mapped={!!data.network.has_postback_api || data.summary.verified > 0} />
        <MappingHealthCard mapping={data.mapping_health} />
      </div>

      <HourHeatmapCard heatmap={data.breakdowns.hour_heatmap} />

      {(data.recent.unmatched.length > 0 || data.recent.verified.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <UnmatchedSamplesCard rows={data.recent.unmatched} />
          <RecentVerifiedCard rows={data.recent.verified} />
        </div>
      )}

      <NetworkMetaCard network={data.network} />

      <Card>
        <CardHeader
          title="Raw Postback Log"
          subtitle={
            filterActive
              ? `Every postback fire for ${data.network.name}, scoped to the ${selectedOfferIds.length} selected offer${selectedOfferIds.length === 1 ? '' : 's'}. Use the time-window controls to drill into a specific minute range; click a row for raw payload, or the click_id to inspect the matched click.`
              : `Every postback fire for ${data.network.name}. Use the time-window controls to drill into a specific minute range; click a row for raw payload, or the click_id to inspect the matched click.`
          }
        />
        <ConversionsReportTab
          range={range}
          verifiedOnly={false}
          fixedNetworkId={data.network.network_id}
          fixedOfferIds={selectedOfferIds.length > 0 ? selectedOfferIds : undefined}
          inlineDateTimeOverride
          showClickColumn
        />
      </Card>
    </div>
  );
}

// ── Diagnostic flag banners ─────────────────────────────────────────

function FlagsList({ flags }: { flags: PostbackDetailFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="space-y-2">
      {flags.map((f, i) => <FlagBanner key={i} flag={f} />)}
    </div>
  );
}

function FlagBanner({ flag }: { flag: PostbackDetailFlag }) {
  const tone =
    flag.severity === 'critical'
      ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
      : flag.severity === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
        : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200';
  const Icon =
    flag.severity === 'critical' ? AlertCircle :
    flag.severity === 'warn' ? AlertTriangle : Info;
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', tone)}>
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        <div className="font-medium">{flag.title}</div>
        {flag.detail && <div className="mt-0.5 text-xs opacity-90">{flag.detail}</div>}
      </div>
    </div>
  );
}

function SamplesNotice({ sampled, truncated }: { sampled: number; truncated: boolean }) {
  return (
    <div className="text-xs text-slate-500 dark:text-neutral-500">
      Built from {fmtCount(sampled)} postback fires.
      {truncated && (
        <span className="ml-1 text-amber-600 dark:text-amber-400">
          (Sample truncated — older fires in this range aren't included.)
        </span>
      )}
    </div>
  );
}

// ── KPI band ────────────────────────────────────────────────────────

function KpiGrid({
  summary, previous, deltas,
}: {
  summary: PostbackDetailSummary;
  previous: PostbackDetailSummary;
  deltas: PostbackDetailDeltas;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Postbacks"
        value={fmtCount(summary.postbacks)}
        delta={deltas.postbacks_pct}
        deltaIsPct
        prev={`vs ${fmtCount(previous.postbacks)}`}
        sub="total fires received"
      />
      <Kpi
        label="Match rate"
        value={summary.postbacks > 0 ? fmtPct(summary.match_rate) : '—'}
        delta={deltas.match_rate_abs}
        deltaIsPct={false}
        prev={`vs ${previous.postbacks > 0 ? fmtPct(previous.match_rate) : '—'}`}
        highlight
        sub={`${fmtCount(summary.unverified)} unmatched`}
      />
      <Kpi
        label="Verified"
        value={fmtCount(summary.verified)}
        delta={deltas.verified_pct}
        deltaIsPct
        prev={`vs ${fmtCount(previous.verified)}`}
        sub="resolved to a click"
      />
      <Kpi
        label="Approval rate"
        value={summary.verified > 0 ? fmtPct(summary.approval_rate) : '—'}
        delta={deltas.approval_rate_abs}
        deltaIsPct={false}
        prev={`vs ${previous.verified > 0 ? fmtPct(previous.approval_rate) : '—'}`}
        sub="how the network grades us"
      />
      <Kpi
        label="Revenue"
        value={fmtMoney(summary.revenue)}
        delta={deltas.revenue_pct}
        deltaIsPct
        prev={`vs ${fmtMoney(previous.revenue)}`}
        sub={summary.verified > 0 ? `${fmtMoney(summary.avg_payout)} avg payout` : undefined}
      />
      <Kpi
        label="Offers fired"
        value={fmtCount(summary.unique_offers)}
        delta={null}
        deltaIsPct
        prev={`${fmtCount(summary.unique_click_ids)} unique clicks matched`}
        sub={summary.duplicate_click_ids > 0 ? `${fmtCount(summary.duplicate_click_ids)} duplicate matches` : undefined}
      />
    </div>
  );
}

function Kpi({
  label, value, delta, deltaIsPct, prev, highlight, sub,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaIsPct: boolean;
  prev: string;
  highlight?: boolean;
  sub?: string;
}) {
  const positive = delta != null && delta > 0;
  const negative = delta != null && delta < 0;
  return (
    <Card className={highlight ? 'ring-1 ring-brand-300/50 dark:ring-brand-500/30' : undefined}>
      <div className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          {label}
        </div>
        <div className={cn(
          'mt-1.5 text-2xl font-semibold tracking-tight tabular-nums',
          highlight ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-neutral-100'
        )}>
          {value}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          {delta != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
                positive && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
                negative && 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
                !positive && !negative && 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
              )}
            >
              {deltaIsPct ? fmtDeltaPct(delta) : fmtDeltaAbs(delta)}
            </span>
          )}
          <span className="truncate text-[11px] text-slate-500 dark:text-neutral-500">{prev}</span>
        </div>
        {sub && <div className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">{sub}</div>}
      </div>
    </Card>
  );
}

// ── Charts ───────────────────────────────────────────────────────────

// Daily postback delivery — verified bars stacked under unverified, with a
// match-rate line and a revenue line on independent right-side axes. The
// whole chart is a delivery health thermometer: short bars = network gone
// quiet; verified shrinking while unverified grows = tracking break;
// revenue line dropping while bars hold steady = network downgrading
// approvals or paying less per lead.
function DeliveryChart({ series }: { series: PostbackDetailDailyPoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const verifiedColor = dark ? '#34d399' : '#059669';
  const unverifiedColor = dark ? '#94a3b8' : '#94a3b8';
  const matchColor = dark ? '#fbbf24' : '#d97706';
  const revenueColor = dark ? '#60a5fa' : '#2563eb';

  const data = useMemo(() =>
    series.map((p) => ({
      ...p,
      match_rate_pct: p.postbacks > 0 ? (p.verified / p.postbacks) * 100 : null,
    })),
  [series]);

  // Compact $ formatter for the revenue axis ticks — keeps the axis narrow
  // even when daily revenue runs into the thousands.
  const fmtRevTick = (v: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      notation: Math.abs(v) >= 1000 ? 'compact' : 'standard',
      maximumFractionDigits: Math.abs(v) >= 1000 ? 1 : 0,
    }).format(v);

  return (
    <Card>
      <CardHeader
        title="Daily delivery"
        subtitle="Verified (green) and unmatched (grey) fires per day, with match rate (orange) and revenue (blue) on the right axes. A falling orange line is the earliest signal of a broken click_id mapping; a falling blue line with steady bars is the network paying you less."
      />
      <CardBody className="p-0">
        <div className="h-72 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: axis, fontSize: 11 }}
                tickFormatter={fmtDateShort}
                stroke={grid}
                tickLine={false}
              />
              <YAxis
                yAxisId="cnt"
                orientation="left"
                tick={{ fill: axis, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                width={48}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                tick={{ fill: axis, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                width={44}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                yAxisId="rev"
                orientation="right"
                tick={{ fill: revenueColor, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                width={56}
                tickFormatter={fmtRevTick}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: dark ? '#171717' : '#ffffff',
                  border: `1px solid ${dark ? '#404040' : '#e2e8f0'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d) => new Date(String(d)).toDateString()}
                formatter={(value, name) => {
                  if (name === 'Match rate') {
                    return value == null ? ['—', name] : [`${Number(value).toFixed(1)}%`, name];
                  }
                  if (name === 'Revenue') {
                    return [fmtMoney(Number(value)), name];
                  }
                  return [fmtCount(Number(value)), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: axis }} iconType="circle" />
              <Bar yAxisId="cnt" dataKey="verified"   stackId="a" name="Verified"   fill={verifiedColor}   radius={[0, 0, 0, 0]} />
              <Bar yAxisId="cnt" dataKey="unverified" stackId="a" name="Unmatched"  fill={unverifiedColor} radius={[2, 2, 0, 0]} />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="match_rate_pct"
                name="Match rate"
                stroke={matchColor}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="rev"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={revenueColor}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

// Daily status mix among verified rows. Distinct from offer reports because
// here it's framed as "the network's grading pattern" — useful for spotting
// a network that suddenly tightens approval or starts reversing more.
function StatusGradingChart({ series }: { series: PostbackDetailDailyPoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';

  return (
    <Card>
      <CardHeader
        title="Network grading"
        subtitle="How the network is bucketing our verified leads. A growing red band means tighter approval; growing amber means slower confirmations."
      />
      <CardBody className="p-0">
        <div className="h-64 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} stroke={grid} tickLine={false} width={36} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: dark ? '#171717' : '#ffffff',
                  border: `1px solid ${dark ? '#404040' : '#e2e8f0'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d) => new Date(String(d)).toDateString()}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: axis }} iconType="circle" />
              <Area type="monotone" dataKey="approved" stackId="1" name="Approved" stroke={dark ? '#34d399' : '#059669'} fill={dark ? '#34d39966' : '#05966966'} />
              <Area type="monotone" dataKey="pending"  stackId="1" name="Pending"  stroke={dark ? '#fbbf24' : '#d97706'} fill={dark ? '#fbbf2466' : '#d9770666'} />
              <Area type="monotone" dataKey="rejected" stackId="1" name="Rejected" stroke={dark ? '#f87171' : '#dc2626'} fill={dark ? '#f8717166' : '#dc262666'} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

// Match-rate health summary card. Replaces the offer report's "funnel" — for
// postbacks the funnel is degenerate (postback → matched is a single step),
// but the relationship between fires/matches/duplicates is the story.
function MatchHealthCard({
  summary, mapping,
}: {
  summary: PostbackDetailSummary;
  mapping?: string;
}) {
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Link2 className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Match health</span>}
        subtitle="How many of the network's fires actually resolved to a tracked click. Mapping mismatches and click TTL expiry both show up here."
      />
      <CardBody className="space-y-3">
        <Bar2
          label="Fires received"
          value={fmtCount(summary.postbacks)}
          width={1}
          tone="grey"
        />
        <Bar2
          label="Matched a tracked click"
          value={fmtCount(summary.verified)}
          width={summary.postbacks > 0 ? summary.verified / summary.postbacks : 0}
          subRight={summary.postbacks > 0 ? `${fmtPct(summary.match_rate)} match rate` : undefined}
          tone="green"
        />
        <Bar2
          label="Approved by network"
          value={fmtCount(summary.approved)}
          width={summary.postbacks > 0 ? summary.approved / summary.postbacks : 0}
          subRight={summary.verified > 0 ? `${fmtPct(summary.approval_rate)} of verified` : undefined}
          tone="blue"
        />
        <div className="rounded-md border border-slate-100 bg-slate-50/60 p-2.5 text-xs text-slate-600 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300">
          <div className="font-medium text-slate-700 dark:text-neutral-200">Click_id parameter</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-neutral-400">
            {mapping ? `?${mapping}=…` : '— not configured —'}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 dark:text-neutral-500">
            The network must include this parameter on every fire. If it doesn't match, every postback lands as unmatched.
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Bar2({
  label, value, width, subRight, tone = 'grey',
}: {
  label: string;
  value: string;
  width: number;
  subRight?: string;
  tone?: 'grey' | 'green' | 'blue';
}) {
  const w = Math.max(0.04, Math.min(1, width));
  const bar =
    tone === 'green'
      ? 'bg-emerald-500/80 dark:bg-emerald-500/60'
      : tone === 'blue'
        ? 'bg-brand-500/70 dark:bg-brand-500/60'
        : 'bg-slate-400/70 dark:bg-neutral-500/60';
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-slate-500 dark:text-neutral-400">
        <span>{label}</span>
        <span className="tabular-nums text-slate-700 dark:text-neutral-200">{value}</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-neutral-800">
        <div className={cn('h-2 rounded-full', bar)} style={{ width: `${w * 100}%` }} />
      </div>
      {subRight && (
        <div className="mt-0.5 text-right text-[11px] text-slate-400 dark:text-neutral-500">{subRight}</div>
      )}
    </div>
  );
}

// ── Per-offer fires for this network ──────────────────────────────────

function OffersFiredTable({
  rows,
  availableOffers,
}: {
  rows: PostbackOfferBreakdown[];
  availableOffers: PostbackAvailableOffer[];
}) {
  const nameByOfferId = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of availableOffers) if (o.name) m.set(o.offer_id, o.name);
    return m;
  }, [availableOffers]);

  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Target className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Offers fired by this network</span>}
        subtitle="Which offers does this network mostly fire for? Concentration on one offer = single-point-of-failure risk; an offer with high fires but low match rate = mapping or routing bug."
      />
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyStateThin description="No fires in this window." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Offer</TH>
                <TH className="text-right">Fires</TH>
                <TH className="text-right">Verified</TH>
                <TH className="text-right">Match</TH>
                <TH className="text-right">A · R</TH>
                <TH className="text-right">Revenue</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const name = nameByOfferId.get(r.offer_id);
                return (
                  <TR key={r.offer_id}>
                    <TD>
                      {name ? (
                        <>
                          <div className="font-medium text-slate-800 dark:text-neutral-200">{name}</div>
                          <div className="font-mono text-[11px] text-slate-400 dark:text-neutral-500">{r.offer_id}</div>
                        </>
                      ) : (
                        <span className="font-mono text-xs">{r.offer_id}</span>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">{fmtCount(r.postbacks)}</TD>
                    <TD className="text-right tabular-nums">{fmtCount(r.verified)}</TD>
                    <TD className="text-right tabular-nums">{r.postbacks > 0 ? fmtPct(r.match_rate) : '—'}</TD>
                    <TD className="text-right tabular-nums text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400">{fmtCount(r.approved)}</span>
                      {' · '}
                      <span className="text-red-600 dark:text-red-400">{fmtCount(r.rejected)}</span>
                    </TD>
                    <TD className="text-right tabular-nums font-semibold text-slate-900 dark:text-neutral-100">{fmtMoney(r.revenue)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

// ── Offer multi-select ───────────────────────────────────────────────
//
// Read-cheap: the `offers` list is whatever the network actually fired for
// in the current window (sourced from the same drilldown docs the page
// already fetched). Selecting offers re-runs the detail query with the
// new offer_ids set; the backend filters the same daily docs in-memory,
// so no extra Firestore reads are issued.
function OfferFilterBar({
  offers,
  selectedOfferIds,
  onChange,
  range,
}: {
  offers: PostbackAvailableOffer[];
  selectedOfferIds: string[];
  onChange: (next: string[]) => void;
  range: ReportRange;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close the dropdown when the user clicks anywhere outside it.
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const selectedSet = useMemo(() => new Set(selectedOfferIds), [selectedOfferIds]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) =>
      o.offer_id.toLowerCase().includes(q) ||
      (o.name?.toLowerCase().includes(q) ?? false)
    );
  }, [offers, search]);

  const labelFor = (o: PostbackAvailableOffer) => o.name ?? o.offer_id;

  function toggle(offer_id: string) {
    if (selectedSet.has(offer_id)) {
      onChange(selectedOfferIds.filter((id) => id !== offer_id));
    } else {
      onChange([...selectedOfferIds, offer_id]);
    }
  }

  function clearAll() {
    onChange([]);
  }

  const rangeIsSingleDay =
    range.from.slice(0, 10) === range.to.slice(0, 10);

  return (
    <Card>
      <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-neutral-200">
          <Filter className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
          Filter by offer
        </div>

        <div ref={ref} className="relative flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <span className="truncate">
              {selectedOfferIds.length === 0 ? (
                <span className="text-slate-500 dark:text-neutral-400">
                  All offers ({offers.length})
                </span>
              ) : (
                `${selectedOfferIds.length} of ${offers.length} selected`
              )}
            </span>
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
          </button>

          {open && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              <div className="border-b border-slate-100 p-2 dark:border-neutral-800">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or ID…"
                    className="w-full rounded border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-700 placeholder-slate-400 focus:border-brand-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                  />
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-slate-400 dark:text-neutral-500">
                    No offers match.
                  </div>
                ) : (
                  filtered.map((o) => {
                    const checked = selectedSet.has(o.offer_id);
                    return (
                      <button
                        key={o.offer_id}
                        type="button"
                        onClick={() => toggle(o.offer_id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-neutral-800',
                          checked && 'bg-brand-50/40 dark:bg-brand-500/10'
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                              checked
                                ? 'border-brand-500 bg-brand-500 text-white'
                                : 'border-slate-300 dark:border-neutral-600'
                            )}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-700 dark:text-neutral-200">
                              {labelFor(o)}
                            </div>
                            {o.name && (
                              <div className="truncate font-mono text-[10px] text-slate-400 dark:text-neutral-500">
                                {o.offer_id}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="flex-shrink-0 tabular-nums text-slate-500 dark:text-neutral-400">
                          {fmtCount(o.postbacks)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedOfferIds.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs dark:border-neutral-800">
                  <span className="text-slate-500 dark:text-neutral-400">
                    {selectedOfferIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedOfferIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedOfferIds.map((id) => {
              const o = offers.find((x) => x.offer_id === id);
              const label = o?.name ?? id;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-[11px] text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`Remove ${label}`}
                    className="rounded-full hover:bg-brand-100 dark:hover:bg-brand-500/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="text-[11px] text-slate-400 dark:text-neutral-500 sm:ml-auto sm:text-right">
          {rangeIsSingleDay
            ? `Day: ${fmtDateShort(range.from)}`
            : `${fmtDateShort(range.from)} – ${fmtDateShort(range.to)}`}
        </div>
      </CardBody>
    </Card>
  );
}

function StatusBreakdownCard({ rows, verified }: { rows: PostbackStatusBreakdown[]; verified: number }) {
  const tone = (s: PostbackStatusBreakdown['status']) =>
    s === 'approved' ? 'bg-emerald-500/70 dark:bg-emerald-500/60'
      : s === 'pending' ? 'bg-amber-500/70 dark:bg-amber-500/60'
        : 'bg-red-500/70 dark:bg-red-500/60';
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><ListChecks className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Status mix</span>}
        subtitle="The network's grading of our verified leads. A high pending share means cash-flow lag; a high rejected share means lead-quality problems."
      />
      <CardBody>
        {verified === 0 ? (
          <EmptyStateThin description="No verified fires in this window." />
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.status}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium capitalize text-slate-700 dark:text-neutral-200">{r.status}</span>
                  <span className="tabular-nums text-slate-500 dark:text-neutral-400">
                    {fmtCount(r.count)} · {fmtPct(r.share)} · {fmtMoney(r.revenue)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-neutral-800">
                  <div className={cn('h-2 rounded-full', tone(r.status))} style={{ width: `${(r.share * 100).toFixed(1)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ── Source / method ─────────────────────────────────────────────────

function SourceMixCard({ rows }: { rows: PostbackSourceBreakdown[] }) {
  const total = rows.reduce((s, r) => s + r.postbacks, 0);
  const labelFor = (s: PostbackSourceBreakdown['source']) =>
    s === 'postback' ? 'S2S postback (network → us)'
      : s === 'api' ? 'Affiliate API pull (us → network)'
        : 'Unlabelled';
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Layers className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Ingress source</span>}
        subtitle="Whether fires arrived as direct S2S postbacks or as records pulled by our scheduled affiliate-API job. Each surface has a different owner — telling them apart matters when only one is broken."
      />
      <CardBody>
        {total === 0 ? (
          <EmptyStateThin description="No fires recorded in the sample window." />
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const share = total > 0 ? r.postbacks / total : 0;
              return (
                <li key={r.source}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-neutral-200">{labelFor(r.source)}</span>
                    <span className="tabular-nums text-slate-500 dark:text-neutral-400">
                      {fmtCount(r.postbacks)} fires · {r.postbacks > 0 ? fmtPct(r.match_rate) : '—'} matched
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-neutral-800">
                    <div
                      className="h-1.5 rounded-full bg-brand-500/70 dark:bg-brand-500/60"
                      style={{ width: `${(share * 100).toFixed(1)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 text-[11px] text-slate-400 dark:text-neutral-500">
          Source split is computed from a 200-row recent slice — the proportions are representative but not exact totals.
        </div>
      </CardBody>
    </Card>
  );
}

function MethodMixCard({ rows }: { rows: PostbackMethodBreakdown[] }) {
  const total = rows.reduce((s, r) => s + r.postbacks, 0);
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Webhook className="h-4 w-4 text-slate-400 dark:text-neutral-500" />HTTP method</span>}
        subtitle="GET vs POST. Most networks settle on one — a sudden shift signals an upstream config change on their end. Our endpoint accepts either."
      />
      <CardBody>
        {total === 0 ? (
          <EmptyStateThin description="No fires recorded in the sample window." />
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const share = total > 0 ? r.postbacks / total : 0;
              return (
                <li key={r.method}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-mono font-medium text-slate-700 dark:text-neutral-200">{r.method}</span>
                    <span className="tabular-nums text-slate-500 dark:text-neutral-400">
                      {fmtCount(r.postbacks)} fires · {fmtCount(r.verified)} verified
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-neutral-800">
                    <div
                      className="h-1.5 rounded-full bg-brand-500/70 dark:bg-brand-500/60"
                      style={{ width: `${(share * 100).toFixed(1)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ── Latency & mapping health ────────────────────────────────────────

function LatencyCard({ latency, mapped }: { latency: PostbackLatency; mapped: boolean }) {
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Network latency</span>}
        subtitle="Time between the network's reported event and when we received the postback. A wide gap can mean batch processing — or that a network is replaying old fires."
      />
      <CardBody>
        {!mapped ? (
          <div className="text-sm text-slate-500 dark:text-neutral-400">
            Latency is calculated from the network's <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">network_timestamp</code> field.
            Configure <strong>mapping_timestamp</strong> in the postback config to surface this metric.
          </div>
        ) : latency.count === 0 ? (
          <EmptyStateThin description="No verified fires arrived with a parseable network timestamp." />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Median" value={fmtMinutes(latency.median_minutes)} />
            <Stat label="p95" value={fmtMinutes(latency.p95_minutes)} />
            <div className="col-span-2 text-[11px] text-slate-500 dark:text-neutral-500">
              Computed across {fmtCount(latency.count)} verified fires with a parseable network timestamp.
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-100 p-3 dark:border-neutral-800">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-neutral-100">{value}</div>
    </div>
  );
}

function MappingHealthCard({ mapping }: { mapping: PostbackMappingHealth }) {
  const fields: { key: keyof PostbackMappingHealth; label: string; sub?: string }[] = [
    { key: 'has_payout_mapping',    label: 'Payout',    sub: `${fmtCount(mapping.fires_with_payout)} extracted` },
    { key: 'has_status_mapping',    label: 'Status',    sub: `${fmtCount(mapping.fires_with_status)} extracted` },
    { key: 'has_currency_mapping',  label: 'Currency' },
    { key: 'has_txn_id_mapping',    label: 'Txn ID',    sub: `${fmtCount(mapping.fires_with_txn_id)} extracted` },
    { key: 'has_timestamp_mapping', label: 'Timestamp' },
  ];
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Settings2 className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Mapping coverage</span>}
        subtitle="Which fields the postback config knows how to extract. A red row means the network is sending the field but we're not capturing it — the data is sitting unparsed in raw_payload."
      />
      <CardBody className="space-y-2">
        {fields.map((f) => {
          const has = mapping[f.key] as boolean;
          return (
            <div key={f.key as string} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-200">
                {has ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-slate-300 dark:text-neutral-600" />
                )}
                <span>{f.label}</span>
              </div>
              <span className="text-xs text-slate-500 dark:text-neutral-400">
                {has ? (f.sub ?? 'configured') : 'not configured'}
              </span>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

// ── Hour heatmap ─────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HourHeatmapCard({ heatmap }: { heatmap: PostbackHourHeatmap }) {
  const max = useMemo(() => {
    let m = 0;
    for (const row of heatmap) for (const v of row) if (v > m) m = v;
    return m;
  }, [heatmap]);

  return (
    <Card>
      <CardHeader
        title="Fire timing heatmap (UTC)"
        subtitle="When this network actually fires. Many networks batch — a tight cluster of cells means there's a fixed processing window. A blank row signals a paused day."
      />
      <CardBody className="p-3 sm:p-4">
        {max === 0 ? (
          <EmptyStateThin description="No timestamped fires in this window." />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-px text-[10px]">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center text-slate-400 dark:text-neutral-500">{h}</div>
                ))}
                {heatmap.map((row, dow) => (
                  <HeatmapRow key={dow} dow={dow} row={row} max={max} />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400">
                <span>Less</span>
                <div className="flex gap-0.5">
                  {[0.1, 0.25, 0.5, 0.75, 1].map((v) => (
                    <div key={v} className="h-3 w-4 rounded-sm" style={{ background: heatColor(v) }} />
                  ))}
                </div>
                <span>More ({fmtCount(max)} max)</span>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function HeatmapRow({ dow, row, max }: { dow: number; row: number[]; max: number }) {
  return (
    <>
      <div className="flex items-center pr-1 text-slate-400 dark:text-neutral-500">{DAYS[dow]}</div>
      {row.map((v, h) => (
        <div
          key={h}
          title={`${DAYS[dow]} ${String(h).padStart(2, '0')}:00 — ${fmtCount(v)} fires`}
          className="aspect-square w-full rounded-sm"
          style={{ background: heatColor(max > 0 ? v / max : 0) }}
        />
      ))}
    </>
  );
}

function heatColor(v: number): string {
  if (v <= 0) return 'rgba(148,163,184,0.10)';
  const a = Math.max(0.08, Math.min(0.95, v));
  // Amber scale — visually distinct from the offer-report blue heatmap so an
  // operator with both pages open won't confuse "lots of fires" with "lots
  // of clicks".
  return `rgba(217,119,6,${a.toFixed(2)})`;
}

// ── Recent samples ──────────────────────────────────────────────────

function UnmatchedSamplesCard({ rows }: { rows: UnmatchedSample[] }) {
  return (
    <Card>
      <CardHeader
        title="Recent unmatched fires"
        subtitle="The most recent fires that didn't resolve to a tracked click. The payload keys hint at what the network is actually sending — useful when a click_id parameter rename is suspected."
      />
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyStateThin description="None — every recent fire matched a click." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>click_id received</TH>
                <TH>Source</TH>
                <TH>Payload keys</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.conversion_id}>
                  <TD className="whitespace-nowrap text-xs text-slate-500 dark:text-neutral-400">{fmtDateTime(r.created_at)}</TD>
                  <TD className="font-mono text-[11px] text-slate-500 dark:text-neutral-500">
                    {r.click_id ? r.click_id.slice(0, 16) + (r.click_id.length > 16 ? '…' : '') : <span className="italic text-slate-400">missing</span>}
                  </TD>
                  <TD className="text-xs">
                    {r.source ? <Badge tone="gray">{r.source}</Badge> : '—'}
                    {r.method && <span className="ml-1 font-mono text-[10px] text-slate-400 dark:text-neutral-500">{r.method}</span>}
                  </TD>
                  <TD>
                    <div className="flex max-w-[14rem] flex-wrap gap-1">
                      {r.raw_payload_keys.slice(0, 6).map((k) => (
                        <code key={k} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                          {k}
                        </code>
                      ))}
                      {r.raw_payload_keys.length > 6 && (
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500">+{r.raw_payload_keys.length - 6}</span>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

function RecentVerifiedCard({ rows }: { rows: RecentVerifiedSample[] }) {
  return (
    <Card>
      <CardHeader
        title="Recent verified fires"
        subtitle="Latest postbacks that landed cleanly. A good sample to confirm the integration is alive before/after a config change."
      />
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyStateThin description="None in this window." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Offer</TH>
                <TH>Status</TH>
                <TH className="text-right">Payout</TH>
                <TH>Click</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.conversion_id}>
                  <TD className="whitespace-nowrap text-xs text-slate-500 dark:text-neutral-400">{fmtDateTime(r.created_at)}</TD>
                  <TD className="text-xs font-mono">{r.offer_id ?? '—'}</TD>
                  <TD>
                    <Badge tone={statusTone(r.status)}>{r.status ?? 'unknown'}</Badge>
                  </TD>
                  <TD className="text-right tabular-nums text-xs">{r.payout != null ? fmtMoney(r.payout, r.currency) : '—'}</TD>
                  <TD className="font-mono text-[11px] text-slate-500 dark:text-neutral-500">
                    {r.click_id ? (
                      <Link
                        to={`/clicks/${encodeURIComponent(r.click_id)}`}
                        className="hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        {r.click_id.slice(0, 12)}…
                      </Link>
                    ) : '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

function statusTone(s?: string): 'green' | 'amber' | 'red' | 'gray' {
  const v = (s ?? '').toLowerCase();
  if (v === 'pending') return 'amber';
  if (v === 'rejected' || v === 'declined' || v === 'reversed') return 'red';
  if (v === 'approved') return 'green';
  return 'gray';
}

// ── Footer / meta ────────────────────────────────────────────────────

function NetworkMetaCard({
  network,
}: {
  network: PostbackDetailResponse['network'];
}) {
  return (
    <Card>
      <CardHeader title="Network details" />
      <CardBody className="grid gap-2 text-sm sm:grid-cols-2">
        <MetaRow label="Network ID" value={<code className="font-mono text-xs">{network.network_id}</code>} />
        <MetaRow
          label="click_id parameter"
          value={network.mapping_click_id ? <code className="font-mono text-xs">{network.mapping_click_id}</code> : '—'}
        />
        <MetaRow label="Default status" value={network.default_status ?? '—'} />
        <MetaRow
          label="Affiliate API pull"
          value={network.has_postback_api ? <Badge tone="green">configured</Badge> : <span className="text-slate-400 dark:text-neutral-500">postback only</span>}
        />
        <MetaRow label="Created" value={fmtDateTime(network.created_at)} />
        <MetaRow label="Updated" value={fmtDateTime(network.updated_at)} />
        <div className="sm:col-span-2">
          <Link
            to={`/postbacks/${encodeURIComponent(network.network_id)}`}
            className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
          >
            Open postback config <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 dark:border-neutral-800">
      <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-neutral-400">{label}</span>
      <span className="min-w-0 truncate text-right text-slate-700 dark:text-neutral-200">{value}</span>
    </div>
  );
}

function EmptyStateThin({ description = 'No data in this range.' }: { description?: string }) {
  return (
    <div className="px-5 py-10">
      <EmptyState title="" description={description} />
    </div>
  );
}
