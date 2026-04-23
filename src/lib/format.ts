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

export function shortId(id: string | undefined | null, head = 8): string {
  if (!id) return '—';
  return id.length > head ? `${id.slice(0, head)}…` : id;
}
