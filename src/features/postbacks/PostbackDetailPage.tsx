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
import { networksApi } from './api';
import { PostbackFormModal } from './PostbackFormModal';
import { EventLog } from './EventLog';

export function PostbackDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['network', id],
    queryFn: () => networksApi.get(id),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => networksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['networks'] });
      qc.removeQueries({ queryKey: ['network', id] });
      navigate('/postbacks', { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError) setDeleteError(err.code ?? err.message);
      else if (err instanceof Error) setDeleteError(err.message);
      else setDeleteError('Could not delete postback');
    },
  });

  if (query.isLoading) return <CenteredSpinner />;
  if (query.isError || !query.data) {
    return (
      <Card>
        <div className="px-5 py-4 text-sm text-slate-600 dark:text-neutral-300">Postback not found.</div>
      </Card>
    );
  }

  const network = query.data;

  // Build an example URL the user can copy into the network's dashboard.
  // LHS param names are FIXED canonical names; RHS is the network's macro
  // (taken from the mapping). The network substitutes {<macro>} before firing,
  // so the backend always receives the fixed canonical names.
  const exampleParts: string[] = [];
  if (network.mapping_click_id)  exampleParts.push(`click_id={${network.mapping_click_id}}`);
  if (network.mapping_payout)    exampleParts.push(`payout={${network.mapping_payout}}`);
  if (network.mapping_currency)  exampleParts.push(`currency={${network.mapping_currency}}`);
  if (network.mapping_status)    exampleParts.push(`status={${network.mapping_status}}`);
  if (network.mapping_txn_id)    exampleParts.push(`transaction_id={${network.mapping_txn_id}}`);
  if (network.mapping_timestamp) exampleParts.push(`event_time={${network.mapping_timestamp}}`);
  const extraEntries = Object.entries(network.extra_mappings ?? {});
  for (const [paramName, macro] of extraEntries) {
    if (macro) exampleParts.push(`${paramName}={${macro}}`);
  }
  const exampleUrl = `${network.postback_url ?? ''}${exampleParts.length ? '?' + exampleParts.join('&') : ''}`;

  const mappingRows: { key: string; label: string; value?: string }[] = [
    { key: 'mapping_click_id',  label: 'Click ID',         value: network.mapping_click_id },
    { key: 'mapping_payout',    label: 'Payout',           value: network.mapping_payout },
    { key: 'mapping_currency',  label: 'Currency',         value: network.mapping_currency },
    { key: 'mapping_status',    label: 'Status',           value: network.mapping_status },
    { key: 'mapping_txn_id',    label: 'Transaction ID',   value: network.mapping_txn_id },
    { key: 'mapping_timestamp', label: 'Event timestamp',  value: network.mapping_timestamp },
    ...extraEntries.map(([paramName, macro]) => ({
      key: `extra_${paramName}`,
      label: paramName,
      value: macro,
    })),
  ];

  return (
    <>
      <PageHeader
        back={
          <Link
            to="/postbacks"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <ArrowLeft className="h-4 w-4" /> All postbacks
          </Link>
        }
        title={network.name}
        description={network.network_id}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit mappings
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
          <CardHeader title="Postback URL" subtitle="Configure this URL in your network's dashboard. They append their parameters to it." />
          <CardBody className="space-y-4">
            <div>
              <label className="label">Base URL</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input readOnly value={network.postback_url ?? ''} className="font-mono text-xs" />
                {network.postback_url && <CopyButton value={network.postback_url} className="self-start sm:self-auto" />}
              </div>
            </div>

            <div>
              <label className="label">Example URL with your mapped parameters</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <code className="flex-1 break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-neutral-950/60 dark:text-neutral-300 dark:ring-neutral-800">
                  {exampleUrl}
                </code>
                <CopyButton value={exampleUrl} className="self-start sm:self-auto" />
              </div>
              <p className="hint">
                Paste this into the network's postback field as-is. The parameter names on the left
                (<Tok>click_id</Tok>, <Tok>payout</Tok>, …) are fixed — the network substitutes each{' '}
                <Tok>{'{macro}'}</Tok> with the actual value before firing.
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-neutral-400">
              On every fire, the backend extracts the mapped fields, looks up <Tok>click_id</Tok>{' '}
              against your click log, and stores a conversion with <Tok>verified: true</Tok> if found,{' '}
              <Tok>false</Tok> otherwise.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Details" />
          <CardBody className="space-y-3 text-sm">
            <Row label="Status" value={<Badge tone={network.status === 'active' ? 'green' : 'gray'}>{network.status}</Badge>} />
            <Row label="Default status" value={network.default_status ?? 'approved'} />
            <Row label="Created" value={fmtDateTime(network.created_at)} />
            <Row label="Updated" value={fmtDateTime(network.updated_at)} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Parameter mapping" subtitle="The macro name this network substitutes for each URL parameter." />
          <CardBody>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
              {mappingRows.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-neutral-800"
                >
                  <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-neutral-400">{m.label}</span>
                  <code className="font-mono text-xs text-slate-700 dark:text-neutral-300">{m.value || '—'}</code>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Event log" subtitle="Latest postbacks from this network. Click a row for full detail." />
          <EventLog networkId={network.network_id} />
        </Card>
      </div>

      <PostbackFormModal open={editOpen} onClose={() => setEditOpen(false)} initial={network} />

      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => !deleteMutation.isPending && setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete postback?"
        description={
          <>
            This permanently removes the <strong>{network.name}</strong> ({network.network_id}) postback configuration.
            Past conversion records stay in the database, but the network can no longer fire successful postbacks against
            this URL until it's recreated.
          </>
        }
        confirmLabel="Delete postback"
        variant="danger"
        busy={deleteMutation.isPending}
        error={deleteError}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
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
