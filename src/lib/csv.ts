// Minimal client-side CSV writer for "Download report" buttons. Intentionally
// dependency-free — Excel-compatible quoting is the only correctness rule that
// matters here, and json2csv would add ~30 KB for that.
//
// Escaping: wrap a field in double-quotes when it contains a quote, comma, or
// newline; double up any embedded quotes. A UTF-8 BOM is prepended so Excel
// renders ₹ and other non-ASCII glyphs without the "import from text" wizard.

export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(v: CsvCell): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: Array<CsvCell[]>): string {
  const out: string[] = [];
  out.push(headers.map((h) => escapeCell(h)).join(','));
  for (const row of rows) out.push(row.map(escapeCell).join(','));
  return out.join('\r\n');
}

// Triggers a browser download. ﻿ is the UTF-8 BOM — Excel needs it on
// Windows to detect UTF-8 (otherwise ₹ becomes mojibake).
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so Safari (which reads the URL out-of-process)
  // doesn't lose the download mid-flight.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// UTC stamp `YYYYMMDD_HHmm` for filename suffixes. UTC so two operators in
// different timezones produce identical filenames for the same window.
export function csvTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}
