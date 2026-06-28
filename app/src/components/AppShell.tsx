// The application shell: brand, primary navigation, the always-available
// accessibility toolbar, a focus-mode banner, a skip link, and the routed
// content outlet.

import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { usePreferences } from '../store/Preferences';
import { A11yToolbar } from './A11yToolbar';
import { Icon } from './icons';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/speaker', label: 'My sessions', end: false },
  { to: '/organizer', label: 'Organizer', end: false },
  { to: '/event', label: 'Public page', end: false },
];

export function AppShell() {
  const [drawer, setDrawer] = useState(false);
  const { prefs, toggle } = usePreferences();
  const loc = useLocation();

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to main content</a>

      <header className="topbar">
        <div className="container-wide topbar-inner">
          <NavLink to="/" className="brand" aria-label="Lectern home">
            <span className="brand-mark" aria-hidden="true">L</span>
            Lectern
          </NavLink>

          <nav className="nav-links" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="row" style={{ marginLeft: 'auto', gap: '0.6rem' }}>
            <span className="focus-banner" aria-live="polite">
              <Icon.Focus size={15} /> Focus mode
              <button type="button" className="btn-ghost btn btn-sm" onClick={() => toggle('focusMode')} style={{ padding: '0 0.4rem', minHeight: 'auto' }}>
                Exit
              </button>
            </span>
            <NavLink to="/submit" className="btn btn-primary btn-sm" data-nonessential>
              <Icon.Mic size={16} /> Submit a talk
            </NavLink>
            <A11yToolbar />
            <button
              type="button"
              className="btn btn-outline btn-icon nav-mobile"
              aria-label="Open menu"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
            >
              <Icon.Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-label="Menu">
            <div className="between" style={{ marginBottom: '0.5rem' }}>
              <span className="brand"><span className="brand-mark">L</span> Lectern</span>
              <button type="button" className="btn btn-outline btn-icon" aria-label="Close menu" onClick={() => setDrawer(false)}>
                <Icon.Close size={20} />
              </button>
            </div>
            <NavLink to="/submit" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={() => setDrawer(false)}>
              Submit a talk
            </NavLink>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={() => setDrawer(false)}>
                {n.label}
              </NavLink>
            ))}
          </div>
        </>
      )}

      <main id="main" className="main" tabIndex={-1} key={loc.pathname}>
        <Outlet />
      </main>

      <footer data-nonessential style={{ borderTop: '1px solid var(--line)', padding: '1.5rem 0', background: 'var(--surface)' }}>
        <div className="container-wide between wrap" style={{ gap: '0.75rem' }}>
          <span className="small muted">
            <strong className="serif" style={{ color: 'var(--ink)' }}>Lectern</strong> — from call for papers to certified credit.
          </span>
          <span className="tiny faint">
            {prefs.highContrast ? 'High-contrast mode on · ' : ''}WCAG 2.2 AA · ADA · Section 508 · Demo data resets locally.
          </span>
        </div>
      </footer>
    </div>
  );
}
