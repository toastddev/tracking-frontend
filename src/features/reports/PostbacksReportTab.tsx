import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ChevronRight,
  Inbox,
  Webhook,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { fmtMoney } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import type { PostbackNetworkSummary } from '@/types';
import { reportsApi } from './api';
import type { ReportRange } from './ReportFilters';

type SortKey = 'postbacks' | 'verified' | 'match_rate' | 'approval_rate' | 'revenue' | 'name';

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Network',
  postbacks: 'Fires',
  verified: 'Verified',
  match_rate: 'Match rate',
  approval_rate: 'Approval',
  revenue: 'Revenue',
};

const fmtCount = (v: number) =>
  new Intl.NumberFormat(undefined, { notation: v >= 10_000 ? 'compact' : 'standard' }).format(v);

const fmtPct = (v: number) => (v * 100).toFixed(1) + '%';

// Stable colour per network — same trick as the offer chart so a network keeps
// a recognisable colour across the bar chart and the per-row dot.
function colorForNetwork(id: string, dark: boolean): string {
  const palette = dark
    ? ['#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c', '#a3e635']
    : ['#d97706', '#059669', '#2563eb', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#65a30d'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}

interface Props {
  range: ReportRange;
}

export function PostbacksReportTab({ range }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('postbacks');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const navigate = useNavigate();

  const reportQuery = useQuery({
    queryKey: ['reports', 'postbacks', range.from, range.to],
    queryFn: () => reportsApi.postbacks({ from: range.from, to: range.to }),
    staleTime: 30_000,
  });

  const networks = reportQuery.data?.networks ?? [];
  const totals = reportQuery.data?.totals;

  const sorted = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1;
    return networks.slice().sort((a, b) => {
      switch (sortKey) {
        case 'name':           return dir * (a.network_name ?? a.network_id).localeCompare(b.network_name ?? b.network_id);
        case 'verified':       return dir * (a.verified - b.verified);
        case 'match_rate':     return dir * (a.match_rate - b.match_rate);
        case 'approval_rate':  return dir * (a.approval_rate - b.approval_rate);
        case 'revenue':        return dir * (a.revenue - b.revenue);
        case 'postbacks':
        default:               return dir * (a.postbacks - b.postbacks);
      }
    });
  }, [networks, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(k); setSortDir('desc'); }
  }

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-neutral-400">
          Per-network postback delivery health, computed from the raw{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">conversions</code>{' '}
          collection. Match rate &mdash; how many fires landed on a tracked click &mdash; is the primary signal of integration health, not revenue.
        </div>
        {reportQuery.isFetching && <Spinner className="text-slate-400 dark:text-neutral-500" />}
      </div>

      {reportQuery.data?.truncated && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Sample truncated.</div>
            <p className="mt-1 text-amber-800/90 dark:text-amber-200/80">
              Showing the most recent {fmtCount(reportQuery.data.conversions_scanned)} fires across all networks.
              Drill into a network for a per-network capped view.
            </p>
          </div>
        </div>
      )}

      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Postbacks" value={fmtCount(totals.postbacks)} />
          <MiniStat
            label="Verified"
            value={fmtCount(totals.verified)}
            sub={totals.postbacks > 0 ? `${fmtPct(totals.verified / totals.postbacks)} match` : undefined}
            highlight
          />
          <MiniStat
            label="Unmatched"
            value={fmtCount(totals.unverified)}
            sub={totals.postbacks > 0 ? `${fmtPct(totals.unverified / totals.postbacks)} of fires` : undefined}
          />
          <MiniStat label="Networks" value={fmtCount(totals.networks)} sub={`${fmtMoney(totals.revenue)} revenue`} />
        </div>
      )}

      <Card>
        <CardHeader
          title="Fires by network"
          subtitle="Stacked verified vs unmatched per network. A tall grey portion is the operator's tell — either click_id is wrong, or click TTL purged matching clicks."
        />
        <CardBody className="p-0">
          {reportQuery.isLoading ? (
            <CenteredSpinner />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<Webhook className="h-10 w-10" />}
              title="No postback fires in this range"
              description="No networks have fired any postbacks in the selected window."
            />
          ) : (
            <FiresByNetworkChart networks={sorted} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Per-network metrics"
          subtitle="Click a row to drill into that network's delivery health, mapping coverage, latency, and unmatched-fire samples."
        />
        <div className="overflow-x-auto">
          {reportQuery.isLoading ? (
            <CenteredSpinner />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title="No networks active in this range"
              description="Either widen the date range or check that your postback config is receiving traffic."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <SortHeader label={SORT_LABEL.name}          active={sortKey==='name'}          dir={sortDir} onClick={() => toggleSort('name')} />
                  <TH className="text-right">Status</TH>
                  <SortHeader label={SORT_LABEL.postbacks}     active={sortKey==='postbacks'}     dir={sortDir} onClick={() => toggleSort('postbacks')} align="right" />
                  <SortHeader label={SORT_LABEL.verified}      active={sortKey==='verified'}      dir={sortDir} onClick={() => toggleSort('verified')} align="right" />
                  <SortHeader label={SORT_LABEL.match_rate}    active={sortKey==='match_rate'}    dir={sortDir} onClick={() => toggleSort('match_rate')} align="right" />
                  <TH className="text-right">A · P · R</TH>
                  <SortHeader label={SORT_LABEL.approval_rate} active={sortKey==='approval_rate'} dir={sortDir} onClick={() => toggleSort('approval_rate')} align="right" />
                  <SortHeader label={SORT_LABEL.revenue}       active={sortKey==='revenue'}       dir={sortDir} onClick={() => toggleSort('revenue')} align="right" />
                  <TH>Trend</TH>
                  <TH className="w-8" aria-label="Open detail" />
                </TR>
              </THead>
              <TBody>
                {sorted.map((row) => (
                  <NetworkRow
                    key={row.network_id}
                    row={row}
                    onOpen={() => navigate(
                      `/reports/postbacks/${encodeURIComponent(row.network_id)}` +
                      `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
                    )}
                  />
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}

function NetworkRow({ row, onOpen }: { row: PostbackNetworkSummary; onOpen: () => void }) {
  const { resolved } = useTheme();
  const color = colorForNetwork(row.network_id, resolved === 'dark');
  // Match-rate row tint: low match rate = red row, high = green. This is the
  // "scan the whole table for problems" affordance the operator opens this
  // page for.
  const matchTone =
    row.postbacks === 0 ? 'text-slate-400 dark:text-neutral-500'
      : row.match_rate < 0.5 ? 'text-red-600 dark:text-red-400 font-semibold'
        : row.match_rate < 0.8 ? 'text-amber-600 dark:text-amber-400'
          : 'text-emerald-600 dark:text-emerald-400 font-medium';
  return (
    <TR
      className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-neutral-800/50"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Open postback report for ${row.network_name ?? row.network_id}`}
    >
      <TD>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ background: color }}
            aria-hidden
          />
          <div>
            <div className="font-medium text-slate-800 dark:text-neutral-200">
              {row.network_name ?? row.network_id}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-neutral-500">
              {row.network_id}
              {row.unique_offers > 0 && <> · {row.unique_offers} offer{row.unique_offers === 1 ? '' : 's'}</>}
            </div>
          </div>
        </div>
      </TD>
      <TD className="text-right">
        {row.status === 'paused'
          ? <Badge tone="amber">paused</Badge>
          : row.status === 'active'
            ? <Badge tone="green">active</Badge>
            : <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>}
      </TD>
      <TD className="text-right tabular-nums">{fmtCount(row.postbacks)}</TD>
      <TD className="text-right tabular-nums">
        {fmtCount(row.verified)}
        {row.unverified > 0 && (
          <div className="text-[11px] text-slate-400 dark:text-neutral-500">
            {fmtCount(row.unverified)} unmatched
          </div>
        )}
      </TD>
      <TD className={cn('text-right tabular-nums', matchTone)}>
        {row.postbacks > 0 ? fmtPct(row.match_rate) : '—'}
      </TD>
      <TD className="text-right">
        <div className="flex flex-col items-end gap-0.5 text-xs tabular-nums text-slate-500 dark:text-neutral-400">
          <span>
            <span className="text-emerald-600 dark:text-emerald-400">{fmtCount(row.approved)}</span>
            {' · '}
            {fmtCount(row.pending)}
            {' · '}
            <span className="text-red-600 dark:text-red-400">{fmtCount(row.rejected)}</span>
          </span>
        </div>
      </TD>
      <TD className="text-right tabular-nums">
        {row.verified > 0 ? fmtPct(row.approval_rate) : '—'}
      </TD>
      <TD className="text-right tabular-nums font-semibold text-slate-900 dark:text-neutral-100">
        {fmtMoney(row.revenue)}
        {row.verified > 0 && (
          <div className="text-[11px] font-normal text-slate-400 dark:text-neutral-500">
            {fmtMoney(row.avg_payout)} avg
          </div>
        )}
      </TD>
      <TD>
        <Sparkline series={row.series} color={color} />
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

function MiniStat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'ring-1 ring-brand-300/50 dark:ring-brand-500/30' : undefined}>
      <div className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">{label}</div>
        <div className={cn(
          'mt-1.5 text-2xl font-semibold tracking-tight tabular-nums',
          highlight ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-neutral-100'
        )}>
          {value}
        </div>
        {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">{sub}</div>}
      </div>
    </Card>
  );
}

function FiresByNetworkChart({ networks }: { networks: PostbackNetworkSummary[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const top = networks.slice(0, 8);
  const data = top.map((n) => ({
    name: n.network_name ?? n.network_id,
    Verified: n.verified,
    Unmatched: n.unverified,
  }));
  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  return (
    <div className="h-64 w-full px-2 pb-2 pt-3 sm:px-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
          <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} stroke={grid} tickLine={false} allowDecimals={false} />
          <YAxis dataKey="name" type="category" tick={{ fill: axis, fontSize: 11 }} stroke={grid} tickLine={false} width={120} />
          <Tooltip
            contentStyle={{
              backgroundColor: dark ? '#171717' : '#ffffff',
              border: `1px solid ${dark ? '#404040' : '#e2e8f0'}`,
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: axis }} iconType="circle" />
          <Bar dataKey="Verified"  stackId="s" fill={dark ? '#34d399' : '#059669'} />
          <Bar dataKey="Unmatched" stackId="s" fill={dark ? '#94a3b8' : '#94a3b8'} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Tiny inline sparkline of daily postback fires (verified). Same shape as the
// offer reports tab so the page feels consistent.
function Sparkline({
  series, color,
}: {
  series: { date: string; verified: number }[];
  color: string;
}) {
  const max = Math.max(1, ...series.map((p) => p.verified));
  const w = 80;
  const h = 22;
  const stepX = series.length > 1 ? w / (series.length - 1) : w;
  const points = series
    .map((p, i) => `${(i * stepX).toFixed(2)},${(h - (p.verified / max) * h).toFixed(2)}`)
    .join(' ');
  if (max === 1 && series.every((s) => s.verified === 0)) {
    return <span className="inline-block text-[10px] text-slate-300 dark:text-neutral-700">flat</span>;
  }
  return (
    <svg width={w} height={h} className="overflow-visible" aria-label="trend">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} />
      <circle
        cx={(series.length - 1) * stepX}
        cy={h - (series[series.length - 1]!.verified / max) * h}
        r={2}
        fill={color}
      />
    </svg>
  );
}
