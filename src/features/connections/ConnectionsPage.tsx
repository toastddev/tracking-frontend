import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { CenteredSpinner } from '@/components/ui/Spinner';
import { googleAdsApi } from './api';
import { GoogleAdsConnectCard } from './GoogleAdsConnectCard';

export function ConnectionsPage() {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.has('status')) {
      const next = new URLSearchParams(params);
      next.delete('status');
      next.delete('reason');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const query = useQuery({
    queryKey: ['google-ads-connections'],
    queryFn: () => googleAdsApi.listConnections(),
  });

  if (query.isLoading) return <CenteredSpinner />;

  const connections = query.data?.items ?? [];
  const mcc = connections.filter((c) => c.type === 'mcc');
  const child = connections.filter((c) => c.type === 'child');

  return (
    <>
      <PageHeader
        title="Connections"
        description="Forward conversions and Google-tagged outbound clicks from this tracker to outside ad platforms."
      />
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
      </div>
    </>
  );
}
