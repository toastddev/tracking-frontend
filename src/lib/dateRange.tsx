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

export type RangePreset = '1d' | '2d' | '7d' | '30d' | '90d' | 'custom';

export const DEFAULT_PRESET: RangePreset = '30d';

export interface DateRange {
  from: string; // ISO
  to: string;   // ISO
  preset: RangePreset;
}

interface PresetSpec {
  key: RangePreset;
  label: string;
  hours: number;
}

export const RANGE_PRESETS: PresetSpec[] = [
  { key: '1d',  label: '1 day',   hours: 24 },
  { key: '2d',  label: '2 days',  hours: 48 },
  { key: '7d',  label: 'Week',    hours: 24 * 7 },
  { key: '30d', label: 'Month',   hours: 24 * 30 },
  { key: '90d', label: '90 days', hours: 24 * 90 },
];

export function buildPresetRange(preset: RangePreset): DateRange {
  if (preset === 'custom') throw new Error('cannot build custom from preset');
  const p = RANGE_PRESETS.find((x) => x.key === preset);
  if (!p) throw new Error(`bad preset ${preset}`);
  const to = new Date();
  const from = new Date(to.getTime() - p.hours * 60 * 60 * 1000);
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
    // Re-anchor relative presets to "now" so a stored "30d" still means the
    // last 30 days at the time of the next visit, not the slice that was
    // current when it was saved.
    const presetMatch = RANGE_PRESETS.find((p) => p.key === parsed.preset);
    if (presetMatch) return buildPresetRange(presetMatch.key);
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
