// The certificate — rendered for real, printable, and downloadable as a
// standalone file. Attendee, event, sessions, credit hours, date, serial, and
// the accredited issuing body line. This is the artifact the whole product
// exists to produce.

import { Link, useParams } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { useToast, EmptyState } from '../components/ui';
import { Icon } from '../components/icons';
import { creditLabel, formatDate, fullName } from '../lib/format';
import { ceuEquivalent } from '../lib/credits';

export function CertificatePage() {
  const { id } = useParams();
  const { data, ruleFor } = useStore();
  const toast = useToast();

  const cert = data.certificates.find((c) => c.id === id);
  if (!cert) {
    return (
      <div className="container-narrow"><div className="card card-lg">
        <EmptyState icon="Award" title="Certificate not found">It may not have been issued yet. Issue it from the Credits page.</EmptyState>
        <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}><Link to="/organizer/credits" className="btn btn-primary">Go to credits</Link></div>
      </div></div>
    );
  }

  const attendee = data.attendees.find((a) => a.id === cert.attendeeId);
  const event = data.events.find((e) => e.id === cert.eventId)!;
  const rule = ruleFor(cert.eventId);
  const ceu = ceuEquivalent(cert.totalCreditHours, rule);
  const attendeeName = attendee ? fullName(attendee) : 'Attendee';

  function download() {
    const html = standaloneHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Certificate-${cert!.serial}-${attendeeName.replace(/\s+/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.push('Certificate downloaded', 'Download');
  }

  function standaloneHtml() {
    const isCompletion = cert!.type === 'completion';
    const sessions = cert!.sessions.map((s) => `<tr><td>${s.title}</td><td style="text-align:right">${isCompletion ? creditLabel(s.creditHours, cert!.unitLabel) : 'Attended'}</td></tr>`).join('');
    const totalLine = isCompletion
      ? `${creditLabel(cert!.totalCreditHours, cert!.unitLabel)}${ceu ? ` &middot; ${ceu} CEU` : ''}`
      : `${cert!.sessions.length} sessions attended`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Certificate ${cert!.serial}</title>
<style>body{font-family:Georgia,serif;background:#faf7f1;color:#241a3d;margin:0;padding:40px}
.c{max-width:780px;margin:auto;background:#fff;border:3px solid #e6d4a8;border-radius:18px;padding:48px;text-align:center}
h1{font-size:34px;margin:8px 0}.s{letter-spacing:.2em;text-transform:uppercase;font-size:12px;color:#a9741f;font-weight:bold}
.name{font-size:40px;margin:18px 0;border-bottom:1px solid #e6d4a8;display:inline-block;padding-bottom:6px}
table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}td{padding:8px;border-bottom:1px solid #eee;text-align:left}
.tot{font-size:24px;color:#a9741f;font-weight:bold}.meta{font-size:12px;color:#777;margin-top:24px}</style></head>
<body><div class="c"><div class="s">Certificate of ${cert!.type === 'completion' ? 'Completion' : 'Participation'}</div>
<p>This certifies that</p><div class="name">${attendeeName}</div>
<p>has successfully ${cert!.type === 'completion' ? 'completed' : 'participated in'}</p>
<h1>${event.name}</h1><p>${event.edition} · ${formatDate(event.startDate)} · ${event.venue}</p>
<table>${sessions}</table>
<div class="tot">${totalLine}</div>
<div class="meta">Issued by ${cert!.issuingBody}<br>Provider ${cert!.providerNumber} · Serial ${cert!.serial} · Issued ${formatDate(cert!.issuedAt)}</div>
</div></body></html>`;
  }

  return (
    <div className="container stack-lg">
      <div className="between wrap no-print" data-noprint style={{ gap: '0.75rem' }}>
        <Link to="/organizer/credits" className="btn btn-ghost btn-sm"><Icon.ArrowLeft size={16} /> Back to credits</Link>
        <div className="row gap-sm">
          <button type="button" className="btn btn-outline" onClick={() => window.print()}><Icon.Print size={16} /> Print / Save as PDF</button>
          <button type="button" className="btn btn-gold" onClick={download}><Icon.Download size={16} /> Download</button>
        </div>
      </div>

      <div className="cert">
        <div className="cert-inner stack" style={{ gap: '0.9rem', alignItems: 'center' }}>
          <div className="cert-seal"><Icon.Award size={38} /></div>
          <span className="eyebrow" style={{ color: 'var(--gold)', letterSpacing: '0.2em' }}>
            Certificate of {cert.type === 'completion' ? 'Completion' : 'Participation'}
          </span>
          <p style={{ margin: 0 }}>This certifies that</p>
          <div className="cert-name">{attendeeName}</div>
          <p style={{ margin: 0 }}>
            has successfully {cert.type === 'completion' ? 'completed' : 'participated in'}
          </p>
          <h2 className="serif" style={{ fontSize: '1.9rem' }}>{event.name}</h2>
          <p className="small" style={{ margin: 0 }}>{event.edition} · {formatDate(event.startDate)} · {event.venue}</p>

          <div className="cert-rule stack-sm" style={{ width: 'min(520px, 100%)', padding: '1rem 0', margin: '0.5rem 0' }}>
            {cert.sessions.map((s, i) => (
              <div className="row between small" key={i} style={{ gap: '1rem' }}>
                <span style={{ textAlign: 'left' }}>{s.title}</span>
                <span className="strong nowrap tabular">{cert.type === 'completion' ? creditLabel(s.creditHours, cert.unitLabel) : 'Attended'}</span>
              </div>
            ))}
          </div>

          {cert.type === 'completion' ? (
            <div className="stat" style={{ alignItems: 'center' }}>
              <span className="stat-value gold" style={{ fontSize: '2.4rem' }}>
                {creditLabel(cert.totalCreditHours, cert.unitLabel)}
              </span>
              <span className="stat-label">{ceu ? `${ceu} CEU equivalent · ` : ''}awarded</span>
            </div>
          ) : (
            <div className="stat" style={{ alignItems: 'center' }}>
              <span className="stat-value" style={{ fontSize: '1.8rem' }}>{cert.sessions.length} session{cert.sessions.length === 1 ? '' : 's'} attended</span>
              <span className="stat-label">Certificate of participation · no clock hours earned</span>
            </div>
          )}

          <div className="divider" style={{ width: '100%' }} />
          <p className="tiny faint" style={{ margin: 0, maxWidth: '52ch' }}>
            Issued by <strong className="strong" style={{ color: 'var(--ink)' }}>{cert.issuingBody}</strong>
            <br />Provider {cert.providerNumber} · Serial <span className="kbd">{cert.serial}</span> · Issued {formatDate(cert.issuedAt)}
          </p>
        </div>
      </div>

      <p className="tiny faint no-print" data-noprint style={{ textAlign: 'center' }}>
        Verifiable by serial against the issuing body’s records. Clock hours apply toward Cascadia educator license renewal.
      </p>
    </div>
  );
}
