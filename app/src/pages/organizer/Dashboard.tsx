// Organizer dashboard — the live event at a glance, the lifecycle progress, and
// the all-time totals that make Lectern the system of record.

import { Link } from 'react-router-dom';
import { useStore } from '../../store/AppStore';
import { Icon, type IconName } from '../../components/icons';
import { buildLedger, totalEarned } from '../../lib/credits';
import { creditLabel } from '../../lib/format';

export function Dashboard() {
  const { data, activeEvent, creditRule } = useStore();

  const subs = data.submissions.filter((s) => s.eventId === activeEvent.id && s.status !== 'draft');
  const accepted = subs.filter((s) => s.status === 'accepted' || s.status === 'scheduled');
  const scheduled = data.agenda.filter((s) => s.eventId === activeEvent.id && (s.kind === 'session' || s.kind === 'keynote'));
  const attendees = data.attendees.filter((a) => a.eventId === activeEvent.id);
  const checkedIn = new Set(data.attendance.filter((a) => a.checkInAt).map((a) => a.attendeeId)).size;
  const liveCredit = attendees.reduce(
    (n, a) => n + totalEarned(buildLedger(a.id, activeEvent.id, data.agenda, creditRule, data.attendance, data.submissions)),
    0,
  );
  const certsIssued = data.certificates.filter((c) => c.eventId === activeEvent.id).length;
  const pendingReview = subs.filter((s) => s.status === 'submitted' || s.status === 'under_review').length;

  // all-time, across the org's history (system-of-record framing)
  const completed = data.events.filter((e) => e.status === 'completed' && e.metrics);
  const allTimeHours = completed.reduce((n, e) => n + (e.metrics!.creditHoursIssued), 0) + liveCredit;
  const allTimeCerts = completed.reduce((n, e) => n + e.metrics!.certificatesIssued, 0) + certsIssued;
  const allTimeAttended = completed.reduce((n, e) => n + e.metrics!.attended, 0) + checkedIn;

  // year-over-year credit hours (oldest → live)
  const history = [...completed].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const chart = [...history.map((e) => ({ label: `${e.year}`, value: e.metrics!.creditHoursIssued, edition: e.edition, gold: false })),
    { label: `${activeEvent.year}`, value: Math.round(liveCredit), edition: 'Live', gold: true }];
  const maxVal = Math.max(...chart.map((c) => c.value), 1);

  const lifecycle: { label: string; done: boolean; value: string; to: string; icon: IconName }[] = [
    { label: 'Submissions in', done: subs.length > 0, value: `${subs.length}`, to: '/organizer/review', icon: 'ClipboardCheck' },
    { label: 'Reviewed & accepted', done: pendingReview === 0, value: `${accepted.length} accepted`, to: '/organizer/review', icon: 'Sparkles' },
    { label: 'Scheduled', done: scheduled.length > 0, value: `${scheduled.length} on agenda`, to: '/organizer/agenda', icon: 'Grid' },
    { label: 'Checked in', done: checkedIn > 0, value: `${checkedIn}/${attendees.length}`, to: '/organizer/roster', icon: 'Users' },
    { label: 'Credit issued', done: certsIssued > 0, value: `${certsIssued} certs`, to: '/organizer/credits', icon: 'Award' },
  ];

  return (
    <div className="stack-lg">
      {/* live KPIs */}
      <div className="grid grid-4">
        <Kpi icon="ClipboardCheck" label="Submissions" value={subs.length} sub={`${pendingReview} awaiting decision`} to="/organizer/review" />
        <Kpi icon="Grid" label="Scheduled" value={scheduled.length} sub={`${accepted.length} accepted`} to="/organizer/agenda" />
        <Kpi icon="Users" label="Checked in" value={`${checkedIn}/${attendees.length}`} sub="of registered" to="/organizer/roster" />
        <Kpi icon="Award" label="Credit hours" value={creditLabel(liveCredit, creditRule.unitLabel)} sub={`${certsIssued} certificates issued`} to="/organizer/credits" gold />
      </div>

      {/* lifecycle progress */}
      <div className="card stack">
        <div className="between">
          <h3 className="serif" style={{ fontSize: '1.15rem' }}>Where this event is</h3>
          {pendingReview > 0 && <Link to="/organizer/review" className="btn btn-primary btn-sm">Review {pendingReview} now <Icon.Arrow size={15} /></Link>}
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
          {lifecycle.map((l, i) => {
            const I = Icon[l.icon];
            return (
              <Link to={l.to} key={i} className="card card-hover stack-sm" style={{ gap: '0.35rem', textDecoration: 'none', borderColor: l.done ? 'var(--green-soft)' : undefined }}>
                <span className="row between">
                  <span style={{ color: l.done ? 'var(--green)' : 'var(--ink-faint)' }}><I size={20} /></span>
                  {l.done ? <Icon.CheckCircle size={16} style={{ color: 'var(--green)' }} /> : <span className="tiny faint">{i + 1}</span>}
                </span>
                <span className="strong small">{l.label}</span>
                <span className="tiny faint">{l.value}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-side">
        {/* Year over year */}
        <div className="card stack">
          <div className="between">
            <div className="stack-sm" style={{ gap: 0 }}>
              <h3 className="serif" style={{ fontSize: '1.15rem' }}>Credit hours issued, year over year</h3>
              <span className="tiny faint">The continuity that makes leaving expensive</span>
            </div>
            <Link to="/organizer/history" className="btn btn-ghost btn-sm">Full history <Icon.Arrow size={14} /></Link>
          </div>
          <div className="barchart" aria-hidden="true">
            {chart.map((c, i) => (
              <div className={`col${c.gold ? ' gold' : ''}`} key={i}>
                <span className="tiny strong tabular">{c.value.toLocaleString()}</span>
                <div className="bar-fill" style={{ height: `${Math.max(8, (c.value / maxVal) * 100)}%` }} />
                <span className="bar-label">{c.label}<br /><span className="faint">{c.edition}</span></span>
              </div>
            ))}
          </div>
          <p className="sr-only">
            {chart.map((c) => `${c.label} ${c.edition}: ${c.value} hours`).join('. ')}
          </p>
        </div>

        {/* All-time */}
        <div className="card card-gold stack">
          <span className="row gap-sm strong" style={{ color: 'var(--gold)' }}><Icon.History size={18} /> All-time, across {completed.length + 1} events</span>
          <div className="stack" style={{ gap: '0.9rem', marginTop: '0.3rem' }}>
            <AllTime label="Credit hours issued" value={Math.round(allTimeHours).toLocaleString()} />
            <AllTime label="Certificates issued" value={allTimeCerts.toLocaleString()} />
            <AllTime label="Educators served" value={allTimeAttended.toLocaleString()} />
          </div>
          <p className="tiny faint" style={{ margin: 0 }}>
            Every hour and certificate stays in {data.organization.name}’s permanent record — searchable, reportable, and yours.
          </p>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, to, gold }: { icon: IconName; label: string; value: string | number; sub: string; to: string; gold?: boolean }) {
  const I = Icon[icon];
  return (
    <Link to={to} className="card card-hover stack-sm" style={{ gap: '0.35rem', textDecoration: 'none' }}>
      <span className="row between">
        <span style={{ color: gold ? 'var(--gold)' : 'var(--indigo)' }}><I size={22} /></span>
        <Icon.Arrow size={16} className="faint" />
      </span>
      <span className={`stat-value ${gold ? 'gold' : ''}`} style={{ fontSize: '1.8rem' }}>{value}</span>
      <span className="stat-label">{label}</span>
      <span className="tiny faint">{sub}</span>
    </Link>
  );
}

function AllTime({ label, value }: { label: string; value: string }) {
  return (
    <div className="between" style={{ borderBottom: '1px solid var(--gold-line)', paddingBottom: '0.6rem' }}>
      <span className="small">{label}</span>
      <span className="stat-value gold" style={{ fontSize: '1.5rem' }}>{value}</span>
    </div>
  );
}
