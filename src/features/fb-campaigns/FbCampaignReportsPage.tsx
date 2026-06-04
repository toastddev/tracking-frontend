import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  CloudDownload,
  Download,
  Info,
  Inbox,
  Megaphone,
  Search,
  TrendingDown,
  TrendingUp,
  X,
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
  LineChart,
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
import { useDateRange } from '@/lib/dateRange';
import {
  facebookAdsApi,
  fbCampaignReportsApi,
  type FbCampaignDailyPoint,
  type FbCampaignDailyTotal,
  type FbCampaignInsight,
  type FbCampaignReportSummary,
  type FbCampaignReportsResponse,
} from '@/features/connections/facebook/api';

// ── helpers (mirrors GAds CampaignReportsPage's helper set 1:1) ──────────

interface FbCampaignDailyAggregatePoint extends FbCampaignDailyPoint {
  total_revenue_inr?: number;
  fb_only_revenue: number;
  fb_only_clicks: number;
  fb_revenue_share?: number;
  fb_click_share?: number;
}

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

function todayKey(): string { return new Date().toISOString().slice(0, 10); }
function monthStartKey(): string { return todayKey().slice(0, 8) + '01'; }

function fmtSyncedRelative(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
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

type SortKey =
  | 'name' | 'clicks' | 'conversions' | 'cvr' | 'epc'
  | 'revenue' | 'spend' | 'profit' | 'roas' | 'roi'
  | 'fb_clicks' | 'fb_impressions' | 'fb_ctr' | 'fb_cpc';

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
  fb_clicks: 'Clicks',
  fb_impressions: 'Impressions',
  fb_ctr: 'CTR',
  fb_cpc: 'CPC',
};

// ── Top-level page ──────────────────────────────────────────────────

export function FbCampaignReportsPage() {
  const { range } = useDateRange();
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [statusMsg, setStatusMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const reportQuery = useQuery({
    queryKey: ['fb-campaign-summary', range.from, range.to],
    queryFn: () => fbCampaignReportsApi.summary({ from: range.from, to: range.to }),
    staleTime: 30_000,
  });

  // Persisted Facebook Insights sync window. Mirrors the GAds page pattern.
  const syncStateQuery = useQuery({
    queryKey: ['fb-sync-state'],
    queryFn: () => facebookAdsApi.getSyncState(),
    staleTime: 30_000,
  });

  const today = todayKey();
  const currentMonth = today.slice(0, 7);
  const [syncFrom, setSyncFrom] = useState<string | null>(null);
  const [syncTo, setSyncTo] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !syncStateQuery.data) return;
    hydratedRef.current = true;
    const savedFrom = syncStateQuery.data.pref_from;
    const savedTo = syncStateQuery.data.pref_to;
    setSyncFrom(savedFrom && savedFrom.slice(0, 7) === currentMonth ? savedFrom : monthStartKey());
    setSyncTo(savedTo && savedTo <= today && savedTo.slice(0, 7) === currentMonth ? savedTo : today);
  }, [syncStateQuery.data, currentMonth, today]);

  const savePrefs = useMutation({
    mutationFn: (prefs: { from: string; to: string }) => facebookAdsApi.saveSyncPrefs(prefs.from, prefs.to),
  });

  const handleFromChange = (v: string) => {
    setSyncFrom(v);
    if (v && syncTo && v <= syncTo) savePrefs.mutate({ from: v, to: syncTo });
  };
  const handleToChange = (v: string) => {
    setSyncTo(v);
    if (syncFrom && v && syncFrom <= v) savePrefs.mutate({ from: syncFrom, to: v });
  };

  const syncInsights = useMutation({
    mutationFn: () => {
      if (!syncFrom || !syncTo) throw new Error('Sync window not loaded');
      return facebookAdsApi.sync(syncFrom, syncTo);
    },
    onSuccess: (r) => {
      setStatusMsg({
        tone: 'success',
        text:
          `Synced ${r.campaigns_updated.toLocaleString()} campaigns with ${fmtInr(r.total_spend_inr)} total ad spend ` +
          `(${(r.total_clicks ?? 0).toLocaleString()} clicks, ${(r.total_impressions ?? 0).toLocaleString()} impressions) ` +
          `from Meta Insights in ${(r.duration_ms / 1000).toFixed(1)}s.`,
      });
      qc.invalidateQueries({ queryKey: ['fb-campaign-summary'] });
      qc.invalidateQueries({ queryKey: ['fb-campaign-detail'] });
      qc.invalidateQueries({ queryKey: ['fb-sync-state'] });
    },
    onError: (e: unknown) => {
      setStatusMsg({
        tone: 'error',
        text: `Meta Insights sync failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    },
  });

  return (
    <>
      <PageHeader
        title="FB Campaigns"
        description="Per-campaign Facebook performance with ad spend, ROAS and ROI. Campaign IDs come from utm_id (preferred) or utm_campaign on the click URL when utm_source is a Meta source."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <RefreshButton invalidateOnSuccess={[['fb-campaign-summary']]} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            Facebook Insights sync window
          </span>
          <span className="text-[11px] text-slate-400 dark:text-neutral-500">
            Saved globally · resets on the 1st of each month
          </span>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="mb-0.5 block text-[11px] text-slate-500 dark:text-neutral-400">From</label>
            <Input
              type="date"
              value={syncFrom ?? ''}
              onChange={(e) => handleFromChange(e.target.value)}
              max={syncTo ?? today}
              disabled={syncFrom == null}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] text-slate-500 dark:text-neutral-400">To</label>
            <Input
              type="date"
              value={syncTo ?? ''}
              onChange={(e) => handleToChange(e.target.value)}
              min={syncFrom ?? undefined}
              max={today}
              disabled={syncTo == null}
              className="h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setStatusMsg(null); syncInsights.mutate(); }}
            disabled={syncInsights.isPending || !syncFrom || !syncTo}
            title="Pull campaign names, spend, clicks, impressions, CPC and CTR directly from Meta Insights for the selected window."
          >
            {syncInsights.isPending ? <Spinner /> : <CloudDownload className="h-3.5 w-3.5" />}
            {syncInsights.isPending ? 'Syncing…' : 'Sync Insights'}
          </Button>
        </div>
        <div className="ml-auto text-right text-[11px] text-slate-500 dark:text-neutral-400">
          <div>
            Last Meta Insights sync:{' '}
            <span className="font-medium text-slate-700 dark:text-neutral-200">
              {syncStateQuery.data ? fmtSyncedRelative(syncStateQuery.data.last_synced_at) : '…'}
            </span>
          </div>
          {syncStateQuery.data?.last_sync_from && syncStateQuery.data?.last_sync_to && (
            <div className="text-slate-400 dark:text-neutral-500">
              window {syncStateQuery.data.last_sync_from} → {syncStateQuery.data.last_sync_to}
            </div>
          )}
        </div>
      </div>

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
          <button
            onClick={() => setStatusMsg(null)}
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
              Couldn't load FB campaign reports.{' '}
              {reportQuery.error instanceof Error ? reportQuery.error.message : 'Please try again.'}
            </div>
          </div>
        </Card>
      ) : reportQuery.data.campaigns.length === 0 ? (
        <EmptyFbCampaignsCard />
      ) : (
        <Body
          data={reportQuery.data}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k) => {
            if (sortKey === k) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
            else { setSortKey(k); setSortDir('desc'); }
          }}
          onOpenCampaign={(id) =>
            navigate(`/fb-campaigns/${encodeURIComponent(id)}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`)
          }
        />
      )}

      <FacebookUploadsExportCard rangeFrom={range.from} rangeTo={range.to} />
    </>
  );
}

// ── Empty state ─────────────────────────────────────────────────────

function EmptyFbCampaignsCard() {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Megaphone className="h-10 w-10 text-slate-400 dark:text-neutral-500" />
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100">
              No FB campaign data in this window
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500 dark:text-neutral-400">
              The Facebook campaign rollup is populated from new clicks and postbacks tagged with{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">utm_source=fb/ig/meta</code>
              {' '}plus either{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">utm_id</code>
              {' '}or{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">utm_campaign</code>.
              {' '}Connect a Meta ad account on the Connections page and run the Sync Insights button above to pull spend numbers.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Body ────────────────────────────────────────────────────────────

function Body({
  data, sortKey, sortDir, onSort, onOpenCampaign,
}: {
  data: FbCampaignReportsResponse;
  sortKey: SortKey;
  sortDir: 'desc' | 'asc';
  onSort: (k: SortKey) => void;
  onOpenCampaign: (id: string) => void;
}) {
  const [search, setSearch] = useState('');

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
        case 'fb_clicks': return dir * ((a.fb_clicks ?? 0) - (b.fb_clicks ?? 0));
        case 'fb_impressions': return dir * ((a.fb_impressions ?? 0) - (b.fb_impressions ?? 0));
        case 'fb_ctr': return dir * ((a.fb_ctr ?? 0) - (b.fb_ctr ?? 0));
        case 'fb_cpc': return dir * ((a.fb_cpc ?? 0) - (b.fb_cpc ?? 0));
        case 'revenue':
        default: return dir * (a.revenue - b.revenue);
      }
    });
    return arr;
  }, [data.campaigns, sortKey, sortDir]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) =>
      c.campaign_id.toLowerCase().includes(q) ||
      (c.campaign_name ?? '').toLowerCase().includes(q),
    );
  }, [sorted, search]);

  const dailyAggregate = useMemo(
    () => buildDailyAggregate(data.campaigns, data.daily_totals),
    [data.campaigns, data.daily_totals],
  );

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
        campaigns={filteredSorted}
        totalCampaignCount={sorted.length}
        search={search}
        onSearchChange={setSearch}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        onOpen={onOpenCampaign}
      />
    </div>
  );
}

function buildDailyAggregate(
  campaigns: FbCampaignReportSummary[],
  dailyTotals: FbCampaignDailyTotal[] | undefined,
): FbCampaignDailyAggregatePoint[] {
  if (campaigns.length === 0) return [];
  const dates = campaigns[0]!.series.map((p) => p.date);
  const totalsByDate = new Map<string, number | null>();
  for (const t of dailyTotals ?? []) totalsByDate.set(t.date, t.total_revenue_inr);

  return dates.map((date, i) => {
    let clicks = 0, postbacks = 0, conversions = 0, revenue = 0, spend = 0;
    let fbClicks = 0, fbImpressions = 0;
    // FB-only attributed sub-totals — every campaign on this page IS FB so the
    // share metric is effectively redundant, but kept for parity with the
    // GAds chart's tooltip shape (operator-readable in both views).
    let fbOnlyRevenue = 0, fbOnlyClicks = 0;
    for (const c of campaigns) {
      const p = c.series[i];
      if (!p) continue;
      clicks += p.clicks;
      postbacks += p.postbacks;
      conversions += p.conversions;
      revenue += p.revenue;
      spend += p.spend;
      fbClicks += p.fb_clicks ?? 0;
      fbImpressions += p.fb_impressions ?? 0;
      fbOnlyRevenue += p.revenue;
      fbOnlyClicks += p.clicks;
    }
    const total = totalsByDate.has(date) ? totalsByDate.get(date) : 0;
    const fbRevenueShare = total != null && total > 0 ? fbOnlyRevenue / total : undefined;
    const fbClickShare = clicks > 0 ? fbOnlyClicks / clicks : undefined;
    return {
      date,
      clicks,
      postbacks,
      conversions,
      revenue,
      spend,
      profit: revenue - spend,
      fb_clicks: fbClicks,
      fb_impressions: fbImpressions,
      fb_ctr: fbImpressions > 0 ? fbClicks / fbImpressions : 0,
      fb_cpc: fbClicks > 0 ? spend / fbClicks : 0,
      total_revenue_inr: total ?? undefined,
      fb_only_revenue: fbOnlyRevenue,
      fb_only_clicks: fbOnlyClicks,
      fb_revenue_share: fbRevenueShare,
      fb_click_share: fbClickShare,
    };
  });
}

// ── Insights band ───────────────────────────────────────────────────

function InsightsBand({ insights }: { insights: FbCampaignInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="space-y-2">
      {insights.map((ins, i) => <InsightBanner key={i} insight={ins} />)}
    </div>
  );
}

function InsightBanner({ insight }: { insight: FbCampaignInsight }) {
  const tone =
    insight.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
    : insight.severity === 'warn'   ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
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

function KpiBand({ totals }: { totals: FbCampaignReportsResponse['totals'] }) {
  const profitTone = totals.profit > 0 ? 'positive' : totals.profit < 0 ? 'negative' : 'neutral';
  const hasFb = totals.fb_impressions > 0 || totals.fb_clicks > 0;
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
          value={fmtInr(totals.spend)}
          tooltip={fmtInrExact(totals.spend)}
          sub={
            totals.spend_coverage < 1
              ? `${(totals.spend_coverage * 100).toFixed(0)}% coverage`
              : 'all campaigns'
          }
        />
        <Kpi
          label="Profit"
          value={fmtInr(totals.profit)}
          tooltip={fmtInrExact(totals.profit)}
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
          sub={totals.clicks > 0 ? `${fmtPct(totals.cvr)} CVR · ${fmtInr(totals.epc)} EPC` : '—'}
        />
      </div>
      {hasFb && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="FB Clicks" value={fmtCount(totals.fb_clicks)} sub="from Meta Insights" />
          <Kpi label="FB CTR" value={fmtPct(totals.fb_ctr)} sub={`${fmtCount(totals.fb_impressions)} impressions`} />
          <Kpi label="FB Impressions" value={fmtCount(totals.fb_impressions)} sub="from Meta Insights" />
          <Kpi
            label="FB CPC"
            value={fmtInr(totals.fb_cpc)}
            tooltip={fmtInrExact(totals.fb_cpc)}
            sub={`weighted across ${totals.campaigns} campaigns`}
          />
        </div>
      )}
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

// ── Charts ──────────────────────────────────────────────────────────

function RevenueVsSpendChart({ series }: { series: FbCampaignDailyAggregatePoint[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const revColor = dark ? '#34d399' : '#059669';
  const spendColor = dark ? '#f87171' : '#dc2626';
  const totalColor = dark ? '#94a3b8' : '#475569';

  const hasTotal = series.some((p) => typeof p.total_revenue_inr === 'number' && p.total_revenue_inr > 0);

  return (
    <Card>
      <CardHeader
        title="Revenue vs ad spend"
        subtitle={
          hasTotal
            ? 'Daily totals across all FB campaigns. The dashed line is the true daily revenue across ALL conversions (offer_reports, INR); the gap below it is revenue that never made it into a campaign rollup.'
            : 'Daily totals across all FB campaigns. Green above red means profitable; red above green means burning money.'
        }
      />
      <CardBody className="p-0">
        <div className="h-72 w-full px-2 pb-2 pt-3 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fb-rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={revColor} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={revColor} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fb-spend-grad" x1="0" y1="0" x2="0" y2="1">
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
                formatter={(value, name, item) => {
                  if (name === 'Revenue (campaigns)') {
                    const point = item.payload as FbCampaignDailyAggregatePoint | undefined;
                    const revShare = point?.fb_revenue_share;
                    const clickShare = point?.fb_click_share;
                    const parts: string[] = [fmtInrExact(Number(value))];
                    if (revShare != null) parts.push(`FB rev ${(revShare * 100).toFixed(1)}%`);
                    if (clickShare != null) parts.push(`FB clicks ${(clickShare * 100).toFixed(1)}%`);
                    return [parts.join(' · '), String(name)];
                  }
                  if (value == null) return ['—', String(name)];
                  return [fmtInrExact(Number(value)), String(name)];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: axis }} iconType="circle" />
              <Area type="monotone" dataKey="revenue" name="Revenue (campaigns)" stroke={revColor} fill="url(#fb-rev-grad)" strokeWidth={2} />
              <Area type="monotone" dataKey="spend" name="Ad spend" stroke={spendColor} fill="url(#fb-spend-grad)" strokeWidth={2} />
              {hasTotal && (
                <Line
                  type="monotone"
                  dataKey="total_revenue_inr"
                  name="Revenue (all conversions)"
                  stroke={totalColor}
                  strokeWidth={1.75}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

function DailyProfitChart({ series }: { series: FbCampaignDailyPoint[] }) {
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

function RoasTrendChart({ series }: { series: FbCampaignDailyPoint[] }) {
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Sort label + Table ──────────────────────────────────────────────

function SortLabel({
  label, active, dir, onClick,
}: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide',
        active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200',
      )}
    >
      {label}
      {active && <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  );
}

function CampaignsTable({
  campaigns, totalCampaignCount, search, onSearchChange, sortKey, sortDir, onSort, onOpen,
}: {
  campaigns: FbCampaignReportSummary[];
  totalCampaignCount: number;
  search: string;
  onSearchChange: (s: string) => void;
  sortKey: SortKey;
  sortDir: 'desc' | 'asc';
  onSort: (k: SortKey) => void;
  onOpen: (id: string) => void;
}) {
  const isSearching = search.trim().length > 0;
  return (
    <Card>
      <CardHeader
        title="Per-campaign metrics"
        subtitle="Click a row to drill into a campaign. Edit per-day spend on the detail page."
      />
      <div className="border-b border-slate-200 px-4 py-2.5 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" aria-hidden />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search campaigns by name or ID…"
              className="h-8 pl-8 text-xs"
              aria-label="Search campaigns"
            />
          </div>
          {isSearching && (
            <>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                {campaigns.length} of {totalCampaignCount}
              </span>
              <Button size="sm" variant="ghost" onClick={() => onSearchChange('')}>
                <X className="h-3 w-3" /> Clear
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        {campaigns.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState
              icon={<Inbox className="h-8 w-8" />}
              title={isSearching ? `No campaigns match "${search}"` : 'No campaigns'}
              description=""
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH rowSpan={2}>
                  <SortLabel label={SORT_LABEL.name} active={sortKey === 'name'} dir={sortDir} onClick={() => onSort('name')} />
                </TH>
                <TH rowSpan={2} className="text-right"><SortLabel label={SORT_LABEL.clicks} active={sortKey === 'clicks'} dir={sortDir} onClick={() => onSort('clicks')} /></TH>
                <TH rowSpan={2} className="text-right"><SortLabel label={SORT_LABEL.conversions} active={sortKey === 'conversions'} dir={sortDir} onClick={() => onSort('conversions')} /></TH>
                <TH rowSpan={2} className="text-right"><SortLabel label={SORT_LABEL.cvr} active={sortKey === 'cvr'} dir={sortDir} onClick={() => onSort('cvr')} /></TH>
                <TH rowSpan={2} className="text-right"><SortLabel label={SORT_LABEL.epc} active={sortKey === 'epc'} dir={sortDir} onClick={() => onSort('epc')} /></TH>
                <TH rowSpan={2} className="text-right"><SortLabel label={SORT_LABEL.revenue} active={sortKey === 'revenue'} dir={sortDir} onClick={() => onSort('revenue')} /></TH>
                <TH rowSpan={2} className="text-right"><SortLabel label={SORT_LABEL.spend} active={sortKey === 'spend'} dir={sortDir} onClick={() => onSort('spend')} /></TH>
                <TH rowSpan={2} className="text-right"><SortLabel label={SORT_LABEL.profit} active={sortKey === 'profit'} dir={sortDir} onClick={() => onSort('profit')} /></TH>
                <TH rowSpan={2} className="text-right"><SortLabel label={SORT_LABEL.roas} active={sortKey === 'roas'} dir={sortDir} onClick={() => onSort('roas')} /></TH>
                <TH rowSpan={2} className="text-right"><SortLabel label={SORT_LABEL.roi} active={sortKey === 'roi'} dir={sortDir} onClick={() => onSort('roi')} /></TH>
                <TH
                  colSpan={4}
                  className="border-l border-slate-200 text-center text-[11px] uppercase tracking-wide text-blue-700 dark:border-neutral-800 dark:text-brand-300"
                  title="Metrics pulled directly from Meta Insights (per-campaign, per-day). Synced via the Sync Insights button or the orchestrated Refresh."
                >
                  META
                </TH>
                <TH rowSpan={2} className="w-8" aria-label="Open detail" />
              </TR>
              <TR>
                <TH className="border-l border-slate-200 text-right dark:border-neutral-800"><SortLabel label="Clicks" active={sortKey === 'fb_clicks'} dir={sortDir} onClick={() => onSort('fb_clicks')} /></TH>
                <TH className="text-right"><SortLabel label="CTR" active={sortKey === 'fb_ctr'} dir={sortDir} onClick={() => onSort('fb_ctr')} /></TH>
                <TH className="text-right"><SortLabel label="Impressions" active={sortKey === 'fb_impressions'} dir={sortDir} onClick={() => onSort('fb_impressions')} /></TH>
                <TH className="text-right"><SortLabel label="CPC" active={sortKey === 'fb_cpc'} dir={sortDir} onClick={() => onSort('fb_cpc')} /></TH>
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

function CampaignRow({ row, onOpen }: { row: FbCampaignReportSummary; onOpen: () => void }) {
  const profitTone =
    row.spend === 0 ? 'text-slate-500 dark:text-neutral-400'
    : row.profit > 0 ? 'text-emerald-600 dark:text-emerald-400'
    : row.profit < 0 ? 'text-red-600 dark:text-red-400'
    : 'text-slate-500 dark:text-neutral-400';
  const hasFb = (row.fb_impressions ?? 0) > 0 || (row.fb_clicks ?? 0) > 0;
  const isUntagged = row.campaign_id === 'fb_untagged';
  const sourceBadgeLabel =
    row.source === 'utm_id' ? 'utm_id'
    : row.source === 'utm_campaign' ? 'UTM'
    : isUntagged ? 'Untagged'
    : 'Facebook';
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
            <Badge tone={isUntagged ? 'amber' : row.source === 'fb_campaign_id' || row.source === 'utm_id' ? 'blue' : 'amber'}>
              {sourceBadgeLabel}
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
      <TD className="text-right tabular-nums" title={row.clicks > 0 ? fmtInrExact(row.epc) : undefined}>
        {row.clicks > 0 ? fmtInr(row.epc) : '—'}
      </TD>
      <TD
        className="text-right tabular-nums font-semibold text-slate-900 dark:text-neutral-100"
        title={fmtInrExact(row.revenue)}
      >
        {fmtInr(row.revenue)}
      </TD>
      <TD className="text-right tabular-nums" title={row.spend > 0 ? fmtInrExact(row.spend) : undefined}>
        {row.spend > 0 ? fmtInr(row.spend) : <span className="text-amber-600 dark:text-amber-400 text-[11px]">not set</span>}
      </TD>
      <TD
        className={cn('text-right tabular-nums font-semibold', profitTone)}
        title={row.spend > 0 ? fmtInrExact(row.profit) : undefined}
      >
        {row.spend > 0 ? fmtInr(row.profit) : '—'}
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
      {/* META column group */}
      <TD className="border-l border-slate-200 text-right tabular-nums dark:border-neutral-800">
        {hasFb ? fmtCount(row.fb_clicks ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
      </TD>
      <TD className="text-right tabular-nums">
        {hasFb ? fmtPct(row.fb_ctr ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
      </TD>
      <TD className="text-right tabular-nums">
        {hasFb ? fmtCount(row.fb_impressions ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
      </TD>
      <TD
        className="text-right tabular-nums"
        title={hasFb ? fmtInrExact(row.fb_cpc ?? 0) : undefined}
      >
        {hasFb && (row.fb_cpc ?? 0) > 0 ? fmtInr(row.fb_cpc ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
      </TD>
      <TD className="text-right text-slate-300 dark:text-neutral-600">›</TD>
    </TR>
  );
}

// ── CAPI upload export card (parallel to GoogleAdsUploadsExportCard) ─────

type FbUploadKind = 'conversion' | 'click';
type FbUploadStatus = 'pending' | 'sent' | 'partial_failure' | 'failed' | 'skipped';

function startOfUtcDayFromInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
function endOfUtcDayFromInput(value: string): Date | null {
  const d = startOfUtcDayFromInput(value);
  if (!d) return null;
  return new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
}
function isoToUtcDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function FacebookUploadsExportCard({ rangeFrom, rangeTo }: { rangeFrom: string; rangeTo: string }) {
  const [from, setFrom] = useState(() => isoToUtcDate(rangeFrom));
  const [to, setTo] = useState(() => isoToUtcDate(rangeTo));
  const [kind, setKind] = useState<'' | FbUploadKind>('');
  const [status, setStatus] = useState<'' | FbUploadStatus>('');
  const [downloading, setDownloading] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const lastRangeRef = useRef({ from: rangeFrom, to: rangeTo });
  useEffect(() => {
    if (lastRangeRef.current.from !== rangeFrom || lastRangeRef.current.to !== rangeTo) {
      lastRangeRef.current = { from: rangeFrom, to: rangeTo };
      setFrom(isoToUtcDate(rangeFrom));
      setTo(isoToUtcDate(rangeTo));
    }
  }, [rangeFrom, rangeTo]);

  async function download() {
    setMsg(null);
    const f = startOfUtcDayFromInput(from);
    const t = endOfUtcDayFromInput(to);
    if (!f || !t || f.getTime() > t.getTime()) {
      setMsg({ tone: 'error', text: 'Pick a valid From → To range (full UTC days).' });
      return;
    }
    setDownloading(true);
    try {
      const result = await facebookAdsApi.exportUploadsCsv({
        from: f.toISOString(),
        to: t.toISOString(),
        kind: kind || undefined,
        status: status || undefined,
      });
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      const rowsLabel = result.rowCount.toLocaleString();
      setMsg({
        tone: 'success',
        text: result.truncated
          ? `Downloaded ${rowsLabel} rows (capped — narrow the window or filters for a complete export).`
          : `Downloaded ${rowsLabel} rows.`,
      });
    } catch (e) {
      setMsg({
        tone: 'error',
        text: `Download failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title="Facebook CAPI upload report"
        subtitle="CSV audit of every CAPI push to Meta — click forwards, conversion forwards, successes, partial failures, hard failures, and skips (with reason). Filter by kind/status here or open the file in Excel and slice it there."
      />
      <CardBody>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="min-w-[10rem]">
            <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
              From (UTC)
            </label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} className="h-8 text-xs" />
          </div>
          <div className="min-w-[10rem]">
            <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
              To (UTC)
            </label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} className="h-8 text-xs" />
          </div>
          <div className="min-w-[9rem]">
            <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
              Kind
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as '' | FbUploadKind)}
              className="block h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              <option value="">All</option>
              <option value="conversion">Conversion</option>
              <option value="click">Click</option>
            </select>
          </div>
          <div className="min-w-[10rem]">
            <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as '' | FbUploadStatus)}
              className="block h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              <option value="">All</option>
              <option value="sent">Sent</option>
              <option value="partial_failure">Partial failure</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="sm:ml-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={download}
              disabled={downloading || !from || !to}
              title="Download every Meta CAPI upload attempt in the selected window as a CSV (capped at 100,000 rows)."
            >
              {downloading ? <Spinner /> : <Download className="h-3.5 w-3.5" />}
              {downloading ? 'Downloading…' : 'Download CSV'}
            </Button>
          </div>
        </div>

        {msg && (
          <div
            className={cn(
              'mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
              msg.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
            )}
          >
            {msg.tone === 'success'
              ? <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              : <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
            <span className="flex-1">{msg.text}</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
