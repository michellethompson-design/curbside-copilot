// Secondary navigation for the organizer console — the lifecycle, left to right.

import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { Icon, type IconName } from './icons';

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/organizer', label: 'Dashboard', icon: 'Chart', end: true },
  { to: '/organizer/review', label: 'Review queue', icon: 'Sparkles' },
  { to: '/organizer/agenda', label: 'Agenda', icon: 'Grid' },
  { to: '/organizer/roster', label: 'Roster & check-in', icon: 'Users' },
  { to: '/organizer/credits', label: 'Credits & certificates', icon: 'Award' },
  { to: '/organizer/history', label: 'Event history', icon: 'History' },
];

export function OrganizerLayout() {
  const { data, activeEvent } = useStore();
  const pending = data.submissions.filter(
    (s) => s.eventId === activeEvent.id && (s.status === 'submitted' || s.status === 'under_review'),
  ).length;

  return (
    <div className="container-wide stack-lg">
      <div className="between wrap" data-nonessential>
        <div className="stack-sm">
          <span className="eyebrow">Organizer console · {data.organization.name}</span>
          <h1 style={{ fontSize: '1.9rem' }}>{activeEvent.name}</h1>
          <span className="row-wrap small muted">
            <span className="badge badge-coral badge-plain">● Live now</span>
            {activeEvent.edition} · {activeEvent.venue}
          </span>
        </div>
      </div>

      <div className="scroll-x" data-nonessential>
        <nav className="row" aria-label="Organizer sections" style={{ gap: '0.3rem', minWidth: 'max-content', borderBottom: '1px solid var(--line)', paddingBottom: '0.5rem' }}>
          {TABS.map((t) => {
            const I = Icon[t.icon];
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <I size={16} />
                {t.label}
                {t.label === 'Review queue' && pending > 0 && (
                  <span className="badge badge-amber badge-plain tiny" style={{ padding: '0 0.45rem' }}>{pending}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
