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

// The display currency is fetched from the backend once and cached here.
// It drives all fmtMoney calls across the app.
let _displayCurrency = 'USD';

export function setDisplayCurrency(c: string): void {
  _displayCurrency = (c || 'USD').toUpperCase();
}

export function getDisplayCurrency(): string {
  return _displayCurrency;
}

export function fmtMoney(amount: number | undefined | null, currency?: string | null): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  const cur = currency || _displayCurrency;
  try {
    // For INR we use the Indian locale for proper ₹ formatting with lakhs/crores
    const locale = cur === 'INR' ? 'en-IN' : undefined;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

// Compact money format for chart axes — e.g. ₹1.2Cr, ₹50L, ₹1K
export function fmtMoneyCompact(amount: number, currency?: string | null): string {
  const cur = currency || _displayCurrency;
  try {
    const locale = cur === 'INR' ? 'en-IN' : undefined;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return amount.toFixed(0);
  }
}

export function shortId(id: string | undefined | null, head = 8): string {
  if (!id) return '—';
  return id.length > head ? `${id.slice(0, head)}…` : id;
}
