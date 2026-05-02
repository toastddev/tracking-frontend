import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Info,
  PencilLine,
  Trash2,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Save,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtMoney } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { reportsApi } from '@/features/reports/api';
import { buildPresetRange, type ReportRange } from '@/features/reports/ReportFilters';
import type {
  CampaignDetailDailyPoint,
  CampaignDetailDeltas,
  CampaignDetailFlag,
  CampaignDetailResponse,
  CampaignDetailSummary,
  CampaignOfferBreakdown,
  CampaignSpendDay,
  CampaignWeekdayBreakdown,
} from '@/types';

const fmtCount = (v: number) =>
  new Intl.NumberFormat(undefined, { notation: v >= 10_000 ? 'compact' : 'standard' }).format(v);

const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';

function fmtDeltaPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function fmtDeltaAbs(v: number | null, suffix = 'pp'): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(2)}${suffix}`;
}

function fmtDeltaMoney(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${fmtMoney(v)}`;
}

function fmtRoas(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '—';
  return `${v.toFixed(2)}×`;
}

function fmtRoi(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(0)}%`;
}

function fmtDateShort(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${dt.toLocaleDateString(undefined, { month: 'short' })} ${dt.getDate()}`;
}

function rangeFromQuery(qp: URLSearchParams): ReportRange {
  const from = qp.get('from');
  const to = qp.get('to');
  if (from && to && !Number.isNaN(new Date(from).getTime()) && !Number.isNaN(new Date(to).getTime())) {
    return { from, to, preset: 'custom' };
  }
  return buildPresetRange('30d');
}

export function CampaignDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const range = useMemo(() => rangeFromQuery(search), [search]);
  const qc = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['report-campaign-detail', id, range.from, range.to],
    queryFn: () => reportsApi.campaignDetail(id, { from: range.from, to: range.to }),
    enabled: !!id,
    staleTime: 30_000,
  });

  return (
    <>
      <PageHeader
        back={
          <Link
            to={`/campaigns?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <ArrowLeft className="h-4 w-4" /> Campaigns
          </Link>
        }
        title={detailQuery.data?.campaign.campaign_name ?? id}
        description={
          detailQuery.data
            ? `${id} • ${detailQuery.data.range.days} day${detailQuery.data.range.days === 1 ? '' : 's'} • Source: ${detailQuery.data.campaign.source === 'gad_campaignid' ? 'Google Ads' : 'UTM'}`
            : id
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => qc.invalidateQueries({ queryKey: ['report-campaign-detail', id] })}
              disabled={detailQuery.isFetching}
              title="Refresh campaign data"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', detailQuery.isFetching && 'animate-spin')} />
              Refresh
            </Button>
            {detailQuery.data?.campaign.source && (
              <Badge tone={detailQuery.data.campaign.source === 'gad_campaignid' ? 'blue' : 'amber'}>
                {detailQuery.data.campaign.source === 'gad_campaignid' ? 'Google Ads' : 'UTM'}
              </Badge>
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
              Couldn't load campaign detail.{' '}
              {detailQuery.error instanceof Error ? detailQuery.error.message : 'Please try again.'}
            </div>
          </div>
        </Card>
      ) : (
        <DetailBody campaignId={id} range={range} data={detailQuery.data} />
      )}
    </>
  );
}

function DetailBody({
  campaignId, range, data,
}: { campaignId: string; range: ReportRange; data: CampaignDetailResponse }) {
  return (
    <div className="space-y-6">
      <FlagsList flags={data.flags} />

      <KpiGrid summary={data.summary} previous={data.previous} deltas={data.deltas} />

      <BestWorstStrip best={data.best_day} worst={data.worst_day} />

      <RevenueSpendChart series={data.series} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DailyProfitChart series={data.series} />
        <WeekdayBreakdownCard rows={data.breakdowns.weekday} />
      </div>

      <OffersBreakdownCard rows={data.breakdowns.offers} range={range} />

      <SpendEditorCard
        campaignId={campaignId}
        range={range}
        spendDays={data.spend_days}
        series={data.series}
      />

      <NameEditorCard
        campaignId={campaignId}
        currentName={data.campaign.campaign_name}
        range={range}
      />

      <FootprintCard campaign={data.campaign} samples={data.samples} />
    </div>
  );
}

// ── Flags ────────────────────────────────────────────────────────────

function FlagsList({ flags }: { flags: CampaignDetailFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="space-y-2">
      {flags.map((f, i) => <FlagBanner key={i} flag={f} />)}
    </div>
  );
}

function FlagBanner({ flag }: { flag: CampaignDetailFlag }) {
  const tone =
    flag.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
    : flag.severity === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
    : flag.severity === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
    : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200';
  const Icon =
    flag.severity === 'critical' ? AlertCircle :
    flag.severity === 'warn' ? AlertTriangle :
    flag.severity === 'success' ? CheckCircle2 : Info;
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

// ── KPI band ────────────────────────────────────────────────────────

function KpiGrid({
  summary, previous, deltas,
}: { summary: CampaignDetailSummary; previous: CampaignDetailSummary; deltas: CampaignDetailDeltas }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Revenue"
        value={fmtMoney(summary.revenue)}
        deltaText={fmtDeltaPct(deltas.revenue_pct)}
        deltaSignal={deltas.revenue_pct}
        prev={`vs ${fmtMoney(previous.revenue)}`}
        highlight
      />
      <Kpi
        label="Spend"
        value={fmtMoney(summary.spend)}
        deltaText={fmtDeltaPct(deltas.spend_pct)}
        deltaSignal={deltas.spend_pct == null ? null : -deltas.spend_pct}
        prev={`vs ${fmtMoney(previous.spend)}`}
      />
      <Kpi
        label="Profit"
        value={summary.spend > 0 ? fmtMoney(summary.profit) : '—'}
        deltaText={fmtDeltaMoney(deltas.profit_abs)}
        deltaSignal={deltas.profit_abs}
        prev={`vs ${fmtMoney(previous.profit)}`}
        tone={summary.profit > 0 ? 'positive' : summary.profit < 0 ? 'negative' : 'neutral'}
      />
      <Kpi
        label="ROAS"
        value={fmtRoas(summary.roas)}
        deltaText={deltas.roas_abs == null ? '—' : `${deltas.roas_abs > 0 ? '+' : ''}${deltas.roas_abs.toFixed(2)}×`}
        deltaSignal={deltas.roas_abs}
        prev={`vs ${fmtRoas(previous.roas)}`}
        tone={summary.roas >= 1.5 ? 'positive' : summary.spend > 0 && summary.roas < 1 ? 'negative' : 'neutral'}
      />
      <Kpi
        label="ROI"
        value={fmtRoi(summary.roi)}
        deltaText={summary.roi !== 0 || previous.roi !== 0 ? `${summary.roi > previous.roi ? '+' : ''}${((summary.roi - previous.roi) * 100).toFixed(0)}pp` : '—'}
        deltaSignal={summary.roi - previous.roi}
        prev={`vs ${fmtRoi(previous.roi)}`}
        tone={summary.roi > 0 ? 'positive' : summary.spend > 0 && summary.roi < 0 ? 'negative' : 'neutral'}
      />
      <Kpi
        label="CVR"
        value={summary.clicks > 0 ? fmtPct(summary.cvr) : '—'}
        deltaText={fmtDeltaAbs(deltas.cvr_abs)}
        deltaSignal={deltas.cvr_abs}
        prev={`vs ${previous.clicks > 0 ? fmtPct(previous.cvr) : '—'}`}
      />
    </div>
  );
}

function Kpi({
  label, value, deltaText, deltaSignal, prev, highlight, tone,
}: {
  label: string;
  value: string;
  deltaText: string;
  deltaSignal: number | null;
  prev: string;
  highlight?: boolean;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const positive = deltaSignal != null && deltaSignal > 0;
  const negative = deltaSignal != null && deltaSignal < 0;
  return (
    <Card className={highlight ? 'ring-1 ring-brand-300/50 dark:ring-brand-500/30' : undefined}>
      <div className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          {label}
        </div>
        <div className={cn(
          'mt-1.5 text-2xl font-semibold tracking-tight tabular-nums',
          tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'negative' && 'text-red-600 dark:text-red-400',
          !tone && (highlight ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-neutral-100')
        )}>
          {value}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={cn(
            'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
            positive && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
            negative && 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
            !positive && !negative && 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'
          )}>
            {positive && <TrendingUp className="h-3 w-3" />}
            {negative && <TrendingDown className="h-3 w-3" />}
            {deltaText}
          </span>
          <span className="truncate text-[11px] text-slate-500 dark:text-neutral-500">{prev}</span>
        </div>
      </div>
    </Card>
  );
}

// ── Best / worst day strip ──────────────────────────────────────────

function BestWorstStrip({
  best, worst,
}: {
  best: { date: string; profit: number; revenue: number; spend: number } | undefined;
  worst: { date: string; profit: number; revenue: number; spend: number } | undefined;
}) {
  if (!best && !worst) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {best && (
        <DayCallout
          tone="positive"
          title="Best day"
          subtitle={fmtDateShort(best.date)}
          headline={best.profit >= 0 ? `+${fmtMoney(best.profit)} profit` : `${fmtMoney(best.profit)} profit`}
          detail={`${fmtMoney(best.revenue)} revenue on ${fmtMoney(best.spend)} spend`}
        />
      )}
      {worst && (
        <DayCallout
          tone={worst.profit >= 0 ? 'positive' : 'negative'}
          title="Worst day"
          subtitle={fmtDateShort(worst.date)}
          headline={worst.profit >= 0 ? `+${fmtMoney(worst.profit)} profit` : `${fmtMoney(worst.profit)} loss`}
          detail={`${fmtMoney(worst.revenue)} revenue on ${fmtMoney(worst.spend)} spend`}
        />
      )}
    </div>
  );
}

function DayCallout({
  tone, title, subtitle, headline, detail,
}: { tone: 'positive' | 'negative'; title: string; subtitle: string; headline: string; detail: string }) {
  return (
    <Card className={cn(
      tone === 'positive'
        ? 'ring-1 ring-emerald-200 dark:ring-emerald-500/30'
        : 'ring-1 ring-red-200 dark:ring-red-500/30'
    )}>
      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">{title}</span>
          <span className="text-xs text-slate-500 dark:text-neutral-400">{subtitle}</span>
        </div>
        <div className={cn(
          'mt-1 text-xl font-semibold tabular-nums',
          tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        )}>
          {headline}
        </div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-neutral-500">{detail}</div>
      </div>
    </Card>
  );
}

// ── Charts ───────────────────────────────────────────────────────────

function RevenueSpendChart({ series }: { series: CampaignDetailDailyPoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const revColor = dark ? '#34d399' : '#059669';
  const spendColor = dark ? '#f87171' : '#dc2626';
  const roasColor = dark ? '#a78bfa' : '#7c3aed';

  const data = series.map((p) => ({
    ...p,
    roasOrNull: p.spend > 0 ? p.revenue / p.spend : null,
  }));

  return (
    <Card>
      <CardHeader
        title="Revenue, spend & ROAS"
        subtitle="Daily revenue and spend areas with ROAS overlay (purple, right axis). When the purple line stays above 1×, the campaign is profitable on that day."
      />
      <CardBody className="p-0">
        <div className="h-72 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev-grad-d" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={revColor} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={revColor} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="spend-grad-d" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={spendColor} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={spendColor} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
              <YAxis
                yAxisId="money"
                tick={{ fill: axis, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                tickFormatter={(v) =>
                  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact' }).format(Number(v))
                }
                width={56}
              />
              <YAxis
                yAxisId="roas"
                orientation="right"
                tick={{ fill: axis, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                tickFormatter={(v) => `${Number(v).toFixed(1)}×`}
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
                  if (name === 'ROAS') return [value == null ? '—' : `${Number(value).toFixed(2)}×`, 'ROAS'];
                  return [fmtMoney(Number(value)), String(name)];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: axis }} iconType="circle" />
              <Area yAxisId="money" type="monotone" dataKey="revenue" name="Revenue" stroke={revColor} fill="url(#rev-grad-d)" strokeWidth={2} />
              <Area yAxisId="money" type="monotone" dataKey="spend" name="Spend" stroke={spendColor} fill="url(#spend-grad-d)" strokeWidth={2} />
              <Line yAxisId="roas" type="monotone" dataKey="roasOrNull" name="ROAS" stroke={roasColor} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

function DailyProfitChart({ series }: { series: CampaignDetailDailyPoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const positive = dark ? '#34d399' : '#059669';
  const negative = dark ? '#f87171' : '#dc2626';
  return (
    <Card>
      <CardHeader title="Daily profit" subtitle="Revenue minus spend per day. Red bars are loss days." />
      <CardBody className="p-0">
        <div className="h-64 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
              <YAxis
                tick={{ fill: axis, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                tickFormatter={(v) =>
                  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact' }).format(Number(v))
                }
                width={56}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: dark ? '#171717' : '#ffffff',
                  border: `1px solid ${dark ? '#404040' : '#e2e8f0'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d) => new Date(String(d)).toDateString()}
                formatter={(value) => [fmtMoney(Number(value)), 'Profit']}
              />
              <Bar dataKey="profit" radius={[2, 2, 0, 0]}>
                {series.map((p, i) => (
                  <Cell key={i} fill={p.profit >= 0 ? positive : negative} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Weekday breakdown ───────────────────────────────────────────────

function WeekdayBreakdownCard({ rows }: { rows: CampaignWeekdayBreakdown[] }) {
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const max = Math.max(0, ...rows.map((r) => r.revenue));
  return (
    <Card>
      <CardHeader
        title="Day-of-week pattern"
        subtitle="Where in the week revenue lives. Use to time bid increases or pause weak days."
      />
      <CardBody>
        {total === 0 ? (
          <EmptyState title="" description="No revenue this window." />
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const share = total > 0 ? r.revenue / total : 0;
              const barShare = max > 0 ? r.revenue / max : 0;
              return (
                <li key={r.dow}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-neutral-200">{r.label}</span>
                    <span className="tabular-nums text-slate-500 dark:text-neutral-400">
                      {fmtMoney(r.revenue)} · {fmtMoney(r.profit)} profit · {fmtCount(r.conversions)} conv ({(share * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-neutral-800">
                    <div
                      className={cn(
                        'h-1.5 rounded-full',
                        r.profit >= 0 ? 'bg-emerald-500/70 dark:bg-emerald-500/60' : 'bg-red-500/70 dark:bg-red-500/60'
                      )}
                      style={{ width: `${(barShare * 100).toFixed(1)}%` }}
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

// ── Offers breakdown ────────────────────────────────────────────────

function OffersBreakdownCard({
  rows, range,
}: { rows: CampaignOfferBreakdown[]; range: ReportRange }) {
  return (
    <Card>
      <CardHeader
        title="Offers driven by this campaign"
        subtitle="Materialised from raw clicks/conversions for accurate per-offer revenue. Click an offer to jump to its dedicated report."
      />
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState title="No offer attribution" description="Either no clicks resolved to a known offer in this window, or the campaign has not driven any verified conversions yet." />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Offer</TH>
                <TH className="text-right">Clicks</TH>
                <TH className="text-right">Conversions</TH>
                <TH className="text-right">CVR</TH>
                <TH className="text-right">Revenue</TH>
                <TH className="text-right">Share of campaign revenue</TH>
                <TH className="w-8" aria-label="Open offer report" />
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.offer_id}>
                  <TD>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800 dark:text-neutral-200">
                        {r.offer_name ?? r.offer_id}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-neutral-500">{r.offer_id}</span>
                    </div>
                  </TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.clicks)}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.conversions)}</TD>
                  <TD className="text-right tabular-nums">{r.clicks > 0 ? fmtPct(r.cvr) : '—'}</TD>
                  <TD className="text-right tabular-nums font-semibold text-slate-900 dark:text-neutral-100">{fmtMoney(r.revenue)}</TD>
                  <TD className="text-right tabular-nums">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-neutral-400">{(r.share_of_revenue * 100).toFixed(1)}%</span>
                      <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-neutral-800">
                        <div
                          className="h-1.5 rounded-full bg-brand-500/70 dark:bg-brand-500/60"
                          style={{ width: `${(r.share_of_revenue * 100).toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  </TD>
                  <TD className="text-right">
                    {r.offer_id !== 'unknown' ? (
                      <Link
                        to={`/reports/offers/${encodeURIComponent(r.offer_id)}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}
                        className="inline-flex"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ChevronRight className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                      </Link>
                    ) : null}
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

// ── Spend editor ────────────────────────────────────────────────────

function SpendEditorCard({
  campaignId, range, spendDays, series,
}: {
  campaignId: string;
  range: ReportRange;
  spendDays: CampaignSpendDay[];
  series: CampaignDetailDailyPoint[];
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState<string>(() => series[series.length - 1]?.date ?? '');
  const [spend, setSpend] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ d, s }: { d: string; s: number }) =>
      reportsApi.updateCampaignSpend(campaignId, d, s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-campaign-detail', campaignId, range.from, range.to] });
      qc.invalidateQueries({ queryKey: ['reports', 'campaigns'] });
      setSpend('');
      setError(null);
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    },
  });

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Pick a valid date.');
      return;
    }
    const n = Number(spend);
    if (!Number.isFinite(n) || n < 0) {
      setError('Enter a non-negative number for spend.');
      return;
    }
    mutation.mutate({ d: date, s: n });
  }

  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><PencilLine className="h-4 w-4 text-slate-400 dark:text-neutral-500" />Ad spend</span>}
        subtitle="Enter what you actually spent on this campaign per day. ROAS / ROI / profit on this page recalculate as soon as you save."
      />
      <CardBody className="space-y-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem]">
            <label className="label mb-1 text-xs">Date (UTC)</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="min-w-[10rem]">
            <label className="label mb-1 text-xs">Spend (USD)</label>
            <Input type="number" step="0.01" min="0" value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="0.00" />
          </div>
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
          {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
        </form>

        {spendDays.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            No spend recorded yet for this campaign in the visible window. Add a daily entry above and ROAS unlocks immediately.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH className="text-right">Spend</TH>
                  <TH className="text-right">Revenue</TH>
                  <TH className="text-right">Profit</TH>
                  <TH className="text-right">ROAS</TH>
                  <TH className="w-8"></TH>
                </TR>
              </THead>
              <TBody>
                {spendDays.map((d) => {
                  const profit = d.profit;
                  const roas = d.spend > 0 ? d.revenue / d.spend : 0;
                  return (
                    <TR key={d.date}>
                      <TD className="font-mono text-xs">{d.date}</TD>
                      <TD className="text-right tabular-nums">{fmtMoney(d.spend)}</TD>
                      <TD className="text-right tabular-nums">{fmtMoney(d.revenue)}</TD>
                      <TD className={cn(
                        'text-right tabular-nums font-semibold',
                        profit > 0 ? 'text-emerald-600 dark:text-emerald-400'
                        : profit < 0 ? 'text-red-600 dark:text-red-400'
                        : ''
                      )}>{fmtMoney(profit)}</TD>
                      <TD className="text-right tabular-nums">{fmtRoas(roas)}</TD>
                      <TD className="text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setDate(d.date);
                            setSpend(String(d.spend));
                          }}
                          title="Load into the editor above"
                          className="text-slate-400 hover:text-slate-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => mutation.mutate({ d: d.date, s: 0 })}
                          title="Clear spend (set to 0)"
                          className="ml-2 text-slate-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                          disabled={mutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Name editor ─────────────────────────────────────────────────────

function NameEditorCard({
  campaignId, currentName, range,
}: { campaignId: string; currentName: string | undefined; range: ReportRange }) {
  const qc = useQueryClient();
  const [name, setName] = useState<string>(currentName ?? '');
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (n: string) => reportsApi.updateCampaignName(campaignId, n),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['report-campaign-detail', campaignId, range.from, range.to] });
      qc.invalidateQueries({ queryKey: ['reports', 'campaigns'] });
      setSavedHint(`Name set to "${r.campaign_name}"`);
    },
    onError: (e: unknown) => {
      setSavedHint(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    },
  });

  return (
    <Card>
      <CardHeader
        title="Display name"
        subtitle="Optional human-readable label. Useful when the campaign id is a 10-digit Google Ads number."
      />
      <CardBody>
        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate(name.trim()); }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[16rem] flex-1">
            <label className="label mb-1 text-xs">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring sale 2026" />
          </div>
          <Button type="submit" size="sm" disabled={mutation.isPending || !name.trim() || name.trim() === currentName}>
            {mutation.isPending ? <Spinner /> : <Save className="h-3.5 w-3.5" />}
            Save name
          </Button>
        </form>
        {savedHint && (
          <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">{savedHint}</p>
        )}
      </CardBody>
    </Card>
  );
}

// ── Footprint card ──────────────────────────────────────────────────

function FootprintCard({
  campaign, samples,
}: {
  campaign: CampaignDetailResponse['campaign'];
  samples: CampaignDetailResponse['samples'];
}) {
  return (
    <Card>
      <CardHeader title="Campaign footprint" />
      <CardBody className="grid gap-2 text-sm sm:grid-cols-2">
        <Row label="Campaign ID" value={<code className="font-mono text-xs">{campaign.campaign_id}</code>} />
        <Row label="Source" value={campaign.source === 'gad_campaignid' ? 'gad_campaignid (Google Ads)' : 'utm_campaign'} />
        <Row label="First seen" value={campaign.first_seen ?? '—'} />
        <Row label="Last seen" value={campaign.last_seen ?? '—'} />
        <Row
          label="Sample size"
          value={
            <span className="text-xs">
              {fmtCount(samples.clicks_sampled)} clicks · {fmtCount(samples.conversions_sampled)} conversions
              {(samples.clicks_truncated || samples.conversions_truncated) && (
                <span className="ml-1 text-amber-600 dark:text-amber-400">(truncated — totals & series are exact)</span>
              )}
            </span>
          }
        />
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 dark:border-neutral-800">
      <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-neutral-400">{label}</span>
      <span className="min-w-0 truncate text-right text-slate-700 dark:text-neutral-200">{value}</span>
    </div>
  );
}
