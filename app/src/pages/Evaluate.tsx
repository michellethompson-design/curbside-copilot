// Session evaluation — a real, attendee-facing form. Completing it satisfies the
// credit rule's evaluation requirement (releasing pending credit) and feeds the
// session's average rating shown to organizers.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SessionEvaluation } from '../data/types';
import { useStore } from '../store/AppStore';
import { useToast, EmptyState } from '../components/ui';
import { Icon } from '../components/icons';
import { clock, fullName } from '../lib/format';

const PACING: { value: SessionEvaluation['pacing']; label: string }[] = [
  { value: 'too_slow', label: 'A bit slow' },
  { value: 'just_right', label: 'Just right' },
  { value: 'too_fast', label: 'A bit fast' },
];

export function Evaluate() {
  const { attendeeId, slotId } = useParams();
  const { data, submitEvaluation } = useStore();
  const toast = useToast();
  const nav = useNavigate();

  const attendee = data.attendees.find((a) => a.id === attendeeId);
  const slot = data.agenda.find((s) => s.id === slotId);
  const sub = slot?.submissionId ? data.submissions.find((x) => x.id === slot.submissionId) : undefined;
  const existing = data.attendance.find((a) => a.attendeeId === attendeeId && a.slotId === slotId)?.evaluation;

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [pacing, setPacing] = useState<SessionEvaluation['pacing']>(existing?.pacing ?? 'just_right');
  const [applicable, setApplicable] = useState<boolean | null>(existing ? existing.applicable : null);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [done, setDone] = useState(false);

  if (!attendee || !slot) {
    return (
      <div className="container-narrow"><div className="card card-lg">
        <EmptyState icon="ClipboardCheck" title="Evaluation link not found">Check the session and attendee, or head back.</EmptyState>
      </div></div>
    );
  }

  const title = sub?.title ?? slot.title;
  const valid = rating > 0 && applicable !== null;

  function submit() {
    if (!valid) return;
    submitEvaluation(attendee!.id, slot!.id, {
      rating,
      pacing,
      applicable: !!applicable,
      comment: comment.trim() || undefined,
      submittedAt: new Date().toISOString(),
    });
    setDone(true);
    toast.push('Thanks — evaluation recorded', 'CheckCircle');
  }

  if (done) {
    return (
      <div className="container-narrow">
        <div className="card card-lg stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="cert-seal" style={{ width: 64, height: 64 }}><Icon.Check size={30} /></div>
          <h1 style={{ fontSize: '1.6rem' }}>Thank you!</h1>
          <p>Your feedback on <strong className="strong">{title}</strong> is in, and your clock hours for this session are now confirmed.</p>
          <div className="row gap-sm">
            <Link to="/kiosk" className="btn btn-primary"><Icon.ClipboardCheck size={16} /> Back to check-in</Link>
            <Link to="/organizer/credits" className="btn btn-outline">View my credit</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-narrow stack-lg">
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => nav(-1)} data-nonessential>
        <Icon.ArrowLeft size={16} /> Back
      </button>
      <div className="card card-lg stack-lg">
        <div className="stack-sm">
          <span className="eyebrow">Session evaluation</span>
          <h1 style={{ fontSize: '1.6rem' }}>{title}</h1>
          <span className="tiny faint">{clock(slot.startMinutes)}–{clock(slot.endMinutes)} · {slot.room} · for {fullName(attendee)}</span>
        </div>

        {/* rating */}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: '0.5rem' }}>How would you rate this session? <span className="field-req">*</span></legend>
          <div className="row gap-sm" role="radiogroup" aria-label="Overall rating, 1 to 5 stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className="btn btn-icon"
                style={{ background: 'transparent', color: (hover || rating) >= n ? 'var(--gold)' : 'var(--line-strong)', border: 0, padding: '0.2rem' }}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
              >
                <Icon.Star size={34} />
              </button>
            ))}
            <span className="small muted" style={{ marginLeft: '0.5rem' }}>{rating ? `${rating}/5` : 'Tap a star'}</span>
          </div>
        </fieldset>

        {/* pacing */}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: '0.5rem' }}>How was the pacing?</legend>
          <div className="pill-row">
            {PACING.map((p) => (
              <button key={p.value} type="button" className="chip-toggle" aria-pressed={pacing === p.value} onClick={() => setPacing(p.value)}>
                {pacing === p.value && <Icon.Check size={15} />}{p.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* applicable */}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: '0.5rem' }}>Can you use this in your classroom? <span className="field-req">*</span></legend>
          <div className="pill-row">
            {[{ v: true, l: 'Yes, right away' }, { v: false, l: 'Not really' }].map((o) => (
              <button key={String(o.v)} type="button" className="chip-toggle" aria-pressed={applicable === o.v} onClick={() => setApplicable(o.v)}>
                {applicable === o.v && <Icon.Check size={15} />}{o.l}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="field-label" htmlFor="eval-comment">Anything else? (optional)</label>
          <textarea id="eval-comment" className="textarea" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="One thing that worked, one thing to improve." />
        </div>

        <div className="row between wrap" style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
          <span className="tiny faint row gap-sm"><Icon.Award size={14} style={{ color: 'var(--gold)' }} /> Completing this confirms your clock hours for the session.</span>
          <button type="button" className="btn btn-primary btn-lg" disabled={!valid} onClick={submit}>
            <Icon.Check size={18} /> Submit evaluation
          </button>
        </div>
      </div>
    </div>
  );
}
