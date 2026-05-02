import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronRight,
  CheckCircle2,
  Database,
  Info,
  Inbox,
  Megaphone,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fmtMoney } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { reportsApi } from '@/features/reports/api';
import { ReportFilters, buildPresetRange, type ReportRange } from '@/features/reports/ReportFilters';
import type {
  CampaignDailyPoint,
  CampaignInsight,
  CampaignReportSummary,
  CampaignReportsResponse,
} from '@/types';

const fmtCount = (v: number) =>
  new Intl.NumberFormat(undefined, { notation: v >= 10_000 ? 'compact' : 'standard' }).format(v);

const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';

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

type SortKey =
  | 'revenue' | 'spend' | 'profit' | 'roas' | 'roi'
  | 'clicks' | 'conversions' | 'cvr' | 'epc' | 'name';

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Campaign',
  clicks: 'Clicks',
  conversions: 'Conversions',
  revenue: 'Revenue',
  spend: 'Spend',
  profit: 'Profit',
  roas: 'ROAS',
  roi: 'ROI',
  cvr: 'CVR',
  epc: 'EPC',
};

export function CampaignReportsPage() {
  const [range, setRange] = useState<ReportRange>(() => buildPresetRange('30d'));
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [backfillMsg, setBackfillMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const reportQuery = useQuery({
    queryKey: ['reports', 'campaigns', range.from, range.to],
    queryFn: () => reportsApi.campaigns({ from: range.from, to: range.to }),
    staleTime: 30_000,
  });

  const backfill = useMutation({
    mutationFn: () => reportsApi.backfillCampaigns({ from: range.from, to: range.to }),
    onSuccess: (r) => {
      setBackfillMsg({
        tone: 'success',
        text:
          `Rebuilt from ${r.clicks_scanned.toLocaleString()} clicks ` +
          `(${r.clicks_with_campaign.toLocaleString()} tagged) and ` +
          `${r.conversions_scanned.toLocaleString()} conversions ` +
          `(${r.conversions_with_campaign.toLocaleString()} attributed) ` +
          `into ${r.buckets_written.toLocaleString()} campaign-day buckets ` +
          `(${(r.duration_ms / 1000).toFixed(1)}s).`,
      });
      qc.invalidateQueries({ queryKey: ['reports', 'campaigns'] });
      qc.invalidateQueries({ queryKey: ['report-campaign-detail'] });
    },
    onError: (e: unknown) => {
      setBackfillMsg({
        tone: 'error',
        text: `Rebuild failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    },
  });

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Per-campaign performance with ad spend, ROAS and ROI. Campaign IDs come from gad_campaignid (Google Ads) or utm_campaign on the click URL."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setBackfillMsg(null); backfill.mutate(); }}
              disabled={backfill.isPending}
              title="Rebuild the campaign rollup from your historical clicks + conversions. Idempotent. Operator-entered spend is preserved."
            >
              {backfill.isPending ? <Spinner /> : <Database className="h-3.5 w-3.5" />}
              {backfill.isPending ? 'Rebuilding…' : 'Rebuild from source'}
            </Button>
            {reportQuery.isFetching && <Spinner className="text-slate-400 dark:text-neutral-500" />}
          </div>
        }
      />

      <div className="mb-6">
        <ReportFilters value={range} onChange={setRange} />
      </div>

      {backfillMsg && (
        <div
          className={cn(
            'mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
            backfillMsg.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
          )}
        >
          {backfillMsg.tone === 'success'
            ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
            : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <div className="flex-1">{backfillMsg.text}</div>
          <button
            onClick={() => setBackfillMsg(null)}
            className="opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {reportQuery.isLoading ? (
        <CenteredSpinner />
      ) : reportQuery.isError || !reportQuery.data ? (
        <Card>
          <div className="flex items-start gap-2 p-5 text-sm text-slate-600 dark:text-neutral-300">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div>
              Couldn't load campaign reports.{' '}
              {reportQuery.error instanceof Error ? reportQuery.error.message : 'Please try again.'}
            </div>
          </div>
        </Card>
      ) : reportQuery.data.campaigns.length === 0 ? (
        <EmptyCampaignsCard
          onRebuild={() => { setBackfillMsg(null); backfill.mutate(); }}
          rebuilding={backfill.isPending}
        />
      ) : (
        <Body
          data={reportQuery.data}
          range={range}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k) => {
            if (sortKey === k) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
            else { setSortKey(k); setSortDir('desc'); }
          }}
          onOpenCampaign={(id) =>
            navigate(`/campaigns/${encodeURIComponent(id)}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`)
          }
        />
      )}
    </>
  );
}

function EmptyCampaignsCard({ onRebuild, rebuilding }: { onRebuild: () => void; rebuilding: boolean }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Megaphone className="h-10 w-10 text-slate-400 dark:text-neutral-500" />
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">
              No campaign data in this window
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500 dark:text-neutral-400">
              The campaign rollup is populated forward-only from new clicks and postbacks tagged with{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">gad_campaignid</code>
              {' '}or{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">utm_campaign</code>.
              {' '}If you already have historical clicks, click <strong>Rebuild from source</strong> to backfill the rollup. It is idempotent
              and preserves any per-day ad spend you've already entered.
            </p>
          </div>
          <Button onClick={onRebuild} disabled={rebuilding}>
            {rebuilding ? <Spinner /> : <Database className="h-4 w-4" />}
            {rebuilding ? 'Rebuilding…' : 'Rebuild from source'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Body({
  data, range, sortKey, sortDir, onSort, onOpenCampaign,
}: {
  data: CampaignReportsResponse;
  range: ReportRange;
  sortKey: SortKey;
  sortDir: 'desc' | 'asc';
  onSort: (k: SortKey) => void;
  onOpenCampaign: (id: string) => void;
}) {
  const sorted = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1;
    const arr = data.campaigns.slice();
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * (a.campaign_name ?? a.campaign_id).localeCompare(b.campaign_name ?? b.campaign_id);
        case 'clicks': return dir * (a.clicks - b.clicks);
        case 'conversions': return dir * (a.conversions - b.conversions);
        case 'spend': return dir * (a.spend - b.spend);
        case 'profit': return dir * (a.profit - b.profit);
        case 'roas': return dir * (a.roas - b.roas);
        case 'roi': return dir * (a.roi - b.roi);
        case 'cvr': return dir * (a.cvr - b.cvr);
        case 'epc': return dir * (a.epc - b.epc);
        case 'revenue':
        default: return dir * (a.revenue - b.revenue);
      }
    });
    return arr;
  }, [data.campaigns, sortKey, sortDir]);

  const dailyAggregate = useMemo(() => buildDailyAggregate(data.campaigns), [data.campaigns]);

  void range;

  return (
    <div className="space-y-6">
      <InsightsBand insights={data.insights} />

      <KpiBand totals={data.totals} />

      <RevenueVsSpendChart series={dailyAggregate} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DailyProfitChart series={dailyAggregate} />
        <RoasTrendChart series={dailyAggregate} />
      </div>

      <CampaignsTable
        campaigns={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        onOpen={onOpenCampaign}
      />
    </div>
  );
}

function buildDailyAggregate(campaigns: CampaignReportSummary[]): CampaignDailyPoint[] {
  if (campaigns.length === 0) return [];
  const dates = campaigns[0]!.series.map((p) => p.date);
  return dates.map((date, i) => {
    let clicks = 0, postbacks = 0, conversions = 0, revenue = 0, spend = 0;
    for (const c of campaigns) {
      const p = c.series[i];
      if (!p) continue;
      clicks += p.clicks;
      postbacks += p.postbacks;
      conversions += p.conversions;
      revenue += p.revenue;
      spend += p.spend;
    }
    return { date, clicks, postbacks, conversions, revenue, spend, profit: revenue - spend };
  });
}

// ── Insights band ───────────────────────────────────────────────────

function InsightsBand({ insights }: { insights: CampaignInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="space-y-2">
      {insights.map((ins, i) => (
        <InsightBanner key={i} insight={ins} />
      ))}
    </div>
  );
}

function InsightBanner({ insight }: { insight: CampaignInsight }) {
  const tone =
    insight.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
    : insight.severity === 'warn'    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
    : insight.severity === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
    :                                  'border-blue-200 bg-blue-50 text-blue-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200';
  const Icon =
    insight.severity === 'critical' ? AlertCircle :
    insight.severity === 'warn' ? AlertTriangle :
    insight.severity === 'success' ? CheckCircle2 : Info;
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', tone)}>
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        <div className="font-medium">{insight.title}</div>
        {insight.detail && <div className="mt-0.5 text-xs opacity-90">{insight.detail}</div>}
      </div>
    </div>
  );
}

// ── KPI band ────────────────────────────────────────────────────────

function KpiBand({ totals }: { totals: CampaignReportsResponse['totals'] }) {
  const profitTone = totals.profit > 0 ? 'positive' : totals.profit < 0 ? 'negative' : 'neutral';
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Revenue"
        value={fmtMoney(totals.revenue)}
        sub={`${fmtCount(totals.clicks)} clicks`}
        highlight
      />
      <Kpi
        label="Ad spend"
        value={fmtMoney(totals.spend)}
        sub={
          totals.spend_coverage < 1
            ? `${(totals.spend_coverage * 100).toFixed(0)}% coverage`
            : 'all campaigns'
        }
      />
      <Kpi
        label="Profit"
        value={fmtMoney(totals.profit)}
        sub={
          totals.spend > 0
            ? `${totals.profitable_campaigns} winning · ${totals.unprofitable_campaigns} losing`
            : 'spend not entered'
        }
        tone={profitTone}
      />
      <Kpi
        label="ROAS"
        value={fmtRoas(totals.roas)}
        sub={
          totals.roas >= 2 ? 'healthy'
          : totals.roas >= 1 ? 'breakeven'
          : totals.spend > 0 ? 'underwater' : 'no spend'
        }
        tone={totals.roas >= 1.5 ? 'positive' : totals.roas > 0 && totals.roas < 1 ? 'negative' : 'neutral'}
      />
      <Kpi label="ROI" value={fmtRoi(totals.roi)} sub={`avg across ${totals.campaigns} campaigns`} />
      <Kpi
        label="Conversions"
        value={fmtCount(totals.conversions)}
        sub={totals.clicks > 0 ? `${fmtPct(totals.cvr)} CVR · ${fmtMoney(totals.epc)} EPC` : '—'}
      />
    </div>
  );
}

function Kpi({
  label, value, sub, highlight, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
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
        {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">{sub}</div>}
      </div>
    </Card>
  );
}

// ── Charts ───────────────────────────────────────────────────────────

function RevenueVsSpendChart({ series }: { series: CampaignDailyPoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const revColor = dark ? '#34d399' : '#059669';
  const spendColor = dark ? '#f87171' : '#dc2626';

  return (
    <Card>
      <CardHeader
        title="Revenue vs ad spend"
        subtitle="Daily totals across all campaigns. Green above red means profitable; red above green means burning money."
      />
      <CardBody className="p-0">
        <div className="h-72 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={revColor} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={revColor} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="spend-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={spendColor} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={spendColor} stopOpacity={0.05} />
                </linearGradient>
              </defs>
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
                formatter={(value, name) => [fmtMoney(Number(value)), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: axis }} iconType="circle" />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={revColor} fill="url(#rev-grad)" strokeWidth={2} />
              <Area type="monotone" dataKey="spend" name="Ad spend" stroke={spendColor} fill="url(#spend-grad)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

function DailyProfitChart({ series }: { series: CampaignDailyPoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const positive = dark ? '#34d399' : '#059669';
  const negative = dark ? '#f87171' : '#dc2626';

  return (
    <Card>
      <CardHeader
        title="Daily profit"
        subtitle="Revenue minus spend, day by day. Red bars are loss days — investigate creative, audience or bid changes around them."
      />
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
              <Bar dataKey="profit" name="Profit" radius={[2, 2, 0, 0]}>
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

function RoasTrendChart({ series }: { series: CampaignDailyPoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const lineColor = dark ? '#a78bfa' : '#7c3aed';

  const data = series.map((p) => ({
    date: p.date,
    roas: p.spend > 0 ? p.revenue / p.spend : null,
  }));

  return (
    <Card>
      <CardHeader
        title="ROAS trend"
        subtitle="Daily ROAS. Above 1× the campaign earns more than it spends. Look for the line crossing 1 — that's the day spend started returning."
      />
      <CardBody className="p-0">
        <div className="h-64 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
              <YAxis
                tick={{ fill: axis, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                tickFormatter={(v) => `${Number(v).toFixed(1)}×`}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: dark ? '#171717' : '#ffffff',
                  border: `1px solid ${dark ? '#404040' : '#e2e8f0'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d) => new Date(String(d)).toDateString()}
                formatter={(value) => [value == null ? '—' : `${Number(value).toFixed(2)}×`, 'ROAS']}
              />
              <Line
                type="monotone"
                dataKey="roas"
                name="ROAS"
                stroke={lineColor}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Table ────────────────────────────────────────────────────────────

function CampaignsTable({
  campaigns, sortKey, sortDir, onSort, onOpen,
}: {
  campaigns: CampaignReportSummary[];
  sortKey: SortKey;
  sortDir: 'desc' | 'asc';
  onSort: (k: SortKey) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Per-campaign metrics"
        subtitle="Click a row to drill into a campaign. Edit per-day spend on the detail page."
      />
      <div className="overflow-x-auto">
        {campaigns.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState icon={<Inbox className="h-8 w-8" />} title="No campaigns" description="" />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <SortHeader label={SORT_LABEL.name} active={sortKey==='name'} dir={sortDir} onClick={() => onSort('name')} />
                <SortHeader label={SORT_LABEL.clicks} active={sortKey==='clicks'} dir={sortDir} onClick={() => onSort('clicks')} align="right" />
                <SortHeader label={SORT_LABEL.conversions} active={sortKey==='conversions'} dir={sortDir} onClick={() => onSort('conversions')} align="right" />
                <SortHeader label={SORT_LABEL.cvr} active={sortKey==='cvr'} dir={sortDir} onClick={() => onSort('cvr')} align="right" />
                <SortHeader label={SORT_LABEL.epc} active={sortKey==='epc'} dir={sortDir} onClick={() => onSort('epc')} align="right" />
                <SortHeader label={SORT_LABEL.revenue} active={sortKey==='revenue'} dir={sortDir} onClick={() => onSort('revenue')} align="right" />
                <SortHeader label={SORT_LABEL.spend} active={sortKey==='spend'} dir={sortDir} onClick={() => onSort('spend')} align="right" />
                <SortHeader label={SORT_LABEL.profit} active={sortKey==='profit'} dir={sortDir} onClick={() => onSort('profit')} align="right" />
                <SortHeader label={SORT_LABEL.roas} active={sortKey==='roas'} dir={sortDir} onClick={() => onSort('roas')} align="right" />
                <SortHeader label={SORT_LABEL.roi} active={sortKey==='roi'} dir={sortDir} onClick={() => onSort('roi')} align="right" />
                <TH>Trend</TH>
                <TH className="w-8" aria-label="Open detail" />
              </TR>
            </THead>
            <TBody>
              {campaigns.map((row) => (
                <CampaignRow key={row.campaign_id} row={row} onOpen={() => onOpen(row.campaign_id)} />
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

function CampaignRow({ row, onOpen }: { row: CampaignReportSummary; onOpen: () => void }) {
  const profitTone =
    row.spend === 0 ? 'text-slate-500 dark:text-neutral-400'
    : row.profit > 0 ? 'text-emerald-600 dark:text-emerald-400'
    : row.profit < 0 ? 'text-red-600 dark:text-red-400'
    : 'text-slate-500 dark:text-neutral-400';
  return (
    <TR
      className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-neutral-800/50"
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      tabIndex={0}
      role="button"
      aria-label={`Open detail for campaign ${row.campaign_name ?? row.campaign_id}`}
    >
      <TD>
        <div className="flex flex-col">
          <div className="font-medium text-slate-800 dark:text-neutral-200">
            {row.campaign_name ?? row.campaign_id}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-neutral-500">
            <span className="font-mono">{row.campaign_id}</span>
            <Badge tone={row.source === 'gad_campaignid' ? 'blue' : 'amber'}>
              {row.source === 'gad_campaignid' ? 'Google Ads' : 'UTM'}
            </Badge>
          </div>
        </div>
      </TD>
      <TD className="text-right tabular-nums">{fmtCount(row.clicks)}</TD>
      <TD className="text-right tabular-nums">
        {fmtCount(row.conversions)}
        {row.unverified > 0 && (
          <div className="text-[11px] text-amber-600 dark:text-amber-400">{fmtCount(row.unverified)} unverified</div>
        )}
      </TD>
      <TD className="text-right tabular-nums">{row.clicks > 0 ? fmtPct(row.cvr) : '—'}</TD>
      <TD className="text-right tabular-nums">{row.clicks > 0 ? fmtMoney(row.epc) : '—'}</TD>
      <TD className="text-right tabular-nums font-semibold text-slate-900 dark:text-neutral-100">{fmtMoney(row.revenue)}</TD>
      <TD className="text-right tabular-nums">
        {row.spend > 0 ? fmtMoney(row.spend) : <span className="text-amber-600 dark:text-amber-400 text-[11px]">not set</span>}
      </TD>
      <TD className={cn('text-right tabular-nums font-semibold', profitTone)}>
        {row.spend > 0 ? fmtMoney(row.profit) : '—'}
      </TD>
      <TD className="text-right tabular-nums">
        <span className={cn(
          'inline-flex items-center gap-0.5',
          row.spend === 0 && 'text-slate-400 dark:text-neutral-500',
          row.spend > 0 && row.roas >= 1 && 'text-emerald-600 dark:text-emerald-400',
          row.spend > 0 && row.roas < 1 && 'text-red-600 dark:text-red-400'
        )}>
          {row.spend > 0 && row.roas >= 1 && <TrendingUp className="h-3 w-3" />}
          {row.spend > 0 && row.roas < 1 && <TrendingDown className="h-3 w-3" />}
          {fmtRoas(row.roas)}
        </span>
      </TD>
      <TD className="text-right tabular-nums">{row.spend > 0 ? fmtRoi(row.roi) : '—'}</TD>
      <TD>
        <ProfitSparkline series={row.series} />
      </TD>
      <TD className="text-right">
        <ChevronRight className="h-4 w-4 text-slate-400 dark:text-neutral-500" aria-hidden />
      </TD>
    </TR>
  );
}

function SortHeader({
  label, active, dir, onClick, align = 'left',
}: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; align?: 'left' | 'right' }) {
  return (
    <TH className={align === 'right' ? 'text-right' : ''}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-neutral-200',
          active && 'text-slate-900 dark:text-neutral-100'
        )}
      >
        {label}
        {active && <span className="text-[10px]">{dir === 'desc' ? '▼' : '▲'}</span>}
      </button>
    </TH>
  );
}

// Profit-coloured inline trend. Each segment is green/red based on that day's
// profit so the operator can see at a glance "where it broke".
function ProfitSparkline({ series }: { series: CampaignDailyPoint[] }) {
  const w = 80;
  const h = 22;
  const max = Math.max(1, ...series.map((p) => Math.abs(p.profit)));
  const stepX = series.length > 1 ? w / (series.length - 1) : w;
  if (series.every((p) => p.profit === 0 && p.revenue === 0 && p.spend === 0)) {
    return <span className="inline-block text-[10px] text-slate-300 dark:text-neutral-700">flat</span>;
  }
  return (
    <svg width={w} height={h} className="overflow-visible" aria-label="profit trend">
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="currentColor" className="text-slate-200 dark:text-neutral-700" strokeWidth={0.5} />
      {series.map((p, i) => {
        if (i === 0) return null;
        const prev = series[i - 1]!;
        const x1 = (i - 1) * stepX;
        const x2 = i * stepX;
        const y1 = h / 2 - (prev.profit / max) * (h / 2);
        const y2 = h / 2 - (p.profit / max) * (h / 2);
        const positive = p.profit >= 0;
        return (
          <line
            key={i}
            x1={x1.toFixed(2)} y1={y1.toFixed(2)}
            x2={x2.toFixed(2)} y2={y2.toFixed(2)}
            stroke={positive ? '#10b981' : '#ef4444'}
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}
