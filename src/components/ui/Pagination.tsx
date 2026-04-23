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
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{pageLabel ?? ''}</div>
      <div className="flex items-center gap-2">
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
