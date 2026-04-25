import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CopyButton } from '@/components/ui/CopyButton';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { offersApi } from './api';
import { OfferFormModal } from './OfferFormModal';

export function OfferDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['offer', id],
    queryFn: () => offersApi.get(id),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => offersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] });
      qc.removeQueries({ queryKey: ['offer', id] });
      navigate('/offers', { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError) setDeleteError(err.code ?? err.message);
      else if (err instanceof Error) setDeleteError(err.message);
      else setDeleteError('Could not delete offer');
    },
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
  const fullUrl = offer.tracking_url ? `${offer.tracking_url}${offer.tracking_url.includes('?') ? '&' : '?'}aff_id=${encodeURIComponent(offer.offer_id)}` : '';

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
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Tracking URL"
          />
          <CardBody className="space-y-4">
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="block min-w-0 flex-1 break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-slate-200 dark:bg-neutral-950/60 dark:text-neutral-200 dark:ring-neutral-800">
                  {fullUrl}
                </code>
                {fullUrl && <CopyButton value={fullUrl} className="self-start sm:self-auto" />}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Affiliates can also append <Tok>&amp;s1=…&amp;s2=…</Tok> sub-parameters and ad-platform IDs
              (<Tok>gclid</Tok>, <Tok>gbraid</Tok>, <Tok>fbclid</Tok>, etc.) — they're captured on the click and
              available as <Tok>{'{token}'}</Tok> in the affiliate destination template below.
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

      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => !deleteMutation.isPending && setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete offer?"
        description={
          <>
            This permanently removes <strong>{offer.name}</strong> ({offer.offer_id}). Existing clicks and conversions
            already linked to it stay in the database, but the offer itself can no longer be edited or fired against.
          </>
        }
        confirmLabel="Delete offer"
        variant="danger"
        busy={deleteMutation.isPending}
        error={deleteError}
      />
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

function Tok({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-neutral-800 dark:text-neutral-300">
      {children}
    </code>
  );
}
