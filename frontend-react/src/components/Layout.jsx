import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar, { NAV, BrandMark } from './Sidebar.jsx';

function useBackendHealth() {
  const [state, setState] = useState('checking');
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch('/api/dashboard')
        .then((r) => alive && setState(r.ok ? 'online' : 'degraded'))
        .catch(() => alive && setState('offline'));
    check();
    const t = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return state;
}

const HEALTH = {
  online: ['bg-green-600', 'Connected'],
  degraded: ['bg-amber-500', 'Degraded'],
  offline: ['bg-red-600', 'Backend offline'],
  checking: ['bg-stone-400', 'Connecting'],
};

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const health = useBackendHealth();
  const current = NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));
  const [dot, label] = HEALTH[health];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-stone-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-stone-200 bg-white">
          <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" className="btn-secondary px-2.5 py-1.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
              Menu
            </button>
            <div className="lg:hidden"><BrandMark size="h-7 w-7" /></div>
            <p className="truncate text-sm text-stone-500">
              {current?.group || 'CareFlow'} <span className="mx-1 text-stone-300">/</span>
              <span className="font-medium text-stone-900">{current?.label || 'Home healthcare'}</span>
            </p>
            <div className="ml-auto flex items-center gap-4 text-sm text-stone-500">
              <span className="hidden md:inline">{today}</span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {label}
              </span>
              <span className="hidden border-l border-stone-200 pl-4 text-stone-700 sm:inline">Care coordinator</span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1320px] px-4 py-7 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
