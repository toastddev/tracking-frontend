import type { Network } from '@/types';

export function buildExampleUrl(network: Network): string {
  const exampleParts: string[] = [];
  if (network.mapping_click_id)  exampleParts.push(`click_id={${network.mapping_click_id}}`);
  if (network.mapping_payout)    exampleParts.push(`payout={${network.mapping_payout}}`);
  if (network.mapping_currency)  exampleParts.push(`currency={${network.mapping_currency}}`);
  if (network.mapping_status)    exampleParts.push(`status={${network.mapping_status}}`);
  if (network.mapping_txn_id)    exampleParts.push(`transaction_id={${network.mapping_txn_id}}`);
  if (network.mapping_timestamp) exampleParts.push(`event_time={${network.mapping_timestamp}}`);
  const extraEntries = Object.entries(network.extra_mappings ?? {});
  for (const [paramName, macro] of extraEntries) {
    if (macro) exampleParts.push(`${paramName}={${macro}}`);
  }
  return `${network.postback_url ?? ''}${exampleParts.length ? '?' + exampleParts.join('&') : ''}`;
}
