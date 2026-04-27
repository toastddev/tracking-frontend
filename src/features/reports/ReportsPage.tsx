import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, DollarSign, MousePointerClick, Webhook } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { CenteredSpinner, Spinner } from '@/components/ui/Spinner';
import { reportsApi } from './api';
import { ReportFilters, buildPresetRange, type ReportRange } from './ReportFilters';
import { ActivityChart, RevenueChart } from './ReportChart';
import { ClicksReportTab } from './ClicksReportTab';
import { ConversionsReportTab } from './ConversionsReportTab';
import { PostbacksReportTab } from './PostbacksReportTab';
import { cn } from '@/lib/cn';

type Tab = 'clicks' | 'conversions' | 'postbacks';

const TABS: { key: Tab; label: string; description: string }[] = [
  { key: 'clicks',      label: 'Clicks',      description: 'Every tracked click.' },
  { key: 'conversions', label: 'Conversions', description: 'Verified postbacks that resolved to a real click.' },
  { key: 'postbacks',   label: 'Postbacks',   description: 'All postback events (verified + unverified).' },
];

function defaultRange(): ReportRange {
  return buildPresetRange('30d');
}

export function ReportsPage() {
  const [range, setRange] = useState<ReportRange>(defaultRange);
  const [tab, setTab] = useState<Tab>('clicks');

  const queryArgs = useMemo(
    () => ({ from: range.from, to: range.to }),
    [range.from, range.to]
  );

  const summaryQuery = useQuery({
    queryKey: ['reports', 'summary', queryArgs],
    queryFn: () => reportsApi.summary(queryArgs),
    staleTime: 30_000,
  });

  const timeseriesQuery = useQuery({
    queryKey: ['reports', 'timeseries', queryArgs],
    queryFn: () => reportsApi.timeseries(queryArgs),
    staleTime: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Clicks, postbacks, conversions, and revenue — across every offer and network."
        actions={
          (summaryQuery.isFetching || timeseriesQuery.isFetching) && (
            <Spinner className="text-slate-400 dark:text-neutral-500" />
          )
        }
      />

      <div className="mb-6">
        <ReportFilters value={range} onChange={setRange} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Clicks"
          value={fmtCount(summaryQuery.data?.clicks)}
          loading={summaryQuery.isLoading}
        />
        <StatCard
          icon={<Webhook className="h-4 w-4" />}
          label="Postbacks"
          value={fmtCount(summaryQuery.data?.postbacks)}
          loading={summaryQuery.isLoading}
          sub={summaryQuery.data
            ? `${fmtCount(summaryQuery.data.unverified)} unverified`
            : undefined}
        />
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Conversions"
          value={fmtCount(summaryQuery.data?.conversions)}
          loading={summaryQuery.isLoading}
          sub={summaryQuery.data
            ? `${(summaryQuery.data.cvr * 100).toFixed(2)}% CVR`
            : undefined}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Revenue"
          value={fmtMoney(summaryQuery.data?.revenue)}
          loading={summaryQuery.isLoading}
          sub={summaryQuery.data
            ? `${fmtMoney(summaryQuery.data.epc)} EPC`
            : undefined}
        />
      </div>

      <div className="mb-6 space-y-6">
        <Card>
          <CardHeader
            title="Revenue"
            subtitle="Sum of payout for verified conversions, bucketed by day."
          />
          <CardBody className="p-0">
            {timeseriesQuery.isLoading ? (
              <CenteredSpinner />
            ) : (
              <RevenueChart points={timeseriesQuery.data?.points ?? []} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Clicks & conversions"
            subtitle="Daily clicks alongside verified and unverified postback events."
          />
          <CardBody className="p-0">
            {timeseriesQuery.isLoading ? (
              <CenteredSpinner />
            ) : (
              <ActivityChart points={timeseriesQuery.data?.points ?? []} />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="flex border-b border-slate-200 px-2 pt-2 sm:px-3 dark:border-neutral-800 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
                tab === t.key
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
              )}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
              )}
            </button>
          ))}
        </div>
        <div>
          {tab === 'clicks' && <ClicksReportTab range={range} />}
          {tab === 'conversions' && <ConversionsReportTab range={range} verifiedOnly />}
          {tab === 'postbacks' && <PostbacksReportTab range={range} />}
        </div>
      </Card>
    </>
  );
}

function StatCard({
  icon, label, value, sub, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          <span className="text-slate-400 dark:text-neutral-500">{icon}</span>
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-neutral-100 sm:text-3xl">
          {loading ? <Skeleton className="h-8 w-20" /> : value}
        </div>
        {sub && !loading && (
          <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{sub}</div>
        )}
      </div>
    </Card>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-neutral-800', className)} />;
}

function fmtCount(n: number | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat().format(n);
}

function fmtMoney(n: number | undefined): string {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
}
