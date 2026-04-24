import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer when navigating.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Lock scroll while drawer is open.
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:h-screen md:flex-row md:overflow-hidden dark:bg-black">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
          >
            <Menu className="h-5 w-5" />
          </button>
          <LayoutDashboard className="h-5 w-5 text-brand-600" />
          <span className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Tracking</span>
        </div>
        <ThemeToggle variant="compact" />
      </header>

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in dark:bg-neutral-950/70"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-slide-in-right shadow-2xl">
            <Sidebar
              onClose={() => setNavOpen(false)}
              headerExtra={
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  aria-label="Close navigation"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  <X className="h-4 w-4" />
                </button>
              }
            />
          </div>
        </div>
      )}

      <main className="flex-1 md:overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
