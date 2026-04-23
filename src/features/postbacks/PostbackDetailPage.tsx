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
import { Input } from '@/components/ui/Input';
import { fmtDateTime } from '@/lib/format';
import { networksApi } from './api';
import { PostbackFormModal } from './PostbackFormModal';
import { EventLog } from './EventLog';

export function PostbackDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);

  const query = useQuery({
    queryKey: ['network', id],
    queryFn: () => networksApi.get(id),
    enabled: !!id,
  });

  if (query.isLoading) return <CenteredSpinner />;
  if (query.isError || !query.data) {
    return (
      <Card>
        <div className="px-5 py-4 text-sm text-slate-600">Postback not found.</div>
      </Card>
    );
  }

  const network = query.data;

  const mappingRows: { key: string; label: string; value?: string }[] = [
    { key: 'mapping_click_id',  label: 'Click ID',         value: network.mapping_click_id },
    { key: 'mapping_payout',    label: 'Payout',           value: network.mapping_payout },
    { key: 'mapping_currency',  label: 'Currency',         value: network.mapping_currency },
    { key: 'mapping_status',    label: 'Status',           value: network.mapping_status },
    { key: 'mapping_txn_id',    label: 'Transaction ID',   value: network.mapping_txn_id },
    { key: 'mapping_timestamp', label: 'Event timestamp',  value: network.mapping_timestamp },
  ];

  return (
    <>
      <PageHeader
        back={
          <Link to="/postbacks" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> All postbacks
          </Link>
        }
        title={network.name}
        description={network.network_id}
        actions={
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit mappings
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Postback URL" subtitle="Configure this URL in your network's dashboard. They append their parameters to it." />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={network.postback_url ?? ''} className="font-mono text-xs" />
              {network.postback_url && <CopyButton value={network.postback_url} />}
            </div>
            <p className="text-xs text-slate-500">
              The backend reads the network's parameter mapping to extract canonical fields, looks up the
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono">click_id</code>
              against your click log, and stores a conversion with <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono">verified: true</code>
              if found, or <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono">false</code> otherwise.
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
          <CardHeader title="Parameter mapping" subtitle="The incoming parameter name the network sends for each canonical field." />
          <CardBody>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
              {mappingRows.map((m) => (
                <div key={m.key} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="text-xs uppercase tracking-wide text-slate-500">{m.label}</span>
                  <code className="font-mono text-xs text-slate-700">{m.value || '—'}</code>
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
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}
