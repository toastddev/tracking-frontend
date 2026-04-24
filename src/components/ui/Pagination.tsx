import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface Props {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageLabel?: string;
}

export function Pagination({ hasPrev, hasNext, onPrev, onNext, pageLabel }: Props) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-950/50">
      <div className="text-xs text-slate-500 dark:text-neutral-400 sm:order-first">{pageLabel ?? ''}</div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onPrev} disabled={!hasPrev}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="secondary" size="sm" onClick={onNext} disabled={!hasNext}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
