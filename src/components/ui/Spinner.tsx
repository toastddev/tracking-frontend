import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
}

export function CenteredSpinner() {
  return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
