import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus, Trash2, FlaskConical, Link2, Save } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { fmtDateTime } from '@/lib/format';
import { ga4Api, ga4ErrorMessage, type Ga4Connection, type Ga4LinkedStream } from './api';
import { Ga4StreamPickerModal } from './Ga4StreamPickerModal';

const BULLETS = [
  'Sign in with a Google account that has Editor access to the GA4 property (e.g. the naarayan.com property).',
  'Link the web stream: the tracker creates its own Measurement Protocol secret on it - nothing to copy or paste.',
  'Uploads follow the Google Ads rules exactly: every verified postback / API conversion whose click carried the site’s GA ids is sent, with the same conversion time and value, and transaction_id = conversion id (like the Google Ads order_id).',
  'Sale event = the GA4 counterpart of the Google Ads sale conversion action (default "purchase"). Click event is optional, like the click conversion action - leave it empty unless you want tracker clicks in GA4 too (the site already sends affiliate_click).',
  'Save upload audit data keeps a row for every attempt (sent, failed, skipped with reason) and adds the GA4 Uploads tab in the sidebar. Turn it off and forwarding is unchanged - outcomes only go to the logs, and nothing is stored.',
  'Don’t also import this GA4 purchase into Google Ads - the Google Ads connection above already uploads these conversions.',
];

export function Ga4ConnectCard() {
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['ga4-connections'],
    queryFn: () => ga4Api.listConnections(),
  });

  const startM = useMutation({
    mutationFn: () => ga4Api.oauthStart(),
    onSuccess: (res) => { window.location.href = res.auth_url; },
    onError: (err) => setError(ga4ErrorMessage(err)),
  });

  const connections = query.data?.items ?? [];

  return (
    <Card>
      <CardHeader
        title="Google Analytics 4"
        subtitle="Send affiliate conversions into GA4 against the visitor’s original session."
        actions={
          <Button onClick={() => startM.mutate()} disabled={startM.isPending}>
            {startM.isPending ? <Spinner /> : <Plus className="h-4 w-4" />}
            {connections.length === 0 ? 'Connect' : 'Connect another'}
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <ul className="space-y-1 rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600 ring-1 ring-slate-200 dark:bg-neutral-950/40 dark:text-neutral-400 dark:ring-neutral-800">
          {BULLETS.map((b, i) => <li key={i} className="leading-relaxed">• {b}</li>)}
        </ul>

        {(error || query.error) && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error ?? ga4ErrorMessage(query.error)}</span>
          </div>
        )}

        {query.isLoading ? (
          <Spinner />
        ) : connections.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            No Google Analytics account connected yet. Click <strong>Connect</strong> to sign in with Google.
          </p>
        ) : (
          <div className="space-y-4">
            {connections.map((c) => <Ga4ConnectionPanel key={c.connection_id} connection={c} />)}
          </div>
        )}

        <Ga4AuditToggle />
      </CardBody>
    </Card>
  );
}

// Audit switch: on by default, and what gates the GA4 Uploads sidebar tab.
function Ga4AuditToggle() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ['ga4-settings'], queryFn: () => ga4Api.getSettings() });
  const saveM = useMutation({
    mutationFn: (audit_enabled: boolean) => ga4Api.updateSettings({ audit_enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ga4-settings'] });
      qc.invalidateQueries({ queryKey: ['ga4-uploads'] });
    },
  });
  const enabled = settingsQ.data?.audit_enabled ?? true;

  return (
    <div className="rounded-lg px-4 py-3 ring-1 ring-slate-200 dark:ring-neutral-800">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={enabled}
          disabled={settingsQ.isLoading || saveM.isPending}
          onChange={(e) => saveM.mutate(e.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900 dark:text-neutral-100">
            Save upload audit data {saveM.isPending && <Spinner />}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-neutral-400">
            Stores every GA4 upload attempt and shows the <strong>GA4 Uploads</strong> tab in the sidebar, where you can filter
            and export them. Off = nothing stored (roughly one row per conversion saved), forwarding unaffected.
          </span>
        </span>
      </label>
      {saveM.error && <div className="mt-2 text-xs text-red-700 dark:text-red-400">{ga4ErrorMessage(saveM.error)}</div>}
    </div>
  );
}

function Ga4ConnectionPanel({ connection }: { connection: Ga4Connection }) {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteM = useMutation({
    mutationFn: () => ga4Api.deleteConnection(connection.connection_id),
    onSuccess: () => {
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ['ga4-connections'] });
    },
  });

  return (
    <div className="rounded-lg ring-1 ring-slate-200 dark:ring-neutral-800">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900 dark:text-neutral-100">{connection.google_user_email || 'Google account'}</div>
          <div className="text-xs text-slate-500 dark:text-neutral-400">
            Connected {connection.created_at ? fmtDateTime(connection.created_at) : ''}
          </div>
        </div>
        <Badge tone={connection.status === 'active' ? 'green' : 'red'}>
          {connection.status === 'active' ? 'Active' : 'Needs reconnect'}
        </Badge>
        <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
          <Link2 className="h-4 w-4" /> Link stream
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Disconnect">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {connection.last_error && connection.status !== 'active' && (
        <div className="border-b border-slate-200 px-4 py-2 text-xs text-red-700 dark:border-neutral-800 dark:text-red-400">
          {connection.last_error} - use <strong>Connect another</strong> to sign in again, then remove this one.
        </div>
      )}

      <div className="divide-y divide-slate-200 dark:divide-neutral-800">
        {connection.streams.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500 dark:text-neutral-400">
            No stream linked yet - nothing is sent to GA4 until you link one.
          </p>
        ) : (
          connection.streams.map((s) => <Ga4StreamRow key={s.measurement_id} stream={s} />)
        )}
      </div>

      <Ga4StreamPickerModal
        open={pickerOpen}
        connectionId={connection.connection_id}
        googleUserEmail={connection.google_user_email}
        onClose={() => setPickerOpen(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteM.mutate()}
        title="Disconnect Google Analytics?"
        description="Forwarding stops for every stream linked through this sign-in. The Measurement Protocol secret stays in GA4 and is reused if you link the stream again."
        confirmLabel="Disconnect"
        variant="danger"
        busy={deleteM.isPending}
        error={deleteM.error ? ga4ErrorMessage(deleteM.error) : null}
      />
    </div>
  );
}

function Ga4StreamRow({ stream }: { stream: Ga4LinkedStream }) {
  const qc = useQueryClient();
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; messages: string[] } | null>(null);
  const [saleEvent, setSaleEvent] = useState(stream.sale_event_name || 'purchase');
  const [clickEvent, setClickEvent] = useState(stream.click_event_name ?? '');
  const [saved, setSaved] = useState(false);

  const toggleM = useMutation({
    mutationFn: () => ga4Api.updateStream(stream.measurement_id, { enabled: !stream.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ga4-connections'] }),
  });
  // ≈ saving the sale / click conversion actions on a Google Ads connection.
  const eventsM = useMutation({
    mutationFn: () =>
      ga4Api.updateStream(stream.measurement_id, {
        sale_event_name: saleEvent.trim(),
        click_event_name: clickEvent.trim(),
      }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ['ga4-connections'] });
    },
  });
  const eventsDirty =
    saleEvent.trim() !== (stream.sale_event_name || 'purchase') || clickEvent.trim() !== (stream.click_event_name ?? '');
  const unlinkM = useMutation({
    mutationFn: () => ga4Api.unlinkStream(stream.measurement_id),
    onSuccess: () => {
      setConfirmUnlink(false);
      qc.invalidateQueries({ queryKey: ['ga4-connections'] });
    },
  });
  const testM = useMutation({
    mutationFn: () => ga4Api.testStream(stream.measurement_id),
    onSuccess: (res) => setTestResult(res),
    onError: (err) => setTestResult({ ok: false, messages: [ga4ErrorMessage(err)] }),
  });

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900 dark:text-neutral-100">
            {stream.property_name || `Property ${stream.property_id}`} › {stream.stream_name || 'Web stream'}{' '}
            <span className="font-mono text-xs text-slate-500">{stream.measurement_id}</span>
          </div>
          {stream.default_uri && <div className="truncate text-xs text-slate-500">{stream.default_uri}</div>}
        </div>
        <Badge tone={stream.enabled ? 'green' : 'gray'}>{stream.enabled ? 'Forwarding' : 'Paused'}</Badge>
        <Button size="sm" variant="secondary" onClick={() => testM.mutate()} disabled={testM.isPending}>
          {testM.isPending ? <Spinner /> : <FlaskConical className="h-4 w-4" />} Validate
        </Button>
        <Button size="sm" variant="secondary" onClick={() => toggleM.mutate()} disabled={toggleM.isPending}>
          {stream.enabled ? 'Pause' : 'Resume'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmUnlink(true)}>Unlink</Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            Sale event (postback conversions)
          </label>
          <Input value={saleEvent} onChange={(e) => setSaleEvent(e.target.value)} className="h-8 text-xs" placeholder="purchase" />
        </div>
        <div className="sm:w-56">
          <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            Click event (optional)
          </label>
          <Input value={clickEvent} onChange={(e) => setClickEvent(e.target.value)} className="h-8 text-xs" placeholder="not uploaded" />
        </div>
        <Button size="sm" variant="secondary" onClick={() => eventsM.mutate()} disabled={!eventsDirty || !saleEvent.trim() || eventsM.isPending}>
          {eventsM.isPending ? <Spinner /> : <Save className="h-4 w-4" />} {saved ? 'Saved' : 'Save events'}
        </Button>
        <div className="text-xs text-slate-500 dark:text-neutral-400 sm:ml-auto">
          Value in {stream.currency_code || 'USD'}{stream.time_zone ? ` · ${stream.time_zone}` : ''}
        </div>
      </div>
      {eventsM.error && <div className="text-xs text-red-700 dark:text-red-400">{ga4ErrorMessage(eventsM.error)}</div>}
      {testResult && (
        <div
          className={
            testResult.ok
              ? 'rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30'
              : 'rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30'
          }
        >
          {testResult.ok
            ? 'GA4 accepted a sample purchase payload (validation only - nothing was recorded).'
            : testResult.messages.join(' · ')}
        </div>
      )}
      {(toggleM.error || unlinkM.error) && (
        <div className="text-xs text-red-700 dark:text-red-400">{ga4ErrorMessage(toggleM.error ?? unlinkM.error)}</div>
      )}
      <ConfirmDialog
        open={confirmUnlink}
        onCancel={() => setConfirmUnlink(false)}
        onConfirm={() => unlinkM.mutate()}
        title={`Unlink ${stream.measurement_id}?`}
        description="Conversions stop being sent to this GA4 stream."
        confirmLabel="Unlink"
        variant="danger"
        busy={unlinkM.isPending}
      />
    </div>
  );
}
