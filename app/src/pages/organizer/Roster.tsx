// Roster & attendance — the credit-bearing record we own.
//
// Register attendees (or pull from a mocked ticketing hook), then simulate
// door check-in per session. Attendance drives credit, so every toggle here
// flows straight into the certificate.

import { useMemo, useState } from 'react';
import { useStore } from '../../store/AppStore';
import { Avatar, SectionHead, useToast } from '../../components/ui';
import { Icon } from '../../components/icons';
import { clock, creditLabel } from '../../lib/format';

export function Roster() {
  const { data, activeEvent, creditRule, registerAttendee, toggleCheckIn, toggleEvaluation, earnedHoursFor } = useStore();
  const toast = useToast();

  const sessionSlots = data.agenda
    .filter((s) => s.eventId === activeEvent.id && (s.kind === 'session' || s.kind === 'keynote'))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const [activeSlot, setActiveSlot] = useState(sessionSlots[0]?.id ?? '');
  const [showForm, setShowForm] = useState(false);

  const attendees = data.attendees.filter((a) => a.eventId === activeEvent.id);
  const slot = sessionSlots.find((s) => s.id === activeSlot);
  const sub = slot?.submissionId ? data.submissions.find((x) => x.id === slot.submissionId) : undefined;

  const recordsForSlot = useMemo(
    () => new Map(data.attendance.filter((a) => a.slotId === activeSlot).map((a) => [a.attendeeId, a])),
    [data.attendance, activeSlot],
  );
  const checkedInHere = recordsForSlot.size;

  function attendedCount(attendeeId: string) {
    return data.attendance.filter((a) => a.attendeeId === attendeeId && a.checkInAt).length;
  }

  return (
    <div className="stack-lg">
      <SectionHead eyebrow="Step 4 · Registration & attendance" title="Roster & check-in"
        action={
          <div className="row gap-sm">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => toast.push('Pulled 0 new — Eventbrite is in sync', 'Plug')}>
              <Icon.Plug size={15} /> Sync Eventbrite
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              <Icon.Plus size={15} /> Register attendee
            </button>
          </div>
        }
      >
        The attendee roster is the record credit is reported against — so Lectern owns it. Check people in below and watch credit accrue.
      </SectionHead>

      <div className="grid grid-4">
        <Stat label="Registered" value={attendees.length} icon="Users" />
        <Stat label="Checked in here" value={checkedInHere} icon="CheckCircle" tone="green" />
        <Stat label="Total check-ins" value={data.attendance.filter((a) => a.checkInAt).length} icon="ClipboardCheck" />
        <Stat label="Sessions" value={sessionSlots.length} icon="Calendar" />
      </div>

      {showForm && <RegisterForm onAdd={(a) => { registerAttendee(a); setShowForm(false); toast.push('Added to the roster', 'Check'); }} onCancel={() => setShowForm(false)} />}

      {/* Session check-in switcher */}
      <div className="card stack">
        <div className="between wrap" style={{ gap: '0.75rem' }}>
          <div className="stack-sm" style={{ gap: '0.15rem' }}>
            <span className="eyebrow">Simulate door check-in for</span>
            <strong>{sub?.title ?? slot?.title}</strong>
            {slot && <span className="tiny faint">{clock(slot.startMinutes)}–{clock(slot.endMinutes)} · {slot.room} · {creditLabel((slot.endMinutes - slot.startMinutes) / creditRule.minutesPerCreditHour, creditRule.unitLabel)} if attended</span>}
          </div>
          <label className="row gap-sm">
            <span className="sr-only">Choose session</span>
            <select className="select" style={{ width: 'auto' }} value={activeSlot} onChange={(e) => setActiveSlot(e.target.value)}>
              {sessionSlots.map((s) => {
                const ss = s.submissionId ? data.submissions.find((x) => x.id === s.submissionId) : undefined;
                return <option key={s.id} value={s.id}>{clock(s.startMinutes)} · {ss?.title ?? s.title}</option>;
              })}
            </select>
          </label>
        </div>

        <div className="scroll-x">
          <table className="table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Attendee</th>
                <th>District</th>
                <th>Checked in</th>
                <th>Evaluation</th>
                <th className="nowrap">Sessions</th>
                <th className="nowrap">Credit so far</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => {
                const rec = recordsForSlot.get(a.id);
                const here = !!rec?.checkInAt;
                const earned = earnedHoursFor(a.id);
                return (
                  <tr key={a.id}>
                    <td>
                      <span className="row gap-sm">
                        <Avatar person={a} color="var(--indigo)" size="sm" />
                        <span className="stack-sm" style={{ gap: 0 }}>
                          <span className="strong">{a.firstName} {a.lastName}</span>
                          <span className="tiny faint">{a.role}</span>
                        </span>
                      </span>
                    </td>
                    <td className="small">{a.district}</td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm ${here ? 'btn-ink' : 'btn-outline'}`}
                        aria-pressed={here}
                        onClick={() => toggleCheckIn(a.id, activeSlot)}
                      >
                        {here ? <><Icon.Check size={14} /> In</> : 'Check in'}
                      </button>
                    </td>
                    <td>
                      {here ? (
                        <label className="switch" title="Mark session evaluation complete">
                          <input type="checkbox" checked={!!rec?.evaluationComplete} onChange={() => toggleEvaluation(a.id, activeSlot)} />
                          <span className="switch-track"><span className="switch-knob" /></span>
                          <span className="tiny faint">{rec?.evaluationComplete ? 'Done' : 'Pending'}</span>
                        </label>
                      ) : (
                        <span className="tiny faint">—</span>
                      )}
                    </td>
                    <td className="small tabular">{attendedCount(a.id)}/{sessionSlots.length}</td>
                    <td><span className="badge badge-gold">{creditLabel(earned, creditRule.unitLabel)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tiny faint" style={{ margin: 0 }}>
          Credit requires {Math.round(creditRule.minimumAttendancePct * 100)}% attendance{creditRule.requiresEvaluation ? ' and a completed evaluation' : ''}. Toggle evaluation to see credit release.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: keyof typeof Icon; tone?: string }) {
  const I = Icon[icon];
  return (
    <div className="card stack-sm" style={{ gap: '0.3rem' }}>
      <span className="row" style={{ color: tone ? `var(--${tone})` : 'var(--indigo)' }}><I size={20} /></span>
      <span className="stat-value" style={{ fontSize: '1.7rem' }}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function RegisterForm({ onAdd, onCancel }: { onAdd: (a: { firstName: string; lastName: string; email: string; role: string; district: string; registrationSource: string; eventId: string }) => void; onCancel: () => void }) {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', role: '', district: '' });
  const valid = f.firstName && f.lastName && f.email.includes('@');
  return (
    <form
      className="card card-accent stack"
      onSubmit={(e) => { e.preventDefault(); if (valid) onAdd({ ...f, registrationSource: 'Direct', eventId: '' }); }}
    >
      <h3 className="serif" style={{ fontSize: '1.1rem' }}>Register an attendee</h3>
      <div className="grid grid-2">
        <div className="field"><label className="field-label" htmlFor="rf-first">First name <span className="field-req">*</span></label><input id="rf-first" className="input" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></div>
        <div className="field"><label className="field-label" htmlFor="rf-last">Last name <span className="field-req">*</span></label><input id="rf-last" className="input" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></div>
        <div className="field"><label className="field-label" htmlFor="rf-email">Email <span className="field-req">*</span></label><input id="rf-email" className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label className="field-label" htmlFor="rf-role">Role</label><input id="rf-role" className="input" placeholder="Grade 4 Teacher" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label" htmlFor="rf-district">District / employer</label><input id="rf-district" className="input" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} /></div>
      </div>
      <div className="row gap-sm">
        <button type="submit" className="btn btn-primary" disabled={!valid}>Add to roster</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
