import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Inbox, Check, X, Database, AlertCircle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { fmtMoney } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import type { OfferReportSummary } from '@/types';
import { offersApi } from '@/features/offers/api';
import { reportsApi } from './api';
import type { ReportRange } from './ReportFilters';

const STORAGE_KEY = 'reports:offers:selection:v1';

interface Props {
  range: ReportRange;
}

// Local storage keeps the user's offer selection between sessions. Stored as a
// JSON array of offer_ids; corrupt/missing → empty (= "all offers").
function loadSelection(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveSelection(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* private mode / quota — silent */
  }
}

type SortKey =
  | 'revenue'
  | 'clicks'
  | 'conversions'
  | 'cvr'
  | 'epc'
  | 'forecast'
  | 'name';

const SORT_LABEL: Record<SortKey, string> = {
  revenue: 'Revenue',
  clicks: 'Clicks',
  conversions: 'Conversions',
  cvr: 'CVR',
  epc: 'EPC',
  forecast: 'Month-end forecast',
  name: 'Name',
};

const fmtCount = (v: number) =>
  new Intl.NumberFormat(undefined, { notation: v >= 10_000 ? 'compact' : 'standard' }).format(v);

const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';

// Stable colour assignment per offer_id so the same offer keeps its colour
// across the chart and the table — important for a user scanning rows.
function colorForOffer(offer_id: string, dark: boolean): string {
  const palette = dark
    ? ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c', '#a3e635']
    : ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#65a30d'];
  let h = 0;
  for (let i = 0; i < offer_id.length; i++) h = (h * 31 + offer_id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}

export function OfferReportsTab({ range }: Props) {
  const [selection, setSelection] = useState<string[]>(() => loadSelection());
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [search, setSearch] = useState('');
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const qc = useQueryClient();

  // Persist on every change — debounce isn't worth it; this is a small array.
  useEffect(() => {
    saveSelection(selection);
  }, [selection]);

  // Hydrate the offer list once. We always fetch the full list (capped at 100)
  // so the multi-select shows everything the admin can pick from, even when
  // the rollup table doesn't have data yet for a brand-new offer.
  const offersQuery = useQuery({
    queryKey: ['offers', 'list-for-reports'],
    queryFn: () => offersApi.list({ limit: 100 }),
    staleTime: 60_000,
  });

  // Selection semantics:
  //   - empty selection ⇒ "all offers" (don't pass offer_ids to the backend so
  //     it returns whatever rolled up in the window).
  //   - non-empty ⇒ explicit allowlist; backend will surface zeros for any
  //     missing offer.
  const reportQuery = useQuery({
    queryKey: ['reports', 'offers', range.from, range.to, selection.slice().sort().join(',')],
    queryFn: () => reportsApi.offers({
      from: range.from,
      to: range.to,
      offer_ids: selection.length > 0 ? selection : undefined,
    }),
    staleTime: 30_000,
  });

  const offers = offersQuery.data?.items ?? [];
  const reports = reportQuery.data?.offers ?? [];
  const totals = reportQuery.data?.totals;

  // Rollup is empty when *every* returned offer summary has zero clicks +
  // zero postbacks. That's the trigger for the "rebuild from source" hint —
  // the user almost certainly has data in clicks/conversions but never
  // populated the rollup (e.g. brand-new deployment of this feature).
  const rollupLooksEmpty =
    !reportQuery.isLoading &&
    !!totals &&
    totals.clicks === 0 &&
    totals.postbacks === 0 &&
    totals.revenue === 0;

  const backfill = useMutation({
    mutationFn: () => reportsApi.backfillOffers({ from: range.from, to: range.to }),
    onSuccess: (r) => {
      setBackfillMsg(
        `Rebuilt from ${r.clicks_scanned.toLocaleString()} clicks and ` +
        `${r.conversions_scanned.toLocaleString()} conversions ` +
        `into ${r.buckets_written.toLocaleString()} daily buckets ` +
        `(${(r.duration_ms / 1000).toFixed(1)}s).`
      );
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (e: unknown) => {
      setBackfillMsg(`Rebuild failed: ${e instanceof Error ? e.message : String(e)}`);
    },
  });

  const sorted = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1;
    const arr = reports.slice();
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name':       return dir * (a.offer_name ?? a.offer_id).localeCompare(b.offer_name ?? b.offer_id);
        case 'clicks':     return dir * (a.clicks - b.clicks);
        case 'conversions':return dir * (a.conversions - b.conversions);
        case 'cvr':        return dir * (a.cvr - b.cvr);
        case 'epc':        return dir * (a.epc - b.epc);
        case 'forecast':   return dir * (a.est_month_end_revenue - b.est_month_end_revenue);
        case 'revenue':
        default:           return dir * (a.revenue - b.revenue);
      }
    });
    return arr;
  }, [reports, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(k); setSortDir('desc'); }
  }

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) =>
      o.name.toLowerCase().includes(q) || o.offer_id.toLowerCase().includes(q)
    );
  }, [offers, search]);

  function toggleOffer(id: string) {
    setSelection((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  function selectAll() {
    setSelection(offers.map((o) => o.offer_id));
  }
  function clearAll() {
    setSelection([]);
  }

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-neutral-400">
          Aggregated metrics drawn from the TTL-safe <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">offer_reports</code> rollup.
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setBackfillMsg(null); backfill.mutate(); }}
            disabled={backfill.isPending}
          >
            {backfill.isPending ? <Spinner /> : <Database className="h-3.5 w-3.5" />}
            {backfill.isPending ? 'Rebuilding…' : 'Rebuild from source'}
          </Button>
        </div>
      </div>

      {backfillMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1">{backfillMsg}</div>
          <button onClick={() => setBackfillMsg(null)} className="text-emerald-700/60 hover:text-emerald-900 dark:text-emerald-300/60">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {rollupLooksEmpty && !backfill.isPending && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium">No rollup data in this range yet.</div>
            <p className="mt-1 text-amber-800/90 dark:text-amber-200/80">
              The offer-reports rollup is populated from new clicks &amp; postbacks going forward.
              If you already have historical data in <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] dark:bg-amber-500/20">clicks</code> and{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] dark:bg-amber-500/20">conversions</code>, click <strong>Rebuild from source</strong> to backfill the rollup. It is idempotent and safe to re-run.
            </p>
          </div>
        </div>
      )}

      <OfferSelector
        offers={offers}
        selection={selection}
        filteredOptions={filteredOptions}
        search={search}
        onSearch={setSearch}
        onToggle={toggleOffer}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        loading={offersQuery.isLoading}
      />

      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Clicks" value={fmtCount(totals.clicks)} />
          <MiniStat
            label="Conversions"
            value={fmtCount(totals.conversions)}
            sub={totals.clicks > 0 ? `${fmtPct(totals.conversions / totals.clicks)} CVR` : undefined}
          />
          <MiniStat label="Revenue" value={fmtMoney(totals.revenue)} />
          <MiniStat
            label="Forecast (month-end)"
            value={fmtMoney(totals.est_month_end_revenue)}
            sub={
              totals.est_month_end_revenue > totals.revenue
                ? `+${fmtMoney(totals.est_month_end_revenue - totals.revenue)} projected`
                : 'no MTD projection'
            }
            highlight
          />
        </div>
      )}

      <Card>
        <CardHeader
          title="Revenue by offer"
          subtitle="Daily revenue per offer over the selected range. Hover for the breakdown."
          actions={reportQuery.isFetching && <Spinner className="text-slate-400 dark:text-neutral-500" />}
        />
        <CardBody className="p-0">
          {reportQuery.isLoading ? (
            <CenteredSpinner />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title="No offer data in this range"
              description="Adjust the date range or select different offers."
            />
          ) : (
            <RevenueByOfferChart offers={sorted} />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Clicks vs conversions" subtitle="Top offers — daily activity." />
          <CardBody className="p-0">
            {sorted.length === 0
              ? <EmptyState icon={<Inbox className="h-8 w-8" />} title="No data" description="" />
              : <ClicksVsConvChart offers={sorted.slice(0, 5)} />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Funnel snapshot" subtitle="Status mix across selected offers." />
          <CardBody className="p-0">
            {sorted.length === 0
              ? <EmptyState icon={<Inbox className="h-8 w-8" />} title="No data" description="" />
              : <FunnelChart offers={sorted} />}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Per-offer metrics"
          subtitle="Click a column header to sort. Forecasts use month-to-date revenue projected linearly to month-end."
        />
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <SortHeader label={SORT_LABEL.name}        active={sortKey==='name'}        dir={sortDir} onClick={() => toggleSort('name')} />
                <TH className="text-right">Status</TH>
                <SortHeader label={SORT_LABEL.clicks}      active={sortKey==='clicks'}      dir={sortDir} onClick={() => toggleSort('clicks')} align="right" />
                <SortHeader label={SORT_LABEL.conversions} active={sortKey==='conversions'} dir={sortDir} onClick={() => toggleSort('conversions')} align="right" />
                <TH className="text-right">Approved · Pending · Rejected</TH>
                <SortHeader label={SORT_LABEL.cvr}         active={sortKey==='cvr'}         dir={sortDir} onClick={() => toggleSort('cvr')} align="right" />
                <SortHeader label={SORT_LABEL.epc}         active={sortKey==='epc'}         dir={sortDir} onClick={() => toggleSort('epc')} align="right" />
                <TH className="text-right">RPM</TH>
                <SortHeader label={SORT_LABEL.revenue}     active={sortKey==='revenue'}     dir={sortDir} onClick={() => toggleSort('revenue')} align="right" />
                <SortHeader label={SORT_LABEL.forecast}    active={sortKey==='forecast'}    dir={sortDir} onClick={() => toggleSort('forecast')} align="right" />
                <TH>Trend</TH>
              </TR>
            </THead>
            <TBody>
              {sorted.map((row) => (
                <OfferRow key={row.offer_id} row={row} />
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function OfferRow({ row }: { row: OfferReportSummary }) {
  const { resolved } = useTheme();
  const color = colorForOffer(row.offer_id, resolved === 'dark');
  return (
    <TR className="hover:bg-slate-50/60 dark:hover:bg-neutral-800/50">
      <TD>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ background: color }}
            aria-hidden
          />
          <div>
            <div className="font-medium text-slate-800 dark:text-neutral-200">
              {row.offer_name ?? row.offer_id}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-neutral-500">{row.offer_id}</div>
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
      <TD className="text-right tabular-nums">{fmtCount(row.clicks)}</TD>
      <TD className="text-right tabular-nums">
        {fmtCount(row.conversions)}
        {row.unverified > 0 && (
          <div className="text-[11px] text-amber-600 dark:text-amber-400">
            {fmtCount(row.unverified)} unverified
          </div>
        )}
      </TD>
      <TD className="text-right">
        <div className="flex flex-col items-end gap-0.5 text-xs tabular-nums text-slate-500 dark:text-neutral-400">
          <span><span className="text-emerald-600 dark:text-emerald-400">{fmtCount(row.approved)}</span> · {fmtCount(row.pending)} · <span className="text-red-600 dark:text-red-400">{fmtCount(row.rejected)}</span></span>
          {row.conversions > 0 && (
            <span className="text-[11px] text-slate-400 dark:text-neutral-500">
              {fmtPct(row.approval_rate)} approval
            </span>
          )}
        </div>
      </TD>
      <TD className="text-right tabular-nums">{row.clicks > 0 ? fmtPct(row.cvr) : '—'}</TD>
      <TD className="text-right tabular-nums">{row.clicks > 0 ? fmtMoney(row.epc) : '—'}</TD>
      <TD className="text-right tabular-nums text-xs text-slate-500 dark:text-neutral-400">
        {row.clicks > 0 ? fmtMoney(row.rpm) : '—'}
      </TD>
      <TD className="text-right tabular-nums font-semibold text-slate-900 dark:text-neutral-100">
        {fmtMoney(row.revenue)}
      </TD>
      <TD className="text-right tabular-nums">
        {row.est_month_end_revenue > 0 ? (
          <div>
            <div className="font-medium text-brand-700 dark:text-brand-300">
              {fmtMoney(row.est_month_end_revenue)}
            </div>
            {row.est_month_end_revenue > row.revenue && (
              <div className="text-[11px] text-slate-400 dark:text-neutral-500">
                +{fmtMoney(row.est_month_end_revenue - row.revenue)}
              </div>
            )}
          </div>
        ) : <span className="text-slate-400 dark:text-neutral-500">—</span>}
      </TD>
      <TD>
        <Sparkline series={row.series} color={color} />
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
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          {label}
        </div>
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

function OfferSelector({
  offers,
  selection,
  filteredOptions,
  search,
  onSearch,
  onToggle,
  onSelectAll,
  onClearAll,
  loading,
}: {
  offers: { offer_id: string; name: string; status?: string }[];
  selection: string[];
  filteredOptions: { offer_id: string; name: string; status?: string }[];
  search: string;
  onSearch: (v: string) => void;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  loading: boolean;
}) {
  const allSelected = selection.length === offers.length && offers.length > 0;
  return (
    <Card>
      <CardHeader
        title="Offers"
        subtitle={
          selection.length === 0
            ? `All ${offers.length} offers — your selection persists in this browser.`
            : `${selection.length} of ${offers.length} selected`
        }
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search offers"
              className="h-8 w-48"
            />
            <Button size="sm" variant="ghost" onClick={onSelectAll} disabled={allSelected}>
              <Check className="h-3.5 w-3.5" /> All
            </Button>
            <Button size="sm" variant="ghost" onClick={onClearAll} disabled={selection.length === 0}>
              <X className="h-3.5 w-3.5" /> None
            </Button>
          </div>
        }
      />
      <CardBody>
        {loading ? (
          <CenteredSpinner />
        ) : filteredOptions.length === 0 ? (
          <div className="py-2 text-center text-sm text-slate-500 dark:text-neutral-400">
            No offers match.
          </div>
        ) : (
          <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
            {filteredOptions.map((o) => {
              const checked = selection.length === 0 || selection.includes(o.offer_id);
              const explicit = selection.includes(o.offer_id);
              return (
                <button
                  key={o.offer_id}
                  type="button"
                  onClick={() => onToggle(o.offer_id)}
                  title={o.offer_id}
                  className={cn(
                    'inline-flex max-w-[260px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    explicit
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400/60 dark:bg-brand-500/10 dark:text-brand-300'
                      : checked
                        ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
                        : 'border-slate-200 bg-slate-50 text-slate-500 line-through dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500'
                  )}
                >
                  {explicit ? <Check className="h-3 w-3" /> : null}
                  <span className="truncate">{o.name}</span>
                  {o.status === 'paused' && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">paused</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Stacked daily revenue per offer. Each offer is a coloured stack so the
// overall revenue trend is legible alongside per-offer contribution.
function RevenueByOfferChart({ offers }: { offers: OfferReportSummary[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const visible = offers.slice(0, 8); // chart legibility cap; full table still shows the rest
  const dates = visible[0]?.series.map((p) => p.date) ?? [];

  const data = useMemo(() => {
    return dates.map((date, i) => {
      const row: Record<string, string | number> = { date };
      for (const o of visible) {
        row[o.offer_id] = o.series[i]?.revenue ?? 0;
      }
      return row;
    });
  }, [dates, visible]);

  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';

  return (
    <div className="h-72 w-full px-2 pb-2 pt-3 sm:px-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: axis, fontSize: 11 }}
            tickFormatter={(d) => fmtTickDate(d)}
            stroke={grid}
            tickLine={false}
          />
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
            labelFormatter={(d) => fmtTooltipDate(String(d))}
            formatter={(value, name) => {
              const offer = visible.find((o) => o.offer_id === String(name));
              return [fmtMoney(Number(value)), offer?.offer_name ?? String(name)];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: axis }}
            formatter={(value) => visible.find((o) => o.offer_id === value)?.offer_name ?? value}
            iconType="circle"
          />
          {visible.map((o) => (
            <Bar
              key={o.offer_id}
              dataKey={o.offer_id}
              stackId="rev"
              fill={colorForOffer(o.offer_id, dark)}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClicksVsConvChart({ offers }: { offers: OfferReportSummary[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const dates = offers[0]?.series.map((p) => p.date) ?? [];

  const data = useMemo(() => {
    return dates.map((date, i) => {
      let clicks = 0;
      let conversions = 0;
      for (const o of offers) {
        clicks += o.series[i]?.clicks ?? 0;
        conversions += o.series[i]?.conversions ?? 0;
      }
      return { date, clicks, conversions };
    });
  }, [dates, offers]);

  const grid = dark ? '#262626' : '#e2e8f0';
  const axis = dark ? '#a3a3a3' : '#64748b';
  const click = dark ? '#60a5fa' : '#2563eb';
  const conv = dark ? '#34d399' : '#059669';

  return (
    <div className="h-64 w-full px-2 pb-2 pt-3 sm:px-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmtTickDate} stroke={grid} tickLine={false} />
          <YAxis tick={{ fill: axis, fontSize: 11 }} stroke={grid} tickLine={false} width={44} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: dark ? '#171717' : '#ffffff',
              border: `1px solid ${dark ? '#404040' : '#e2e8f0'}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(d) => fmtTooltipDate(String(d))}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: axis }} iconType="circle" />
          <Line type="monotone" dataKey="clicks" name="Clicks" stroke={click} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="conversions" name="Conversions" stroke={conv} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Stacked horizontal bars: per-offer status mix. Visualises approval rate
// and unverified leakage at a glance.
function FunnelChart({ offers }: { offers: OfferReportSummary[] }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const top = offers.slice(0, 6);
  const data = top.map((o) => ({
    name: o.offer_name ?? o.offer_id,
    Approved: o.approved,
    Pending: o.pending,
    Rejected: o.rejected,
    Unverified: o.unverified,
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
          <Bar dataKey="Approved" stackId="s" fill={dark ? '#34d399' : '#059669'} />
          <Bar dataKey="Pending"  stackId="s" fill={dark ? '#fbbf24' : '#d97706'} />
          <Bar dataKey="Rejected" stackId="s" fill={dark ? '#f87171' : '#dc2626'} />
          <Bar dataKey="Unverified" stackId="s" fill={dark ? '#6b7280' : '#94a3b8'} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Tiny inline trend renderer — tabular cells need a glanceable signal.
// Built without ResponsiveContainer to avoid the layout-thrash penalty of
// hundreds of recharts instances per page.
function Sparkline({ series, color }: { series: { date: string; revenue: number }[]; color: string }) {
  const max = Math.max(1, ...series.map((p) => p.revenue));
  const w = 80;
  const h = 22;
  const stepX = series.length > 1 ? w / (series.length - 1) : w;
  const points = series
    .map((p, i) => `${(i * stepX).toFixed(2)},${(h - (p.revenue / max) * h).toFixed(2)}`)
    .join(' ');
  if (max === 1 && series.every((s) => s.revenue === 0)) {
    return <span className="inline-block text-[10px] text-slate-300 dark:text-neutral-700">flat</span>;
  }
  return (
    <svg width={w} height={h} className="overflow-visible" aria-label="trend">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} />
      <circle
        cx={(series.length - 1) * stepX}
        cy={h - (series[series.length - 1]!.revenue / max) * h}
        r={2}
        fill={color}
      />
    </svg>
  );
}

function fmtTickDate(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${dt.toLocaleDateString(undefined, { month: 'short' })} ${dt.getDate()}`;
}

function fmtTooltipDate(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

