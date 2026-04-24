import { ConversionsReportTab } from './ConversionsReportTab';
import type { ReportRange } from './ReportFilters';

// Postbacks tab = every postback (verified + unverified). We reuse the
// conversions tab without the verified-only filter so the audit trail
// surfaces network fires that didn't match a click.
export function PostbacksReportTab({ range }: { range: ReportRange }) {
  return <ConversionsReportTab range={range} />;
}
