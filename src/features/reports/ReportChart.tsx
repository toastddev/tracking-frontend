import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/lib/theme';
import type { TimeseriesPoint } from '@/types';

interface Props {
  points: TimeseriesPoint[];
}

const fmtCount = (v: number) => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(v);
const fmtMoney = (v: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact' }).format(v);

// Shared colour palette resolved once per theme so the three charts below
// stay visually consistent.
function useChartColors() {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  return useMemo(
    () => ({
      grid:          dark ? '#262626' : '#e2e8f0',
      axis:          dark ? '#a3a3a3' : '#64748b',
      tooltipBg:     dark ? '#171717' : '#ffffff',
      tooltipBorder: dark ? '#404040' : '#e2e8f0',
      tooltipText:   dark ? '#e5e5e5' : '#0f172a',
      clicks:        dark ? '#60a5fa' : '#2563eb',
      verified:      dark ? '#34d399' : '#059669',
      unverified:    dark ? '#fbbf24' : '#d97706',
      revenue:       dark ? '#a78bfa' : '#7c3aed',
    }),
    [dark]
  );
}

function tickDate(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return `${dt.toLocaleDateString(undefined, { month: 'short' })} ${dt.getDate()}`;
}

function tooltipLabel(d: string): string {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const ChartShell = ({ children }: { children: React.ReactNode }) => (
  <div className="h-56 w-full px-2 pb-2 pt-3 sm:px-4">
    <ResponsiveContainer width="100%" height="100%">
      {children as React.ReactElement}
    </ResponsiveContainer>
  </div>
);

export function RevenueChart({ points }: Props) {
  const c = useChartColors();
  return (
    <ChartShell>
      <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.revenue} stopOpacity={0.35} />
            <stop offset="100%" stopColor={c.revenue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: c.axis, fontSize: 11 }}
          tickFormatter={tickDate}
          stroke={c.grid}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: c.axis, fontSize: 11 }}
          stroke={c.grid}
          tickLine={false}
          tickFormatter={fmtMoney}
          width={56}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: c.tooltipBg,
            border: `1px solid ${c.tooltipBorder}`,
            borderRadius: 8,
            color: c.tooltipText,
            fontSize: 12,
          }}
          labelStyle={{ color: c.tooltipText, marginBottom: 4 }}
          labelFormatter={tooltipLabel}
          formatter={(value: number) => [fmtMoney(value), 'Revenue']}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke={c.revenue}
          fill="url(#revFill)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartShell>
  );
}

export function ActivityChart({ points }: Props) {
  const c = useChartColors();
  // Derive unverified inline — `postbacks` already counts verified + unverified,
  // so the difference is the unverified slice.
  const data = useMemo(
    () => points.map((p) => ({ ...p, unverified: Math.max(0, p.postbacks - p.conversions) })),
    [points]
  );
  return (
    <ChartShell>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: c.axis, fontSize: 11 }}
          tickFormatter={tickDate}
          stroke={c.grid}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: c.axis, fontSize: 11 }}
          stroke={c.grid}
          tickLine={false}
          tickFormatter={fmtCount}
          width={44}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: c.tooltipBg,
            border: `1px solid ${c.tooltipBorder}`,
            borderRadius: 8,
            color: c.tooltipText,
            fontSize: 12,
          }}
          labelStyle={{ color: c.tooltipText, marginBottom: 4 }}
          labelFormatter={tooltipLabel}
          formatter={(value: number, name: string) => [fmtCount(value), name]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: c.axis }} iconType="circle" />
        <Line
          type="monotone"
          dataKey="clicks"
          name="Clicks"
          stroke={c.clicks}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="conversions"
          name="Verified conversions"
          stroke={c.verified}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="unverified"
          name="Unverified postbacks"
          stroke={c.unverified}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartShell>
  );
}
