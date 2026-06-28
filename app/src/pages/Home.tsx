// Overview / landing — the wedge is the hero. A new visitor understands within
// seconds that Lectern carries an event past where Sessionize stops: all the way
// to certified credit.

import { Link } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { Icon, type IconName } from '../components/icons';
import { formatDateRange } from '../lib/format';

const LIFECYCLE: { n: string; title: string; tag: string; payoff?: boolean }[] = [
  { n: '01', title: 'Call for papers', tag: 'Open a CFP in minutes' },
  { n: '02', title: 'Speakers submit', tag: 'Chunked, autosaved, accessible' },
  { n: '03', title: 'AI first-pass review', tag: 'Fit, quality & flags' },
  { n: '04', title: 'Schedule', tag: 'Agenda builder' },
  { n: '05', title: 'Register & check in', tag: 'The roster we own', payoff: true },
  { n: '06', title: 'Earn CE credit', tag: 'Clock hours accrue', payoff: true },
  { n: '07', title: 'Issue certificates', tag: 'Completion & participation', payoff: true },
];

const LEVERS: { icon: IconName; title: string; body: string; color: string }[] = [
  { icon: 'Mic', title: 'Wins the deal', color: 'var(--coral)', body: 'A radically calmer speaker submission and an AI first-pass that does the cold reading for organizers.' },
  { icon: 'Award', title: 'Keeps the customer', color: 'var(--gold)', body: 'Roster, attendance, credit hours, and certificates become the institution’s permanent record — the part nobody can rip out.' },
  { icon: 'Accessibility', title: 'Opens the market', color: 'var(--indigo)', body: 'WCAG 2.2 AA and ADA / 508 alignment is the procurement gate in K-12 and higher-ed. We clear it by design.' },
];

export function Home() {
  const { data, activeEvent } = useStore();

  return (
    <div className="stack-lg">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="container-wide" style={{ paddingTop: '1rem' }}>
          <div className="grid grid-side" style={{ gap: '2rem', alignItems: 'center' }}>
            <div className="stack">
              <span className="badge badge-indigo" style={{ width: 'fit-content' }}>
                <Icon.Building size={13} /> {data.organization.name}
              </span>
              <h1 style={{ maxWidth: '14ch' }}>
                From call for papers to <span style={{ color: 'var(--gold)' }}>certified credit.</span>
              </h1>
              <p style={{ fontSize: '1.12rem', maxWidth: '52ch' }}>
                Lectern runs the whole continuing-education lifecycle in one place. Sessionize
                selects talks and builds a schedule, then hands you a spreadsheet. We keep going —
                attendance, clock hours, and certificates — and become your system of record.
              </p>
              <div className="row-wrap" style={{ marginTop: '0.4rem' }}>
                <Link to="/submit" className="btn btn-primary btn-lg"><Icon.Mic size={18} /> Submit a talk</Link>
                <Link to="/organizer" className="btn btn-ink btn-lg"><Icon.Chart size={18} /> Open organizer console</Link>
              </div>
              <p className="tiny faint">Live demo · sample data · everything below actually works, end to end.</p>
            </div>

            <div className="card card-lg stack" aria-label="Active event">
              <span className="eyebrow">Happening today</span>
              <h3 className="serif" style={{ fontSize: '1.5rem' }}>{activeEvent.name}</h3>
              <span className="row-wrap small muted">
                <span className="badge badge-coral badge-plain">● Live now</span>
                {activeEvent.edition}
              </span>
              <div className="divider" />
              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <KStat label="Submissions" value={data.submissions.filter((s) => s.eventId === activeEvent.id && s.status !== 'draft').length} />
                <KStat label="On the agenda" value={data.agenda.filter((s) => s.eventId === activeEvent.id && (s.kind === 'session' || s.kind === 'keynote')).length} />
                <KStat label="Registered" value={data.attendees.filter((a) => a.eventId === activeEvent.id).length} />
                <KStat label="Date" valueText={formatDateRange(activeEvent.startDate, activeEvent.endDate)} />
              </div>
              <Link to="/event" className="btn btn-outline btn-block">View public event page <Icon.Arrow size={16} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* The wedge */}
      <section className="container-wide stack">
        <div className="section-head">
          <div className="stack-sm">
            <span className="eyebrow">The lifecycle</span>
            <h2>One continuous path. The hand-off is where we win.</h2>
            <p>Follow it left to right. The gold steps are the part Sessionize doesn’t do — and the part an institution can’t afford to lose.</p>
          </div>
        </div>
        <div className="lifecycle">
          {LIFECYCLE.map((s, i) => (
            <div key={s.n} className={`life-step${s.payoff ? ' payoff' : ''}`}>
              <span className="life-num">{s.n}</span>
              <span className="life-title">{s.title}</span>
              <span className="life-tag">{s.tag}</span>
              {i === 3 && (
                <span className="badge badge-coral badge-plain tiny" style={{ position: 'absolute', top: '-0.7rem', right: '-0.3rem' }}>
                  Sessionize ends →
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Three levers */}
      <section className="container-wide stack">
        <div className="grid grid-3">
          {LEVERS.map((l) => {
            const I = Icon[l.icon];
            return (
              <div className="card card-hover stack" key={l.title} style={{ borderTop: `3px solid ${l.color}` }}>
                <span className="row" style={{ color: l.color }}><I size={26} /></span>
                <h4>{l.title}</h4>
                <p className="small">{l.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Try the spine */}
      <section className="container-wide">
        <div className="card card-lg card-gold stack">
          <div className="between wrap" style={{ gap: '1rem' }}>
            <div className="stack-sm">
              <span className="eyebrow" style={{ color: 'var(--gold)' }}>Walk the spine yourself</span>
              <h3 className="serif">Submit a talk → review it → schedule it → check people in → issue a certificate.</h3>
              <p className="small">Each link opens the real, working screen. The whole loop runs on local sample data.</p>
            </div>
          </div>
          <div className="row-wrap">
            <Link to="/submit" className="btn btn-ink"><Icon.Mic size={16} /> 1. Submit</Link>
            <Link to="/organizer/review" className="btn btn-outline"><Icon.Sparkles size={16} /> 2. AI review</Link>
            <Link to="/organizer/agenda" className="btn btn-outline"><Icon.Grid size={16} /> 3. Schedule</Link>
            <Link to="/organizer/roster" className="btn btn-outline"><Icon.Users size={16} /> 4. Check-in</Link>
            <Link to="/organizer/credits" className="btn btn-gold"><Icon.Award size={16} /> 5. Credits & certificate</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function KStat({ label, value, valueText }: { label: string; value?: number; valueText?: string }) {
  return (
    <div className="stat">
      <span className="stat-value" style={{ fontSize: valueText ? '1.1rem' : undefined }}>{valueText ?? value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
