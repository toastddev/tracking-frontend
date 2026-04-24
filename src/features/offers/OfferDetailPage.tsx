import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CopyButton } from '@/components/ui/CopyButton';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { fmtDateTime } from '@/lib/format';
import { offersApi } from './api';
import { OfferFormModal } from './OfferFormModal';

export function OfferDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);

  const query = useQuery({
    queryKey: ['offer', id],
    queryFn: () => offersApi.get(id),
    enabled: !!id,
  });

  if (query.isLoading) return <CenteredSpinner />;
  if (query.isError || !query.data) {
    return (
      <Card>
        <div className="px-5 py-4 text-sm text-slate-600 dark:text-neutral-300">Offer not found.</div>
      </Card>
    );
  }

  const offer = query.data;

  return (
    <>
      <PageHeader
        back={
          <Link
            to="/offers"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <ArrowLeft className="h-4 w-4" /> All offers
          </Link>
        }
        title={offer.name}
        description={offer.offer_id}
        actions={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Tracking URL"
            subtitle="Give this to each affiliate after replacing YOUR_AFFILIATE_ID with their ID. aff_id is required."
          />
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="block min-w-0 flex-1 break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-neutral-950/60 dark:text-neutral-300 dark:ring-neutral-800">
                {offer.tracking_url}
              </code>
              {offer.tracking_url && <CopyButton value={offer.tracking_url} className="self-start sm:self-auto" />}
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Affiliates can also append{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">&amp;s1=…&amp;s2=…</code>{' '}
              sub-parameters and ad-platform IDs (
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">gclid</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">gbraid</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">fbclid</code>,
              etc.) — they're captured on the click and available as{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">{'{token}'}</code>{' '}
              in the affiliate destination template below.
            </p>

            <div>
              <div className="label">Affiliate destination template</div>
              <code className="block break-all rounded-md bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 ring-1 ring-slate-800 dark:bg-neutral-950 dark:ring-neutral-800">
                {offer.base_url}
              </code>
            </div>

            {offer.default_params && Object.keys(offer.default_params).length > 0 && (
              <div>
                <div className="label">Default params</div>
                <pre className="overflow-x-auto rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-neutral-950/60 dark:text-neutral-300 dark:ring-neutral-800">
                  {JSON.stringify(offer.default_params, null, 2)}
                </pre>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Details" />
          <CardBody className="space-y-3 text-sm">
            <DetailRow label="Status" value={<Badge tone={offer.status === 'active' ? 'green' : 'gray'}>{offer.status}</Badge>} />
            <DetailRow label="Created" value={fmtDateTime(offer.created_at)} />
            <DetailRow label="Updated" value={fmtDateTime(offer.updated_at)} />
          </CardBody>
        </Card>
      </div>

      <OfferFormModal open={editOpen} onClose={() => setEditOpen(false)} initial={offer} />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-neutral-400">{label}</span>
      <span className="text-slate-700 dark:text-neutral-200">{value}</span>
    </div>
  );
}
