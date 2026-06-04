import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CloudDownload,
  Info,
  PencilLine,
  Save,
  X,
  TrendingDown,
  TrendingUp,
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
import { RefreshButton } from '@/features/reports/RefreshButton';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fmtInr, fmtInrExact } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useUrlSyncedDateRange } from '@/lib/dateRange';
import { facebookAdsApi, fbCampaignReportsApi } from '@/features/connections/facebook/api';

// ── formatters (mirrors GAds CampaignDetailPage 1:1) ──────────────

const fmtCount = (v: number) =>
  new Intl.NumberFormat('en-IN', { notation: v >= 10_000 ? 'compact' : 'standard' }).format(v);

function fmtInrCompactAxis(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
}

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

function todayKey(): string { return new Date().toISOString().slice(0, 10); }
function monthStartKey(): string { return todayKey().slice(0, 8) + '01'; }

interface DailyRow {
  campaign_id: string;
  campaign_name?: string;
  date: string;
  clicks: number;
  postbacks: number;
  conversions: number;
  revenue: number;
  spend: number;
  approved: number;
  pending: number;
  rejected: number;
  offers: string[];
  fb_clicks?: number;
  fb_impressions?: number;
  fb_cpc?: number;
  fb_ctr?: number;
  fb_cpm?: number;
  fb_reach?: number;
}

// ── Page ────────────────────────────────────────────────────────────

export function FbCampaignDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const range = useUrlSyncedDateRange();
  const qc = useQueryClient();
  const isUntagged = id === 'fb_untagged';
  const [statusMsg, setStatusMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const detailQuery = useQuery({
    queryKey: ['fb-campaign-detail', id],
    queryFn: () => fbCampaignReportsApi.byCampaign(id),
    enabled: !!id,
    staleTime: 30_000,
  });

  // Sync window for the in-page "Sync Facebook data" button. Defaults to
  // 1st-of-month → today, mirroring the GAds detail page pattern. Could be
  // wired to facebookAdsApi.getSyncState if the operator wants the same
  // remembered window — for now the inline button works on a sensible default.
  const syncFacebook = useMutation({
    mutationFn: () => facebookAdsApi.sync(monthStartKey(), todayKey()),
    onSuccess: (r) => {
      setStatusMsg({
        tone: 'success',
        text:
          `Synced ${r.campaigns_updated.toLocaleString()} campaigns with ${fmtInr(r.total_spend_inr)} total ad spend ` +
          `(${(r.total_clicks ?? 0).toLocaleString()} clicks, ${(r.total_impressions ?? 0).toLocaleString()} impressions) ` +
          `from Meta Insights in ${(r.duration_ms / 1000).toFixed(1)}s.`,
      });
      qc.invalidateQueries({ queryKey: ['fb-campaign-detail', id] });
      qc.invalidateQueries({ queryKey: ['fb-campaign-summary'] });
      qc.invalidateQueries({ queryKey: ['fb-sync-state'] });
    },
    onError: (e) => {
      setStatusMsg({
        tone: 'error',
        text: `Meta Insights sync failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    },
  });

  const fromDay = range.from.slice(0, 10);
  const toDay = range.to.slice(0, 10);

  const filtered = useMemo<DailyRow[]>(() => {
    const rows = detailQuery.data?.items ?? [];
    return rows.filter((r) => r.date >= fromDay && r.date <= toDay);
  }, [detailQuery.data?.items, fromDay, toDay]);

  const head = filtered[0] ?? detailQuery.data?.items[0];

  const totals = useMemo(() => {
    const acc = filtered.reduce(
      (a, r) => ({
        clicks: a.clicks + r.clicks,
        postbacks: a.postbacks + r.postbacks,
        conversions: a.conversions + r.conversions,
        revenue: a.revenue + r.revenue,
        spend: a.spend + r.spend,
        approved: a.approved + r.approved,
        pending: a.pending + r.pending,
        rejected: a.rejected + r.rejected,
        fb_clicks: a.fb_clicks + (r.fb_clicks ?? 0),
        fb_impressions: a.fb_impressions + (r.fb_impressions ?? 0),
        fb_reach_sum: a.fb_reach_sum + (r.fb_reach ?? 0),
        fb_cpm_sum: a.fb_cpm_sum + (r.fb_cpm ?? 0),
        fb_cpm_days: a.fb_cpm_days + ((r.fb_cpm ?? 0) > 0 ? 1 : 0),
      }),
      { clicks: 0, postbacks: 0, conversions: 0, revenue: 0, spend: 0,
        approved: 0, pending: 0, rejected: 0,
        fb_clicks: 0, fb_impressions: 0, fb_reach_sum: 0, fb_cpm_sum: 0, fb_cpm_days: 0 },
    );
    const profit = acc.revenue - acc.spend;
    return {
      ...acc,
      profit,
      cvr: acc.clicks > 0 ? acc.conversions / acc.clicks : 0,
      epc: acc.clicks > 0 ? acc.revenue / acc.clicks : 0,
      roas: acc.spend > 0 ? acc.revenue / acc.spend : 0,
      roi: acc.spend > 0 ? (acc.revenue - acc.spend) / acc.spend : 0,
      fb_ctr: acc.fb_impressions > 0 ? acc.fb_clicks / acc.fb_impressions : 0,
      fb_cpc: acc.fb_clicks > 0 ? acc.spend / acc.fb_clicks : 0,
      // CPM = (spend / impressions) * 1000 — recompute from the aggregate so a
      // weighted-average view is correct vs. summing daily CPMs (which would
      // double-count days). fall back to the daily-average when we have CPM
      // per day but no impressions.
      fb_cpm:
        acc.fb_impressions > 0 ? (acc.spend / acc.fb_impressions) * 1000
        : acc.fb_cpm_days > 0 ? acc.fb_cpm_sum / acc.fb_cpm_days
        : 0,
      // Reach across the window — Meta's daily reach is unique-per-day, so the
      // sum is an upper bound (overlap inflates it). Surface as "≤" prefix.
      fb_reach: acc.fb_reach_sum,
    };
  }, [filtered]);

  const hasFb = totals.fb_impressions > 0 || totals.fb_clicks > 0;

  return (
    <>
      <PageHeader
        back={
          <Link
            to={`/fb-campaigns?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <ArrowLeft className="h-4 w-4" /> FB Campaigns
          </Link>
        }
        title={head?.campaign_name ?? id}
        description={
          filtered.length > 0
            ? `${id} • ${filtered.length} day${filtered.length === 1 ? '' : 's'} in window${isUntagged ? ' • synthetic (clicks with Meta identifier but no campaign tag)' : ''}`
            : id
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setStatusMsg(null); syncFacebook.mutate(); }}
              disabled={syncFacebook.isPending}
              title="Pull the latest spend / clicks / impressions / CTR / CPC / CPM / Reach from Meta Insights for this campaign."
            >
              {syncFacebook.isPending ? <Spinner /> : <CloudDownload className="h-3.5 w-3.5" />}
              {syncFacebook.isPending ? 'Syncing…' : 'Sync Facebook data'}
            </Button>
            <RefreshButton invalidateOnSuccess={[['fb-campaign-detail', id]]} />
            {isUntagged
              ? <Badge tone="amber">Untagged</Badge>
              : <Badge tone="blue">Facebook</Badge>}
          </div>
        }
      />

      {statusMsg && (
        <div
          className={cn(
            'mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
            statusMsg.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
          )}
        >
          {statusMsg.tone === 'success'
            ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
            : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <div className="flex-1">{statusMsg.text}</div>
          <button onClick={() => setStatusMsg(null)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Info className="h-8 w-8 text-slate-400 dark:text-neutral-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
                No data for this campaign in the selected window
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Widen the date range or pick a different campaign to see its daily breakdown.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          <KpiBand totals={totals} />

          <RevenueVsSpendChart series={filtered} />

          <div className="grid gap-6 lg:grid-cols-2">
            <DailyProfitChart series={filtered} />
            <RoasTrendChart series={filtered} />
          </div>

          <FbMetricsSection totals={totals} series={filtered} hasFb={hasFb} />

          <SpendEditorCard campaignId={id} rows={filtered} disabled={isUntagged} />

          {isUntagged && (
            <Card>
              <CardBody>
                <div className="flex items-start gap-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
                  <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Synthetic campaign</div>
                    <div className="mt-1 text-xs">
                      <code className="font-mono">fb_untagged</code> aggregates Meta-tagged clicks (fbclid / _fbc / _fbp) that
                      arrived without a campaign id. Spend cannot be set here — fix at the source by tagging your Meta ad
                      URLs with <code className="font-mono">utm_id={'{{'}campaign.id{'}}'}</code>
                      {' '}or <code className="font-mono">fb_campaign_id</code>.
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

// ── KPI band (parallel to GAds CampaignDetail's KpiGrid) ───────────

interface Totals {
  revenue: number; spend: number; profit: number; clicks: number;
  conversions: number; cvr: number; epc: number; roas: number; roi: number;
  fb_clicks: number; fb_impressions: number; fb_ctr: number; fb_cpc: number;
  fb_cpm: number; fb_reach: number;
  approved: number; pending: number; rejected: number;
}

function KpiBand({ totals }: { totals: Totals }) {
  const profitTone = totals.profit > 0 ? 'positive' : totals.profit < 0 ? 'negative' : 'neutral';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Revenue"
          value={fmtInr(totals.revenue)}
          tooltip={fmtInrExact(totals.revenue)}
          sub={`${fmtCount(totals.clicks)} clicks`}
          highlight
        />
        <Kpi
          label="Ad spend"
          value={totals.spend > 0 ? fmtInr(totals.spend) : '—'}
          tooltip={totals.spend > 0 ? fmtInrExact(totals.spend) : undefined}
          sub={totals.spend > 0 ? 'from Meta Insights / manual' : 'spend not entered'}
        />
        <Kpi
          label="Profit"
          value={totals.spend > 0 ? fmtInr(totals.profit) : '—'}
          tooltip={totals.spend > 0 ? fmtInrExact(totals.profit) : undefined}
          sub={totals.spend > 0 ? 'revenue − spend' : 'add spend to compute'}
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
        <Kpi
          label="ROI"
          value={totals.spend > 0 ? fmtRoi(totals.roi) : '—'}
          sub={totals.spend > 0 ? 'profit / spend' : '—'}
        />
        <Kpi
          label="Conversions"
          value={fmtCount(totals.conversions)}
          sub={
            totals.clicks > 0
              ? `${fmtPct(totals.cvr)} CVR · ${fmtInr(totals.epc)} EPC`
              : '—'
          }
        />
      </div>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-3">
        <SmallStat label="Approved" value={fmtCount(totals.approved)} tone="positive" />
        <SmallStat label="Pending" value={fmtCount(totals.pending)} tone="neutral" />
        <SmallStat label="Rejected" value={fmtCount(totals.rejected)} tone="negative" />
      </div>
    </div>
  );
}

function Kpi({
  label, value, sub, tooltip, highlight, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tooltip?: string;
  highlight?: boolean;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <Card className={cn(highlight && 'ring-1 ring-brand-300/50 dark:ring-brand-500/30')}>
      <div className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          {label}
        </div>
        <div
          className={cn(
            'mt-1.5 text-2xl font-semibold tracking-tight tabular-nums',
            tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
            tone === 'negative' && 'text-red-600 dark:text-red-400',
            !tone && (highlight ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-neutral-100')
          )}
          title={tooltip}
        >
          {value}
        </div>
        {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">{sub}</div>}
      </div>
    </Card>
  );
}

function SmallStat({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'negative' | 'neutral' }) {
  return (
    <Card>
      <div className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-neutral-400">{label}</div>
        <div
          className={cn(
            'mt-1 text-lg font-semibold tabular-nums',
            tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
            tone === 'negative' && 'text-red-600 dark:text-red-400',
            tone === 'neutral' && 'text-slate-700 dark:text-neutral-300',
          )}
        >
          {value}
        </div>
      </div>
    </Card>
  );
}

// ── FB Metrics Section (parallel to GadsMetricsSection) ────────────

function FbMetricsSection({
  totals, series, hasFb,
}: { totals: Totals; series: DailyRow[]; hasFb: boolean }) {
  return (
    <Card>
      <CardHeader
        title="Facebook Insights metrics"
        subtitle="Clicks, impressions, CTR, CPC, CPM and Reach pulled directly from Meta Insights for this campaign. Synced when you press Sync Facebook data above or run the orchestrated Refresh."
      />
      <CardBody className={hasFb ? 'space-y-5' : undefined}>
        {!hasFb ? (
          <EmptyState
            title="No Meta Insights data for this campaign in this window"
            description="Either the campaign is tagged with utm_campaign without a Meta utm_source, or no Insights sync has run for the date range. Press Sync Facebook data above to pull the latest metrics."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <FbKpi label="FB Clicks" value={fmtCount(totals.fb_clicks)} sub="from Meta Insights" />
              <FbKpi
                label="FB CTR"
                value={fmtPct(totals.fb_ctr)}
                sub={`${fmtCount(totals.fb_impressions)} impressions`}
              />
              <FbKpi
                label="FB Impressions"
                value={fmtCount(totals.fb_impressions)}
                sub="from Meta Insights"
              />
              <FbKpi
                label="FB CPC"
                value={totals.fb_cpc > 0 ? fmtInr(totals.fb_cpc) : '—'}
                tooltip={totals.fb_cpc > 0 ? fmtInrExact(totals.fb_cpc) : undefined}
                sub="spend ÷ FB clicks"
              />
              <FbKpi
                label="FB CPM"
                value={totals.fb_cpm > 0 ? fmtInr(totals.fb_cpm) : '—'}
                tooltip={totals.fb_cpm > 0 ? fmtInrExact(totals.fb_cpm) : undefined}
                sub="cost per 1k impressions"
              />
              <FbKpi
                label="FB Reach"
                value={totals.fb_reach > 0 ? `≤ ${fmtCount(totals.fb_reach)}` : '—'}
                sub="upper bound (daily sum, overlap inflates)"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FbClicksImpressionsChart series={series} />
              <FbCtrCpcChart series={series} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FbCpmChart series={series} />
              <FbReachChart series={series} />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function FbKpi({
  label, value, sub, tooltip,
}: { label: string; value: string; sub?: string; tooltip?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:text-brand-300">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-neutral-100" title={tooltip}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400">{sub}</div>}
    </div>
  );
}

function FbClicksImpressionsChart({ series }: { series: DailyRow[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const clicksColor = dark ? '#60a5fa' : '#2563eb';
  const imprColor = dark ? '#fbbf24' : '#d97706';

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-700 dark:text-neutral-300">
        Clicks vs impressions (Meta)
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
            <YAxis
              yAxisId="clicks"
              tick={{ fill: axis, fontSize: 11 }}
              stroke={grid}
              tickLine={false}
              tickFormatter={(v) => new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(Number(v))}
              width={48}
            />
            <YAxis
              yAxisId="impr"
              orientation="right"
              tick={{ fill: axis, fontSize: 11 }}
              stroke={grid}
              tickLine={false}
              tickFormatter={(v) => new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(Number(v))}
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
              formatter={(value, name) => [new Intl.NumberFormat('en-IN').format(Number(value)), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: axis }} iconType="circle" />
            <Bar yAxisId="impr" dataKey="fb_impressions" name="Impressions" fill={imprColor} fillOpacity={0.4} />
            <Line yAxisId="clicks" type="monotone" dataKey="fb_clicks" name="Clicks" stroke={clicksColor} strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FbCtrCpcChart({ series }: { series: DailyRow[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const ctrColor = dark ? '#34d399' : '#059669';
  const cpcColor = dark ? '#f472b6' : '#db2777';

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-700 dark:text-neutral-300">
        CTR vs CPC (Meta)
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
            <YAxis
              yAxisId="ctr"
              tick={{ fill: axis, fontSize: 11 }}
              stroke={grid}
              tickLine={false}
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
              width={48}
            />
            <YAxis
              yAxisId="cpc"
              orientation="right"
              tick={{ fill: axis, fontSize: 11 }}
              stroke={grid}
              tickLine={false}
              tickFormatter={(v) => fmtInrCompactAxis(Number(v))}
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
              formatter={(value, name) => {
                if (name === 'CTR') return [`${(Number(value) * 100).toFixed(2)}%`, 'CTR'];
                return [fmtInrExact(Number(value)), 'CPC'];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: axis }} iconType="circle" />
            <Line yAxisId="ctr" type="monotone" dataKey="fb_ctr" name="CTR" stroke={ctrColor} strokeWidth={2} dot={{ r: 2 }} />
            <Line yAxisId="cpc" type="monotone" dataKey="fb_cpc" name="CPC" stroke={cpcColor} strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FbCpmChart({ series }: { series: DailyRow[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const cpmColor = dark ? '#fb923c' : '#ea580c';

  const data = series.map((p) => ({ date: p.date, fb_cpm: p.fb_cpm ?? 0 }));

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-700 dark:text-neutral-300">
        CPM (cost per 1k impressions, Meta)
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
            <YAxis
              tick={{ fill: axis, fontSize: 11 }}
              stroke={grid}
              tickLine={false}
              tickFormatter={(v) => fmtInrCompactAxis(Number(v))}
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
              formatter={(value) => [fmtInrExact(Number(value)), 'CPM']}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: axis }} iconType="circle" />
            <Line type="monotone" dataKey="fb_cpm" name="CPM" stroke={cpmColor} strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FbReachChart({ series }: { series: DailyRow[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const reachColor = dark ? '#22d3ee' : '#0891b2';

  const data = series.map((p) => ({ date: p.date, fb_reach: p.fb_reach ?? 0 }));

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-700 dark:text-neutral-300">
        Reach (unique users per day, Meta)
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
            <YAxis
              tick={{ fill: axis, fontSize: 11 }}
              stroke={grid}
              tickLine={false}
              tickFormatter={(v) => new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(Number(v))}
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
              formatter={(value) => [new Intl.NumberFormat('en-IN').format(Number(value)), 'Reach']}
            />
            <Bar dataKey="fb_reach" name="Reach" fill={reachColor} fillOpacity={0.5} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Revenue/Profit/ROAS charts (mirror GAds detail page) ───────────

function RevenueVsSpendChart({ series }: { series: DailyRow[] }) {
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
        subtitle="Daily totals for this campaign. Green above red means profitable; red above green means burning money."
      />
      <CardBody className="p-0">
        <div className="h-72 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fb-detail-rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={revColor} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={revColor} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fb-detail-spend-grad" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={(v) => fmtInrCompactAxis(Number(v))}
                width={64}
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
                  if (value == null) return ['—', String(name)];
                  return [fmtInrExact(Number(value)), String(name)];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: axis }} iconType="circle" />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={revColor} fill="url(#fb-detail-rev-grad)" strokeWidth={2} />
              <Area type="monotone" dataKey="spend" name="Ad spend" stroke={spendColor} fill="url(#fb-detail-spend-grad)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

function DailyProfitChart({ series }: { series: DailyRow[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const positive = dark ? '#34d399' : '#059669';
  const negative = dark ? '#f87171' : '#dc2626';

  const data = series.map((p) => ({ date: p.date, profit: p.revenue - p.spend }));

  return (
    <Card>
      <CardHeader
        title="Daily profit"
        subtitle="Revenue minus spend, day by day. Red bars are loss days — investigate creative, audience or bid changes around them."
      />
      <CardBody className="p-0">
        <div className="h-64 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
              <YAxis
                tick={{ fill: axis, fontSize: 11 }}
                stroke={grid}
                tickLine={false}
                tickFormatter={(v) => fmtInrCompactAxis(Number(v))}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: dark ? '#171717' : '#ffffff',
                  border: `1px solid ${dark ? '#404040' : '#e2e8f0'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d) => new Date(String(d)).toDateString()}
                formatter={(value) => [fmtInrExact(Number(value)), 'Profit']}
              />
              <Bar dataKey="profit" name="Profit" radius={[2, 2, 0, 0]}>
                {data.map((p, i) => (
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

function RoasTrendChart({ series }: { series: DailyRow[] }) {
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
        subtitle="Daily ROAS. Above 1× the campaign earns more than it spends."
      />
      <CardBody className="p-0">
        <div className="h-64 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtDateShort} stroke={grid} tickLine={false} />
              <YAxis
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
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Per-day editable spend table (matches the per-campaign report style) ──

function SpendEditorCard({
  campaignId,
  rows,
  disabled,
}: {
  campaignId: string;
  rows: DailyRow[];
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const setSpend = useMutation({
    mutationFn: (payload: { date: string; spend: number }) =>
      fbCampaignReportsApi.setSpend({ campaign_id: campaignId, ...payload }),
    onSuccess: () => {
      setEditingDate(null);
      setMsg({ tone: 'success', text: 'Spend saved.' });
      qc.invalidateQueries({ queryKey: ['fb-campaign-detail', campaignId] });
      qc.invalidateQueries({ queryKey: ['fb-campaign-summary'] });
    },
    onError: (e) => {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    },
  });

  return (
    <Card>
      <CardHeader
        title="Per-day breakdown"
        subtitle={
          disabled
            ? 'Spend cannot be set on a synthetic campaign. Tag the source clicks instead.'
            : 'Click any spend cell to edit. Operator-entered values override what Meta Insights pulls — the next sync overwrites them again with canonical Meta numbers.'
        }
      />
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH rowSpan={2}>Date</TH>
              <TH rowSpan={2} className="text-right">Clicks</TH>
              <TH rowSpan={2} className="text-right">Conversions</TH>
              <TH rowSpan={2} className="text-right">Revenue</TH>
              <TH rowSpan={2} className="text-right">Spend</TH>
              <TH rowSpan={2} className="text-right">Profit</TH>
              <TH rowSpan={2} className="text-right">ROAS</TH>
              <TH
                colSpan={5}
                className="border-l border-slate-200 text-center text-[11px] uppercase tracking-wide text-blue-700 dark:border-neutral-800 dark:text-brand-300"
                title="Metrics pulled directly from Meta Insights (per-campaign, per-day)."
              >
                META
              </TH>
              {!disabled && <TH rowSpan={2} className="w-8" />}
            </TR>
            <TR>
              <TH className="border-l border-slate-200 text-right dark:border-neutral-800">Clicks</TH>
              <TH className="text-right">CTR</TH>
              <TH className="text-right">Impr</TH>
              <TH className="text-right">CPC</TH>
              <TH className="text-right">CPM</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const profit = r.revenue - r.spend;
              const roas = r.spend > 0 ? r.revenue / r.spend : 0;
              const profitTone =
                r.spend === 0 ? 'text-slate-500 dark:text-neutral-400'
                : profit > 0 ? 'text-emerald-600 dark:text-emerald-400'
                : profit < 0 ? 'text-red-600 dark:text-red-400'
                : 'text-slate-500 dark:text-neutral-400';
              const editing = editingDate === r.date;
              const hasFb = (r.fb_impressions ?? 0) > 0 || (r.fb_clicks ?? 0) > 0;
              return (
                <TR key={r.date}>
                  <TD className="font-mono text-xs">{r.date}</TD>
                  <TD className="text-right tabular-nums">{fmtCount(r.clicks)}</TD>
                  <TD className="text-right tabular-nums">
                    {fmtCount(r.conversions)}
                    {(r.pending > 0 || r.rejected > 0) && (
                      <div className="text-[11px] text-slate-500 dark:text-neutral-500">
                        {r.approved}A · {r.pending}P · {r.rejected}R
                      </div>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums" title={fmtInrExact(r.revenue)}>
                    {fmtInr(r.revenue)}
                  </TD>
                  <TD className="text-right tabular-nums" title={r.spend > 0 ? fmtInrExact(r.spend) : undefined}>
                    {editing ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="h-7 w-28 text-right text-xs"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const n = Number(editingValue);
                            if (!Number.isFinite(n) || n < 0) return;
                            setSpend.mutate({ date: r.date, spend: n });
                          }}
                          disabled={setSpend.isPending}
                          title="Save"
                        >
                          {setSpend.isPending ? <Spinner /> : <Save className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingDate(null)} title="Cancel">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : r.spend > 0 ? (
                      fmtInr(r.spend)
                    ) : (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">not set</span>
                    )}
                  </TD>
                  <TD className={cn('text-right tabular-nums font-semibold', profitTone)}>
                    {r.spend > 0 ? fmtInr(profit) : '—'}
                  </TD>
                  <TD className="text-right tabular-nums">
                    <span className={cn(
                      'inline-flex items-center gap-0.5',
                      r.spend === 0 && 'text-slate-400 dark:text-neutral-500',
                      r.spend > 0 && roas >= 1 && 'text-emerald-600 dark:text-emerald-400',
                      r.spend > 0 && roas < 1 && 'text-red-600 dark:text-red-400'
                    )}>
                      {r.spend > 0 && roas >= 1 && <TrendingUp className="h-3 w-3" />}
                      {r.spend > 0 && roas < 1 && <TrendingDown className="h-3 w-3" />}
                      {fmtRoas(roas)}
                    </span>
                  </TD>
                  {/* META block */}
                  <TD className="border-l border-slate-200 text-right tabular-nums dark:border-neutral-800">
                    {hasFb ? fmtCount(r.fb_clicks ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {hasFb ? fmtPct(r.fb_ctr ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {hasFb ? fmtCount(r.fb_impressions ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
                  </TD>
                  <TD className="text-right tabular-nums" title={(r.fb_cpc ?? 0) > 0 ? fmtInrExact(r.fb_cpc ?? 0) : undefined}>
                    {(r.fb_cpc ?? 0) > 0 ? fmtInr(r.fb_cpc ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
                  </TD>
                  <TD className="text-right tabular-nums" title={(r.fb_cpm ?? 0) > 0 ? fmtInrExact(r.fb_cpm ?? 0) : undefined}>
                    {(r.fb_cpm ?? 0) > 0 ? fmtInr(r.fb_cpm ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
                  </TD>
                  {!disabled && (
                    <TD className="text-right">
                      {!editing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingDate(r.date);
                            setEditingValue(String(r.spend || ''));
                          }}
                          title="Edit spend"
                        >
                          <PencilLine className="h-3 w-3" />
                        </Button>
                      )}
                    </TD>
                  )}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
      {msg && (
        <div className="border-t border-slate-200 px-4 py-2 text-xs dark:border-neutral-800">
          <div className={cn(
            'flex items-center gap-2',
            msg.tone === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
          )}>
            {msg.text}
            <button
              onClick={() => setMsg(null)}
              className="ml-auto opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
