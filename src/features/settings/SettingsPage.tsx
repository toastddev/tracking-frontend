import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api';
import { settingsApi, type ResetDataResult } from './api';

const CONFIRM_PHRASE = 'RESET';

export function SettingsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ResetDataResult | null>(null);

  const reset = useMutation({
    mutationFn: () => settingsApi.resetData(),
    onSuccess: (res) => {
      setLastResult(res);
      setOpen(false);
      setTyped('');
      // Wipe every cache that depends on the wiped data so the dashboard
      // immediately shows zeroes everywhere instead of stale numbers.
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['conversions'] });
      qc.invalidateQueries({ queryKey: ['clicks'] });
      qc.invalidateQueries({ queryKey: ['offer-clicks'] });
      qc.invalidateQueries({ queryKey: ['network-conversions'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.code ?? err.message : err instanceof Error ? err.message : 'Reset failed');
    },
  });

  const canConfirm = typed.trim().toUpperCase() === CONFIRM_PHRASE;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace-level operations. Destructive actions require a typed confirmation."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Reset all data" subtitle="Clear every click, conversion, and Google Ads upload audit record from this workspace." />
          <CardBody className="space-y-4">
            <div className="rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
              <div className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This deletes all incoming-data records.
              </div>
              <ul className="mt-2 space-y-1 pl-6 text-xs">
                <li><strong>Will be permanently deleted:</strong> every <code className="font-mono">clicks/</code>, <code className="font-mono">conversions/</code>, and <code className="font-mono">google_ads_uploads/</code> document.</li>
                <li><strong>Will be preserved:</strong> offers, postbacks (networks), Google Ads connections, Google Ads routes, MCC children snapshots, and your admin login.</li>
                <li>Past forwarded conversions <em>that already reached Google Ads</em> are not undone — they live in your Google Ads account, not here.</li>
              </ul>
            </div>

            {lastResult && (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Reset completed.
                </div>
                <div className="mt-1 text-xs">
                  Deleted {lastResult.clicks.toLocaleString()} clicks, {lastResult.conversions.toLocaleString()} conversions,
                  and {lastResult.google_ads_uploads.toLocaleString()} Google Ads upload records.
                </div>
              </div>
            )}

            <div>
              <Button variant="danger" onClick={() => { setError(null); setOpen(true); }}>
                <Trash2 className="h-4 w-4" /> Reset all data
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => !reset.isPending && setOpen(false)}
        size="md"
        title="Reset all incoming data?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={reset.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => reset.mutate()}
              disabled={!canConfirm || reset.isPending}
            >
              {reset.isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
              Permanently delete
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-neutral-300">
            This <strong>cannot be undone</strong>. The following Firestore collections will be wiped:
          </p>
          <ul className="list-disc pl-6 text-sm text-slate-600 dark:text-neutral-400">
            <li><code className="font-mono">clicks/</code> — every redirect we recorded</li>
            <li><code className="font-mono">conversions/</code> — every postback (verified or unverified)</li>
            <li><code className="font-mono">google_ads_uploads/</code> — every Google Ads forwarding attempt</li>
          </ul>
          <p className="text-sm text-slate-600 dark:text-neutral-300">
            Configuration is preserved: offers, postbacks, Google Ads connections + routes are untouched.
          </p>

          <div>
            <label className="label">Type <code className="font-mono">{CONFIRM_PHRASE}</code> to confirm</label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoFocus
              disabled={reset.isPending}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
              {error}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
