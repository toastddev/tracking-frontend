import { useMemo } from 'react';
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
  Award,
  Settings2,
  Globe,
  Hash,
  Info,
  Network,
  Sparkles,
  TrendingDown,
  TrendingUp,
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
  AffiliateBreakdown,
  AdPlatformBreakdown,
  CountryBreakdown,
  HourHeatmap,
  NetworkBreakdown,
  OfferDetailDailyPoint,
  OfferDetailDeltas,
  OfferDetailFlag,
  OfferDetailRecentConversion,
  OfferDetailResponse,
  OfferDetailSummary,
  PayoutBucket,
  SubIdBreakdown,
} from '@/types';
import { reportsApi } from './api';
import { buildPresetRange, type ReportRange } from './ReportFilters';

const fmtCount = (v: number) =>
  new Intl.NumberFormat(undefined, {
    notation: v >= 10_000 ? 'compact' : 'standard',
  }).format(v);

const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';

// Render a percentage delta (already a decimal: 0.12 = +12%). Returns "—"
// when prev was zero (denominator), since the change is undefined.
function fmtDeltaPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

// Absolute delta for already-percentage metrics (e.g. CVR). Returns "+1.2pp"
// to make it visually distinct from percent-change deltas.
function fmtDeltaAbs(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(2)}pp`;
}

function fmtDateShort(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${dt.toLocaleDateString(undefined, { month: 'short' })} ${dt.getDate()}`;
}

// Parse the optional ?from/?to off the URL — falls back to the default 30d
// preset so a stale link still renders something useful.
function rangeFromQuery(qp: URLSearchParams): ReportRange {
  const from = qp.get('from');
  const to = qp.get('to');
  if (from && to && !Number.isNaN(new Date(from).getTime()) && !Number.isNaN(new Date(to).getTime())) {
    return { from, to, preset: 'custom' };
  }
  return buildPresetRange('30d');
}

export function OfferReportDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const range = useMemo(() => rangeFromQuery(search), [search]);

  const detailQuery = useQuery({
    queryKey: ['report-offer-detail', id, range.from, range.to],
    queryFn: () => reportsApi.offerDetail(id, { from: range.from, to: range.to }),
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
        title={detailQuery.data?.offer.name ?? id}
        description={
          detailQuery.data
            ? `${id} • Window: ${fmtDateShort(detailQuery.data.range.from)} – ${fmtDateShort(detailQuery.data.range.to)} (${detailQuery.data.range.days} days)`
            : id
        }
        actions={
          <div className="flex items-center gap-2">
            {detailQuery.data?.offer.status === 'active' && (
              <Badge tone="green">active</Badge>
            )}
            {detailQuery.data?.offer.status === 'paused' && (
              <Badge tone="amber">paused</Badge>
            )}
            <Link
              to={`/offers/${encodeURIComponent(id)}`}
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
              Couldn't load the report.{' '}
              {detailQuery.error instanceof Error ? detailQuery.error.message : 'Please try again.'}
            </div>
          </div>
        </Card>
      ) : (
        <DetailBody data={detailQuery.data} />
      )}
    </>
  );
}

function DetailBody({ data }: { data: OfferDetailResponse }) {
  return (
    <div className="space-y-6">
      <FlagsList flags={data.flags} />

      <KpiGrid summary={data.summary} previous={data.previous} deltas={data.deltas} />

      <SamplesNotice
        clicksSampled={data.samples.clicks_sampled}
        conversionsSampled={data.samples.conversions_sampled}
        clicksTruncated={data.samples.clicks_truncated}
        conversionsTruncated={data.samples.conversions_truncated}
      />

      <RevenueClicksChart series={data.series} />

      <div className="grid gap-6 lg:grid-cols-2">
        <StatusMixChart series={data.series} />
        <FunnelCard funnel={data.funnel} approvalRate={data.summary.approval_rate} unverified={data.summary.unverified} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AffiliatesTable rows={data.breakdowns.affiliates} />
        <CountriesTable rows={data.breakdowns.countries} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SubIdsCard label="s1" rows={data.breakdowns.sub_ids.s1} />
        <SubIdsCard label="s2" rows={data.breakdowns.sub_ids.s2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <NetworksTable rows={data.breakdowns.networks} />
        <AdPlatformsCard rows={data.breakdowns.ad_platforms} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HourHeatmapCard heatmap={data.breakdowns.hour_heatmap} />
        <PayoutHistogramCard buckets={data.payout_histogram} />
      </div>

      {(data.recent.rejected.length > 0 || data.recent.unverified.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentConversionsCard
            title="Recent rejected"
            description="Last few rejected conversions — investigate if rejections cluster around a network or affiliate."
            rows={data.recent.rejected}
            tone="red"
          />
          <RecentConversionsCard
            title="Recent unverified"
            description="Postbacks whose click_id didn't match a stored click. Possible tracking break or unauthorised postbacks."
            rows={data.recent.unverified}
            tone="amber"
          />
        </div>
      )}

      <OfferMetaCard
        offerId={data.offer.offer_id}
        baseUrl={data.offer.base_url}
        createdAt={data.offer.created_at}
        updatedAt={data.offer.updated_at}
      />
    </div>
  );
}

function FlagsList({ flags }: { flags: OfferDetailFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="space-y-2">
      {flags.map((f, i) => (
        <FlagBanner key={i} flag={f} />
      ))}
    </div>
  );
}

function FlagBanner({ flag }: { flag: OfferDetailFlag }) {
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

function SamplesNotice({
  clicksSampled, conversionsSampled, clicksTruncated, conversionsTruncated,
}: {
  clicksSampled: number; conversionsSampled: number;
  clicksTruncated: boolean; conversionsTruncated: boolean;
}) {
  return (
    <div className="text-xs text-slate-500 dark:text-neutral-500">
      Breakdowns built from {fmtCount(clicksSampled)} clicks and {fmtCount(conversionsSampled)} conversions.
      {(clicksTruncated || conversionsTruncated) && (
        <span className="ml-1 text-amber-600 dark:text-amber-400">
          (Sample truncated — totals and the daily chart are exact.)
        </span>
      )}
    </div>
  );
}

// ── KPI band ────────────────────────────────────────────────────────

function KpiGrid({
  summary, previous, deltas,
}: {
  summary: OfferDetailSummary;
  previous: OfferDetailSummary;
  deltas: OfferDetailDeltas;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Revenue"
        value={fmtMoney(summary.revenue)}
        delta={deltas.revenue_pct}
        deltaIsPct
        prev={`vs ${fmtMoney(previous.revenue)}`}
        highlight
      />
      <Kpi
        label="Clicks"
        value={fmtCount(summary.clicks)}
        delta={deltas.clicks_pct}
        deltaIsPct
        prev={`vs ${fmtCount(previous.clicks)}`}
      />
      <Kpi
        label="Conversions"
        value={fmtCount(summary.conversions)}
        delta={deltas.conversions_pct}
        deltaIsPct
        prev={`vs ${fmtCount(previous.conversions)}`}
      />
      <Kpi
        label="CVR"
        value={summary.clicks > 0 ? fmtPct(summary.cvr) : '—'}
        delta={deltas.cvr_abs}
        deltaIsPct={false}
        prev={`vs ${previous.clicks > 0 ? fmtPct(previous.cvr) : '—'}`}
      />
      <Kpi
        label="EPC"
        value={summary.clicks > 0 ? fmtMoney(summary.epc) : '—'}
        delta={deltas.epc_pct}
        deltaIsPct
        prev={`vs ${previous.clicks > 0 ? fmtMoney(previous.epc) : '—'}`}
      />
      <Kpi
        label="Approval rate"
        value={summary.postbacks > 0 ? fmtPct(summary.approval_rate) : '—'}
        delta={deltas.approval_rate_abs}
        deltaIsPct={false}
        prev={`vs ${previous.postbacks > 0 ? fmtPct(previous.approval_rate) : '—'}`}
      />
    </div>
  );
}

function Kpi({
  label, value, delta, deltaIsPct, prev, highlight,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaIsPct: boolean;
  prev: string;
  highlight?: boolean;
}) {
  // Direction for color: positive deltas green for revenue/clicks/etc,
  // but for things like rejection/abandonment higher would be bad. All KPIs
  // here are "more is better", so we use the simple rule.
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
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
              positive && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
              negative && 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
              !positive && !negative && 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
            )}
          >
            {positive && <TrendingUp className="h-3 w-3" />}
            {negative && <TrendingDown className="h-3 w-3" />}
            {deltaIsPct ? fmtDeltaPct(delta) : fmtDeltaAbs(delta)}
          </span>
          <span className="truncate text-[11px] text-slate-500 dark:text-neutral-500">{prev}</span>
        </div>
      </div>
    </Card>
  );
}

// ── Charts ───────────────────────────────────────────────────────────

function RevenueClicksChart({ series }: { series: OfferDetailDailyPoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const revColor = dark ? '#34d399' : '#059669';
  const clickColor = dark ? '#60a5fa' : '#2563eb';

  return (
    <Card>
      <CardHeader
        title="Revenue & clicks"
        subtitle="Daily revenue (bars) alongside click volume (line). Look for revenue staying flat while clicks fall — quality is improving — or the opposite."
      />
      <CardBody className="p-0">
        <div className="h-72 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: axis, fontSize: 11 }}
                tickFormatter={fmtDateShort}
                stroke={grid}
                tickLine={false}
              />
              <YAxis
                yAxisId="rev"
                orientation="left"
                tick={{ fill: axis, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                tickFormatter={(v) =>
                  new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: 'USD',
                    notation: 'compact',
                  }).format(Number(v))
                }
                width={56}
              />
              <YAxis
                yAxisId="clicks"
                orientation="right"
                tick={{ fill: axis, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                width={48}
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
                  if (name === 'Revenue') return [fmtMoney(Number(value)), 'Revenue'];
                  return [fmtCount(Number(value)), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: axis }} iconType="circle" />
              <Bar
                yAxisId="rev"
                dataKey="revenue"
                name="Revenue"
                fill={revColor}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="clicks"
                type="monotone"
                dataKey="clicks"
                name="Clicks"
                stroke={clickColor}
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

function StatusMixChart({ series }: { series: OfferDetailDailyPoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';

  return (
    <Card>
      <CardHeader
        title="Conversion status mix"
        subtitle="Approved / pending / rejected / unverified, stacked by day. Watch the orange and grey bands — they're money at risk."
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
              <Area type="monotone" dataKey="approved"   stackId="1" name="Approved"   stroke={dark ? '#34d399' : '#059669'} fill={dark ? '#34d39966' : '#05966966'} />
              <Area type="monotone" dataKey="pending"    stackId="1" name="Pending"    stroke={dark ? '#fbbf24' : '#d97706'} fill={dark ? '#fbbf2466' : '#d9770666'} />
              <Area type="monotone" dataKey="rejected"   stackId="1" name="Rejected"   stroke={dark ? '#f87171' : '#dc2626'} fill={dark ? '#f8717166' : '#dc262666'} />
              <Area type="monotone" dataKey="unverified" stackId="1" name="Unverified" stroke={dark ? '#94a3b8' : '#94a3b8'} fill={dark ? '#94a3b866' : '#94a3b866'} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

function FunnelCard({
  funnel, approvalRate, unverified,
}: {
  funnel: { clicks: number; postbacks: number; verified: number; approved: number };
  approvalRate: number;
  unverified: number;
}) {
  // Drop-off percentages between adjacent steps. Each row reads:
  // "this many entered the step → this % survived to the next."
  const c2p = funnel.clicks > 0 ? funnel.postbacks / funnel.clicks : 0;
  // Postback → verified is the approval signal we trust. The status-bucket
  // "approved" count is unreliable because anything not explicitly
  // pending/rejected falls back to it, so we don't render an extra step
  // built on that bucket.
  const p2v = funnel.postbacks > 0 ? funnel.verified / funnel.postbacks : 0;
  return (
    <Card>
      <CardHeader
        title="Funnel"
        subtitle="From the click to a verified conversion. The biggest drop-off step is where to look first."
      />
      <CardBody className="space-y-3">
        <FunnelStep
          label="Clicks"
          value={fmtCount(funnel.clicks)}
          width={1}
        />
        <FunnelStep
          label="Postbacks"
          value={fmtCount(funnel.postbacks)}
          width={funnel.clicks > 0 ? funnel.postbacks / Math.max(funnel.clicks, 1) : 0}
          subRight={`${(c2p * 100).toFixed(2)}% click → postback`}
        />
        <FunnelStep
          label="Verified conversions"
          value={fmtCount(funnel.verified)}
          width={funnel.clicks > 0 ? funnel.verified / Math.max(funnel.clicks, 1) : 0}
          subRight={
            `${(p2v * 100).toFixed(1)}% verified` +
            (unverified > 0 ? ` · ${fmtCount(unverified)} unmatched` : '') +
            ` (overall approval ${(approvalRate * 100).toFixed(1)}%)`
          }
          tone="green"
        />
      </CardBody>
    </Card>
  );
}

function FunnelStep({
  label, value, width, subRight, tone = 'blue',
}: {
  label: string;
  value: string;
  width: number;
  subRight?: string;
  tone?: 'blue' | 'green';
}) {
  const w = Math.max(0.04, Math.min(1, width));
  const bar =
    tone === 'green'
      ? 'bg-emerald-500/80 dark:bg-emerald-500/60'
      : 'bg-brand-500/70 dark:bg-brand-500/60';
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

// ── Breakdown tables ─────────────────────────────────────────────────

function AffiliatesTable({ rows }: { rows: AffiliateBreakdown[] }) {
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Award className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Top affiliates</span>}
        subtitle="Affiliates ranked by revenue. Scan for ones with traffic but no conversions — that's wasted spend or fraud."
      />
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyStateThin />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Affiliate</TH>
                <TH className="text-right">Clicks</TH>
                <TH className="text-right">Conv.</TH>
                <TH className="text-right">CVR</TH>
                <TH className="text-right">EPC</TH>
                <TH className="text-right">Revenue</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.aff_id}>
                  <TD className="font-mono text-xs">{r.aff_id}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.clicks)}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.conversions)}</TD>
                  <TD className="text-right tabular-nums">{r.clicks > 0 ? fmtPct(r.cvr) : '—'}</TD>
                  <TD className="text-right tabular-nums">{r.clicks > 0 ? fmtMoney(r.epc) : '—'}</TD>
                  <TD className="text-right tabular-nums font-semibold text-slate-900 dark:text-neutral-100">{fmtMoney(r.revenue)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

function CountriesTable({ rows }: { rows: CountryBreakdown[] }) {
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Globe className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Top countries</span>}
        subtitle="Geographic breakdown of clicks. Use to spot disqualified geos or under-served markets."
      />
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyStateThin />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Country</TH>
                <TH className="text-right">Clicks</TH>
                <TH className="text-right">Conv.</TH>
                <TH className="text-right">CVR</TH>
                <TH className="text-right">Revenue</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.country}>
                  <TD className="font-medium">{r.country}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.clicks)}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.conversions)}</TD>
                  <TD className="text-right tabular-nums">{r.clicks > 0 ? fmtPct(r.cvr) : '—'}</TD>
                  <TD className="text-right tabular-nums">{fmtMoney(r.revenue)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

function SubIdsCard({ label, rows }: { label: string; rows: SubIdBreakdown[] }) {
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Hash className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Top {label} values</span>}
        subtitle={`Affiliates use ${label} for campaign / creative IDs. Outlier CVRs here often indicate a winning ad to scale, or a fraud test cluster to block.`}
      />
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyStateThin description={`No ${label} values seen on traffic.`} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{label} value</TH>
                <TH className="text-right">Clicks</TH>
                <TH className="text-right">Conv.</TH>
                <TH className="text-right">CVR</TH>
                <TH className="text-right">Revenue</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.value}>
                  <TD className="max-w-[12rem] truncate font-mono text-xs">{r.value}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.clicks)}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.conversions)}</TD>
                  <TD className="text-right tabular-nums">{r.clicks > 0 ? fmtPct(r.cvr) : '—'}</TD>
                  <TD className="text-right tabular-nums">{fmtMoney(r.revenue)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

function NetworksTable({ rows }: { rows: NetworkBreakdown[] }) {
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Network className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Networks</span>}
        subtitle="Per-network mix. Approval rate = verified postbacks / total postbacks for that network. A low value vs others means many postbacks aren't matching a tracked click."
      />
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyStateThin />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Network</TH>
                <TH className="text-right">Conv.</TH>
                <TH className="text-right">A · P · R</TH>
                <TH className="text-right">Approval</TH>
                <TH className="text-right">Unverified</TH>
                <TH className="text-right">Revenue</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.network_id}>
                  <TD className="font-medium">{r.network_id}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.conversions)}</TD>
                  <TD className="text-right tabular-nums text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400">{fmtCount(r.approved)}</span>
                    {' · '}
                    <span className="text-amber-600 dark:text-amber-400">{fmtCount(r.pending)}</span>
                    {' · '}
                    <span className="text-red-600 dark:text-red-400">{fmtCount(r.rejected)}</span>
                  </TD>
                  <TD className="text-right tabular-nums">{(r.conversions + r.unverified) > 0 ? fmtPct(r.approval_rate) : '—'}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.unverified)}</TD>
                  <TD className="text-right tabular-nums font-semibold text-slate-900 dark:text-neutral-100">{fmtMoney(r.revenue)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

const PLATFORM_LABEL: Record<AdPlatformBreakdown['platform'], string> = {
  google: 'Google (gclid/gbraid)',
  facebook: 'Facebook (fbclid)',
  tiktok: 'TikTok (ttclid)',
  microsoft: 'Microsoft (msclkid)',
  organic: 'Organic / direct',
};

function AdPlatformsCard({ rows }: { rows: AdPlatformBreakdown[] }) {
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Traffic source</span>}
        subtitle="Inferred from click IDs (gclid, fbclid, etc.) on the click URL. 'Organic' = no platform tag was passed."
      />
      <CardBody>
        {totalClicks === 0 ? (
          <EmptyStateThin />
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const share = totalClicks > 0 ? r.clicks / totalClicks : 0;
              return (
                <li key={r.platform}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-neutral-200">{PLATFORM_LABEL[r.platform]}</span>
                    <span className="tabular-nums text-slate-500 dark:text-neutral-400">
                      {fmtCount(r.clicks)} clicks · {r.clicks > 0 ? fmtPct(r.cvr) : '—'} CVR · {fmtMoney(r.revenue)}
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

// ── Hour heatmap ─────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HourHeatmapCard({ heatmap }: { heatmap: HourHeatmap }) {
  const max = useMemo(() => {
    let m = 0;
    for (const row of heatmap) for (const v of row) if (v > m) m = v;
    return m;
  }, [heatmap]);

  return (
    <Card>
      <CardHeader
        title="Click activity heatmap (UTC)"
        subtitle="Day-of-week × hour-of-day. Pick the right time window for paid pushes — and notice flat-line off-hours."
      />
      <CardBody className="p-3 sm:p-4">
        {max === 0 ? (
          <EmptyStateThin description="No timestamped clicks in this window." />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-px text-[10px]">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center text-slate-400 dark:text-neutral-500">
                    {h}
                  </div>
                ))}
                {heatmap.map((row, dow) => (
                  <HeatmapDayRow key={dow} dow={dow} row={row} max={max} />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400">
                <span>Less</span>
                <div className="flex gap-0.5">
                  {[0.1, 0.25, 0.5, 0.75, 1].map((v) => (
                    <div
                      key={v}
                      className="h-3 w-4 rounded-sm"
                      style={{ background: heatColor(v) }}
                    />
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

function HeatmapDayRow({ dow, row, max }: { dow: number; row: number[]; max: number }) {
  return (
    <>
      <div className="flex items-center pr-1 text-slate-400 dark:text-neutral-500">{DAYS[dow]}</div>
      {row.map((v, h) => (
        <div
          key={h}
          title={`${DAYS[dow]} ${String(h).padStart(2, '0')}:00 — ${fmtCount(v)} clicks`}
          className="aspect-square w-full rounded-sm"
          style={{ background: heatColor(max > 0 ? v / max : 0) }}
        />
      ))}
    </>
  );
}

// 0..1 → green-blue scale matching the dashboard theme. Pure CSS would be
// simpler but the dynamic value is what makes a heatmap legible.
function heatColor(v: number): string {
  if (v <= 0) return 'rgba(148,163,184,0.10)';
  // Interpolate from light to brand-blue.
  const a = Math.max(0.08, Math.min(0.95, v));
  return `rgba(37,99,235,${a.toFixed(2)})`;
}

// ── Payout histogram ─────────────────────────────────────────────────

function PayoutHistogramCard({ buckets }: { buckets: PayoutBucket[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  return (
    <Card>
      <CardHeader
        title="Payout distribution"
        subtitle="How verified conversions distribute across payout buckets. A long-tail of high-payout outliers can mean lead-quality bonuses; a tight cluster is normal CPA."
      />
      <CardBody className="p-0">
        {buckets.length === 0 ? (
          <EmptyStateThin description="No verified payouts yet." />
        ) : (
          <div className="h-56 w-full px-2 pb-2 pt-3 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} stroke={grid} tickLine={false} />
                <YAxis tick={{ fill: axis, fontSize: 11 }} stroke={grid} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: dark ? '#171717' : '#ffffff',
                    border: `1px solid ${dark ? '#404040' : '#e2e8f0'}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => {
                    if (name === 'revenue') return [fmtMoney(Number(value)), 'Revenue'];
                    return [fmtCount(Number(value)), 'Conversions'];
                  }}
                />
                <Bar dataKey="count" name="Conversions" fill={dark ? '#60a5fa' : '#2563eb'} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Recent samples ───────────────────────────────────────────────────

function RecentConversionsCard({
  title, description, rows, tone,
}: {
  title: string;
  description: string;
  rows: OfferDetailRecentConversion[];
  tone: 'red' | 'amber';
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={description} />
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyStateThin description="None in this window." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Network</TH>
                <TH>Status</TH>
                <TH className="text-right">Payout</TH>
                <TH>Click</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.conversion_id}>
                  <TD className="whitespace-nowrap text-xs text-slate-500 dark:text-neutral-400">{fmtDateTime(r.created_at)}</TD>
                  <TD className="text-xs">{r.network_id}</TD>
                  <TD>
                    <Badge tone={tone}>{r.status ?? (r.verified ? 'unknown' : 'unverified')}</Badge>
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

// ── Footer / meta ────────────────────────────────────────────────────

function OfferMetaCard({
  offerId, baseUrl, createdAt, updatedAt,
}: {
  offerId: string;
  baseUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}) {
  return (
    <Card>
      <CardHeader title="Offer details" />
      <CardBody className="grid gap-2 text-sm sm:grid-cols-2">
        <MetaRow label="Offer ID" value={<code className="font-mono text-xs">{offerId}</code>} />
        <MetaRow label="Base URL" value={baseUrl ? <code className="break-all font-mono text-xs">{baseUrl}</code> : '—'} />
        <MetaRow label="Created" value={fmtDateTime(createdAt)} />
        <MetaRow label="Updated" value={fmtDateTime(updatedAt)} />
        <div className="sm:col-span-2">
          <Link
            to={`/offers/${encodeURIComponent(offerId)}`}
            className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
          >
            Open offer config <ArrowRight className="h-3.5 w-3.5" />
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
