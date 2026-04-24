import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { fmtDateTime, fmtMoney } from '@/lib/format';
import { conversionsApi } from '../postbacks/api';

interface Props {
  conversionId: string | null;
  onClose: () => void;
}

export function ConversionDetailDrawer({ conversionId, onClose }: Props) {
  const open = conversionId !== null;

  const query = useQuery({
    queryKey: ['conversion', conversionId],
    queryFn: () => conversionsApi.get(conversionId!),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-fade-in dark:bg-neutral-950/70"
      onClick={onClose}
    >
      <div
        className="h-full w-full animate-slide-in-right overflow-y-auto bg-white shadow-2xl sm:max-w-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4 dark:border-neutral-800 dark:bg-neutral-900/95">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-neutral-100">Conversion detail</h2>
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{conversionId}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {query.isLoading ? (
          <CenteredSpinner />
        ) : !query.data ? (
          <div className="p-6 text-sm text-slate-600 dark:text-neutral-300">Conversion not found.</div>
        ) : (
          <ConversionBody data={query.data} />
        )}
      </div>
    </div>
  );
}

function ConversionBody({
  data,
}: {
  data: {
    conversion: import('@/types').ConversionRecord;
    click: import('@/types').ClickRecord | null;
  };
}) {
  const { conversion, click } = data;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Section title="Postback">
        <Row label="Received" value={fmtDateTime(conversion.created_at)} />
        <Row label="Network" value={conversion.network_id} />
        <Row label="Method" value={conversion.method} />
        <Row label="Source IP" value={conversion.source_ip ?? '—'} />
        <Row label="Status" value={conversion.status ?? '—'} />
        <Row label="Payout" value={fmtMoney(conversion.payout, conversion.currency)} />
        <Row label="Currency" value={conversion.currency ?? '—'} />
        <Row label="Transaction ID" value={conversion.txn_id ?? '—'} />
        <Row label="Network timestamp" value={conversion.network_timestamp ?? '—'} />
        <Row
          label="Verified"
          value={
            conversion.verified ? (
              <Badge tone="green">verified — {conversion.verification_reason}</Badge>
            ) : (
              <Badge tone="amber">unverified — {conversion.verification_reason}</Badge>
            )
          }
        />
      </Section>

      {conversion.verified && click ? (
        <Section title="Originating click">
          <Row label="Click ID" value={<code className="font-mono text-xs">{click.click_id}</code>} />
          <Row label="Offer" value={click.offer_id} />
          <Row label="Affiliate" value={click.aff_id} />
          <Row label="Country" value={click.country ?? '—'} />
          <Row label="IP" value={click.ip ?? '—'} />
          <Row label="Referrer" value={click.referrer ?? '—'} />
          <Row label="User agent" value={<span className="break-all text-xs">{click.user_agent ?? '—'}</span>} />
          <Row label="Clicked at" value={fmtDateTime(click.created_at)} />

          <div className="mt-3">
            <SubBlock title="Sub-parameters">
              {Object.keys(click.sub_params ?? {}).length === 0 ? (
                <span className="text-xs text-slate-500 dark:text-neutral-400">none</span>
              ) : (
                <KeyValueGrid data={click.sub_params} />
              )}
            </SubBlock>
            <SubBlock title="Ad-platform IDs">
              {Object.values(click.ad_ids ?? {}).filter(Boolean).length === 0 ? (
                <span className="text-xs text-slate-500 dark:text-neutral-400">none captured</span>
              ) : (
                <KeyValueGrid data={click.ad_ids as Record<string, string>} />
              )}
            </SubBlock>
            <SubBlock title="Final redirect URL">
              <code className="block break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-neutral-950/60 dark:text-neutral-300 dark:ring-neutral-800">
                {click.redirect_url}
              </code>
            </SubBlock>
          </div>
        </Section>
      ) : (
        <Section title="Originating click">
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            Click ID <code className="font-mono">{conversion.click_id}</code> did not match any tracked click.
            The conversion is saved for audit but cannot be linked to an offer or affiliate.
          </p>
        </Section>
      )}

      <Section title="Raw payload">
        <pre className="overflow-x-auto rounded-md bg-slate-900 px-3 py-2 font-mono text-xs leading-relaxed text-slate-100 ring-1 ring-slate-800 dark:bg-neutral-950 dark:ring-neutral-800">
          {JSON.stringify(conversion.raw_payload ?? {}, null, 2)}
        </pre>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 text-sm dark:border-neutral-800">
      <span className="shrink-0 text-xs uppercase tracking-wide text-slate-500 dark:text-neutral-400">{label}</span>
      <span className="min-w-0 text-right text-slate-700 dark:text-neutral-200">{value}</span>
    </div>
  );
}

function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-300">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function KeyValueGrid({ data }: { data: Record<string, string | undefined> }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200 sm:grid-cols-2 dark:bg-neutral-950/60 dark:ring-neutral-800">
      {Object.entries(data).map(([k, v]) =>
        v ? (
          <div key={k} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-neutral-400">{k}</span>
            <code className="max-w-[160px] truncate font-mono text-slate-700 dark:text-neutral-300" title={v}>{v}</code>
          </div>
        ) : null
      )}
    </div>
  );
}
