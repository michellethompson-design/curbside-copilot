// Multi-event history — the year-over-year record that turns one event into a
// permanent institutional dataset (and makes switching tools costly).

import { useStore } from '../../store/AppStore';
import { SectionHead } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { buildLedger, totalEarned } from '../../lib/credits';
import { formatDateRange } from '../../lib/format';

export function EventHistory() {
  const { data, activeEvent, creditRule } = useStore();

  const liveCredit = data.attendees
    .filter((a) => a.eventId === activeEvent.id)
    .reduce((n, a) => n + totalEarned(buildLedger(a.id, activeEvent.id, data.agenda, creditRule, data.attendance, data.submissions)), 0);
  const liveCerts = data.certificates.filter((c) => c.eventId === activeEvent.id).length;
  const liveRegistered = data.attendees.filter((a) => a.eventId === activeEvent.id).length;

  // newest first
  const events = [...data.events].sort((a, b) => b.startDate.localeCompare(a.startDate));

  function metricsFor(eventId: string) {
    const e = data.events.find((x) => x.id === eventId)!;
    if (e.metrics) return e.metrics;
    // live event: derive
    return {
      submissions: data.submissions.filter((s) => s.eventId === eventId && s.status !== 'draft').length,
      accepted: data.submissions.filter((s) => s.eventId === eventId && (s.status === 'accepted' || s.status === 'scheduled')).length,
      speakers: new Set(data.submissions.filter((s) => s.eventId === eventId && s.status !== 'draft').map((s) => s.speakerId)).size,
      registered: liveRegistered,
      attended: new Set(data.attendance.filter((a) => a.checkInAt).map((a) => a.attendeeId)).size,
      creditHoursIssued: Math.round(liveCredit),
      certificatesIssued: liveCerts,
      avgSessionRating: 0,
    };
  }

  const totals = events.reduce(
    (acc, e) => {
      const m = metricsFor(e.id);
      acc.hours += m.creditHoursIssued;
      acc.certs += m.certificatesIssued;
      acc.attended += m.attended;
      return acc;
    },
    { hours: 0, certs: 0, attended: 0 },
  );

  return (
    <div className="stack-lg">
      <SectionHead eyebrow="Step 7 · The permanent record" title="Event history">
        Four editions, one continuous dataset. This is what an organizer can’t rebuild after switching tools — and why they don’t.
      </SectionHead>

      <div className="grid grid-3">
        <Total icon="Award" label="Lifetime credit hours" value={totals.hours.toLocaleString()} gold />
        <Total icon="ClipboardCheck" label="Lifetime certificates" value={totals.certs.toLocaleString()} />
        <Total icon="Users" label="Educators served" value={totals.attended.toLocaleString()} />
      </div>

      <div className="stack">
        {events.map((e) => {
          const m = metricsFor(e.id);
          const isLive = e.status !== 'completed';
          const acceptRate = m.submissions > 0 ? Math.round((m.accepted / m.submissions) * 100) : 0;
          return (
            <div className="card card-hover" key={e.id} style={isLive ? { borderColor: 'var(--coral)', borderWidth: 1 } : undefined}>
              <div className="between wrap align-start" style={{ gap: '1rem' }}>
                <div className="stack-sm" style={{ gap: '0.3rem' }}>
                  <div className="row-wrap gap-sm">
                    {isLive ? <span className="badge badge-coral badge-plain">● Live now</span> : <span className="badge badge-plain">{e.year}</span>}
                    <span className="tag">{e.mode.replace('_', ' ')}</span>
                  </div>
                  <h3 className="serif" style={{ fontSize: '1.3rem' }}>{e.name} <span className="faint" style={{ fontWeight: 400 }}>· {e.edition}</span></h3>
                  <span className="tiny faint row gap-sm"><Icon.Calendar size={13} /> {formatDateRange(e.startDate, e.endDate)} · {e.venue}</span>
                </div>
                {!isLive && m.avgSessionRating > 0 && (
                  <span className="badge badge-amber"><Icon.Star size={12} /> {m.avgSessionRating.toFixed(1)} avg</span>
                )}
              </div>
              <div className="divider" />
              <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }}>
                <Mini label="Submissions" value={m.submissions} />
                <Mini label="Accepted" value={`${m.accepted} · ${acceptRate}%`} />
                <Mini label="Registered" value={m.registered} />
                <Mini label="Attended" value={m.attended} />
                <Mini label="Credit hrs" value={m.creditHoursIssued.toLocaleString()} gold />
                <Mini label="Certificates" value={m.certificatesIssued.toLocaleString()} gold />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Total({ icon, label, value, gold }: { icon: IconName; label: string; value: string; gold?: boolean }) {
  const I = Icon[icon];
  return (
    <div className={`card stack-sm ${gold ? 'card-gold' : ''}`} style={{ gap: '0.3rem' }}>
      <span className="row" style={{ color: gold ? 'var(--gold)' : 'var(--indigo)' }}><I size={22} /></span>
      <span className={`stat-value ${gold ? 'gold' : ''}`}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Mini({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className="stack-sm" style={{ gap: 0 }}>
      <span className={`strong ${gold ? '' : ''}`} style={{ fontSize: '1.1rem', color: gold ? 'var(--gold)' : 'var(--ink)' }}>{value}</span>
      <span className="tiny faint">{label}</span>
    </div>
  );
}
