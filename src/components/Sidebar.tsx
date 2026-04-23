import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Webhook, LogOut } from 'lucide-react';
import { auth } from '@/lib/auth';
import { cn } from '@/lib/cn';

const items = [
  { to: '/offers',    label: 'Offers',    icon: Package },
  { to: '/postbacks', label: 'Postbacks', icon: Webhook },
];

export function Sidebar() {
  const email = auth.getEmail();
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
        <LayoutDashboard className="h-5 w-5 text-brand-600" />
        <span className="text-sm font-semibold text-slate-900">Tracking</span>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 px-3 text-xs text-slate-500">
          Signed in as<br />
          <span className="font-medium text-slate-700">{email ?? 'unknown'}</span>
        </div>
        <button
          onClick={() => {
            auth.clear();
            window.location.href = '/login';
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
