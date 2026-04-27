import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError } from '@/lib/api';
import { googleAdsApi, type ExchangeResponse } from './api';
import { GoogleAdsAccountsModal } from './GoogleAdsAccountsModal';

export function GoogleAdsOAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ranOnce = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [exchanged, setExchanged] = useState<ExchangeResponse | null>(null);

  const code = params.get('code');
  const state = params.get('state');
  const oauthError = params.get('error');

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    if (oauthError) {
      setError(`Google declined the OAuth request: ${oauthError}`);
      return;
    }
    if (!code || !state) {
      setError('Missing OAuth code or state in the callback URL.');
      return;
    }

    googleAdsApi.oauthExchange(code, state)
      .then((res) => setExchanged(res))
      .catch((err) => {
        setError(err instanceof ApiError ? err.code ?? err.message : err instanceof Error ? err.message : 'OAuth exchange failed');
      });
  }, [code, state, oauthError]);

  function done() {
    setExchanged(null);
    navigate('/connections', { replace: true });
  }

  if (error) {
    return (
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-medium">Couldn't finish connecting Google Ads.</div>
              <div className="mt-1 text-sm">{error}</div>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate('/connections', { replace: true })}>
            Back to Connections
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (!exchanged) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3 text-sm text-slate-600 dark:text-neutral-400">
          <Spinner /> Talking to Google… (this can take a few seconds while we discover your accounts)
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardBody>
          <div className="text-sm text-slate-600 dark:text-neutral-400">
            Authenticated as <strong className="text-slate-900 dark:text-neutral-200">{exchanged.google_user_email}</strong>.
            Pick the account(s) you want to connect.
          </div>
        </CardBody>
      </Card>
      <GoogleAdsAccountsModal
        open
        onClose={done}
        onFinalized={done}
        type={exchanged.type}
        grantToken={exchanged.grant_token}
        googleUserEmail={exchanged.google_user_email}
        candidates={exchanged.candidates}
      />
    </>
  );
}
