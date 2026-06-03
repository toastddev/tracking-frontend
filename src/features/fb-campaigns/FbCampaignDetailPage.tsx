import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Info } from 'lucide-react';
import {
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
import { useDateRange } from '@/lib/dateRange';
import { fbCampaignReportsApi } from '@/features/connections/facebook/api';

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

export function FbCampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { range } = useDateRange();
  const { theme } = useTheme();

  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingSpend, setEditingSpend] = useState('');

  const dailyQ = useQuery({
    queryKey: ['fb-campaign-detail', id],
    queryFn: () => fbCampaignReportsApi.byCampaign(id!),
    enabled: !!id,
  });

  const setSpend = useMutation({
    mutationFn: (payload: { campaign_id: string; date: string; spend: number }) =>
      fbCampaignReportsApi.setSpend(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-campaign-detail', id] });
      qc.invalidateQueries({ queryKey: ['fb-campaign-summary'] });
      setEditingDate(null);
    },
  });

  const filtered = useMemo(() => {
    const rows = dailyQ.data?.items ?? [];
    const from = range.from.slice(0, 10);
    const to = range.to.slice(0, 10);
    return rows.filter((r) => r.date >= from && r.date <= to);
  }, [dailyQ.data?.items, range.from, range.to]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        clicks: acc.clicks + r.clicks,
        conversions: acc.conversions + r.conversions,
        revenue: acc.revenue + r.revenue,
        spend: acc.spend + r.spend,
        approved: acc.approved + r.approved,
        pending: acc.pending + r.pending,
        rejected: acc.rejected + r.rejected,
        fb_clicks: acc.fb_clicks + (r.fb_clicks ?? 0),
        fb_impressions: acc.fb_impressions + (r.fb_impressions ?? 0),
      }),
      { clicks: 0, conversions: 0, revenue: 0, spend: 0, approved: 0, pending: 0, rejected: 0, fb_clicks: 0, fb_impressions: 0 }
    );
  }, [filtered]);

  if (dailyQ.isLoading) return <CenteredSpinner />;
  if (dailyQ.isError || !dailyQ.data) {
    return (
      <EmptyState
        icon={Info}
        title="Couldn't load campaign"
        description={dailyQ.error instanceof Error ? dailyQ.error.message : 'Unknown error'}
      />
    );
  }

  const head = filtered[0] ?? dailyQ.data.items[0];
  const stroke = theme === 'dark' ? '#52525b' : '#cbd5e1';
  const tickFill = theme === 'dark' ? '#a3a3a3' : '#475569';

  return (
    <>
      <PageHeader
        title={head?.campaign_name ?? id ?? ''}
        description={
          <>
            <code className="font-mono text-xs">{id}</code>
            {id === 'fb_untagged' && <> · synthetic (clicks with fbclid/fbc/fbp but no campaign tag)</>}
          </>
        }
        actions={
          <Button variant="ghost" onClick={() => navigate('/fb-campaigns')}>
            <ArrowLeft className="h-4 w-4" /> Back to FB Campaigns
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Mini label="Revenue" value={fmtInr(totals.revenue)} />
        <Mini label="Spend" value={fmtInr(totals.spend)} />
        <Mini label="Profit" value={fmtInr(totals.revenue - totals.spend)} />
        <Mini label="Conversions" value={fmtCount(totals.conversions)} sub={`${totals.approved}A / ${totals.pending}P / ${totals.rejected}R`} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Mini label="Clicks (tracked)" value={fmtCount(totals.clicks)} />
        <Mini label="FB clicks" value={fmtCount(totals.fb_clicks)} sub="From Meta Insights" />
        <Mini label="FB impressions" value={fmtCount(totals.fb_impressions)} />
        <Mini label="CTR" value={totals.fb_impressions > 0 ? ((totals.fb_clicks / totals.fb_impressions) * 100).toFixed(2) + '%' : '—'} />
      </div>

      <Card className="mb-4">
        <CardHeader title="Daily" />
        <CardBody>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <ComposedChart data={filtered}>
                <CartesianGrid stroke={stroke} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 11 }} />
                <YAxis yAxisId="money" tick={{ fill: tickFill, fontSize: 11 }} tickFormatter={fmtInrCompact} />
                <YAxis yAxisId="count" orientation="right" tick={{ fill: tickFill, fontSize: 11 }} tickFormatter={fmtCount} />
                <Tooltip
                  contentStyle={{
                    background: theme === 'dark' ? '#171717' : '#fff',
                    border: `1px solid ${stroke}`,
                  }}
                />
                <Legend />
                <Bar yAxisId="money" dataKey="revenue" name="Revenue (INR)" fill="#16a34a88" />
                <Bar yAxisId="money" dataKey="spend" name="Spend (INR)" fill="#0ea5e988" />
                <Line yAxisId="count" type="monotone" dataKey="conversions" name="Conversions" stroke="#f59e0b" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Per-day breakdown" subtitle="Operator-entered spend overrides what Meta Insights pulls; the next sync run will overwrite again." />
        <CardBody>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Clicks</TH>
                <TH>Conversions</TH>
                <TH>Revenue</TH>
                <TH>Spend</TH>
                <TH>FB clicks</TH>
                <TH>FB impressions</TH>
                <TH>Action</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((r) => (
                <TR key={r.date}>
                  <TD className="font-mono text-xs">{r.date}</TD>
                  <TD>{fmtCount(r.clicks)}</TD>
                  <TD>
                    {fmtCount(r.conversions)}
                    {(r.pending > 0 || r.rejected > 0) && (
                      <span className="ml-1 text-xs text-slate-400">
                        ({r.approved}A · {r.pending}P · {r.rejected}R)
                      </span>
                    )}
                  </TD>
                  <TD>{fmtInr(r.revenue)}</TD>
                  <TD>
                    {editingDate === r.date ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editingSpend}
                          onChange={(e) => setEditingSpend(e.target.value)}
                          className="w-28"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const n = Number(editingSpend);
                            if (!Number.isFinite(n) || n < 0) return;
                            setSpend.mutate({ campaign_id: id!, date: r.date, spend: n });
                          }}
                          disabled={setSpend.isPending}
                        >
                          {setSpend.isPending ? <Spinner /> : <Save className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingDate(null)}>Cancel</Button>
                      </div>
                    ) : (
                      r.spend > 0 ? fmtInr(r.spend) : <span className="text-slate-400">—</span>
                    )}
                  </TD>
                  <TD>{fmtCount(r.fb_clicks ?? 0)}</TD>
                  <TD>{fmtCount(r.fb_impressions ?? 0)}</TD>
                  <TD>
                    {editingDate !== r.date && id !== 'fb_untagged' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingDate(r.date);
                          setEditingSpend(String(r.spend || ''));
                        }}
                      >
                        Set spend
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-neutral-400">
              No days in the current range have data for this campaign.
            </div>
          )}
          {id === 'fb_untagged' && (
            <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
              <strong>Synthetic campaign.</strong> Spend cannot be set on <code className="font-mono">fb_untagged</code> — it
              represents clicks that carry a Facebook identifier (fbclid / _fbc / _fbp) but no campaign tag. Fix this at the
              source by adding <code className="font-mono">fb_campaign_id</code> or a UTM-tagged source on your tracking links.
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs text-slate-500 dark:text-neutral-400">{label}</div>
        <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-neutral-100">{value}</div>
        {sub && <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{sub}</div>}
      </CardBody>
    </Card>
  );
}
