import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, LayoutDashboard, Package, Webhook, LogOut, PlugZap, Settings } from 'lucide-react';
import { auth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { ThemeToggle } from './ThemeToggle';

const items = [
  { to: '/reports',     label: 'Reports',     icon: BarChart3 },
  { to: '/offers',      label: 'Offers',      icon: Package },
  { to: '/postbacks',   label: 'Postbacks',   icon: Webhook },
  { to: '/connections', label: 'Connections', icon: PlugZap },
  { to: '/settings',    label: 'Settings',    icon: Settings },
];

interface Props {
  onClose?: () => void;
  headerExtra?: ReactNode;
}

export function Sidebar({ onClose, headerExtra }: Props) {
  const email = auth.getEmail();
  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-200 px-5 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-brand-600" />
          <span className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Tracking</span>
        </div>
        {headerExtra}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-slate-200 p-3 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Theme</span>
          <ThemeToggle />
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-neutral-950/60">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">Signed in as</div>
          <div className="truncate text-xs font-medium text-slate-700 dark:text-neutral-300" title={email ?? undefined}>
            {email ?? 'unknown'}
          </div>
        </div>

        <button
          onClick={() => {
            auth.clear();
            window.location.href = '/login';
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
