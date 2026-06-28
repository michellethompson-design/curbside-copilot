// Speaker portal — "My sessions". Reusable profile up top, every submission with
// its live status, and one-tap resume for the autosaved draft.

import { Link } from 'react-router-dom';
import { CURRENT_SPEAKER_ID } from '../data/seed';
import { useStore } from '../store/AppStore';
import { Avatar, StatusBadge, SectionHead, EmptyState } from '../components/ui';
import { Icon } from '../components/icons';
import { clock, durationLabel, formatDate } from '../lib/format';

export function SpeakerPortal() {
  const { data, activeEvent } = useStore();
  const speaker = data.speakers.find((s) => s.id === CURRENT_SPEAKER_ID)!;
  const mine = data.submissions
    .filter((s) => s.speakerId === speaker.id)
    .sort((a, b) => (a.status === 'draft' ? -1 : 0) - (b.status === 'draft' ? -1 : 0));

  function slotFor(submissionId: string) {
    return data.agenda.find((sl) => sl.submissionId === submissionId);
  }

  return (
    <div className="container stack-lg">
      {/* Profile card */}
      <div className="card card-lg stack">
        <div className="row align-start" style={{ gap: '1.1rem' }}>
          <Avatar person={speaker} color={speaker.avatarColor} size="lg" />
          <div className="stack-sm grow" style={{ gap: '0.25rem' }}>
            <div className="between wrap">
              <h1 style={{ fontSize: '1.7rem' }}>{speaker.firstName} {speaker.lastName}</h1>
              <Link to="/submit" className="btn btn-primary"><Icon.Plus size={16} /> Submit another talk</Link>
            </div>
            <span className="muted">{speaker.headline}</span>
            <span className="tiny faint row-wrap">
              <span className="row" style={{ gap: '0.3rem' }}><Icon.Building size={13} /> {speaker.org}</span>
              <span className="row" style={{ gap: '0.3rem' }}><Icon.Pin size={13} /> {speaker.location}</span>
              <span className="row" style={{ gap: '0.3rem' }}><Icon.Mail size={13} /> {speaker.email}</span>
            </span>
          </div>
        </div>
        <p className="small" style={{ margin: 0 }}>{speaker.bio}</p>
        <div className="pill-row">{speaker.expertise.map((x) => <span key={x} className="tag">{x}</span>)}</div>
        {speaker.accessNeeds && (
          <div className="card card-quiet" style={{ padding: '0.7rem 0.9rem' }}>
            <span className="row gap-sm small"><Icon.Accessibility size={16} style={{ color: 'var(--indigo)' }} /> <span><strong className="strong">Access note for organizers:</strong> {speaker.accessNeeds}</span></span>
          </div>
        )}
      </div>

      <SectionHead eyebrow={`${activeEvent.name} · ${activeEvent.edition}`} title="My sessions">
        Your work autosaves as you go. Pick up a draft exactly where you left off.
      </SectionHead>

      {mine.length === 0 ? (
        <div className="card"><EmptyState icon="Mic" title="No submissions yet">Start your first one — it only takes a few minutes.</EmptyState></div>
      ) : (
        <div className="stack">
          {mine.map((s) => {
            const slot = slotFor(s.id);
            const isDraft = s.status === 'draft';
            return (
              <div className={`card${isDraft ? '' : ' card-hover'}`} key={s.id} style={isDraft ? { borderStyle: 'dashed', borderColor: 'var(--line-strong)' } : undefined}>
                <div className="between wrap align-start" style={{ gap: '1rem' }}>
                  <div className="stack-sm grow" style={{ gap: '0.35rem' }}>
                    <div className="row-wrap gap-sm">
                      <StatusBadge status={s.status} />
                      <span className="tag">{s.track}</span>
                      <span className="tag">{s.format} · {durationLabel(s.durationMinutes)}</span>
                    </div>
                    <h3 className="serif" style={{ fontSize: '1.2rem' }}>{s.title || <span className="faint">Untitled draft</span>}</h3>
                    {s.abstract && <p className="small" style={{ margin: 0 }}>{s.abstract.length > 180 ? `${s.abstract.slice(0, 180)}…` : s.abstract}</p>}
                    {slot && (
                      <span className="row gap-sm small" style={{ color: 'var(--indigo)' }}>
                        <Icon.Calendar size={15} /> {formatDate(slot.day, { weekday: 'long', month: 'short', day: 'numeric' })} · {clock(slot.startMinutes)}–{clock(slot.endMinutes)} · {slot.room}
                      </span>
                    )}
                  </div>
                  <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
                    {isDraft ? (
                      <Link to={`/submit/${s.id}`} className="btn btn-primary"><Icon.Arrow size={16} /> Resume draft</Link>
                    ) : (
                      <Link to={`/submit/${s.id}`} className="btn btn-outline">View / edit</Link>
                    )}
                  </div>
                </div>

                {/* Show the speaker their own AI snapshot once decided — transparency */}
                {s.aiReview && (s.status === 'accepted' || s.status === 'scheduled') && (
                  <div className="card card-quiet mt-2" style={{ padding: '0.7rem 0.9rem' }}>
                    <span className="small row gap-sm"><Icon.CheckCircle size={16} style={{ color: 'var(--green)' }} /> Accepted into the program. Thanks for submitting!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
