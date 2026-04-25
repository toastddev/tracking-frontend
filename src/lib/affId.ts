import { useSyncExternalStore } from 'react';

// Global affiliate ID for tracking-link previews. Stored in localStorage so
// it survives reloads and shared across views (offers list, detail) so the
// admin types it once and every URL on screen reflects the same value.

const KEY = 'tracking.last_aff_id';

function read(): string {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

let current = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setAffId(v: string): void {
  current = v;
  try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
}

export function useAffId(): string {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

export function buildAffiliateUrl(base: string | undefined, affId: string): string {
  if (!base) return '';
  const id = affId.trim();
  if (!id) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}aff_id=${encodeURIComponent(id)}`;
}
