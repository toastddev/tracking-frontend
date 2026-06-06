import { useMemo, useState } from 'react';
import { Inbox, Search, X } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { fmtInr } from '@/lib/format';

// Structural superset that fits both the GAds and FB campaign summary types.
// The two diverge only in the platform-specific click/CTR/CPC field name
// prefix (`gads_*` vs `fb_*`); this row reads the right one based on
// `platform`.
export interface CampaignFlatLike {
  campaign_id: string;
  campaign_name?: string;
  source: string;
  clicks: number;
  conversions: number;
  revenue: number;       // INR
  revenue_usd: number;   // reverse-converted from INR
  spend: number;         // INR
  profit: number;
  cvr: number;
  epc: number;
  cpa: number;
  roi: number;
  gads_clicks?: number;
  gads_ctr?: number;
  gads_cpc?: number;
  fb_clicks?: number;
  fb_ctr?: number;
  fb_cpc?: number;
}

interface Props {
  platform: 'google' | 'facebook';
  campaigns: CampaignFlatLike[];
  onOpenCampaign: (id: string) => void;
}

const fmtNum = (v: number) =>
  new Intl.NumberFormat('en-IN', { notation: v >= 10_000 ? 'compact' : 'standard' }).format(v);
const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';
const fmtRoi = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(0)}%` : '—');

// View-2 of the campaigns page: same per-campaign rows as view-1, just
// re-laid-out into a single flat header with the column set the operator
// asked for. Sorted by Earnings (INR) desc — they almost always scan this
// view from highest-earning campaign down.
export function CampaignsFlatTable({ platform, campaigns, onOpenCampaign }: Props) {
  const [search, setSearch] = useState('');

  const platformLabel = platform === 'google' ? 'GAds' : 'FB';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.campaign_id.toLowerCase().includes(q) ||
        (c.campaign_name ?? '').toLowerCase().includes(q),
    );
  }, [campaigns, search]);

  const sorted = useMemo(
    () => filtered.slice().sort((a, b) => b.revenue - a.revenue),
    [filtered],
  );

  const isSearching = search.trim().length > 0;

  return (
    <Card>
      <CardHeader
        title="Per-campaign metrics"
        subtitle="Same campaign data as view 1, laid out with the columns you asked for. Click a row to drill in."
      />
      <div className="border-b border-slate-200 px-4 py-2.5 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns by name or ID…"
              className="h-8 pl-8 text-xs"
              aria-label="Search campaigns"
            />
          </div>
          {isSearching && (
            <>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                {sorted.length} of {campaigns.length}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSearch('')}>
                <X className="h-3 w-3" /> Clear
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        {sorted.length === 0 ? (
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
                <TH>Name</TH>
                <TH className="text-right">{platformLabel} Clicks</TH>
                <TH className="text-right">Network Clicks</TH>
                <TH className="text-right">{platformLabel} CTR</TH>
                <TH className="text-right">{platformLabel} CPC</TH>
                <TH className="text-right">Network Conv</TH>
                <TH className="text-right">CR</TH>
                <TH className="text-right">{platformLabel} Cost</TH>
                <TH className="text-right">Earnings (USD)</TH>
                <TH className="text-right">Earnings (INR)</TH>
                <TH className="text-right">Cost / Conv</TH>
                <TH className="text-right">Rev / Conv</TH>
                <TH className="text-right">EPC</TH>
                <TH className="text-right">Profit</TH>
                <TH className="text-right">ROI</TH>
              </TR>
            </THead>
            <TBody>
              {sorted.map((row) => {
                const adClicks =
                  platform === 'google' ? row.gads_clicks ?? 0 : row.fb_clicks ?? 0;
                const adCtr = platform === 'google' ? row.gads_ctr ?? 0 : row.fb_ctr ?? 0;
                const adCpc = platform === 'google' ? row.gads_cpc ?? 0 : row.fb_cpc ?? 0;
                const revPerConv =
                  row.conversions > 0 ? row.revenue / row.conversions : 0;
                const profitTone =
                  row.profit > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : row.profit < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-neutral-400';
                const roiTone =
                  row.roi > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : row.roi < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-neutral-400';
                return (
                  <TR
                    key={row.campaign_id}
                    className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-neutral-800/50"
                    onClick={() => onOpenCampaign(row.campaign_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenCampaign(row.campaign_id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open detail for campaign ${row.campaign_name ?? row.campaign_id}`}
                  >
                    <TD>
                      <div className="font-medium text-slate-800 dark:text-neutral-200">
                        {row.campaign_name ?? row.campaign_id}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-neutral-500">
                        {row.campaign_id}
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">{fmtNum(adClicks)}</TD>
                    <TD className="text-right tabular-nums">{fmtNum(row.clicks)}</TD>
                    <TD className="text-right tabular-nums">{adCtr ? fmtPct(adCtr) : '—'}</TD>
                    <TD className="text-right tabular-nums">{adCpc ? fmtInr(adCpc) : '—'}</TD>
                    <TD className="text-right tabular-nums">{fmtNum(row.conversions)}</TD>
                    <TD className="text-right tabular-nums">{fmtPct(row.cvr)}</TD>
                    <TD className="text-right tabular-nums">{fmtInr(row.spend)}</TD>
                    <TD className="text-right tabular-nums">{row.revenue_usd.toFixed(2)}</TD>
                    <TD className="text-right tabular-nums">{fmtInr(row.revenue)}</TD>
                    <TD className="text-right tabular-nums">
                      {row.cpa > 0 ? fmtInr(row.cpa) : '—'}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {revPerConv > 0 ? fmtInr(revPerConv) : '—'}
                    </TD>
                    <TD className="text-right tabular-nums">{fmtInr(row.epc)}</TD>
                    <TD className={`text-right tabular-nums font-medium ${profitTone}`}>
                      {fmtInr(row.profit)}
                    </TD>
                    <TD className={`text-right tabular-nums ${roiTone}`}>{fmtRoi(row.roi)}</TD>
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
