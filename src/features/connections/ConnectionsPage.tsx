import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { ApiError } from '@/lib/api';
import { googleAdsApi } from './api';
import { GoogleAdsConnectCard } from './GoogleAdsConnectCard';
import { facebookAdsApi, type FbExchangeResponse } from './facebook/api';
import { FacebookConnectCard } from './facebook/FacebookConnectCard';
import { FacebookAccountsModal } from './facebook/FacebookAccountsModal';

export function ConnectionsPage() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const sessionRunOnce = useRef(false);

  // OAuth callback round-trip lands the user here with one of:
  //   ?fb_oauth_session=<id>            success — exchange session for picker
  //   ?fb_oauth_error=<reason>          failure — surface to operator
  // See backend handleCallback for how the URL params are produced.
  const [fbCallback, setFbCallback] = useState<FbExchangeResponse | null>(null);
  const [fbCallbackError, setFbCallbackError] = useState<string | null>(null);

  useEffect(() => {
    if (params.has('status')) {
      const next = new URLSearchParams(params);
      next.delete('status');
      next.delete('reason');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  // Handle the OAuth session redirect once per mount. A double-fire here
  // would 410 the second call (session already consumed), so the ref guards
  // React-StrictMode double-invocation in dev.
  useEffect(() => {
    if (sessionRunOnce.current) return;
    const sessionId = params.get('fb_oauth_session');
    const errorCode = params.get('fb_oauth_error');
    const errorMsg = params.get('fb_oauth_error_message');

    if (errorCode) {
      sessionRunOnce.current = true;
      setFbCallbackError(errorMsg ? `${errorCode}: ${errorMsg}` : errorCode);
      const next = new URLSearchParams(params);
      next.delete('fb_oauth_error');
      next.delete('fb_oauth_error_message');
      setParams(next, { replace: true });
      return;
    }

    if (sessionId) {
      sessionRunOnce.current = true;
      facebookAdsApi.consumeOauthSession(sessionId)
        .then((res) => {
          setFbCallback(res);
          // Strip the param immediately so a refresh doesn't try to re-consume.
          const next = new URLSearchParams(params);
          next.delete('fb_oauth_session');
          setParams(next, { replace: true });
        })
        .catch((err) => {
          const msg = err instanceof ApiError
            ? err.code ?? err.message
            : err instanceof Error ? err.message : 'oauth_consume_failed';
          setFbCallbackError(msg);
          const next = new URLSearchParams(params);
          next.delete('fb_oauth_session');
          setParams(next, { replace: true });
        });
    }
  }, [params, setParams]);

  const query = useQuery({
    queryKey: ['google-ads-connections'],
    queryFn: () => googleAdsApi.listConnections(),
  });
  const fbQuery = useQuery({
    queryKey: ['fb-connections'],
    queryFn: () => facebookAdsApi.listConnections(),
  });

  if (query.isLoading || fbQuery.isLoading) return <CenteredSpinner />;

  const connections = query.data?.items ?? [];
  const mcc = connections.filter((c) => c.type === 'mcc');
  const child = connections.filter((c) => c.type === 'child');
  const fbConnections = fbQuery.data?.items ?? [];
  const fbBusiness = fbConnections.filter((c) => c.type === 'business');
  const fbAdAccounts = fbConnections.filter((c) => c.type === 'ad_account');

  function dismissModal() {
    setFbCallback(null);
    qc.invalidateQueries({ queryKey: ['fb-connections'] });
  }

  return (
    <>
      <PageHeader
        title="Connections"
        description="Forward conversions and Google-tagged outbound clicks from this tracker to outside ad platforms."
      />

      {fbCallbackError && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Couldn't finish connecting Facebook.</div>
            <div className="mt-0.5 text-xs">{fbCallbackError}</div>
          </div>
          <button
            className="ml-auto text-xs underline hover:no-underline"
            onClick={() => setFbCallbackError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-6">
        <GoogleAdsConnectCard
          type="mcc"
          title="Google Ads — Manager (MCC)"
          blurb="Connect once at the manager level to enable cross-account conversion tracking across every child account under it."
          bullets={[
            'Use this when the Google account you sign in with is the MCC owner / has manager access.',
            'After consent you’ll pick which manager account(s) to enable — usually just one.',
            'Cross-account tracking: conversions are uploaded to the manager and Google Ads attributes them to whichever child account ran the ad. No per-offer or per-network mapping required.',
            'You set ONE conversion action for postback conversions and ONE for outbound clicks at the MCC level — they apply to every child.',
          ]}
          connections={mcc}
        />
        <GoogleAdsConnectCard
          type="child"
          title="Google Ads — Single child accounts"
          blurb="Authenticate once and pick the specific child accounts to forward into individually."
          bullets={[
            'Use this when you don’t manage an MCC, OR when you want different offers / networks to fire into different child accounts.',
            'You can sign in with an MCC user — we’ll list every child the OAuth grant covers and let you tick the ones you want to connect.',
            'Each pick becomes its own connection in this list (so 3 ticked children = 3 rows below).',
            'Per-offer and per-network mapping appears on the Offer and Postback pages — that’s where you say "send conversions for Offer X to Child A" and so on.',
          ]}
          connections={child}
        />
        <FacebookConnectCard
          type="business"
          title="Facebook — Business Manager"
          blurb="Connect once at the Business Manager level to enable cross-account CAPI conversion tracking across every ad account under it."
          bullets={[
            'Use this when the Facebook account you sign in with has admin access to a Business Manager.',
            'After consent you’ll pick which BM(s) to enable — usually just one.',
            'Cross-account tracking: conversions are uploaded to the dataset (pixel) on the BM and Meta attributes them to whichever ad account ran the ad. No per-offer or per-network mapping required.',
            'You set ONE event for postback conversions (e.g. Purchase) and optionally ONE for outbound clicks at the BM level — they apply to every ad account.',
          ]}
          connections={fbBusiness}
        />
        <FacebookConnectCard
          type="ad_account"
          title="Facebook — Single ad accounts"
          blurb="Authenticate once and pick the specific ad accounts to forward into individually."
          bullets={[
            'Use this when you don’t manage a Business Manager, OR when you want different offers / networks to fire into different ad accounts.',
            'You can sign in with a BM user — we’ll list every ad account the OAuth grant covers and let you tick the ones you want to connect.',
            'Each pick becomes its own connection in this list (so 3 ticked ad accounts = 3 rows below).',
            'Per-offer and per-network mapping appears on the Offer and Postback pages — that’s where you say "send conversions for Offer X to Ad Account A" and so on.',
          ]}
          connections={fbAdAccounts}
        />
      </div>

      {fbCallback && (
        <FacebookAccountsModal
          open
          onClose={dismissModal}
          onFinalized={dismissModal}
          type={fbCallback.type}
          grantToken={fbCallback.grant_token}
          metaUserEmail={fbCallback.meta_user_email}
          candidates={fbCallback.candidates}
        />
      )}
    </>
  );
}
