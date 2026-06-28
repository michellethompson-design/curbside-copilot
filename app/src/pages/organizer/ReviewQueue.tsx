// AI first-pass review — the organizer's co-pilot.
//
// Each submission gets an auto-summary, fit + quality scores, duplicate /
// off-topic / missing-objective flags, and a suggested decision. The organizer
// accepts the suggestion in one click or overrides it — the override is recorded.

import { useMemo, useState } from 'react';
import type { AIFlag, Submission } from '../../data/types';
import { useStore } from '../../store/AppStore';
import { Avatar, ScoreMeter, StatusBadge, useToast, EmptyState } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { durationLabel } from '../../lib/format';

type Filter = 'queue' | 'accepted' | 'declined' | 'all';

const FLAG_META: Record<AIFlag['kind'], { label: string; icon: IconName }> = {
  duplicate: { label: 'Possible duplicate', icon: 'Copy' },
  off_topic: { label: 'Off-topic', icon: 'Alert' },
  missing_objectives: { label: 'Objectives needed', icon: 'ClipboardCheck' },
  length_mismatch: { label: 'Format / length', icon: 'Clock' },
  accessibility: { label: 'Accessibility', icon: 'Accessibility' },
};

export function ReviewQueue() {
  const { data, activeEvent, notifyAllDecided } = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('queue');
  const [anonymous, setAnonymous] = useState(false);

  const subs = useMemo(
    () => data.submissions.filter((s) => s.eventId === activeEvent.id && s.status !== 'draft'),
    [data.submissions, activeEvent.id],
  );

  const queue = subs.filter((s) => s.status === 'submitted' || s.status === 'under_review');
  const accepted = subs.filter((s) => s.status === 'accepted' || s.status === 'scheduled' || s.status === 'waitlisted');
  const declined = subs.filter((s) => s.status === 'declined');
  const shown = filter === 'queue' ? queue : filter === 'accepted' ? accepted : filter === 'declined' ? declined : subs;

  const aiAcceptCount = queue.filter((s) => s.aiReview?.suggestedDecision === 'accept').length;
  const unnotified = subs.filter((s) => s.organizerDecision && !s.organizerDecision.notifiedAt).length;

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'queue', label: 'Needs a decision', count: queue.length },
    { key: 'accepted', label: 'Accepted', count: accepted.length },
    { key: 'declined', label: 'Declined', count: declined.length },
    { key: 'all', label: 'All', count: subs.length },
  ];

  return (
    <div className="stack-lg">
      <div className="grid grid-4">
        <SummaryCard icon="ClipboardCheck" label="Awaiting decision" value={queue.length} tone="amber" />
        <SummaryCard icon="Sparkles" label="AI suggests accept" value={aiAcceptCount} tone="green" />
        <SummaryCard icon="CheckCircle" label="Accepted" value={accepted.length} tone="indigo" />
        <SummaryCard icon="Alert" label="Flags raised" value={queue.reduce((n, s) => n + (s.aiReview?.flags.length ?? 0), 0)} tone="coral" />
      </div>

      <div className="card card-quiet" style={{ padding: '0.8rem 1rem' }}>
        <p className="small" style={{ margin: 0 }}>
          <Icon.Sparkles size={15} style={{ color: 'var(--indigo)', verticalAlign: '-2px' }} />{' '}
          <strong className="strong">How this works:</strong> the AI does the cold reading — summarizing, scoring fit and quality,
          and flagging duplicates or off-topic pitches — so you spend your judgment on the close calls. You always decide.
        </p>
      </div>

      <div className="between wrap" style={{ gap: '0.75rem' }}>
        <div className="scroll-x">
          <div className="row" style={{ gap: '0.4rem', minWidth: 'max-content' }}>
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className="chip-toggle" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label} <span className="badge badge-plain tiny" style={{ padding: '0 0.4rem' }}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="row-wrap gap-sm">
          <button type="button" className="chip-toggle" aria-pressed={anonymous} onClick={() => setAnonymous((v) => !v)} title="Hide speaker identities while you evaluate, to reduce bias">
            <Icon.Eye size={15} /> Blind review {anonymous ? 'on' : 'off'}
          </button>
          {unnotified > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { const n = notifyAllDecided(); toast.push(`Sent ${n} decision letter${n === 1 ? '' : 's'} (mocked)`, 'Mail'); }}>
              <Icon.Mail size={15} /> Send {unnotified} decision letter{unnotified === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card"><EmptyState icon="CheckCircle" title="Nothing here">{filter === 'queue' ? 'Every submission has a decision. Nice work.' : 'No submissions in this view.'}</EmptyState></div>
      ) : (
        <div className="stack">
          {shown.map((s) => <ReviewCard key={s.id} submission={s} anonymous={anonymous} />)}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: IconName; label: string; value: number; tone: string }) {
  const I = Icon[icon];
  const color = `var(--${tone === 'green' ? 'green' : tone})`;
  return (
    <div className="card stack-sm" style={{ gap: '0.3rem' }}>
      <span className="row" style={{ color, justifyContent: 'space-between' }}><I size={20} /></span>
      <span className="stat-value" style={{ fontSize: '1.7rem' }}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function ReviewCard({ submission: s, anonymous }: { submission: Submission; anonymous: boolean }) {
  const { data, activeEvent, runAIReview, decideSubmission, notifyDecision } = useStore();
  const toast = useToast();
  const speaker = data.speakers.find((p) => p.id === s.speakerId);
  const [running, setRunning] = useState(false);
  const ai = s.aiReview;
  const related = ai?.flags.find((f) => f.relatedSubmissionId)?.relatedSubmissionId;
  const relatedSub = related ? data.submissions.find((x) => x.id === related) : undefined;

  function runAI() {
    setRunning(true);
    // brief delay so the "thinking" state is perceptible (respects reduced motion via CSS)
    window.setTimeout(() => {
      runAIReview(s.id);
      setRunning(false);
      toast.push('AI first-pass complete', 'Sparkles');
    }, 450);
  }

  function decide(d: 'accept' | 'waitlist' | 'decline') {
    decideSubmission(s.id, d);
    toast.push(d === 'accept' ? 'Accepted — schedule it on the agenda' : d === 'waitlist' ? 'Moved to waitlist' : 'Declined', d === 'accept' ? 'CheckCircle' : 'Check');
  }

  const decided = !!s.organizerDecision;
  const suggestion = ai?.suggestedDecision;

  return (
    <div className="card stack" style={{ borderLeft: `4px solid ${suggestion === 'accept' ? 'var(--green)' : suggestion === 'decline' ? 'var(--red)' : 'var(--amber)'}` }}>
      <div className="between wrap align-start" style={{ gap: '1rem' }}>
        <div className="stack-sm grow" style={{ gap: '0.4rem' }}>
          <div className="row-wrap gap-sm">
            <StatusBadge status={s.status} />
            <span className="tag">{s.track}</span>
            <span className="tag">{s.format} · {durationLabel(s.durationMinutes)}</span>
            {s.coSpeakers.length > 0 && <span className="tag">+{s.coSpeakers.length} co-speaker{s.coSpeakers.length > 1 ? 's' : ''}</span>}
          </div>
          <h3 className="serif" style={{ fontSize: '1.25rem' }}>{s.title}</h3>
          {speaker && (
            anonymous ? (
              <span className="row gap-sm small muted">
                <span className="avatar avatar-sm" style={{ background: 'var(--line-strong)' }} aria-hidden="true"><Icon.Eye size={14} /></span>
                <span className="faint">Speaker hidden · blind review</span>
              </span>
            ) : (
              <span className="row gap-sm small muted">
                <Avatar person={speaker} color={speaker.avatarColor} size="sm" /> {speaker.firstName} {speaker.lastName} · {speaker.org}
              </span>
            )
          )}
        </div>
      </div>

      {!ai ? (
        <div className="card card-quiet row between wrap" style={{ gap: '0.75rem' }}>
          <span className="small muted row gap-sm"><Icon.Sparkles size={16} style={{ color: 'var(--indigo)' }} /> No AI pass yet for this submission.</span>
          <button type="button" className="btn btn-ink" onClick={runAI} disabled={running}>
            {running ? <><span className="spin" /> Reading…</> : <><Icon.Sparkles size={16} /> Run AI first-pass</>}
          </button>
        </div>
      ) : (
        <div className="stack" style={{ background: 'var(--indigo-soft)', border: '1px solid var(--indigo-line)', borderRadius: 'var(--radius)', padding: '1rem' }}>
          <div className="between wrap" style={{ gap: '0.5rem' }}>
            <span className="row gap-sm strong" style={{ color: 'var(--indigo-deep)' }}><Icon.Sparkles size={16} /> AI first-pass</span>
            <span className={`badge ${suggestion === 'accept' ? 'badge-green' : suggestion === 'decline' ? 'badge-red' : 'badge-amber'}`}>
              Suggests: {suggestion === 'accept' ? 'Accept' : suggestion === 'decline' ? 'Decline' : 'Human review'}
            </span>
          </div>
          <p className="small" style={{ margin: 0, color: 'var(--ink)' }}>“{ai.summary}”</p>
          <div className="grid grid-2" style={{ gap: '1rem' }}>
            <ScoreMeter label="Fit to event" value={ai.fitScore} />
            <ScoreMeter label="Abstract quality" value={ai.qualityScore} />
          </div>
          {ai.flags.length > 0 && (
            <div className="stack-sm">
              {ai.flags.map((f, i) => {
                const meta = FLAG_META[f.kind];
                const FI = Icon[meta.icon];
                const tone = f.severity === 'high' ? 'badge-red' : f.severity === 'med' ? 'badge-amber' : 'badge';
                return (
                  <div className="flag-line" key={i}>
                    <span className={`badge ${tone}`} style={{ flex: 'none' }}><FI size={13} /> {meta.label}</span>
                    <span className="small" style={{ color: 'var(--ink)' }}>
                      {f.detail}
                      {f.relatedSubmissionId && relatedSub && <em className="faint"> · vs “{relatedSub.title}”</em>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="tiny faint" style={{ margin: 0 }}>{ai.rationale}</p>
        </div>
      )}

      {/* Abstract + objectives (progressive disclosure) */}
      <details>
        <summary className="small strong" style={{ cursor: 'pointer' }}>Read full abstract & objectives</summary>
        <div className="stack-sm mt-2">
          <p className="small" style={{ margin: 0 }}>{s.abstract}</p>
          {s.learningObjectives.filter(Boolean).length > 0 && (
            <>
              <span className="eyebrow">Learning objectives</span>
              <ul className="dot-list">{s.learningObjectives.filter(Boolean).map((o, i) => <li key={i} className="small">{o}</li>)}</ul>
            </>
          )}
          {activeEvent.customQuestions.length > 0 && (
            <>
              <span className="eyebrow">CFP answers</span>
              <div className="stack-sm">
                {activeEvent.customQuestions.map((q) => (
                  <span key={q.id} className="small"><strong className="strong">{q.label}</strong> — {s.customAnswers[q.id] || <span className="faint">blank</span>}</span>
                ))}
              </div>
            </>
          )}
          {s.pitch && <p className="tiny faint" style={{ margin: 0 }}><strong>Note to organizer:</strong> {s.pitch}</p>}
        </div>
      </details>

      {/* Decision */}
      <div className="row between wrap" style={{ gap: '0.75rem', borderTop: '1px solid var(--line)', paddingTop: '0.9rem' }}>
        {decided ? (
          <span className="small muted row gap-sm wrap">
            <Icon.Check size={15} style={{ color: 'var(--green)' }} />
            {s.organizerDecision!.decision === 'accept' ? 'Accepted' : s.organizerDecision!.decision === 'waitlist' ? 'Waitlisted' : 'Declined'} by {s.organizerDecision!.decidedBy}
            {s.organizerDecision!.overrodeAI && <span className="badge badge-coral badge-plain tiny">overrode AI</span>}
            {s.organizerDecision!.notifiedAt
              ? <span className="badge badge-green badge-plain tiny"><Icon.Mail size={11} /> letter sent</span>
              : <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 0.4rem', minHeight: 'auto' }} onClick={() => { notifyDecision(s.id); toast.push('Decision letter sent (mocked)', 'Mail'); }}><Icon.Mail size={13} /> Notify speaker</button>}
          </span>
        ) : (
          <span className="small faint">Your call:</span>
        )}
        <div className="row gap-sm">
          <button type="button" className={`btn btn-sm ${s.status === 'declined' ? 'btn-danger' : 'btn-outline'}`} onClick={() => decide('decline')}>Decline</button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => decide('waitlist')}>Waitlist</button>
          <button type="button" className={`btn btn-sm ${s.status === 'accepted' || s.status === 'scheduled' ? 'btn-ink' : 'btn-primary'}`} onClick={() => decide('accept')}>
            <Icon.Check size={15} /> Accept
          </button>
        </div>
      </div>
    </div>
  );
}
