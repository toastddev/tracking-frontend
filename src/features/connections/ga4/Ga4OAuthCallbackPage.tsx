import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ga4Api, ga4ErrorMessage } from './api';
import { Ga4StreamPickerModal } from './Ga4StreamPickerModal';

// Google redirects here after the GA4 sign-in. Redeems the code, then goes
// straight to the stream picker so the operator can link a stream in one go.
export function Ga4OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ranOnce = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<{ connection_id: string; google_user_email?: string } | null>(null);

  const code = params.get('code');
  const state = params.get('state');
  const oauthError = params.get('error');

  useEffect(() => {
    // Codes are single-use: guard React Strict Mode's double effect.
    if (ranOnce.current) return;
    ranOnce.current = true;

    if (oauthError) {
      setError(`Google declined the sign-in: ${oauthError}`);
      return;
    }
    if (!code || !state) {
      setError('Missing OAuth code or state in the callback URL.');
      return;
    }
    ga4Api.oauthExchange(code, state)
      .then((res) => setConnection(res.connection))
      .catch((err) => setError(ga4ErrorMessage(err)));
  }, [code, state, oauthError]);

  function done() {
    navigate('/connections', { replace: true });
  }

  if (error) {
    return (
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-medium">Couldn't finish connecting Google Analytics.</div>
              <div className="mt-1 text-sm">{error}</div>
            </div>
          </div>
          <Button variant="secondary" onClick={done}>Back to Connections</Button>
        </CardBody>
      </Card>
    );
  }

  if (!connection) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3 text-sm text-slate-600 dark:text-neutral-400">
          <Spinner /> Talking to Google…
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardBody className="text-sm text-slate-600 dark:text-neutral-400">
          Connected as <strong className="text-slate-900 dark:text-neutral-200">{connection.google_user_email}</strong>.
          Link the GA4 web stream to forward conversions into.
        </CardBody>
      </Card>
      <Ga4StreamPickerModal
        open
        connectionId={connection.connection_id}
        googleUserEmail={connection.google_user_email}
        onClose={done}
      />
    </>
  );
}
