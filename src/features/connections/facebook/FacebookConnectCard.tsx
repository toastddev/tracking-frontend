import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, AlertCircle } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError } from '@/lib/api';
import { facebookAdsApi } from './api';
import { FacebookConnectionPanel } from './FacebookConnectionPanel';
import type { FacebookConnection, FacebookConnectionType } from './types';

interface Props {
  type: FacebookConnectionType;
  title: string;
  blurb: string;
  bullets: string[];
  connections: FacebookConnection[];
}

export function FacebookConnectCard({ type, title, blurb, bullets, connections }: Props) {
  const [error, setError] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => facebookAdsApi.oauthStart(type),
    onSuccess: (res) => {
      window.location.href = res.auth_url;
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.code ?? err.message : err instanceof Error ? err.message : 'OAuth start failed');
    },
  });

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={blurb}
        actions={
          <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
            {startMutation.isPending ? <Spinner /> : <Plus className="h-4 w-4" />}
            {connections.length === 0 ? 'Connect' : 'Connect another'}
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <ul className="space-y-1 rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600 ring-1 ring-slate-200 dark:bg-neutral-950/40 dark:text-neutral-400 dark:ring-neutral-800">
          {bullets.map((b, i) => <li key={i} className="leading-relaxed">• {b}</li>)}
        </ul>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {connections.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            No {type === 'business' ? 'Business Manager' : 'ad account'} connected yet. Click <strong>Connect</strong> to authorise
            with Facebook.
          </p>
        ) : (
          <div className="space-y-4">
            {connections.map((c) => (
              <FacebookConnectionPanel key={c.connection_id} connection={c} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
