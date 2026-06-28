// ─────────────────────────────────────────────────────────────────────────────
// Speaker submission — the neurodiverse-friendly showcase.
//
// One primary action per screen, five short chunked steps, a calm progress
// indicator (no ticking countdown), real autosave + resume, a reusable speaker
// profile so nothing is re-entered, full keyboard + screen-reader support, and a
// mobile-first layout. This is the on-ramp that wins the deal.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CURRENT_SPEAKER_ID } from '../data/seed';
import type { AudienceLevel, CFPQuestion, CoSpeaker, DeliveryMode, Event, SessionFormat, SpeakerProfile, Submission } from '../data/types';
import { Avatar, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { useStore } from '../store/AppStore';
import { fullName } from '../lib/format';

type StepKey = 'profile' | 'basics' | 'talk' | 'objectives' | 'questions' | 'review';
const STEP_LABEL: Record<StepKey, string> = {
  profile: 'Your profile',
  basics: 'The basics',
  talk: 'Your talk',
  objectives: 'Learning objectives',
  questions: 'A few event questions',
  review: 'Review & submit',
};

const FORMATS: { value: SessionFormat; label: string; hint: string }[] = [
  { value: 'workshop', label: 'Workshop', hint: 'Hands-on, participants practice' },
  { value: 'lecture', label: 'Talk', hint: 'You present, Q&A at the end' },
  { value: 'panel', label: 'Panel', hint: 'A moderated conversation' },
  { value: 'lightning', label: 'Lightning', hint: 'Short & punchy, ~15 min' },
];
const LEVELS: { value: AudienceLevel; label: string }[] = [
  { value: 'intro', label: 'New to this' },
  { value: 'intermediate', label: 'Some experience' },
  { value: 'advanced', label: 'Experienced' },
  { value: 'all', label: 'Everyone' },
];
const MODES: { value: DeliveryMode; label: string }[] = [
  { value: 'in_person', label: 'In person' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hybrid', label: 'Hybrid' },
];
const DURATIONS = [15, 45, 60, 90, 120];

export function Submit() {
  const { data, upsertDraft } = useStore();
  const { id } = useParams();
  const nav = useNavigate();

  const [draftId, setDraftId] = useState<string | null>(null);

  // Resolve an existing draft, or create a fresh one and put it in the URL so it
  // can be resumed later.
  useEffect(() => {
    if (id && data.submissions.some((s) => s.id === id)) {
      setDraftId(id);
      return;
    }
    if (!id) {
      const newId = upsertDraft({ speakerId: CURRENT_SPEAKER_ID, status: 'draft', draftStep: 0 });
      setDraftId(newId);
      nav(`/submit/${newId}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!draftId) {
    return (
      <div className="container-narrow"><div className="card">Preparing your submission…</div></div>
    );
  }
  return <SubmitFlow key={draftId} draftId={draftId} />;
}

function SubmitFlow({ draftId }: { draftId: string }) {
  const { data, activeEvent, upsertDraft, submitSubmission, updateSpeaker } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  {
    const submission = data.submissions.find((s) => s.id === draftId)!;
    const speaker = data.speakers.find((s) => s.id === submission.speakerId) ?? data.speakers.find((s) => s.id === CURRENT_SPEAKER_ID)!;

    // Steps are dynamic: the custom-questions step only appears when the
    // organizer added questions to this event's CFP.
    const stepKeys: StepKey[] = ['profile', 'basics', 'talk', 'objectives'];
    if (activeEvent.customQuestions.length > 0) stepKeys.push('questions');
    stepKeys.push('review');

    const [step, setStep] = useState(Math.min(submission.draftStep ?? 0, stepKeys.length - 1));
    const stepKey = stepKeys[step];
    const [form, setForm] = useState<Submission>(submission);
    const [saved, setSaved] = useState(true);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const headingRef = useRef<HTMLHeadingElement>(null);
    const saveTimer = useRef<number | undefined>(undefined);

    // Autosave: debounce writes to the store; reflect status in the live region.
    function patch(p: Partial<Submission>) {
      setForm((f) => ({ ...f, ...p }));
      setSaved(false);
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        upsertDraft({ id: draftId, ...p });
        setSaved(true);
      }, 500);
    }

    function persistNow(extra: Partial<Submission> = {}) {
      window.clearTimeout(saveTimer.current);
      upsertDraft({ ...form, id: draftId, ...extra });
      setSaved(true);
    }

    useEffect(() => {
      headingRef.current?.focus();
    }, [step]);

    function validate(key: StepKey): boolean {
      const e: Record<string, string> = {};
      if (key === 'basics') {
        if (!form.title.trim()) e.title = 'Add a working title so reviewers know your talk.';
        else if (form.title.trim().length < 6) e.title = 'A few more words makes a stronger title.';
      }
      if (key === 'talk') {
        const words = form.abstract.trim().split(/\s+/).filter(Boolean).length;
        if (words < 12) e.abstract = 'Tell us a little more — aim for two or three sentences.';
      }
      if (key === 'objectives') {
        if (form.learningObjectives.filter((o) => o.trim()).length < 1)
          e.objectives = 'Add at least one objective — this is what earns attendees their credit.';
      }
      if (key === 'questions') {
        for (const q of activeEvent.customQuestions) {
          if (q.required && !(form.customAnswers[q.id] ?? '').trim())
            e[`q_${q.id}`] = 'This question is required.';
        }
      }
      setErrors(e);
      return Object.keys(e).length === 0;
    }

    function goNext() {
      if (!validate(stepKey)) return;
      const next = Math.min(step + 1, stepKeys.length - 1);
      persistNow({ draftStep: next });
      setStep(next);
    }
    function goBack() {
      setErrors({});
      setStep((s) => Math.max(0, s - 1));
    }
    function saveAndExit() {
      persistNow({ draftStep: step });
      toast.push('Draft saved — resume anytime', 'Save');
      nav('/speaker');
    }
    function submit() {
      if (!validate('basics') || !validate('talk') || !validate('objectives') || !validate('questions')) {
        toast.push('A couple of fields still need attention', 'Alert');
        // jump to the first step with an error
        const order: StepKey[] = ['basics', 'talk', 'objectives', 'questions'];
        const firstBad = order.find((k) => !validate(k));
        if (firstBad) setStep(stepKeys.indexOf(firstBad));
        return;
      }
      persistNow();
      submitSubmission(draftId);
      toast.push('Submitted! The organizer has it now.', 'CheckCircle');
      nav('/speaker');
    }

    const pct = Math.round(((step + 1) / stepKeys.length) * 100);
    const minutesLeft = Math.max(1, stepKeys.length - 1 - step);

    return (
      <div className="container-narrow stack-lg">
        {/* calm progress header */}
        <div className="stack" data-nonessential>
          <div className="between wrap">
            <div className="stack-sm" style={{ gap: '0.2rem' }}>
              <span className="eyebrow">Submit to {activeEvent.name}</span>
              <span className="small muted">Step {step + 1} of {stepKeys.length} · {STEP_LABEL[stepKey]}</span>
            </div>
            <span className="autosave" aria-live="polite">
              {saved ? (<><Icon.Check size={15} /> Saved</>) : (<><span className="spin" style={{ width: 13, height: 13 }} /> Saving…</>)}
            </span>
          </div>
          <div className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          <div className="row between tiny faint">
            <span className="row" style={{ gap: '0.4rem' }}><Icon.Clock size={13} /> About {minutesLeft} min left — no rush, your work is saved</span>
          </div>
        </div>

        <div className="card card-lg stack-lg">
          <h1 ref={headingRef} tabIndex={-1} data-focus-silent style={{ fontSize: '1.7rem' }}>
            {STEP_LABEL[stepKey]}
          </h1>

          {stepKey === 'profile' && (
            <ProfileStep speaker={speaker} onSave={(p) => updateSpeaker(speaker.id, p)} />
          )}

          {stepKey === 'basics' && (
            <div className="stack-lg">
              <Field label="Working title" required hint="You can polish it later." error={errors.title}>
                <input
                  className="input" autoFocus value={form.title}
                  aria-invalid={!!errors.title} aria-describedby="title-hint"
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="e.g. Keeping Them in the Room: Inclusive Intro CS"
                />
              </Field>
              <RadioCards
                legend="What kind of session?" value={form.format}
                options={FORMATS} onChange={(v) => patch({ format: v as SessionFormat })}
              />
              <div className="grid grid-2">
                <Field label="Track" hint="Where it fits in the program.">
                  <select className="select" value={form.track} onChange={(e) => patch({ track: e.target.value })}>
                    {activeEvent.tracks.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Length">
                  <select className="select" value={form.durationMinutes} onChange={(e) => patch({ durationMinutes: Number(e.target.value) })}>
                    {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
                  </select>
                </Field>
              </div>
              <ChipChoice legend="Who is it for?" value={form.level} options={LEVELS} onChange={(v) => patch({ level: v as AudienceLevel })} />
              <ChipChoice legend="How will you deliver it?" value={form.mode} options={MODES} onChange={(v) => patch({ mode: v as DeliveryMode })} />
              <CoSpeakerEditor coSpeakers={form.coSpeakers} onChange={(coSpeakers) => patch({ coSpeakers })} />
            </div>
          )}

          {stepKey === 'talk' && (
            <div className="stack-lg">
              <Field
                label="Describe your talk" required error={errors.abstract}
                hint="This is what attendees read when choosing sessions. Two or three plain-language sentences is plenty."
              >
                <textarea
                  className="textarea" autoFocus value={form.abstract} rows={6}
                  aria-invalid={!!errors.abstract}
                  onChange={(e) => patch({ abstract: e.target.value })}
                  placeholder="What will people walk away able to do?"
                />
                <div className="input-counter">{form.abstract.trim().split(/\s+/).filter(Boolean).length} words</div>
              </Field>
              <TagEditor tags={form.tags} onChange={(tags) => patch({ tags })} />
              <Field label="Private note to the organizer" hint="Optional — only the review team sees this.">
                <textarea className="textarea" value={form.pitch} rows={2} onChange={(e) => patch({ pitch: e.target.value })} placeholder="Anything that helps them place your session." />
              </Field>
            </div>
          )}

          {stepKey === 'objectives' && (
            <ObjectivesStep
              objectives={form.learningObjectives}
              error={errors.objectives}
              onChange={(learningObjectives) => patch({ learningObjectives })}
            />
          )}

          {stepKey === 'questions' && (
            <CustomQuestionsStep
              questions={activeEvent.customQuestions}
              answers={form.customAnswers}
              errors={errors}
              onChange={(customAnswers) => patch({ customAnswers })}
            />
          )}

          {stepKey === 'review' && (
            <ReviewStep
              form={form}
              event={activeEvent}
              speakerName={fullName(speaker)}
              onJump={(key) => setStep(stepKeys.indexOf(key))}
            />
          )}

          {/* one clear primary action per screen */}
          <div className="row between wrap" style={{ gap: '0.75rem', borderTop: '1px solid var(--line)', paddingTop: '1.1rem' }}>
            <div className="row gap-sm">
              {step > 0 && (
                <button type="button" className="btn btn-outline" onClick={goBack}>
                  <Icon.ArrowLeft size={16} /> Back
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={saveAndExit}>
                <Icon.Save size={16} /> Save & exit
              </button>
            </div>
            {step < stepKeys.length - 1 ? (
              <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
                Continue <Icon.Arrow size={18} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-lg" onClick={submit}>
                <Icon.Check size={18} /> Submit my talk
              </button>
            )}
          </div>
        </div>

        <p className="tiny faint" style={{ textAlign: 'center' }} data-nonessential>
          Every field is keyboard-navigable and screen-reader labeled. Need a calmer screen? Turn on
          <strong> Focus mode</strong> from the Accessibility menu.
        </p>
      </div>
    );
  }
}

// ── Reusable field wrapper (label + hint + error, all wired by id) ──────────────
function Field({
  label, required, hint, error, children,
}: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  const hintId = hint ? `${label}-hint`.replace(/\s+/g, '-').toLowerCase() : undefined;
  return (
    <div className="field">
      <label className="field-label">
        {label} {required && <span className="field-req" title="Required">*</span>}
      </label>
      {hint && <span className="field-hint" id={hintId}>{hint}</span>}
      {children}
      {error && <span className="field-error" role="alert"><Icon.Alert size={14} /> {error}</span>}
    </div>
  );
}

function RadioCards({
  legend, value, options, onChange,
}: { legend: string; value: string; options: { value: string; label: string; hint: string }[]; onChange: (v: string) => void }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field-label" style={{ marginBottom: '0.5rem' }}>{legend}</legend>
      <div className="grid grid-2" style={{ gap: '0.6rem' }}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <label key={o.value} className="card card-hover" style={{ padding: '0.85rem', cursor: 'pointer', borderColor: active ? 'var(--indigo)' : undefined, background: active ? 'var(--indigo-soft)' : undefined, display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <input type="radio" name={legend} checked={active} onChange={() => onChange(o.value)} style={{ marginTop: '0.2rem', accentColor: 'var(--indigo)' }} />
              <span className="stack-sm" style={{ gap: '0.1rem' }}>
                <span className="strong">{o.label}</span>
                <span className="tiny muted">{o.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ChipChoice({
  legend, value, options, onChange,
}: { legend: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field-label" style={{ marginBottom: '0.5rem' }}>{legend}</legend>
      <div className="pill-row">
        {options.map((o) => (
          <button key={o.value} type="button" className="chip-toggle" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {value === o.value && <Icon.Check size={15} />}{o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  function add() {
    const v = input.trim().toLowerCase();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  }
  return (
    <Field label="Topic tags" hint="Press Enter to add. Helps reviewers and attendees find your session.">
      <div className="pill-row" style={{ marginBottom: tags.length ? '0.4rem' : 0 }}>
        {tags.map((t) => (
          <span key={t} className="tag">
            {t}
            <button type="button" className="btn-ghost" aria-label={`Remove ${t}`} style={{ marginLeft: 4, padding: 0, minHeight: 'auto', background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }} onClick={() => onChange(tags.filter((x) => x !== t))}>×</button>
          </span>
        ))}
      </div>
      <div className="row gap-sm">
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="e.g. equity" />
        <button type="button" className="btn btn-outline" onClick={add}>Add</button>
      </div>
    </Field>
  );
}

function ObjectivesStep({ objectives, error, onChange }: { objectives: string[]; error?: string; onChange: (o: string[]) => void }) {
  const list = objectives.length ? objectives : [''];
  function setAt(i: number, v: string) {
    const next = [...list];
    next[i] = v;
    onChange(next.filter((x, idx) => x.trim() || idx === 0));
  }
  return (
    <div className="stack-lg">
      <div className="card card-quiet" style={{ padding: '0.9rem 1.1rem' }}>
        <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
          <Icon.Award size={18} style={{ color: 'var(--gold)', marginTop: 2 }} />
          <p className="small" style={{ margin: 0 }}>
            <strong className="strong">Why this matters:</strong> objectives become the line items on every
            attendee’s continuing-education certificate. Finish each sentence: “After this session, you’ll be able to…”
          </p>
        </div>
      </div>
      <Field label="Learning objectives" required error={error} hint="One or two is plenty. Start with a verb — explain, design, run, plan.">
        <div className="stack-sm">
          {list.map((o, i) => (
            <div className="row gap-sm" key={i}>
              <span className="badge badge-gold badge-plain" aria-hidden="true">{i + 1}</span>
              <input
                className="input" value={o} autoFocus={i === 0}
                aria-label={`Objective ${i + 1}`}
                placeholder="After this session, you’ll be able to…"
                onChange={(e) => setAt(i, e.target.value)}
              />
              {list.length > 1 && (
                <button type="button" className="btn btn-outline btn-icon" aria-label={`Remove objective ${i + 1}`} onClick={() => onChange(list.filter((_, idx) => idx !== i))}>
                  <Icon.Close size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {list.length < 4 && (
          <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => onChange([...list, ''])}>
            <Icon.Plus size={15} /> Add another
          </button>
        )}
      </Field>
    </div>
  );
}

function ProfileStep({ speaker, onSave }: { speaker: SpeakerProfile; onSave: (p: Partial<SpeakerProfile>) => void }) {
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState(speaker.headline);
  const [bio, setBio] = useState(speaker.bio);
  return (
    <div className="stack-lg">
      <div className="card card-quiet" style={{ padding: '0.9rem 1.1rem' }}>
        <div className="row gap-sm">
          <Icon.Sparkles size={18} style={{ color: 'var(--indigo)' }} />
          <p className="small" style={{ margin: 0 }}>
            <strong className="strong">Pulled from your speaker profile</strong> — you entered this once, so there’s nothing to re-type.
          </p>
        </div>
      </div>

      <div className="row align-start gap-sm" style={{ gap: '1rem' }}>
        <Avatar person={speaker} color={speaker.avatarColor} size="lg" />
        <div className="stack-sm grow" style={{ gap: '0.3rem' }}>
          <strong style={{ fontSize: '1.15rem' }}>{speaker.firstName} {speaker.lastName} {speaker.pronouns && <span className="tiny faint">({speaker.pronouns})</span>}</strong>
          {!editing ? (
            <>
              <span className="muted small">{speaker.headline}</span>
              <span className="tiny faint">{speaker.role} · {speaker.org} · {speaker.location}</span>
            </>
          ) : (
            <div className="stack-sm" style={{ marginTop: '0.4rem' }}>
              <Field label="Headline"><input className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} /></Field>
              <Field label="Short bio"><textarea className="textarea" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
            </div>
          )}
        </div>
      </div>

      {!editing && (
        <p className="small" style={{ borderLeft: '3px solid var(--line-strong)', paddingLeft: '0.9rem', margin: 0 }}>{speaker.bio}</p>
      )}

      <div className="pill-row">{speaker.expertise.map((x: string) => <span key={x} className="tag">{x}</span>)}</div>

      <div className="row gap-sm">
        {!editing ? (
          <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}>Edit my profile</button>
        ) : (
          <>
            <button type="button" className="btn btn-ink" onClick={() => { onSave({ headline, bio }); setEditing(false); }}>Save profile</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setHeadline(speaker.headline); setBio(speaker.bio); setEditing(false); }}>Cancel</button>
          </>
        )}
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>Updating your profile updates it everywhere — across this and every future submission.</p>
    </div>
  );
}

function CoSpeakerEditor({ coSpeakers, onChange }: { coSpeakers: CoSpeaker[]; onChange: (c: CoSpeaker[]) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  function add() {
    if (!name.trim()) return;
    onChange([...coSpeakers, { name: name.trim(), email: email.trim() }]);
    setName(''); setEmail('');
  }
  return (
    <Field label="Co-speakers" hint="Optional. Add anyone presenting with you — they’ll be invited to confirm.">
      {coSpeakers.length > 0 && (
        <div className="stack-sm" style={{ marginBottom: '0.4rem' }}>
          {coSpeakers.map((c, i) => (
            <div className="card card-quiet row between" key={i} style={{ padding: '0.5rem 0.8rem' }}>
              <span className="small"><strong className="strong">{c.name}</strong> {c.email && <span className="faint">· {c.email}</span>}</span>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${c.name}`} onClick={() => onChange(coSpeakers.filter((_, idx) => idx !== i))}><Icon.Close size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="row-wrap gap-sm">
        <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Name" aria-label="Co-speaker name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Email (optional)" aria-label="Co-speaker email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn btn-outline" onClick={add}><Icon.Plus size={15} /> Add</button>
      </div>
    </Field>
  );
}

function CustomQuestionsStep({
  questions, answers, errors, onChange,
}: { questions: CFPQuestion[]; answers: Record<string, string>; errors: Record<string, string>; onChange: (a: Record<string, string>) => void }) {
  function set(id: string, v: string) {
    onChange({ ...answers, [id]: v });
  }
  return (
    <div className="stack-lg">
      <div className="card card-quiet" style={{ padding: '0.9rem 1.1rem' }}>
        <p className="small" style={{ margin: 0 }}>
          <strong className="strong">A few questions from the organizers.</strong> These are specific to this event.
        </p>
      </div>
      {questions.map((q) => {
        const err = errors[`q_${q.id}`];
        const val = answers[q.id] ?? '';
        return (
          <Field key={q.id} label={q.label} required={q.required} hint={q.hint} error={err}>
            {q.type === 'short' && (
              <input className="input" value={val} aria-invalid={!!err} onChange={(e) => set(q.id, e.target.value)} />
            )}
            {q.type === 'long' && (
              <textarea className="textarea" rows={3} value={val} aria-invalid={!!err} onChange={(e) => set(q.id, e.target.value)} />
            )}
            {q.type === 'select' && (
              <select className="select" value={val} aria-invalid={!!err} onChange={(e) => set(q.id, e.target.value)}>
                <option value="">Choose…</option>
                {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {q.type === 'checkbox' && (
              <div className="pill-row">
                {['Yes', 'No'].map((opt) => (
                  <button key={opt} type="button" className="chip-toggle" aria-pressed={val === opt} onClick={() => set(q.id, opt)}>
                    {val === opt && <Icon.Check size={15} />}{opt}
                  </button>
                ))}
              </div>
            )}
          </Field>
        );
      })}
    </div>
  );
}

function ReviewStep({ form, event, speakerName, onJump }: { form: Submission; event: Event; speakerName: string; onJump: (key: StepKey) => void }) {
  const rows: { label: string; value: React.ReactNode; key: StepKey }[] = [
    { label: 'Title', value: form.title || <span className="faint">— not set —</span>, key: 'basics' },
    { label: 'Format', value: `${form.format} · ${form.durationMinutes} min · ${form.mode.replace('_', ' ')}`, key: 'basics' },
    { label: 'Track', value: form.track, key: 'basics' },
    ...(form.coSpeakers.length ? [{ label: 'Co-speakers', value: form.coSpeakers.map((c) => c.name).join(', '), key: 'basics' as StepKey }] : []),
    { label: 'Description', value: form.abstract || <span className="faint">— not set —</span>, key: 'talk' },
    { label: 'Objectives', value: form.learningObjectives.filter(Boolean).length ? (<ul className="dot-list">{form.learningObjectives.filter(Boolean).map((o, i) => <li key={i}>{o}</li>)}</ul>) : <span className="faint">— none —</span>, key: 'objectives' },
    ...event.customQuestions.map((q) => ({
      label: q.label,
      value: form.customAnswers[q.id] ? form.customAnswers[q.id] : <span className="faint">— blank —</span>,
      key: 'questions' as StepKey,
    })),
  ];
  return (
    <div className="stack-lg">
      <div className="card card-quiet" style={{ padding: '0.9rem 1.1rem' }}>
        <p className="small" style={{ margin: 0 }}>Presenting as <strong className="strong">{speakerName}</strong>. Review below, jump back to any step to change something, then submit.</p>
      </div>
      <div className="stack">
        {rows.map((r, i) => (
          <div className="row between align-start" key={i} style={{ gap: '1rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.7rem' }}>
            <div className="stack-sm grow" style={{ gap: '0.2rem' }}>
              <span className="eyebrow">{r.label}</span>
              <div className="small" style={{ color: 'var(--ink)' }}>{r.value}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onJump(r.key)}>Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
