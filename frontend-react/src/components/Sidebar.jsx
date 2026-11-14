import { NavLink } from 'react-router-dom';

export const NAV = [
  { to: '/', label: 'Dashboard', group: 'Overview', icon: 'M4 5h6v6H4zM14 5h6v4h-6zM4 15h6v4H4zM14 13h6v6h-6z' },
  { to: '/tracker', label: 'Process tracker', group: 'Overview', icon: 'M3 12h4l3-8 4 16 3-8h4' },
  { to: '/tasks', label: 'Tasklist', group: 'Overview', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
  { to: '/patients', label: 'Patients', group: 'Care', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1' },
  { to: '/nurses', label: 'Nurses', group: 'Care', icon: 'M12 4v6m-3-3h6M5 21v-2a5 5 0 015-5h4a5 5 0 015 5v2' },
  { to: '/visits', label: 'Home visits', group: 'Care', icon: 'M8 7V3m8 4V3M4 11h16M5 5h14v16H5z' },
  { to: '/physio', label: 'Physiotherapy', group: 'Care', icon: 'M13 5a2 2 0 11-4 0 2 2 0 014 0zM7 21l3-9 3 3v6m-6-9l3-3 4 1 3 4' },
  { to: '/pharmacy', label: 'Pharmacy', group: 'Care', icon: 'M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7zM8.5 8.5l7 7' },
  { to: '/risk', label: 'Readmission risk', group: 'Care', icon: 'M12 9v4m0 4h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z' },
  { to: '/notifications', label: 'Notifications', group: 'Admin', icon: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0' },
  { to: '/demo', label: 'Demo controls', group: 'Admin', icon: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4' },
];

export function Icon({ d, className = 'h-4 w-4' }) {
  return (
    <svg className={`${className} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export function BrandMark({ size = 'h-8 w-8' }) {
  return (
    <div className={`flex ${size} items-center justify-center rounded-md bg-brand-800 text-white`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" />
      </svg>
    </div>
  );
}

export default function Sidebar({ onNavigate }) {
  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <nav className="flex h-full flex-col border-r border-stone-200 bg-white">
      <div className="flex items-center gap-3 border-b border-stone-200 px-5 py-4">
        <BrandMark />
        <div className="leading-tight">
          <p className="font-display text-[17px] font-semibold text-ink">CareFlow</p>
          <p className="text-xs text-stone-500">City Home Care · Chennai</p>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-stone-400">{g}</p>
            <ul>
              {NAV.filter((n) => n.group === g).map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        isActive ? 'bg-brand-50 font-medium text-brand-800' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      }`
                    }
                  >
                    <Icon d={n.icon} />
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-stone-200 px-5 py-3 text-xs text-stone-500">
        Camunda 8.8 · Spring Boot · PostgreSQL
      </div>
    </nav>
  );
}
