// Public event page — what an attendee or prospective speaker sees. The credit
// promise is front and center (the wedge, visible early), the agenda is real,
// and registration is a believable mocked ticketing hook.

import { Link } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { Avatar, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { clock, durationLabel, formatDateRange } from '../lib/format';

export function EventPublic() {
  const { data, activeEvent, creditRule } = useStore();
  const toast = useToast();

  const slots = data.agenda
    .filter((s) => s.eventId === activeEvent.id)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const sessionSlots = slots.filter((s) => s.kind === 'session' || s.kind === 'keynote');
  const totalHours = sessionSlots.reduce((n, s) => n + (s.endMinutes - s.startMinutes) / creditRule.minutesPerCreditHour, 0);

  const speakers = data.speakers.filter((sp) =>
    data.submissions.some((s) => s.eventId === activeEvent.id && s.speakerId === sp.id && (s.status === 'accepted' || s.status === 'scheduled')),
  );

  return (
    <div className="stack-lg">
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="container stack" style={{ paddingTop: '0.5rem' }}>
          <span className="badge badge-coral" style={{ width: 'fit-content' }}>● Registration open</span>
          <h1 style={{ maxWidth: '18ch' }}>{activeEvent.name}</h1>
          <p style={{ fontSize: '1.15rem', maxWidth: '54ch' }}>{activeEvent.tagline}</p>
          <div className="row-wrap small muted">
            <span className="row gap-sm"><Icon.Calendar size={16} /> {formatDateRange(activeEvent.startDate, activeEvent.endDate)}</span>
            <span className="row gap-sm"><Icon.Pin size={16} /> {activeEvent.venue}</span>
            <span className="row gap-sm"><Icon.Building size={16} /> {data.organization.name}</span>
          </div>

          {/* credit promise — the wedge, visible early */}
          <div className="card card-gold row between wrap" style={{ gap: '1rem', marginTop: '0.5rem' }}>
            <span className="row gap-sm">
              <Icon.Award size={26} style={{ color: 'var(--gold)' }} />
              <span className="stack-sm" style={{ gap: 0 }}>
                <strong>Earn up to {Math.round(totalHours)} {creditRule.unitLabel.toLowerCase()}</strong>
                <span className="tiny faint">{creditRule.jurisdiction} · applies toward license renewal · certificate included</span>
              </span>
            </span>
            <div className="row gap-sm">
              <button type="button" className="btn btn-gold" onClick={() => toast.push('Mocked: would open Eventbrite checkout', 'Plug')}>Register now</button>
              <Link to="/submit" className="btn btn-outline">Submit a talk</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container stack">
        <p style={{ maxWidth: '70ch' }}>{activeEvent.description}</p>
        <div className="pill-row">{activeEvent.tracks.map((t) => <span key={t} className="badge badge-indigo">{t}</span>)}</div>
      </section>

      {/* Agenda */}
      <section className="container stack">
        <h2>Program</h2>
        <div className="card card-flush">
          {slots.map((s, i) => {
            const sub = s.submissionId ? data.submissions.find((x) => x.id === s.submissionId) : undefined;
            const speaker = sub ? data.speakers.find((p) => p.id === sub.speakerId) : undefined;
            const isBreak = s.kind === 'break' || s.kind === 'lunch';
            return (
              <div key={s.id} className="row align-start" style={{ gap: '1rem', padding: '0.85rem 1.2rem', borderBottom: i < slots.length - 1 ? '1px solid var(--line)' : undefined, background: isBreak ? 'var(--surface-2)' : undefined }}>
                <div className="stack-sm" style={{ gap: 0, minWidth: 110 }}>
                  <span className="slot-time">{clock(s.startMinutes)}</span>
                  <span className="tiny faint">{durationLabel(s.endMinutes - s.startMinutes)}</span>
                </div>
                <div className="grow stack-sm" style={{ gap: '0.2rem' }}>
                  <div className="row-wrap gap-sm">
                    {s.kind === 'keynote' && <span className="badge badge-gold badge-plain tiny">Keynote</span>}
                    <strong style={{ color: 'var(--ink)' }}>{sub?.title ?? s.title}</strong>
                  </div>
                  {speaker && <span className="row gap-sm tiny muted"><Avatar person={speaker} color={speaker.avatarColor} size="sm" /> {speaker.firstName} {speaker.lastName} · {speaker.org}</span>}
                  {sub && <span className="tiny faint">{s.room} · {sub.track}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Speakers */}
      {speakers.length > 0 && (
        <section className="container stack">
          <h2>Speakers</h2>
          <div className="grid grid-3">
            {speakers.map((sp) => (
              <div className="card stack-sm" key={sp.id}>
                <div className="row gap-sm">
                  <Avatar person={sp} color={sp.avatarColor} />
                  <div className="stack-sm" style={{ gap: 0 }}>
                    <strong>{sp.firstName} {sp.lastName}</strong>
                    <span className="tiny faint">{sp.role}</span>
                  </div>
                </div>
                <p className="small" style={{ margin: 0 }}>{sp.headline}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="container">
        <div className="card card-quiet row between wrap" style={{ gap: '0.75rem' }}>
          <span className="small muted row gap-sm"><Icon.Accessibility size={16} style={{ color: 'var(--indigo)' }} /> This event and page are built to WCAG 2.2 AA. Need accommodations? They’re in the Accessibility menu, top right.</span>
          <Link to="/submit" className="btn btn-primary btn-sm">Submit a talk</Link>
        </div>
      </section>
    </div>
  );
}
