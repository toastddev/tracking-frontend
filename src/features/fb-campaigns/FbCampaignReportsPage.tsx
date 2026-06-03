import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  Download,
  Info,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
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
import { fmtInr } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useDateRange } from '@/lib/dateRange';
import { fbCampaignReportsApi, facebookAdsApi, type FbCampaignReportSummary } from '@/features/connections/facebook/api';

const fmtCount = (v: number) =>
  new Intl.NumberFormat('en-IN', { notation: v >= 10_000 ? 'compact' : 'standard' }).format(v);

function fmtInrCompact(v: number): string {
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

type SortKey = 'revenue' | 'spend' | 'profit' | 'roas' | 'cvr' | 'conversions' | 'clicks';

export function FbCampaignReportsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { range } = useDateRange();
  const { theme } = useTheme();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [syncFrom, setSyncFrom] = useState(monthStartKey());
  const [syncTo, setSyncTo] = useState(todayKey());

  const summaryQ = useQuery({
    queryKey: ['fb-campaign-summary', range.from, range.to],
    queryFn: () => fbCampaignReportsApi.summary({ from: range.from, to: range.to }),
  });
  const syncStateQ = useQuery({
    queryKey: ['fb-sync-state'],
    queryFn: () => facebookAdsApi.getSyncState(),
  });

  const syncMutation = useMutation({
    mutationFn: () => fbCampaignReportsApi.syncFromReports(syncFrom, syncTo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-campaign-summary'] });
      qc.invalidateQueries({ queryKey: ['fb-sync-state'] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => facebookAdsApi.exportUploadsCsv({ from: range.from, to: range.to }),
    onSuccess: (result) => {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const data = summaryQ.data;

  const filteredCampaigns = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? data.campaigns.filter(
          (c) =>
            (c.campaign_name ?? '').toLowerCase().includes(q) ||
            c.campaign_id.toLowerCase().includes(q)
        )
      : data.campaigns;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const diff = (av ?? 0) - (bv ?? 0);
      return sortDir === 'asc' ? diff : -diff;
    });
    return sorted;
  }, [data, search, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  }

  const chartData = useMemo(() => {
    if (!data || data.campaigns.length === 0) return [];
    const dailyMap = new Map<string, {
      date: string;
      clicks: number;
      conversions: number;
      revenue: number;
      spend: number;
      total_revenue_inr?: number;
    }>();
    // Sum across all campaigns per day
    for (const c of data.campaigns) {
      for (const p of c.series) {
        const existing = dailyMap.get(p.date) ?? {
          date: p.date, clicks: 0, conversions: 0, revenue: 0, spend: 0,
        };
        existing.clicks += p.clicks;
        existing.conversions += p.conversions;
        existing.revenue += p.revenue;
        existing.spend += p.spend;
        dailyMap.set(p.date, existing);
      }
    }
    // Overlay total_revenue_inr from daily_totals
    for (const dt of data.daily_totals) {
      const ex = dailyMap.get(dt.date);
      if (ex) ex.total_revenue_inr = dt.total_revenue_inr ?? undefined;
    }
    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (summaryQ.isLoading) return <CenteredSpinner />;
  if (summaryQ.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn't load FB campaign reports"
        description={summaryQ.error instanceof Error ? summaryQ.error.message : 'Unknown error'}
      />
    );
  }

  if (!data || data.campaigns.length === 0) {
    return (
      <>
        <PageHeader
          title="FB Campaigns"
          description="Per-campaign performance across your connected Facebook ad accounts. Spend pulled from Meta Insights; conversions attributed via fbclid / fbc / fbp."
          actions={<RefreshButton />}
        />
        <Card>
          <CardBody>
            <EmptyState
              icon={Info}
              title="No FB campaign data yet"
              description={
                <>
                  Click clicks haven't been attributed to any Facebook campaign in this window. Once you connect an ad
                  account on the Connections page and either run the sync below or wait for the next refresh, campaigns
                  will appear here.
                </>
              }
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="label">From</label>
                <Input type="date" value={syncFrom} onChange={(e) => setSyncFrom(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="label">To</label>
                <Input type="date" value={syncTo} onChange={(e) => setSyncTo(e.target.value)} />
              </div>
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? <Spinner /> : <CloudDownload className="h-4 w-4" />}
                Sync Insights now
              </Button>
            </div>
            {syncStateQ.data?.last_synced_at && (
              <div className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
                Last synced: {fmtSyncedRelative(syncStateQ.data.last_synced_at)}
              </div>
            )}
          </CardBody>
        </Card>
      </>
    );
  }

  const t = data.totals;
  const stroke = theme === 'dark' ? '#52525b' : '#cbd5e1';
  const tickFill = theme === 'dark' ? '#a3a3a3' : '#475569';

  return (
    <>
      <PageHeader
        title="FB Campaigns"
        description="Per-campaign performance across your connected Facebook ad accounts. Spend in INR, pulled from Meta Insights."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? <Spinner /> : <Download className="h-4 w-4" />}
              Export CAPI uploads
            </Button>
            <RefreshButton />
          </div>
        }
      />

      {/* Insights band */}
      {data.insights.length > 0 && (
        <div className="mb-4 space-y-2">
          {data.insights.map((ins, i) => {
            const Icon =
              ins.severity === 'success' ? CheckCircle2 :
              ins.severity === 'critical' ? AlertCircle :
              ins.severity === 'warn' ? AlertTriangle :
              Info;
            const tone =
              ins.severity === 'success' ? 'bg-emerald-50 ring-emerald-200 text-emerald-900 dark:bg-emerald-500/10 dark:ring-emerald-500/30 dark:text-emerald-200' :
              ins.severity === 'critical' ? 'bg-red-50 ring-red-200 text-red-900 dark:bg-red-500/10 dark:ring-red-500/30 dark:text-red-200' :
              ins.severity === 'warn' ? 'bg-amber-50 ring-amber-200 text-amber-900 dark:bg-amber-500/10 dark:ring-amber-500/30 dark:text-amber-200' :
              'bg-brand-50 ring-brand-200 text-brand-900 dark:bg-brand-500/10 dark:ring-brand-500/30 dark:text-brand-200';
            return (
              <button
                key={i}
                type="button"
                onClick={() => ins.campaign_id && navigate(`/fb-campaigns/${encodeURIComponent(ins.campaign_id)}`)}
                disabled={!ins.campaign_id}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md px-4 py-3 text-left text-sm ring-1 transition-colors',
                  tone,
                  ins.campaign_id ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">{ins.title}</div>
                  <div className="text-xs opacity-90">{ins.detail}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* KPI cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Revenue (INR)" value={fmtInr(t.revenue)} sub={`Total all conv ${fmtInrCompact(t.total_revenue_inr)}`} />
        <KpiCard label="Spend (INR)" value={fmtInr(t.spend)} sub={`${t.profitable_campaigns}P / ${t.unprofitable_campaigns}L`} />
        <KpiCard
          label="Profit"
          value={fmtInr(t.profit)}
          sub={`ROAS ${fmtRoas(t.roas)}`}
          tone={t.profit > 0 ? 'success' : t.profit < 0 ? 'danger' : undefined}
          Icon={t.profit >= 0 ? TrendingUp : TrendingDown}
        />
        <KpiCard label="Conversions" value={fmtCount(t.conversions)} sub={`${fmtCount(t.clicks)} clicks · CVR ${fmtPct(t.cvr)}`} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="FB clicks" value={fmtCount(t.fb_clicks)} sub={`From Meta Insights`} />
        <KpiCard label="FB impressions" value={fmtCount(t.fb_impressions)} sub={`CTR ${fmtPct(t.fb_ctr)}`} />
        <KpiCard label="FB CPC (avg)" value={fmtInrCompact(t.fb_cpc)} sub="Spend / FB clicks" />
        <KpiCard label="Campaigns" value={fmtCount(t.campaigns)} sub={`${Math.round(t.spend_coverage * 100)}% with spend`} />
      </div>

      {/* Daily chart */}
      <Card className="mb-4">
        <CardHeader title="Daily revenue, spend, conversions" />
        <CardBody>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <ComposedChart data={chartData}>
                <CartesianGrid stroke={stroke} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 11 }} />
                <YAxis yAxisId="money" tick={{ fill: tickFill, fontSize: 11 }} tickFormatter={fmtInrCompact} />
                <YAxis yAxisId="count" orientation="right" tick={{ fill: tickFill, fontSize: 11 }} tickFormatter={fmtCount} />
                <Tooltip
                  contentStyle={{
                    background: theme === 'dark' ? '#171717' : '#fff',
                    border: `1px solid ${stroke}`,
                  }}
                  formatter={(value: number | string, name: string) => {
                    if (typeof value !== 'number') return value;
                    if (name === 'Conversions' || name === 'Clicks') return fmtCount(value);
                    return fmtInr(value);
                  }}
                />
                <Legend />
                <Area yAxisId="money" type="monotone" dataKey="revenue" name="Revenue (INR)" stroke="#16a34a" fill="#16a34a55" />
                <Line yAxisId="money" type="monotone" dataKey="total_revenue_inr" name="Total revenue (all conv)" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
                <Bar yAxisId="money" dataKey="spend" name="Spend (INR)" fill="#0ea5e988" />
                <Line yAxisId="count" type="monotone" dataKey="conversions" name="Conversions" stroke="#f59e0b" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Sync toolbar */}
      <Card className="mb-4">
        <CardHeader
          title="Sync Meta Insights"
          subtitle={
            syncStateQ.data?.last_synced_at
              ? `Last synced ${fmtSyncedRelative(syncStateQ.data.last_synced_at)} (${syncStateQ.data.last_sync_from} → ${syncStateQ.data.last_sync_to})`
              : 'No sync run yet — click below to pull spend / clicks / impressions for the chosen window.'
          }
        />
        <CardBody>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="label">From</label>
              <Input type="date" value={syncFrom} onChange={(e) => setSyncFrom(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label">To</label>
              <Input type="date" value={syncTo} onChange={(e) => setSyncTo(e.target.value)} />
            </div>
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? <Spinner /> : <CloudDownload className="h-4 w-4" />}
              Sync now
            </Button>
          </div>
          {syncMutation.data && (
            <div className="mt-2 text-xs text-slate-600 dark:text-neutral-400">
              ✓ Sync complete: {syncMutation.data.campaigns_updated} campaigns updated,
              total spend {fmtInr(syncMutation.data.total_spend_inr)} ({syncMutation.data.from} → {syncMutation.data.to}).
            </div>
          )}
          {syncMutation.isError && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
              Sync failed: {syncMutation.error instanceof Error ? syncMutation.error.message : 'unknown error'}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Campaign table */}
      <Card>
        <CardHeader
          title="Campaigns"
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search campaigns…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          }
        />
        <CardBody>
          <Table>
            <THead>
              <TR>
                <TH>Campaign</TH>
                <SortTH active={sortKey === 'clicks'} dir={sortDir} onClick={() => toggleSort('clicks')}>Clicks</SortTH>
                <SortTH active={sortKey === 'conversions'} dir={sortDir} onClick={() => toggleSort('conversions')}>Conversions</SortTH>
                <SortTH active={sortKey === 'cvr'} dir={sortDir} onClick={() => toggleSort('cvr')}>CVR</SortTH>
                <SortTH active={sortKey === 'revenue'} dir={sortDir} onClick={() => toggleSort('revenue')}>Revenue</SortTH>
                <SortTH active={sortKey === 'spend'} dir={sortDir} onClick={() => toggleSort('spend')}>Spend</SortTH>
                <SortTH active={sortKey === 'profit'} dir={sortDir} onClick={() => toggleSort('profit')}>Profit</SortTH>
                <SortTH active={sortKey === 'roas'} dir={sortDir} onClick={() => toggleSort('roas')}>ROAS</SortTH>
                <TH>FB impr</TH>
                <TH>CTR</TH>
              </TR>
            </THead>
            <TBody>
              {filteredCampaigns.map((c) => (
                <CampaignRow key={c.campaign_id} c={c} onOpen={() => navigate(`/fb-campaigns/${encodeURIComponent(c.campaign_id)}`)} />
              ))}
            </TBody>
          </Table>
          {filteredCampaigns.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-neutral-400">
              No campaigns match "{search}".
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function KpiCard({
  label, value, sub, tone, Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'success' | 'danger';
  Icon?: typeof TrendingUp;
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs text-slate-500 dark:text-neutral-400">{label}</div>
        <div className={cn(
          'mt-1 flex items-center gap-1.5 text-xl font-semibold',
          tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'danger' && 'text-red-600 dark:text-red-400'
        )}>
          {Icon && <Icon className="h-4 w-4" />}
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{sub}</div>}
      </CardBody>
    </Card>
  );
}

function SortTH({ active, dir, onClick, children }: { active: boolean; dir: 'asc' | 'desc'; onClick: () => void; children: React.ReactNode }) {
  return (
    <TH>
      <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1', active && 'text-brand-600 dark:text-brand-400')}>
        {children}
        {active && <span className="text-xs">{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </TH>
  );
}

function CampaignRow({ c, onOpen }: { c: FbCampaignReportSummary; onOpen: () => void }) {
  const isUntagged = c.campaign_id === 'fb_untagged';
  return (
    <TR className="cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/40" onClick={onOpen}>
      <TD>
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-900 dark:text-neutral-100">
            {c.campaign_name ?? c.campaign_id}
          </span>
          <Badge tone={isUntagged ? 'amber' : 'gray'}>{c.source}</Badge>
          {isUntagged && <Badge tone="amber">synthetic</Badge>}
        </div>
        <div className="text-xs text-slate-500 dark:text-neutral-400">
          <code className="font-mono">{c.campaign_id}</code>
          {c.offers.length > 0 && <> · {c.offers.length} offer{c.offers.length === 1 ? '' : 's'}</>}
        </div>
      </TD>
      <TD>{fmtCount(c.clicks)}</TD>
      <TD>{fmtCount(c.conversions)}</TD>
      <TD>{fmtPct(c.cvr)}</TD>
      <TD>{fmtInr(c.revenue)}</TD>
      <TD>{c.spend > 0 ? fmtInr(c.spend) : <span className="text-slate-400">—</span>}</TD>
      <TD className={cn(c.profit > 0 && 'text-emerald-600 dark:text-emerald-400', c.profit < 0 && 'text-red-600 dark:text-red-400')}>
        {c.spend > 0 ? fmtInr(c.profit) : <span className="text-slate-400">—</span>}
      </TD>
      <TD>{fmtRoas(c.roas)}</TD>
      <TD>{fmtCount(c.fb_impressions)}</TD>
      <TD>{fmtPct(c.fb_ctr)}</TD>
    </TR>
  );
}
