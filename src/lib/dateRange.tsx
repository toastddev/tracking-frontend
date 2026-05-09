import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';

// Global date-range filter shared across every dashboard page. Persisted to
// localStorage so the operator's preferred window survives reloads, and
// hydratable from `?from=&to=` query params on detail pages so shared links
// still scope the data correctly.

const STORAGE_KEY = 'dashboard:date-range:v1';

export type RangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_90d'
  | 'custom';

export const DEFAULT_PRESET: RangePreset = 'this_month';

export interface DateRange {
  from: string; // ISO
  to: string;   // ISO
  preset: RangePreset;
}

interface PresetSpec {
  key: RangePreset;
  label: string;
}

export const RANGE_PRESETS: PresetSpec[] = [
  { key: 'today',      label: 'Today (UTC)' },
  { key: 'yesterday',  label: 'Yesterday (UTC)' },
  { key: 'this_week',  label: 'This week (UTC)' },
  { key: 'last_week',  label: 'Last week (UTC)' },
  { key: 'this_month', label: 'This month (UTC)' },
  { key: 'last_month', label: 'Last month (UTC)' },
  { key: 'last_90d',   label: 'Last 90 days (UTC)' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - 1);
}

function addUtcDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function startOfUtcWeek(d: Date): Date {
  const dayStart = startOfUtcDay(d);
  const dow = dayStart.getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  return addUtcDays(dayStart, -daysSinceMonday);
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1);
}

function normalizePreset(preset: unknown): RangePreset | null {
  if (typeof preset !== 'string') return null;
  if (RANGE_PRESETS.some((p) => p.key === preset)) return preset as RangePreset;
  if (preset === '1d') return 'today';
  if (preset === '2d') return 'yesterday';
  if (preset === '7d') return 'this_week';
  if (preset === '30d') return 'this_month';
  if (preset === '90d') return 'last_90d';
  return null;
}

export function buildPresetRange(preset: RangePreset): DateRange {
  if (preset === 'custom') throw new Error('cannot build custom from preset');
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);
  let from: Date;
  let to: Date;

  switch (preset) {
    case 'today':
      from = todayStart;
      to = todayEnd;
      break;
    case 'yesterday':
      from = addUtcDays(todayStart, -1);
      to = new Date(todayStart.getTime() - 1);
      break;
    case 'this_week':
      from = startOfUtcWeek(now);
      to = todayEnd;
      break;
    case 'last_week': {
      const thisWeekStart = startOfUtcWeek(now);
      from = addUtcDays(thisWeekStart, -7);
      to = new Date(thisWeekStart.getTime() - 1);
      break;
    }
    case 'this_month':
      from = startOfUtcMonth(now);
      to = todayEnd;
      break;
    case 'last_month': {
      const firstThisMonth = startOfUtcMonth(now);
      const previousMonthDay = new Date(firstThisMonth.getTime() - 1);
      from = startOfUtcMonth(previousMonthDay);
      to = endOfUtcMonth(previousMonthDay);
      break;
    }
    case 'last_90d':
      from = addUtcDays(todayStart, -89);
      to = todayEnd;
      break;
    default:
      throw new Error(`bad preset ${preset}`);
  }
  return { from: from.toISOString(), to: to.toISOString(), preset };
}

function loadInitial(): DateRange {
  if (typeof window === 'undefined') return buildPresetRange(DEFAULT_PRESET);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildPresetRange(DEFAULT_PRESET);
    const parsed = JSON.parse(raw) as Partial<DateRange>;
    if (typeof parsed.from !== 'string' || typeof parsed.to !== 'string') {
      return buildPresetRange(DEFAULT_PRESET);
    }
    const f = Date.parse(parsed.from);
    const t = Date.parse(parsed.to);
    if (!Number.isFinite(f) || !Number.isFinite(t) || f > t) {
      return buildPresetRange(DEFAULT_PRESET);
    }
    // Re-anchor relative presets to "now" so a stored preset still means the
    // current calendar period at the time of the next visit, not the slice
    // that was current when it was saved.
    const preset = normalizePreset(parsed.preset);
    if (preset) return buildPresetRange(preset);
    return { from: parsed.from, to: parsed.to, preset: 'custom' };
  } catch {
    return buildPresetRange(DEFAULT_PRESET);
  }
}

function persist(r: DateRange): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {
    // ignore quota / private-mode failures
  }
}

interface Ctx {
  range: DateRange;
  setRange: (next: DateRange) => void;
}

const DateRangeContext = createContext<Ctx | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRangeState] = useState<DateRange>(loadInitial);

  const setRange = useCallback((next: DateRange) => {
    setRangeState(next);
    persist(next);
  }, []);

  const value = useMemo(() => ({ range, setRange }), [range, setRange]);
  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange(): Ctx {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used inside DateRangeProvider');
  return ctx;
}

// Detail-page helper: hydrate the global context from `?from=&to=` on first
// mount (so a shared link scopes correctly) and keep the URL in sync with
// the global range thereafter (so the link in the address bar always
// reflects what the page is showing).
export function useUrlSyncedDateRange(): DateRange {
  const { range, setRange } = useDateRange();
  const [search, setSearch] = useSearchParams();

  // Mount-only: adopt URL params if present.
  useEffect(() => {
    const f = search.get('from');
    const t = search.get('to');
    if (!f || !t) return;
    const fd = Date.parse(f);
    const td = Date.parse(t);
    if (!Number.isFinite(fd) || !Number.isFinite(td) || fd > td) return;
    if (range.from === f && range.to === t) return;
    setRange({ from: f, to: t, preset: 'custom' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL in sync with the global range.
  useEffect(() => {
    if (search.get('from') === range.from && search.get('to') === range.to) return;
    const next = new URLSearchParams(search);
    next.set('from', range.from);
    next.set('to', range.to);
    setSearch(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  return range;
}
