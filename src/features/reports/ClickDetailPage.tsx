import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { CopyButton } from '@/components/ui/CopyButton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { fmtDateTime, shortId } from '@/lib/format';
import { clicksApi } from './api';

export function ClickDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['click', id],
    queryFn: () => clicksApi.get(id),
    enabled: !!id,
  });

  if (query.isLoading) return <CenteredSpinner />;
  if (query.isError || !query.data) {
    return (
      <Card>
        <div className="px-5 py-4 text-sm text-slate-600 dark:text-neutral-300">Click not found.</div>
      </Card>
    );
  }

  const { click, conversions } = query.data;
  const adEntries = Object.entries(click.ad_ids ?? {}).filter(([, v]) => v);
  const subEntries = Object.entries(click.sub_params ?? {});
  const extraEntries = Object.entries(click.extra_params ?? {});

  return (
    <>
      <PageHeader
        title={`Click ${shortId(click.click_id, 12)}`}
        description={fmtDateTime(click.created_at)}
        back={
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <ArrowLeft className="h-4 w-4" /> Reports
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Attribution" subtitle="Identifiers used to credit this click." />
          <CardBody>
            <Row label="Click ID">
              <code className="font-mono text-xs">{click.click_id}</code>
              <CopyButton value={click.click_id} className="ml-2" />
            </Row>
            <Row label="Offer">{click.offer_id}</Row>
            <Row label="Affiliate">{click.aff_id}</Row>
            <Row label="Created">{fmtDateTime(click.created_at)}</Row>
            <Row label="Country">{click.country ?? '—'}</Row>
            <Row label="IP">{click.ip ?? '—'}</Row>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ad network IDs" subtitle="Captured from the click URL — drives Google Ads upload." />
          <CardBody>
            {adEntries.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-neutral-400">No ad IDs were present on this click.</div>
            ) : (
              adEntries.map(([k, v]) => (
                <Row key={k} label={k}>
                  <code className="break-all font-mono text-xs">{v}</code>
                  {v && <CopyButton value={String(v)} className="ml-2" />}
                </Row>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sub IDs" subtitle="s1, s2, … — your structured sub-tracking." />
          <CardBody>
            {subEntries.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-neutral-400">No sub IDs.</div>
            ) : (
              subEntries.map(([k, v]) => (
                <Row key={k} label={k}>
                  <code className="break-all font-mono text-xs">{v}</code>
                </Row>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Extra params" subtitle="Anything else on the click URL — utm_*, partner keys, etc." />
          <CardBody>
            {extraEntries.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-neutral-400">No extra params.</div>
            ) : (
              extraEntries.map(([k, v]) => (
                <Row key={k} label={k}>
                  <code className="break-all font-mono text-xs">{v}</code>
                </Row>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Request" subtitle="Headers captured at redirect time." />
        <CardBody>
          <Row label="User agent">
            <span className="break-all text-xs text-slate-700 dark:text-neutral-300">{click.user_agent ?? '—'}</span>
          </Row>
          <Row label="Referrer">
            <span className="break-all text-xs text-slate-700 dark:text-neutral-300">{click.referrer ?? '—'}</span>
          </Row>
          <Row label="Redirect URL">
            <code className="break-all font-mono text-xs">{click.redirect_url}</code>
            <CopyButton value={click.redirect_url} className="ml-2" />
          </Row>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title={`Conversions for this click (${conversions.length})`}
          subtitle="Postbacks and API rows that resolved to this click_id."
        />
        {conversions.length === 0 ? (
          <div className="px-5 py-4 text-sm text-slate-500 dark:text-neutral-400">
            No conversion has been recorded for this click yet.
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Created</TH>
                <TH>Network</TH>
                <TH>Source</TH>
                <TH>Status</TH>
                <TH>Payout</TH>
                <TH>Txn ID</TH>
              </TR>
            </THead>
            <TBody>
              {conversions.map((c) => (
                <TR key={c.conversion_id}>
                  <TD className="text-xs">{fmtDateTime(c.created_at)}</TD>
                  <TD className="text-sm">{c.network_id}</TD>
                  <TD>
                    <Badge tone={c.source === 'api' ? 'blue' : 'gray'}>{c.source ?? 'postback'}</Badge>
                    {c.shadow && <Badge tone="amber" className="ml-1">shadow</Badge>}
                  </TD>
                  <TD className="text-sm">{c.status ?? '—'}</TD>
                  <TD className="text-sm">{c.payout != null ? `${c.payout} ${c.currency ?? ''}` : '—'}</TD>
                  <TD className="text-xs text-slate-500 dark:text-neutral-400">{c.txn_id ?? '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500 dark:text-neutral-400">{label}</span>
      <span className="text-right font-medium text-slate-900 dark:text-neutral-100">{children}</span>
    </div>
  );
}
