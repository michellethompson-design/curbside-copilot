// Credits & certificates — the payoff, and the lock-in.
//
// The credit rule is concrete and visible. Earned hours are computed live from
// attendance. Certificates issue per-attendee or in bulk, and each one is a real,
// viewable, printable document.

import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/AppStore';
import { Avatar, SectionHead, useToast } from '../../components/ui';
import { Icon } from '../../components/icons';
import { buildLedger, ceuEquivalent, totalEarned } from '../../lib/credits';
import { creditLabel } from '../../lib/format';

export function Credits() {
  const { data, activeEvent, creditRule, issueCertificate, issueAllEligible, certificateFor } = useStore();
  const toast = useToast();
  const nav = useNavigate();

  const attendees = data.attendees.filter((a) => a.eventId === activeEvent.id);

  const rows = attendees.map((a) => {
    const ledger = buildLedger(a.id, activeEvent.id, data.agenda, creditRule, data.attendance, data.submissions);
    const earned = totalEarned(ledger);
    const pendingEval = ledger.filter((l) => !l.earned && l.reason?.includes('evaluation')).length;
    const attended = data.attendance.filter((x) => x.attendeeId === a.id && x.checkInAt).length;
    return { attendee: a, earned, pendingEval, attended, cert: certificateFor(a.id), earnedCount: ledger.filter((l) => l.earned).length };
  });

  const totalIssuedHours = rows.reduce((n, r) => n + (r.cert?.totalCreditHours ?? 0), 0);
  const totalEarnedHours = rows.reduce((n, r) => n + r.earned, 0);
  const certCount = rows.filter((r) => r.cert).length;
  // Eligible for a certificate = attended at least one session (completion if they
  // cleared the threshold, participation otherwise) and not yet issued.
  const eligible = rows.filter((r) => (r.earned > 0 || r.attended > 0) && !r.cert).length;

  function exportStateRoster() {
    const head = ['Last name', 'First name', 'Educator license', 'District', 'Email', 'Sessions earned', `Credit hours (${creditRule.unitLabel})`, 'CEU', 'Certificate serial', 'Type', 'Issued'];
    const lines = rows.map((r) => {
      const a = r.attendee;
      return [
        a.lastName, a.firstName, a.licenseNumber ?? '', a.district, a.email,
        r.earnedCount, r.earned, ceuEquivalent(r.earned, creditRule) ?? '',
        r.cert?.serial ?? '', r.cert?.type ?? (r.earned > 0 ? 'completion (unissued)' : r.attended > 0 ? 'participation (unissued)' : '—'),
        r.cert ? r.cert.issuedAt.slice(0, 10) : '',
      ].map(csvCell).join(',');
    });
    const csv = [head.join(','), ...lines].join('\n');
    downloadFile(`${activeEvent.name}-${activeEvent.edition}-credit-roster.csv`.replace(/\s+/g, '-'), csv, 'text/csv');
    toast.push('State credit roster exported (CSV)', 'Download');
  }

  function exportBackup() {
    downloadFile(`lectern-${activeEvent.id}-backup.json`, JSON.stringify(data, null, 2), 'application/json');
    toast.push('Full event data exported (JSON)', 'Download');
  }

  return (
    <div className="stack-lg">
      <SectionHead eyebrow="Steps 5 & 6 · The payoff" title="Credits & certificates"
        action={
          <div className="row-wrap gap-sm">
            <button type="button" className="btn btn-outline btn-sm" onClick={exportStateRoster}><Icon.Download size={15} /> State roster (CSV)</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportBackup}><Icon.Save size={15} /> Backup (JSON)</button>
            <button type="button" className="btn btn-gold" disabled={eligible === 0} onClick={() => { const n = issueAllEligible(); toast.push(n > 0 ? `Issued ${n} certificate${n === 1 ? '' : 's'}` : 'Nothing new to issue', 'Award'); }}>
              <Icon.Award size={16} /> Issue all eligible ({eligible})
            </button>
          </div>
        }
      >
        Clock hours accrue automatically from attendance. Issue certificates here — this is the record educators need for license renewal, and the reason they come back.
      </SectionHead>

      <div className="grid grid-side">
        <div className="grid grid-2" style={{ height: 'fit-content' }}>
          <BigStat label="Credit hours earned" value={creditLabel(totalEarnedHours, creditRule.unitLabel)} gold />
          <BigStat label="Certificates issued" value={`${certCount} / ${attendees.length}`} />
          <BigStat label="Hours on certificates" value={creditLabel(totalIssuedHours, creditRule.unitLabel)} gold />
          <BigStat label="CEU equivalent" value={`${ceuEquivalent(totalEarnedHours, creditRule) ?? '—'}`} />
        </div>

        {/* Credit rule card */}
        <div className="card card-gold stack-sm">
          <span className="row gap-sm strong" style={{ color: 'var(--gold)' }}><Icon.Shield size={18} /> {creditRule.name}</span>
          <span className="tiny faint">{creditRule.jurisdiction}</span>
          <ul className="check-list small" style={{ marginTop: '0.4rem' }}>
            <li><Icon.Check size={15} /> 1 {creditRule.unitLabel.replace(/s$/, '')} per {creditRule.minutesPerCreditHour} instructional minutes</li>
            <li><Icon.Check size={15} /> Minimum {Math.round(creditRule.minimumAttendancePct * 100)}% attendance per session</li>
            {creditRule.requiresEvaluation && <li><Icon.Check size={15} /> Session evaluation required</li>}
            <li><Icon.Check size={15} /> Rounds to {creditRule.roundingIncrement} {creditRule.unitLabel}</li>
            {creditRule.ceuConversionRatio && <li><Icon.Check size={15} /> {Math.round(1 / creditRule.ceuConversionRatio)} hours = 1 CEU</li>}
          </ul>
          <p className="tiny faint" style={{ margin: 0 }}>{creditRule.notes}</p>
        </div>
      </div>

      <div className="card card-flush">
        <div className="scroll-x">
          <table className="table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Attendee</th>
                <th className="nowrap">Sessions earned</th>
                <th className="nowrap">Credit hours</th>
                <th className="nowrap">CEU</th>
                <th>Certificate</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ attendee: a, earned, earnedCount, pendingEval, attended, cert }) => (
                <tr key={a.id}>
                  <td>
                    <span className="row gap-sm">
                      <Avatar person={a} color="var(--indigo)" size="sm" />
                      <span className="stack-sm" style={{ gap: 0 }}>
                        <span className="strong">{a.firstName} {a.lastName}</span>
                        <span className="tiny faint">{a.licenseNumber}</span>
                      </span>
                    </span>
                  </td>
                  <td className="small tabular">
                    {earnedCount}<span className="faint">/{attended} attended</span>
                    {pendingEval > 0 && <span className="badge badge-amber badge-plain tiny" style={{ marginLeft: 6 }}>{pendingEval} pending eval</span>}
                  </td>
                  <td><span className={`badge ${earned > 0 ? 'badge-gold' : ''}`}>{creditLabel(earned, creditRule.unitLabel)}</span></td>
                  <td className="small tabular faint">{earned > 0 ? ceuEquivalent(earned, creditRule) : '—'}</td>
                  <td>
                    {cert ? (
                      <span className={`badge ${cert.type === 'completion' ? 'badge-green' : 'badge-blue'}`}><Icon.Check size={12} /> {cert.serial} · {cert.type}</span>
                    ) : earned > 0 ? (
                      <span className="badge badge-gold badge-plain tiny">Completion ready</span>
                    ) : attended > 0 ? (
                      <span className="badge badge-blue badge-plain tiny">Participation ready</span>
                    ) : (
                      <span className="tiny faint">Not attended</span>
                    )}
                  </td>
                  <td>
                    {cert ? (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => nav(`/certificate/${cert.id}`)}>View</button>
                    ) : (
                      <button type="button" className="btn btn-gold btn-sm" disabled={earned <= 0 && attended <= 0} onClick={() => { const id = issueCertificate(a.id); if (id) { toast.push('Certificate issued', 'Award'); nav(`/certificate/${id}`); } }}>
                        <Icon.Award size={14} /> Issue
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* mocked LMS hook */}
      <div className="card card-quiet row between wrap" style={{ gap: '0.75rem' }}>
        <span className="small row gap-sm"><Icon.Plug size={16} style={{ color: 'var(--indigo)' }} /> Push earned hours to educators’ <strong className="strong">&nbsp;Canvas LMS</strong> transcripts on issue.</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => toast.push('Mocked: would sync to Canvas LMS', 'Plug')}>Configure LMS sync</button>
      </div>
    </div>
  );
}

function BigStat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="card stack-sm" style={{ gap: '0.2rem' }}>
      <span className={`stat-value ${gold ? 'gold' : ''}`} style={{ fontSize: '1.7rem' }}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
