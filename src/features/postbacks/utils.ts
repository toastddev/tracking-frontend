import type { Network } from '@/types';

export function buildExampleUrl(network: Network): string {
  const formatMacro = (macro: string) => {
    // If the macro already contains typical wrapper characters, don't wrap it in {}.
    // This allows custom syntaxes like MaxBounty's #S2# or others like %SUBID% / $SUBID$.
    if (/[{}<>[\]#$%]/.test(macro)) return macro;
    return `{${macro}}`;
  };

  const exampleParts: string[] = [];
  if (network.mapping_click_id)  exampleParts.push(`click_id=${formatMacro(network.mapping_click_id)}`);
  if (network.mapping_payout)    exampleParts.push(`payout=${formatMacro(network.mapping_payout)}`);
  if (network.mapping_currency)  exampleParts.push(`currency=${formatMacro(network.mapping_currency)}`);
  if (network.mapping_status)    exampleParts.push(`status=${formatMacro(network.mapping_status)}`);
  if (network.mapping_txn_id)    exampleParts.push(`transaction_id=${formatMacro(network.mapping_txn_id)}`);
  if (network.mapping_timestamp) exampleParts.push(`event_time=${formatMacro(network.mapping_timestamp)}`);
  const extraEntries = Object.entries(network.extra_mappings ?? {});
  for (const [paramName, macro] of extraEntries) {
    if (macro) exampleParts.push(`${paramName}=${formatMacro(macro)}`);
  }
  return `${network.postback_url ?? ''}${exampleParts.length ? '?' + exampleParts.join('&') : ''}`;
}
