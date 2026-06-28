// Secondary navigation for the organizer console — the lifecycle, left to right,
// plus an event switcher so the org can move between editions or start a new one.

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { useToast } from './ui';
import { Icon, type IconName } from './icons';

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/organizer', label: 'Dashboard', icon: 'Chart', end: true },
  { to: '/organizer/cfp', label: 'CFP setup', icon: 'Settings' },
  { to: '/organizer/review', label: 'Review queue', icon: 'Sparkles' },
  { to: '/organizer/agenda', label: 'Agenda', icon: 'Grid' },
  { to: '/organizer/roster', label: 'Roster & check-in', icon: 'Users' },
  { to: '/organizer/credits', label: 'Credits & certificates', icon: 'Award' },
  { to: '/organizer/history', label: 'Event history', icon: 'History' },
];

export function OrganizerLayout() {
  const { data, activeEvent, setActiveEvent, createEvent } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  const pending = data.submissions.filter(
    (s) => s.eventId === activeEvent.id && (s.status === 'submitted' || s.status === 'under_review'),
  ).length;

  const isLive = activeEvent.status === 'live';
  const statusBadge =
    activeEvent.status === 'live' ? { cls: 'badge-coral', label: '● Live now' }
      : activeEvent.status === 'completed' ? { cls: 'badge-plain', label: 'Completed' }
        : activeEvent.status === 'cfp_open' ? { cls: 'badge-green', label: 'CFP open' }
          : { cls: 'badge-amber', label: 'Draft' };

  function startNewEvent() {
    const id = createEvent({ name: 'New Event', edition: `${new Date().getFullYear()}`, status: 'draft', customQuestions: [] });
    setCreating(false);
    toast.push('Draft event created — set up the CFP', 'Plus');
    nav('/organizer/cfp');
    return id;
  }

  return (
    <div className="container-wide stack-lg">
      <div className="between wrap" data-nonessential style={{ gap: '1rem' }}>
        <div className="stack-sm">
          <span className="eyebrow">Organizer console · {data.organization.name}</span>
          <div className="row gap-sm wrap">
            <label className="sr-only" htmlFor="event-switch">Active event</label>
            <select
              id="event-switch"
              className="select serif"
              style={{ width: 'auto', fontSize: '1.5rem', fontWeight: 600, border: '1.5px solid var(--line)', background: 'transparent', paddingRight: '2rem' }}
              value={activeEvent.id}
              onChange={(e) => { setActiveEvent(e.target.value); }}
            >
              {data.events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name} · {ev.edition}</option>
              ))}
            </select>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setCreating(true)}>
              <Icon.Plus size={15} /> New event
            </button>
          </div>
          <span className="row-wrap small muted">
            <span className={`badge ${statusBadge.cls} badge-plain`}>{statusBadge.label}</span>
            {activeEvent.edition} · {activeEvent.venue || 'venue TBD'}
          </span>
        </div>
      </div>

      {creating && (
        <div className="card card-accent between wrap" style={{ gap: '0.75rem' }} role="alertdialog" aria-label="Create event">
          <span className="small">Start a new event? It copies tracks, rooms, and the credit rule from <strong className="strong">{activeEvent.name}</strong> so you’re not starting from scratch.</span>
          <div className="row gap-sm">
            <button type="button" className="btn btn-primary btn-sm" onClick={startNewEvent}>Create draft event</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

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

      {!isLive && activeEvent.status !== 'completed' && (
        <div className="card card-quiet small" style={{ padding: '0.7rem 1rem' }}>
          <span className="row gap-sm"><Icon.Alert size={15} style={{ color: 'var(--amber)' }} /> This event is in <strong className="strong">&nbsp;{activeEvent.status === 'cfp_open' ? 'CFP-open' : 'draft'}</strong>&nbsp;state. Configure it under <NavLink to="/organizer/cfp">CFP setup</NavLink>.</span>
        </div>
      )}

      <Outlet />
    </div>
  );
}
