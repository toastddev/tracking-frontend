import { useEffect, useMemo, useRef, useState } from 'react';
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
  Search,
  TrendingDown,
  TrendingUp,
  CloudDownload,
  X,
} from 'lucide-react';
import { RefreshButton } from '@/features/reports/RefreshButton';
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
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { fmtInr, fmtInrExact } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { reportsApi } from '@/features/reports/api';
import { type ReportRange } from '@/features/reports/ReportFilters';
import { useDateRange } from '@/lib/dateRange';
import type {
  CampaignDailyPoint,
  CampaignInsight,
  CampaignReportSummary,
  CampaignReportsResponse,
} from '@/types';

const fmtCount = (v: number) =>
  new Intl.NumberFormat('en-IN', { notation: v >= 10_000 ? 'compact' : 'standard' }).format(v);

// Tight INR formatter for chart axis labels — keeps tick labels under ~6
// characters so the axis doesn't bloat when amounts run into crores.
function fmtInrCompactAxis(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
}

// All date keys in this codebase are YYYY-MM-DD (UTC). Keep the same
// representation here so the From/To controls round-trip cleanly with the
// backend's sync window math.
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartKey(): string {
  return todayKey().slice(0, 8) + '01';
}

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
  | 'revenue' | 'spend' | 'profit' | 'roas' | 'roi'
  | 'clicks' | 'conversions' | 'cvr' | 'epc' | 'name'
  | 'gads_clicks' | 'gads_impressions' | 'gads_ctr' | 'gads_cpc';

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
  gads_clicks: 'Clicks',
  gads_impressions: 'Impressions',
  gads_ctr: 'CTR',
  gads_cpc: 'CPC',
};

export function CampaignReportsPage() {
  const { range } = useDateRange();
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
      let spendsText = '';
      if (r.campaign_spends && r.campaign_spends.length > 0) {
        const namesAndSpends = r.campaign_spends
          .slice(0, 5)
          .map((c) => `${c.campaign_name} (${fmtInr(c.total_spend)} spend)`)
          .join(', ');
        const more = r.campaign_spends.length > 5 ? ` and ${r.campaign_spends.length - 5} more` : '';
        spendsText = ` Updated spends for: ${namesAndSpends}${more}.`;
      }

      setBackfillMsg({
        tone: 'success',
        text:
          `Rebuilt conversion/revenue fields from ${r.conversions_scanned.toLocaleString()} conversions ` +
          `(${r.conversions_with_campaign.toLocaleString()} attributed) ` +
          `into ${r.buckets_written.toLocaleString()} campaign-day buckets ` +
          `(${(r.duration_ms / 1000).toFixed(1)}s). Click totals were left untouched; ` +
          `${r.click_metadata_scanned.toLocaleString()} clicks were scanned only for campaign attribution.` +
          `${r.truncated ? ` Rebuild was truncated: ${r.truncated_reason ?? 'safety cap reached'}.` : ''}` +
          spendsText,
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

  // Persisted Google Ads sync window. Defaults to (1st of current month → today)
  // until the operator picks something else; their choice survives across sessions
  // but resets when the calendar rolls into a new month so a fresh window opens
  // automatically on the 1st.
  const syncStateQuery = useQuery({
    queryKey: ['gads-sync-state'],
    queryFn: () => reportsApi.getGoogleAdsSyncState(),
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
    mutationFn: (prefs: { from: string; to: string }) => reportsApi.saveGoogleAdsSyncPrefs(prefs),
  });

  const handleFromChange = (v: string) => {
    setSyncFrom(v);
    if (v && syncTo && v <= syncTo) savePrefs.mutate({ from: v, to: syncTo });
  };
  const handleToChange = (v: string) => {
    setSyncTo(v);
    if (syncFrom && v && syncFrom <= v) savePrefs.mutate({ from: syncFrom, to: v });
  };

  const syncAds = useMutation({
    mutationFn: () => {
      if (!syncFrom || !syncTo) throw new Error('Sync window not loaded');
      return reportsApi.syncGoogleAdsCampaigns({ from: syncFrom, to: syncTo });
    },
    onSuccess: (r) => {
      setBackfillMsg({
        tone: 'success',
        text:
          `Synced ${r.campaigns_updated.toLocaleString()} campaigns with ${fmtInr(r.total_spend_inr)} total ad spend ` +
          `(${(r.total_clicks ?? 0).toLocaleString()} clicks, ${(r.total_impressions ?? 0).toLocaleString()} impressions) ` +
          `from Google Ads in ${(r.duration_ms / 1000).toFixed(1)}s.`,
      });
      qc.invalidateQueries({ queryKey: ['reports', 'campaigns'] });
      qc.invalidateQueries({ queryKey: ['report-campaign-detail'] });
      qc.invalidateQueries({ queryKey: ['gads-sync-state'] });
    },
    onError: (e: unknown) => {
      setBackfillMsg({
        tone: 'error',
        text: `Google Ads sync failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    },
  });

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Per-campaign performance with ad spend, ROAS and ROI. Campaign IDs come from gad_campaignid (Google Ads) or utm_campaign on the click URL."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setBackfillMsg(null); backfill.mutate(); }}
              disabled={backfill.isPending}
              title="Rebuild only the campaign rollup from historical clicks + conversions. Idempotent. Operator-entered spend and GAds metrics are preserved."
            >
              {backfill.isPending ? <Spinner /> : <Database className="h-3.5 w-3.5" />}
              {backfill.isPending ? 'Rebuilding…' : 'Rebuild'}
            </Button>
            <RefreshButton
              invalidateOnSuccess={[['reports', 'campaigns']]}
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            Google Ads sync window
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
            onClick={() => { setBackfillMsg(null); syncAds.mutate(); }}
            disabled={syncAds.isPending || !syncFrom || !syncTo}
            title="Pull campaign names and ad spend directly from your connected Google Ads accounts for the selected window."
          >
            {syncAds.isPending ? <Spinner /> : <CloudDownload className="h-3.5 w-3.5" />}
            {syncAds.isPending ? 'Syncing…' : 'Sync Ads'}
          </Button>
        </div>
        <div className="ml-auto text-right text-[11px] text-slate-500 dark:text-neutral-400">
          <div>
            Last Google Ads sync:{' '}
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
  const [drillMetric, setDrillMetric] = useState<DrilldownMetric | null>(null);
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
        case 'gads_clicks': return dir * ((a.gads_clicks ?? 0) - (b.gads_clicks ?? 0));
        case 'gads_impressions': return dir * ((a.gads_impressions ?? 0) - (b.gads_impressions ?? 0));
        case 'gads_ctr': return dir * ((a.gads_ctr ?? 0) - (b.gads_ctr ?? 0));
        case 'gads_cpc': return dir * ((a.gads_cpc ?? 0) - (b.gads_cpc ?? 0));
        case 'revenue':
        default: return dir * (a.revenue - b.revenue);
      }
    });
    return arr;
  }, [data.campaigns, sortKey, sortDir]);

  // Filtering for the per-campaign metrics table only — drill-down modal still
  // uses the full unfiltered dataset because the operator opened it to compare
  // *all* campaigns by a given metric.
  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) =>
      c.campaign_id.toLowerCase().includes(q) ||
      (c.campaign_name ?? '').toLowerCase().includes(q),
    );
  }, [sorted, search]);

  const dailyAggregate = useMemo(() => buildDailyAggregate(data.campaigns), [data.campaigns]);

  void range;

  return (
    <div className="space-y-6">
      <InsightsBand insights={data.insights} />

      <KpiBand totals={data.totals} onDrill={setDrillMetric} />

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

      <MetricDrilldownModal
        metric={drillMetric}
        campaigns={data.campaigns}
        totals={data.totals}
        onClose={() => setDrillMetric(null)}
        onOpenCampaign={(id) => { setDrillMetric(null); onOpenCampaign(id); }}
      />
    </div>
  );
}

function buildDailyAggregate(campaigns: CampaignReportSummary[]): CampaignDailyPoint[] {
  if (campaigns.length === 0) return [];
  const dates = campaigns[0]!.series.map((p) => p.date);
  return dates.map((date, i) => {
    let clicks = 0, postbacks = 0, conversions = 0, revenue = 0, spend = 0;
    let gadsClicks = 0, gadsImpressions = 0;
    for (const c of campaigns) {
      const p = c.series[i];
      if (!p) continue;
      clicks += p.clicks;
      postbacks += p.postbacks;
      conversions += p.conversions;
      revenue += p.revenue;
      spend += p.spend;
      gadsClicks += p.gads_clicks ?? 0;
      gadsImpressions += p.gads_impressions ?? 0;
    }
    return {
      date,
      clicks,
      postbacks,
      conversions,
      revenue,
      spend,
      profit: revenue - spend,
      gads_clicks: gadsClicks,
      gads_impressions: gadsImpressions,
      gads_ctr: gadsImpressions > 0 ? gadsClicks / gadsImpressions : 0,
      gads_cpc: gadsClicks > 0 ? spend / gadsClicks : 0,
    };
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

function KpiBand({
  totals,
  onDrill,
}: {
  totals: CampaignReportsResponse['totals'];
  onDrill: (m: DrilldownMetric) => void;
}) {
  const profitTone = totals.profit > 0 ? 'positive' : totals.profit < 0 ? 'negative' : 'neutral';
  const hasGads = totals.gads_impressions > 0 || totals.gads_clicks > 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Revenue"
          value={fmtInr(totals.revenue)}
          tooltip={fmtInrExact(totals.revenue)}
          sub={`${fmtCount(totals.clicks)} clicks`}
          highlight
          onClick={() => onDrill('revenue')}
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
          onClick={() => onDrill('spend')}
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
          onClick={() => onDrill('profit')}
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
          onClick={() => onDrill('roas')}
        />
        <Kpi label="ROI" value={fmtRoi(totals.roi)} sub={`avg across ${totals.campaigns} campaigns`} onClick={() => onDrill('roi')} />
        <Kpi
          label="Conversions"
          value={fmtCount(totals.conversions)}
          sub={totals.clicks > 0 ? `${fmtPct(totals.cvr)} CVR · ${fmtInr(totals.epc)} EPC` : '—'}
          onClick={() => onDrill('conversions')}
        />
      </div>
      {hasGads && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="GADS Clicks"
            value={fmtCount(totals.gads_clicks)}
            sub="from Google Ads"
            onClick={() => onDrill('gads_clicks')}
          />
          <Kpi
            label="GADS CTR"
            value={fmtPct(totals.gads_ctr)}
            sub={`${fmtCount(totals.gads_impressions)} impressions`}
            onClick={() => onDrill('gads_ctr')}
          />
          <Kpi
            label="GADS Impressions"
            value={fmtCount(totals.gads_impressions)}
            sub="from Google Ads"
            onClick={() => onDrill('gads_impressions')}
          />
          <Kpi
            label="GADS CPC"
            value={fmtInr(totals.gads_cpc)}
            tooltip={fmtInrExact(totals.gads_cpc)}
            sub={`weighted across ${totals.campaigns} campaigns`}
            onClick={() => onDrill('gads_cpc')}
          />
        </div>
      )}
    </div>
  );
}

function Kpi({
  label, value, sub, tooltip, highlight, tone, onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  tooltip?: string;
  highlight?: boolean;
  tone?: 'positive' | 'negative' | 'neutral';
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  return (
    <Card
      className={cn(
        highlight && 'ring-1 ring-brand-300/50 dark:ring-brand-500/30',
        interactive && 'cursor-pointer transition hover:shadow-md hover:ring-1 hover:ring-brand-400/40 dark:hover:ring-brand-400/30',
      )}
    >
      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => {
          if (!interactive) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        aria-label={interactive ? `Show ${label} breakdown by campaign` : undefined}
        className={cn(
          'p-4',
          interactive && 'rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            {label}
          </div>
          {interactive && (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500" aria-hidden />
          )}
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
                formatter={(value, name) => [fmtInrExact(Number(value)), String(name)]}
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
  campaigns, totalCampaignCount, search, onSearchChange, sortKey, sortDir, onSort, onOpen,
}: {
  campaigns: CampaignReportSummary[];
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
                  <SortLabel label={SORT_LABEL.name} active={sortKey==='name'} dir={sortDir} onClick={() => onSort('name')} />
                </TH>
                <TH rowSpan={2} className="text-right">
                  <SortLabel label={SORT_LABEL.clicks} active={sortKey==='clicks'} dir={sortDir} onClick={() => onSort('clicks')} />
                </TH>
                <TH rowSpan={2} className="text-right">
                  <SortLabel label={SORT_LABEL.conversions} active={sortKey==='conversions'} dir={sortDir} onClick={() => onSort('conversions')} />
                </TH>
                <TH rowSpan={2} className="text-right">
                  <SortLabel label={SORT_LABEL.cvr} active={sortKey==='cvr'} dir={sortDir} onClick={() => onSort('cvr')} />
                </TH>
                <TH rowSpan={2} className="text-right">
                  <SortLabel label={SORT_LABEL.epc} active={sortKey==='epc'} dir={sortDir} onClick={() => onSort('epc')} />
                </TH>
                <TH rowSpan={2} className="text-right">
                  <SortLabel label={SORT_LABEL.revenue} active={sortKey==='revenue'} dir={sortDir} onClick={() => onSort('revenue')} />
                </TH>
                <TH rowSpan={2} className="text-right">
                  <SortLabel label={SORT_LABEL.spend} active={sortKey==='spend'} dir={sortDir} onClick={() => onSort('spend')} />
                </TH>
                <TH rowSpan={2} className="text-right">
                  <SortLabel label={SORT_LABEL.profit} active={sortKey==='profit'} dir={sortDir} onClick={() => onSort('profit')} />
                </TH>
                <TH rowSpan={2} className="text-right">
                  <SortLabel label={SORT_LABEL.roas} active={sortKey==='roas'} dir={sortDir} onClick={() => onSort('roas')} />
                </TH>
                <TH rowSpan={2} className="text-right">
                  <SortLabel label={SORT_LABEL.roi} active={sortKey==='roi'} dir={sortDir} onClick={() => onSort('roi')} />
                </TH>
                <TH
                  colSpan={4}
                  className="border-l border-slate-200 text-center text-[11px] uppercase tracking-wide text-blue-700 dark:border-neutral-800 dark:text-brand-300"
                  title="Metrics pulled directly from Google Ads (per-campaign, per-day). Synced via the Sync Ads button or the orchestrated Refresh."
                >
                  GADS
                </TH>
                <TH rowSpan={2}>Trend</TH>
                <TH rowSpan={2} className="w-8" aria-label="Open detail" />
              </TR>
              <TR>
                <TH className="border-l border-slate-200 text-right dark:border-neutral-800">
                  <SortLabel label="Clicks" active={sortKey==='gads_clicks'} dir={sortDir} onClick={() => onSort('gads_clicks')} />
                </TH>
                <TH className="text-right">
                  <SortLabel label="CTR" active={sortKey==='gads_ctr'} dir={sortDir} onClick={() => onSort('gads_ctr')} />
                </TH>
                <TH className="text-right">
                  <SortLabel label="Impressions" active={sortKey==='gads_impressions'} dir={sortDir} onClick={() => onSort('gads_impressions')} />
                </TH>
                <TH className="text-right">
                  <SortLabel label="CPC" active={sortKey==='gads_cpc'} dir={sortDir} onClick={() => onSort('gads_cpc')} />
                </TH>
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
  const hasGads = (row.gads_impressions ?? 0) > 0 || (row.gads_clicks ?? 0) > 0;
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
      {/* GADS column group */}
      <TD className="border-l border-slate-200 text-right tabular-nums dark:border-neutral-800">
        {hasGads ? fmtCount(row.gads_clicks ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
      </TD>
      <TD className="text-right tabular-nums">
        {hasGads ? fmtPct(row.gads_ctr ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
      </TD>
      <TD className="text-right tabular-nums">
        {hasGads ? fmtCount(row.gads_impressions ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
      </TD>
      <TD
        className="text-right tabular-nums"
        title={hasGads ? fmtInrExact(row.gads_cpc ?? 0) : undefined}
      >
        {hasGads && (row.gads_cpc ?? 0) > 0 ? fmtInr(row.gads_cpc ?? 0) : <span className="text-[11px] text-slate-400 dark:text-neutral-600">—</span>}
      </TD>
      <TD>
        <ProfitSparkline series={row.series} />
      </TD>
      <TD className="text-right">
        <ChevronRight className="h-4 w-4 text-slate-400 dark:text-neutral-500" aria-hidden />
      </TD>
    </TR>
  );
}

function SortLabel({
  label, active, dir, onClick,
}: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
  return (
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
  );
}

// ── Metric drill-down modal ─────────────────────────────────────────
//
// Opened from the KPI band — sorts every campaign by the chosen metric and
// shows the contribution + share of the total. Clicking a row jumps to the
// per-campaign detail page so the operator can keep digging.

type DrilldownMetric =
  | 'revenue' | 'spend' | 'profit' | 'roas' | 'roi' | 'conversions'
  | 'gads_clicks' | 'gads_impressions' | 'gads_ctr' | 'gads_cpc';

type DrilldownFormat = 'inr' | 'count' | 'pct' | 'ratio_x' | 'roi_pct';

interface DrilldownConfig {
  label: string;
  description: string;
  pick: (c: CampaignReportSummary) => number;
  format: DrilldownFormat;
  // When true, sort ascending so worst-first surfaces (e.g. profit losers).
  worstFirst?: boolean;
  // When true, the metric is a ratio rather than a sum — show a "weighted"
  // total instead of a simple sum, and skip the share column.
  ratio?: boolean;
}

const DRILLDOWN_CONFIG: Record<DrilldownMetric, DrilldownConfig> = {
  revenue: { label: 'Revenue', description: 'INR revenue per campaign across the selected window.', pick: (c) => c.revenue, format: 'inr' },
  spend: { label: 'Ad spend', description: 'Spend (canonical INR) per campaign. Operator-entered or pulled from Google Ads.', pick: (c) => c.spend, format: 'inr' },
  profit: { label: 'Profit', description: 'Revenue minus spend. Negative is a loss.', pick: (c) => c.profit, format: 'inr', worstFirst: false },
  roas: { label: 'ROAS', description: 'Return on ad spend. Above 1× the campaign earns more than it costs.', pick: (c) => c.roas, format: 'ratio_x', ratio: true },
  roi: { label: 'ROI', description: '(Revenue − Spend) / Spend, expressed as a percentage.', pick: (c) => c.roi, format: 'roi_pct', ratio: true },
  conversions: { label: 'Conversions', description: 'Verified postbacks attributed to this campaign.', pick: (c) => c.conversions, format: 'count' },
  gads_clicks: { label: 'GADS Clicks', description: 'Clicks reported by Google Ads (per campaign).', pick: (c) => c.gads_clicks ?? 0, format: 'count' },
  gads_impressions: { label: 'GADS Impressions', description: 'Impressions reported by Google Ads.', pick: (c) => c.gads_impressions ?? 0, format: 'count' },
  gads_ctr: { label: 'GADS CTR', description: 'Click-through rate (clicks / impressions).', pick: (c) => c.gads_ctr ?? 0, format: 'pct', ratio: true },
  gads_cpc: { label: 'GADS CPC', description: 'Cost per click — spend divided by GAds clicks.', pick: (c) => c.gads_cpc ?? 0, format: 'inr', ratio: true },
};

function fmtMetric(v: number, f: DrilldownFormat): string {
  if (!Number.isFinite(v)) return '—';
  switch (f) {
    case 'inr':      return fmtInr(v);
    case 'count':    return fmtCount(v);
    case 'pct':      return fmtPct(v);
    case 'ratio_x':  return fmtRoas(v);
    case 'roi_pct':  return fmtRoi(v);
  }
}

function pickTotal(metric: DrilldownMetric, totals: CampaignReportsResponse['totals']): number {
  switch (metric) {
    case 'revenue':           return totals.revenue;
    case 'spend':             return totals.spend;
    case 'profit':            return totals.profit;
    case 'roas':              return totals.roas;
    case 'roi':               return totals.roi;
    case 'conversions':       return totals.conversions;
    case 'gads_clicks':       return totals.gads_clicks;
    case 'gads_impressions':  return totals.gads_impressions;
    case 'gads_ctr':          return totals.gads_ctr;
    case 'gads_cpc':          return totals.gads_cpc;
  }
}

function MetricDrilldownModal({
  metric, campaigns, totals, onClose, onOpenCampaign,
}: {
  metric: DrilldownMetric | null;
  campaigns: CampaignReportSummary[];
  totals: CampaignReportsResponse['totals'];
  onClose: () => void;
  onOpenCampaign: (id: string) => void;
}) {
  const cfg = metric ? DRILLDOWN_CONFIG[metric] : null;

  const rows = useMemo(() => {
    if (!metric || !cfg) return [];
    const arr = campaigns
      .map((c) => ({ campaign: c, value: cfg.pick(c) }))
      // Drop campaigns where the metric is meaningless (e.g. ROAS with no spend)
      // for ratio metrics — keeps the table focused on real signal.
      .filter((r) => !cfg.ratio || (r.campaign.spend > 0 || r.campaign.revenue > 0));
    arr.sort((a, b) => (cfg.worstFirst ? a.value - b.value : b.value - a.value));
    return arr;
  }, [metric, cfg, campaigns]);

  if (!metric || !cfg) return null;

  const totalValue = pickTotal(metric, totals);
  const showShare = !cfg.ratio && totalValue !== 0;

  return (
    <Modal
      open={metric != null}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-baseline gap-3">
          <span>{cfg.label} by campaign</span>
          <span className="text-xs font-normal text-slate-500 dark:text-neutral-400">
            {fmtMetric(totalValue, cfg.format)} total · {rows.length} campaign{rows.length === 1 ? '' : 's'}
          </span>
        </div>
      }
    >
      <p className="mb-3 text-xs text-slate-500 dark:text-neutral-400">{cfg.description}</p>
      {rows.length === 0 ? (
        <EmptyState icon={<Inbox className="h-8 w-8" />} title="No campaigns to show" description="" />
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <THead>
              <TR>
                <TH>Campaign</TH>
                <TH className="text-right">{cfg.label}</TH>
                {showShare && <TH className="text-right">Share</TH>}
                <TH className="text-right">Spend</TH>
                <TH className="text-right">Revenue</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map(({ campaign, value }) => (
                <TR
                  key={campaign.campaign_id}
                  className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-neutral-800/50"
                  onClick={() => onOpenCampaign(campaign.campaign_id)}
                >
                  <TD>
                    <div className="font-medium text-slate-800 dark:text-neutral-200">
                      {campaign.campaign_name ?? campaign.campaign_id}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-neutral-500">
                      {campaign.campaign_id}
                    </div>
                  </TD>
                  <TD
                    className="text-right tabular-nums font-semibold"
                    title={cfg.format === 'inr' ? fmtInrExact(value) : undefined}
                  >
                    {fmtMetric(value, cfg.format)}
                  </TD>
                  {showShare && (
                    <TD className="text-right tabular-nums text-slate-600 dark:text-neutral-400">
                      {totalValue !== 0 ? `${((value / totalValue) * 100).toFixed(1)}%` : '—'}
                    </TD>
                  )}
                  <TD className="text-right tabular-nums" title={fmtInrExact(campaign.spend)}>
                    {campaign.spend > 0 ? fmtInr(campaign.spend) : '—'}
                  </TD>
                  <TD className="text-right tabular-nums" title={fmtInrExact(campaign.revenue)}>
                    {fmtInr(campaign.revenue)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Modal>
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
