// Self-service check-in kiosk — what an attendee taps at the door. Large targets,
// minimal text, one job at a time. Pick your name, check into a session, then
// you're nudged to the evaluation that confirms your credit.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { Avatar, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { clock, fullName } from '../lib/format';

export function Kiosk() {
  const { data, activeEvent, toggleCheckIn } = useStore();
  const toast = useToast();
  const [attendeeId, setAttendeeId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const attendees = data.attendees.filter((a) => a.eventId === activeEvent.id);
  const sessionSlots = useMemo(
    () => data.agenda
      .filter((s) => s.eventId === activeEvent.id && (s.kind === 'session' || s.kind === 'keynote'))
      .sort((a, b) => a.startMinutes - b.startMinutes),
    [data.agenda, activeEvent.id],
  );

  const attendee = attendees.find((a) => a.id === attendeeId);
  const matches = query.trim()
    ? attendees.filter((a) => fullName(a).toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  function isChecked(slotId: string) {
    return data.attendance.some((a) => a.attendeeId === attendeeId && a.slotId === slotId && a.checkInAt);
  }

  return (
    <div className="container-narrow stack-lg">
      <div className="stack-sm" style={{ textAlign: 'center' }}>
        <span className="badge badge-coral" style={{ margin: '0 auto' }}>● {activeEvent.name} · check-in</span>
        <h1>{!attendee ? 'Find your name' : `Welcome, ${attendee.firstName}`}</h1>
        <p className="muted">{!attendee ? 'Type your name to check in to sessions.' : 'Tap a session as you arrive. Your clock hours start the moment you check in.'}</p>
      </div>

      {!attendee ? (
        <div className="card card-lg stack">
          <div className="field">
            <label className="field-label" htmlFor="kiosk-search">Your name</label>
            <div className="row gap-sm">
              <Icon.Search size={20} className="faint" />
              <input id="kiosk-search" className="input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing…" />
            </div>
          </div>
          {matches.length > 0 && (
            <div className="stack-sm">
              {matches.map((a) => (
                <button key={a.id} type="button" className="card card-hover row between" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => { setAttendeeId(a.id); setQuery(''); }}>
                  <span className="row gap-sm"><Avatar person={a} color="var(--indigo)" /> <span className="stack-sm" style={{ gap: 0 }}><strong>{fullName(a)}</strong><span className="tiny faint">{a.role} · {a.district}</span></span></span>
                  <Icon.Arrow size={18} className="faint" />
                </button>
              ))}
            </div>
          )}
          {query.trim() && matches.length === 0 && <p className="small muted">No match. Check with the registration desk.</p>}
        </div>
      ) : (
        <div className="stack">
          {sessionSlots.map((s) => {
            const sub = s.submissionId ? data.submissions.find((x) => x.id === s.submissionId) : undefined;
            const checked = isChecked(s.id);
            return (
              <div className={`card ${checked ? '' : 'card-hover'}`} key={s.id} style={checked ? { borderColor: 'var(--green-soft)', background: 'var(--green-soft)' } : undefined}>
                <div className="between wrap" style={{ gap: '0.75rem' }}>
                  <div className="stack-sm" style={{ gap: '0.2rem' }}>
                    <span className="slot-time">{clock(s.startMinutes)}–{clock(s.endMinutes)} · {s.room}</span>
                    <strong>{sub?.title ?? s.title}</strong>
                  </div>
                  {checked ? (
                    <div className="row gap-sm">
                      <span className="badge badge-green"><Icon.Check size={13} /> Checked in</span>
                      <Link to={`/evaluate/${attendee.id}/${s.id}`} className="btn btn-gold btn-sm"><Icon.Star size={14} /> Evaluate</Link>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={() => { toggleCheckIn(attendee.id, s.id); toast.push(`Checked in to ${sub?.title ?? s.title}`, 'CheckCircle'); }}>
                      <Icon.ClipboardCheck size={16} /> Check in
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <button type="button" className="btn btn-ghost" onClick={() => setAttendeeId(null)} style={{ alignSelf: 'center' }}>
            <Icon.ArrowLeft size={16} /> That’s not me
          </button>
        </div>
      )}
    </div>
  );
}
