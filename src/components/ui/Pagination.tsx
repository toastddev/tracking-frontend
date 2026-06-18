import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Button';

interface Props {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageLabel?: string;
  // First/Last are opt-in: only rendered when a handler is supplied, so
  // existing callers that just want Prev/Next are unaffected.
  onFirst?: () => void;
  onLast?: () => void;
  busy?: boolean;
}

export function Pagination({ hasPrev, hasNext, onPrev, onNext, pageLabel, onFirst, onLast, busy }: Props) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-950/50">
      <div className="text-xs text-slate-500 dark:text-neutral-400 sm:order-first">{pageLabel ?? ''}</div>
      <div className="flex items-center justify-end gap-2">
        {onFirst && (
          <Button variant="secondary" size="sm" onClick={onFirst} disabled={!hasPrev || busy} title="First page">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onPrev} disabled={!hasPrev || busy}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="secondary" size="sm" onClick={onNext} disabled={!hasNext || busy}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
        {onLast && (
          <Button variant="secondary" size="sm" onClick={onLast} disabled={!hasNext || busy} title="Last page">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
