import { useEffect, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefers(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === 'system' ? systemPrefers() : theme;
}

function applyClass(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

const listeners = new Set<() => void>();
let current: Theme = readStored();

function setTheme(next: Theme) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore storage failures (private mode, quota)
  }
  applyClass(resolve(next));
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Sync when the OS setting changes (only matters for 'system' mode, but we
// re-run unconditionally since the resolved value is cheap).
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    applyClass(resolve(current));
    listeners.forEach((l) => l());
  };
  mq.addEventListener('change', onChange);
  // Apply on boot in case pre-boot script didn't run.
  applyClass(resolve(current));
}

export function useTheme(): { theme: Theme; resolved: ResolvedTheme; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, () => current, () => current);
  // Re-render on system change too (subscription above already fires).
  useEffect(() => {}, []);
  return {
    theme,
    resolved: resolve(theme),
    setTheme,
  };
}

export const themeStore = { get: () => current, set: setTheme, resolve };
