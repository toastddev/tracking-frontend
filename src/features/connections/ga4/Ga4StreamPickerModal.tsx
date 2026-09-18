import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ga4Api, ga4ErrorMessage, type Ga4StreamOption } from './api';

interface Props {
  open: boolean;
  connectionId: string;
  googleUserEmail?: string;
  onClose: () => void;
}

// Lists the GA4 web streams the signed-in Google user can manage and links the
// chosen one: the backend creates a Measurement Protocol secret on it (Google
// requires the user-data acknowledgement below first) and starts forwarding.
export function Ga4StreamPickerModal({ open, connectionId, googleUserEmail, onClose }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [linkedMessage, setLinkedMessage] = useState<string | null>(null);

  const streamsQ = useQuery({
    queryKey: ['ga4-streams', connectionId],
    queryFn: () => ga4Api.listStreams(connectionId),
    enabled: open,
  });

  const linkM = useMutation({
    mutationFn: () => ga4Api.linkStream(connectionId, selected),
    onSuccess: (res) => {
      setLinkedMessage(
        `${res.stream.measurement_id} is linked. ${res.secret_created ? 'A new' : 'The existing'} Measurement Protocol secret "Pennywise tracker (conversions)" is in use.`,
      );
      setSelected('');
      setAcknowledged(false);
      qc.invalidateQueries({ queryKey: ['ga4-connections'] });
      qc.invalidateQueries({ queryKey: ['ga4-streams', connectionId] });
    },
  });

  const items = streamsQ.data?.items ?? [];
  const byProperty = new Map<string, Ga4StreamOption[]>();
  for (const s of items) {
    const key = `${s.account_name} › ${s.property_name} (${s.property_id})`;
    byProperty.set(key, [...(byProperty.get(key) ?? []), s]);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Link a GA4 web stream"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Done</Button>
          <Button
            onClick={() => linkM.mutate()}
            disabled={!selected || !acknowledged || linkM.isPending}
          >
            {linkM.isPending && <Spinner />} Link stream
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {googleUserEmail && (
          <p className="text-slate-600 dark:text-neutral-400">
            Signed in as <strong className="text-slate-900 dark:text-neutral-200">{googleUserEmail}</strong>. Pick the
            stream whose site sends <code>ga_cid</code> / <code>ga_mid</code> on tracker clicks (e.g. naarayan.com).
          </p>
        )}

        {streamsQ.isLoading && (
          <div className="flex items-center gap-2 text-slate-500"><Spinner /> Loading your GA4 properties…</div>
        )}
        {streamsQ.error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{ga4ErrorMessage(streamsQ.error)}</span>
          </div>
        )}
        {!streamsQ.isLoading && !streamsQ.error && items.length === 0 && (
          <p className="text-slate-500 dark:text-neutral-400">
            No GA4 web streams found for this Google account. It needs Editor (or higher) access to the property.
          </p>
        )}

        {[...byProperty.entries()].map(([property, streams]) => (
          <div key={property} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{property}</div>
            {streams.map((s) => {
              const linkedElsewhere = s.linked && s.linked_connection_id !== connectionId;
              return (
                <label
                  key={s.measurement_id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-neutral-800 dark:hover:bg-neutral-800/50"
                >
                  <input
                    type="radio"
                    name="ga4-stream"
                    value={s.measurement_id}
                    checked={selected === s.measurement_id}
                    onChange={() => { setSelected(s.measurement_id); setLinkedMessage(null); }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 dark:text-neutral-100">
                      {s.stream_name || 'Web stream'} <span className="font-mono text-xs text-slate-500">{s.measurement_id}</span>
                    </div>
                    {s.default_uri && <div className="truncate text-xs text-slate-500">{s.default_uri}</div>}
                  </div>
                  {s.linked && (
                    <Badge tone={linkedElsewhere ? 'amber' : 'green'}>
                      {linkedElsewhere ? 'Linked via another sign-in' : s.enabled ? 'Linked' : 'Linked (paused)'}
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        ))}

        {items.length > 0 && (
          <label className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-3 text-xs text-slate-600 ring-1 ring-slate-200 dark:bg-neutral-950/40 dark:text-neutral-400 dark:ring-neutral-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              Google requires this acknowledgement on the property before a Measurement Protocol secret can be created:
              <em> “I acknowledge that I have the necessary privacy disclosures and rights from my end users for the
              collection and processing of their data, including the association of such data with the visitation
              information Google Analytics collects from my site and/or app property.”</em>
            </span>
          </label>
        )}

        {linkM.error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{ga4ErrorMessage(linkM.error)}</span>
          </div>
        )}
        {linkedMessage && (
          <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{linkedMessage}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
