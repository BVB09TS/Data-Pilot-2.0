import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ChatPanel from './ChatPanel';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard',   label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { to: '/connections', label: 'Connections', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
      { to: '/settings',    label: 'Settings',    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
  {
    label: 'Data Graph',
    items: [
      { to: '/lineage',     label: 'Lineage',     icon: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4' },
      { to: '/nodes',       label: 'Models',      icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
      { to: '/edges',       label: 'Edges',       icon: 'M17 8l4 4m0 0l-4 4m4-4H3' },
      { to: '/findings',    label: 'Findings',    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/runs',       label: 'Runs',       icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { to: '/policies',   label: 'Policies',   icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
      { to: '/audit',      label: 'Audit Log',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
      { to: '/pr-reviews', label: 'PR Reviews', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  return (
    <div className="flex h-full bg-white dark:bg-neutral-950 transition-colors duration-150">

      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 flex flex-col bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-colors duration-150">

        {/* Logo */}
        <div className="flex items-center px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-neutral-900 dark:bg-white">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L8 13L13 3" stroke={isDark ? '#0a0a0a' : '#ffffff'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">VORO</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600 select-none">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/dashboard'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-100 select-none ${
                        isActive
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium'
                          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`
                    }
                  >
                    <svg className="w-[15px] h-[15px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon} />
                    </svg>
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-neutral-200 dark:border-neutral-800 space-y-0.5">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-100"
          >
            {isDark ? (
              <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
          </button>

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            {user?.avatar_url
              ? <img src={user.avatar_url} className="w-6 h-6 rounded-full" alt="" />
              : (
                <div className="w-6 h-6 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center text-[10px] font-bold text-white dark:text-neutral-900 flex-shrink-0">
                  {user?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )
            }
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-neutral-900 dark:text-white truncate leading-tight">{user?.name}</p>
              <p className="text-[11px] text-neutral-400 truncate leading-tight">{user?.email}</p>
            </div>
            <button
              onClick={() => logout().then(() => navigate('/login'))}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors ml-auto"
              title="Sign out"
            >
              <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-white dark:bg-neutral-950 transition-colors duration-150">
        <Outlet />
      </main>

      <ChatPanel />
    </div>
  );
}
