// CFP setup — the organizer authors the call for papers: the public details, the
// tracks and rooms, the credit rule, the open/close window, and any custom
// questions added to the submission form. This is the on-ramp Sessionize is known
// for ("a call for speakers in minutes"), now on our side of the lifecycle.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CFPQuestion, CFPQuestionType, DeliveryMode, Event } from '../../data/types';
import { useStore } from '../../store/AppStore';
import { SectionHead, useToast } from '../../components/ui';
import { Icon } from '../../components/icons';
import { makeId } from '../../lib/format';

const MODES: DeliveryMode[] = ['in_person', 'virtual', 'hybrid'];
const QTYPES: { value: CFPQuestionType; label: string }[] = [
  { value: 'short', label: 'Short text' },
  { value: 'long', label: 'Long text' },
  { value: 'select', label: 'Choose one' },
  { value: 'checkbox', label: 'Yes / no' },
];

export function CFPSetup() {
  const { data, activeEvent, updateEvent } = useStore();
  const toast = useToast();
  const [f, setF] = useState<Event>(activeEvent);
  const dirty = JSON.stringify(f) !== JSON.stringify(activeEvent);

  // keep local form in sync if the active event switches under us
  if (f.id !== activeEvent.id) setF(activeEvent);

  function set<K extends keyof Event>(key: K, value: Event[K]) {
    setF((p) => ({ ...p, [key]: value }));
  }
  function save() {
    updateEvent(f.id, f);
    toast.push('CFP saved', 'Save');
  }

  // questions
  function addQuestion() {
    set('customQuestions', [...f.customQuestions, { id: makeId('q'), label: '', type: 'short', required: false }]);
  }
  function updateQuestion(id: string, patch: Partial<CFPQuestion>) {
    set('customQuestions', f.customQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function removeQuestion(id: string) {
    set('customQuestions', f.customQuestions.filter((q) => q.id !== id));
  }

  const cfpOpen = activeEvent.status === 'cfp_open' || activeEvent.status === 'live';

  return (
    <div className="stack-lg">
      <SectionHead eyebrow="Step 1 · The call for papers" title="CFP setup"
        action={
          <div className="row gap-sm">
            <Link to="/submit" className="btn btn-outline btn-sm" target="_blank"><Icon.Eye size={15} /> Preview form</Link>
            <button type="button" className="btn btn-primary" disabled={!dirty} onClick={save}>
              <Icon.Save size={16} /> {dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        }
      >
        Everything here shapes what speakers see. Add custom questions and they appear in the submission flow instantly.
      </SectionHead>

      {/* status + share link */}
      <div className="card card-gold row between wrap" style={{ gap: '0.75rem' }}>
        <span className="row gap-sm">
          <Icon.Mic size={20} style={{ color: 'var(--gold)' }} />
          <span className="stack-sm" style={{ gap: 0 }}>
            <strong>{cfpOpen ? 'Call for papers is open' : 'Call for papers is not open yet'}</strong>
            <span className="tiny faint">Closes {f.cfpCloseDate || '—'} · share the link below with prospective speakers</span>
          </span>
        </span>
        <div className="row gap-sm">
          <code className="kbd">lectern.app/#/submit</code>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard?.writeText('https://lectern.app/#/submit'); toast.push('Submission link copied', 'Copy'); }}>
            <Icon.Copy size={14} /> Copy link
          </button>
        </div>
      </div>

      <div className="grid grid-side">
        {/* Public details */}
        <div className="card stack">
          <h3 className="serif" style={{ fontSize: '1.15rem' }}>Public details</h3>
          <TextRow label="Event name" value={f.name} onChange={(v) => set('name', v)} />
          <div className="grid grid-2">
            <TextRow label="Edition" value={f.edition} onChange={(v) => set('edition', v)} placeholder="Spring 2026" />
            <div className="field">
              <label className="field-label" htmlFor="cfp-mode">Delivery</label>
              <select id="cfp-mode" className="select" value={f.mode} onChange={(e) => set('mode', e.target.value as DeliveryMode)}>
                {MODES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <TextRow label="Tagline" value={f.tagline} onChange={(v) => set('tagline', v)} />
          <div className="field">
            <label className="field-label" htmlFor="cfp-desc">Description</label>
            <textarea id="cfp-desc" className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} />
          </div>
          <TextRow label="Venue" value={f.venue} onChange={(v) => set('venue', v)} />
          <div className="grid grid-2">
            <DateRow label="Event start" value={f.startDate} onChange={(v) => set('startDate', v)} />
            <DateRow label="Event end" value={f.endDate} onChange={(v) => set('endDate', v)} />
            <DateRow label="CFP opens" value={f.cfpOpenDate} onChange={(v) => set('cfpOpenDate', v)} />
            <DateRow label="CFP closes" value={f.cfpCloseDate} onChange={(v) => set('cfpCloseDate', v)} />
          </div>
        </div>

        {/* Program + credit */}
        <div className="stack-lg">
          <div className="card stack">
            <h3 className="serif" style={{ fontSize: '1.15rem' }}>Credit</h3>
            <div className="field">
              <label className="field-label" htmlFor="cfp-rule">Credit rule applied to this event</label>
              <select id="cfp-rule" className="select" value={f.creditRuleId} onChange={(e) => set('creditRuleId', e.target.value)}>
                {data.creditRules.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.unitLabel})</option>)}
              </select>
              <span className="field-hint">{data.creditRules.find((r) => r.id === f.creditRuleId)?.notes}</span>
            </div>
          </div>
          <ListEditor label="Tracks" items={f.tracks} onChange={(v) => set('tracks', v)} placeholder="Add a track" />
          <ListEditor label="Rooms" items={f.rooms} onChange={(v) => set('rooms', v)} placeholder="Add a room" />
        </div>
      </div>

      {/* Custom questions */}
      <div className="card stack">
        <div className="between">
          <div className="stack-sm" style={{ gap: 0 }}>
            <h3 className="serif" style={{ fontSize: '1.15rem' }}>Custom submission questions</h3>
            <span className="tiny faint">These appear as an extra step in the speaker’s submission flow.</span>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={addQuestion}><Icon.Plus size={15} /> Add question</button>
        </div>
        {f.customQuestions.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>No custom questions. Speakers will just complete the standard fields.</p>
        ) : (
          <div className="stack">
            {f.customQuestions.map((q, i) => (
              <div className="card card-quiet stack-sm" key={q.id}>
                <div className="row between">
                  <span className="badge badge-indigo badge-plain tiny">Question {i + 1}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeQuestion(q.id)} aria-label={`Remove question ${i + 1}`}><Icon.Close size={15} /> Remove</button>
                </div>
                <div className="field">
                  <label className="field-label sr-only" htmlFor={`q-label-${q.id}`}>Question text</label>
                  <input id={`q-label-${q.id}`} className="input" placeholder="Question text" value={q.label} onChange={(e) => updateQuestion(q.id, { label: e.target.value })} />
                </div>
                <div className="row-wrap gap-sm">
                  <select className="select" style={{ width: 'auto' }} aria-label="Answer type" value={q.type} onChange={(e) => updateQuestion(q.id, { type: e.target.value as CFPQuestionType })}>
                    {QTYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label className={`chip-toggle${q.required ? ' is-on' : ''}`} style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} style={{ accentColor: 'var(--indigo)' }} />
                    Required
                  </label>
                  {q.type === 'select' && (
                    <input
                      className="input" style={{ flex: 1, minWidth: 200 }}
                      placeholder="Options, comma-separated"
                      aria-label="Options"
                      value={(q.options ?? []).join(', ')}
                      onChange={(e) => updateQuestion(q.id, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary btn-lg" disabled={!dirty} onClick={save}>
          <Icon.Save size={18} /> {dirty ? 'Save CFP' : 'All changes saved'}
        </button>
      </div>
    </div>
  );
}

function TextRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = `f-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DateRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `d-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} type="date" className="input" value={value.slice(0, 10)} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('');
  function add() {
    const v = input.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setInput('');
  }
  return (
    <div className="card stack-sm">
      <h4>{label}</h4>
      <div className="pill-row">
        {items.map((it) => (
          <span key={it} className="tag">
            {it}
            <button type="button" className="btn-ghost" aria-label={`Remove ${it}`} style={{ background: 'none', border: 0, cursor: 'pointer', marginLeft: 4, color: 'inherit' }} onClick={() => onChange(items.filter((x) => x !== it))}>×</button>
          </span>
        ))}
      </div>
      <div className="row gap-sm">
        <label className="sr-only" htmlFor={`add-${label}`}>{placeholder}</label>
        <input id={`add-${label}`} className="input" value={input} placeholder={placeholder} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn btn-outline" onClick={add}>Add</button>
      </div>
    </div>
  );
}
