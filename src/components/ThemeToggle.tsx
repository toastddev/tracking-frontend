import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/cn';

const order: Theme[] = ['system', 'light', 'dark'];
const nextOf = (t: Theme): Theme => order[(order.indexOf(t) + 1) % order.length]!;

const icon = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};
const nextLabel = {
  system: 'Switch to light',
  light: 'Switch to dark',
  dark: 'Switch to system',
};

interface Props {
  variant?: 'sidebar' | 'compact';
  className?: string;
}

export function ThemeToggle({ variant = 'sidebar', className }: Props) {
  const { theme, setTheme } = useTheme();
  const Icon = icon[theme];

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => setTheme(nextOf(theme))}
        aria-label={nextLabel[theme]}
        title={nextLabel[theme]}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors',
          'hover:bg-slate-100 active:bg-slate-200',
          'dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700',
          className
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-xs',
        'dark:border-neutral-800 dark:bg-neutral-900',
        className
      )}
      role="radiogroup"
      aria-label="Theme"
    >
      {order.map((t) => {
        const I = icon[t];
        const active = theme === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(t)}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
            )}
            title={t.charAt(0).toUpperCase() + t.slice(1)}
          >
            <I className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
