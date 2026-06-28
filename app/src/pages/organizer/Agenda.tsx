// Agenda builder. Accepted sessions are placed into rooms and times with
// fully keyboard-operable controls (no drag-only interactions), then shown in a
// room × time grid. Unscheduling returns a session to the pool.

import { useMemo, useState } from 'react';
import type { AgendaSlot } from '../../data/types';
import { useStore } from '../../store/AppStore';
import { Avatar, SectionHead, useToast, EmptyState } from '../../components/ui';
import { Icon } from '../../components/icons';
import { clock, durationLabel } from '../../lib/format';

function timeOptions(): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [];
  for (let m = 540; m <= 960; m += 15) out.push({ value: m, label: clock(m) });
  return out;
}

export function Agenda() {
  const { data, activeEvent, scheduleSubmission, unschedule } = useStore();
  const toast = useToast();
  const times = useMemo(timeOptions, []);

  const slots = data.agenda
    .filter((s) => s.eventId === activeEvent.id)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const accepted = data.submissions.filter((s) => s.eventId === activeEvent.id && s.status === 'accepted');

  // time-block grouping for the grid
  const blocks = useMemo(() => {
    const map = new Map<number, AgendaSlot[]>();
    for (const s of slots) {
      const arr = map.get(s.startMinutes) ?? [];
      arr.push(s);
      map.set(s.startMinutes, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [slots]);

  return (
    <div className="stack-lg">
      <SectionHead eyebrow="Step 3 · Build the program" title="Agenda">
        Place accepted sessions into rooms and times. Everything here is keyboard-operable — no dragging required.
      </SectionHead>

      {/* Unscheduled pool */}
      <div className="card stack">
        <div className="between">
          <h3 className="serif" style={{ fontSize: '1.15rem' }}>Accepted, not yet scheduled</h3>
          <span className="badge badge-amber">{accepted.length} waiting</span>
        </div>
        {accepted.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>Everything accepted is on the agenda. Accept more in the review queue to add sessions here.</p>
        ) : (
          <div className="stack-sm">
            {accepted.map((s) => {
              const speaker = data.speakers.find((p) => p.id === s.speakerId);
              return (
                <PlacementRow
                  key={s.id}
                  title={s.title}
                  speakerName={speaker ? `${speaker.firstName} ${speaker.lastName}` : ''}
                  duration={s.durationMinutes}
                  rooms={activeEvent.rooms}
                  times={times}
                  onPlace={(room, start) => {
                    scheduleSubmission(s.id, room, activeEvent.startDate, start);
                    toast.push(`Scheduled into ${room}`, 'Calendar');
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* The grid */}
      <div className="card card-flush">
        <div className="card-pad between" style={{ padding: '1rem 1.4rem', borderBottom: '1px solid var(--line)' }}>
          <h3 className="serif" style={{ fontSize: '1.15rem' }}>Program · {activeEvent.startDate}</h3>
          <span className="row-wrap tiny faint">
            <span className="row" style={{ gap: '0.3rem' }}><span style={{ width: 10, height: 10, background: 'var(--gold)', borderRadius: 2, display: 'inline-block' }} /> Keynote</span>
            <span className="row" style={{ gap: '0.3rem' }}><span style={{ width: 10, height: 10, background: 'var(--indigo)', borderRadius: 2, display: 'inline-block' }} /> Session</span>
          </span>
        </div>

        {blocks.length === 0 ? (
          <EmptyState icon="Grid" title="Empty agenda">Place a session above to start building the day.</EmptyState>
        ) : (
          <div className="stack" style={{ padding: '1rem 1.4rem', gap: '0.4rem' }}>
            {blocks.map(([start, blockSlots]) => {
              const isBreak = blockSlots.every((s) => s.kind === 'break' || s.kind === 'lunch');
              if (isBreak) {
                return blockSlots.map((s) => (
                  <div key={s.id} className="slot-card break" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="small"><strong className="strong">{s.title}</strong> · {s.room}</span>
                    <span className="slot-time">{clock(s.startMinutes)}–{clock(s.endMinutes)}</span>
                  </div>
                ));
              }
              return (
                <div key={start} className="row align-start" style={{ gap: '0.8rem', alignItems: 'stretch' }}>
                  <div className="agenda-time" style={{ minWidth: 64, paddingTop: '0.6rem' }}>{clock(start)}</div>
                  <div className="grid grow" style={{ gridTemplateColumns: `repeat(${Math.min(blockSlots.length, 4)}, 1fr)`, gap: '0.5rem' }}>
                    {blockSlots.map((s) => {
                      const sub = s.submissionId ? data.submissions.find((x) => x.id === s.submissionId) : undefined;
                      const speaker = sub ? data.speakers.find((p) => p.id === sub.speakerId) : undefined;
                      return (
                        <div key={s.id} className={`slot-card ${s.kind}`}>
                          <div className="between">
                            <span className="slot-time">{clock(s.startMinutes)}–{clock(s.endMinutes)}</span>
                            <span className="badge badge-plain tiny" style={{ padding: '0 0.4rem' }}>{s.room}</span>
                          </div>
                          <span className="slot-title">{sub?.title ?? s.title}</span>
                          {speaker && (
                            <span className="row tiny muted" style={{ gap: '0.3rem' }}>
                              <Avatar person={speaker} color={speaker.avatarColor} size="sm" /> {speaker.firstName} {speaker.lastName}
                            </span>
                          )}
                          {sub && (
                            <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.2rem' }} onClick={() => { unschedule(s.id); toast.push('Returned to the pool', 'ArrowLeft'); }}>
                              <Icon.ArrowLeft size={13} /> Unschedule
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PlacementRow({
  title, speakerName, duration, rooms, times, onPlace,
}: {
  title: string; speakerName: string; duration: number;
  rooms: string[]; times: { value: number; label: string }[];
  onPlace: (room: string, start: number) => void;
}) {
  const [room, setRoom] = useState(rooms[0]);
  const [start, setStart] = useState(times[0].value);
  return (
    <div className="card card-quiet row between wrap" style={{ gap: '0.75rem', padding: '0.8rem 1rem' }}>
      <div className="stack-sm grow" style={{ gap: '0.15rem' }}>
        <strong className="small">{title}</strong>
        <span className="tiny faint">{speakerName} · {durationLabel(duration)}</span>
      </div>
      <div className="row-wrap gap-sm">
        <label className="sr-only" htmlFor={`room-${title}`}>Room</label>
        <select id={`room-${title}`} className="select" style={{ width: 'auto' }} value={room} onChange={(e) => setRoom(e.target.value)}>
          {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="sr-only" htmlFor={`time-${title}`}>Start time</label>
        <select id={`time-${title}`} className="select" style={{ width: 'auto' }} value={start} onChange={(e) => setStart(Number(e.target.value))}>
          {times.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onPlace(room, start)}>
          <Icon.Plus size={15} /> Place
        </button>
      </div>
    </div>
  );
}
