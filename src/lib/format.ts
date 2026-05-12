import { format, formatDistanceToNow } from 'date-fns';

export function fmtDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'MMM d, yyyy HH:mm:ss');
}

export function fmtRelative(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}

// Default currency for non-campaign reports is USD — offer and postback
// reports stay in USD because network payouts are reported in USD on those
// surfaces. Campaign reports are INR-only and use `fmtInr` / `fmtInrExact`
// directly; they do not go through this helper.
export function fmtMoney(amount: number | undefined | null, currency?: string | null): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

// INR formatting — used everywhere campaign / GAds money is rendered. Returns
// a short display string (uses compact lakh/crore notation for big values) so
// table cells stay readable. The exact rupee amount belongs in a tooltip; use
// `fmtInrExact` for that.
export function fmtInr(amount: number | undefined | null): string {
  if (amount == null || Number.isNaN(amount) || !Number.isFinite(amount)) return '—';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

// Exact INR amount with full digit grouping. Renders as ₹12,34,567.89 — the
// authoritative number for the tooltip behind compact displays. Use this in
// the `title` attribute so the operator can see the precise value on hover.
export function fmtInrExact(amount: number | undefined | null): string {
  if (amount == null || Number.isNaN(amount) || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

// Compact integer formatting using the Indian numbering system. Useful for
// large click / impression counts.
export function fmtIntCompact(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n) || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${(n / 1_00_000).toFixed(2)} L`;
  if (abs >= 10_000) return new Intl.NumberFormat('en-IN').format(Math.round(n));
  return new Intl.NumberFormat('en-IN').format(n);
}

export function shortId(id: string | undefined | null, head = 8): string {
  if (!id) return '—';
  return id.length > head ? `${id.slice(0, head)}…` : id;
}
