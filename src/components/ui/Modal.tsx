import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

export function Modal({ open, onClose, title, children, footer, size = 'md' }: Props) {
  const backdropMouseDown = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 backdrop-blur-sm animate-fade-in sm:items-start sm:p-4 dark:bg-neutral-950/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          backdropMouseDown.current = true;
        } else {
          backdropMouseDown.current = false;
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDown.current) {
          onClose();
        }
        backdropMouseDown.current = false;
      }}
    >
      <div
        className={cn(
          'w-full rounded-t-2xl bg-white shadow-xl ring-1 ring-slate-900/5 animate-scale-in',
          'sm:mt-16 sm:rounded-xl',
          'dark:bg-neutral-900 dark:ring-neutral-700/50',
          sizes[size]
        )}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-5 dark:border-neutral-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-neutral-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:rounded-b-xl sm:px-5 dark:border-neutral-800 dark:bg-neutral-950/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
