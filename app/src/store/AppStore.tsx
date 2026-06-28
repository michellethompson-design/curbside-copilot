// ─────────────────────────────────────────────────────────────────────────────
// AppStore — the single client-side source of truth.
//
// Holds the whole AppData object, persists it to localStorage on every change
// (so autosave / save-and-resume is real, not faked), and exposes typed actions
// for every step of the lifecycle. No backend; everything here is the "server".
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildSeed,
  CURRENT_ORGANIZER,
} from '../data/seed';
import type {
  AgendaSlot,
  AppData,
  Attendee,
  Certificate,
  CreditRule,
  Event,
  SessionEvaluation,
  SpeakerProfile,
  Submission,
} from '../data/types';
import { generateReview } from '../lib/ai';
import { buildLedger, totalEarned } from '../lib/credits';
import { makeId } from '../lib/format';

const STORAGE_KEY = 'lectern.appdata.v2';

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && parsed.version === 2) return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  return buildSeed();
}

export interface StoreValue {
  data: AppData;
  activeEvent: Event;
  creditRule: CreditRule;
  ruleFor: (eventId: string) => CreditRule;
  // ── events ──
  setActiveEvent: (eventId: string) => void;
  updateEvent: (eventId: string, patch: Partial<Event>) => void;
  createEvent: (partial: Partial<Event> & { name: string }) => string;
  // ── speakers ──
  updateSpeaker: (id: string, patch: Partial<SpeakerProfile>) => void;
  // ── submissions ──
  upsertDraft: (partial: Partial<Submission> & { id?: string }) => string;
  submitSubmission: (id: string) => void;
  runAIReview: (id: string) => void;
  decideSubmission: (id: string, decision: 'accept' | 'waitlist' | 'decline', note?: string) => void;
  notifyDecision: (id: string) => void;
  notifyAllDecided: () => number;
  // ── agenda ──
  scheduleSubmission: (submissionId: string, room: string, day: string, startMinutes: number) => void;
  unschedule: (slotId: string) => void;
  moveSlot: (slotId: string, room: string, startMinutes: number) => void;
  // ── roster / attendance ──
  registerAttendee: (a: Omit<Attendee, 'id' | 'registeredAt'>) => void;
  toggleCheckIn: (attendeeId: string, slotId: string) => void;
  toggleEvaluation: (attendeeId: string, slotId: string) => void;
  setPartialAttendance: (attendeeId: string, slotId: string, fraction: number) => void;
  submitEvaluation: (attendeeId: string, slotId: string, evaluation: SessionEvaluation) => void;
  // ── credits / certificates ──
  earnedHoursFor: (attendeeId: string) => number;
  issueCertificate: (attendeeId: string) => string | undefined;
  issueAllEligible: () => number;
  certificateFor: (attendeeId: string) => Certificate | undefined;
  // ── demo ──
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full / unavailable — app still works in-memory */
    }
  }, [data]);

  const ruleFor = useCallback(
    (eventId: string) => {
      const ev = data.events.find((e) => e.id === eventId);
      return data.creditRules.find((r) => r.id === ev?.creditRuleId) ?? data.creditRules[0];
    },
    [data.events, data.creditRules],
  );

  const activeEvent = useMemo(
    () => data.events.find((e) => e.id === data.activeEventId) ?? data.events[0],
    [data.events, data.activeEventId],
  );
  const creditRule = useMemo(() => ruleFor(activeEvent.id), [ruleFor, activeEvent.id]);

  // ── events ──
  const setActiveEvent = useCallback<StoreValue['setActiveEvent']>((eventId) => {
    setData((d) => (d.events.some((e) => e.id === eventId) ? { ...d, activeEventId: eventId } : d));
  }, []);

  const updateEvent = useCallback<StoreValue['updateEvent']>((eventId, patch) => {
    setData((d) => ({ ...d, events: d.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)) }));
  }, []);

  const createEvent = useCallback<StoreValue['createEvent']>((partial) => {
    const id = makeId('evt');
    setData((d) => {
      const template = d.events.find((e) => e.id === d.activeEventId) ?? d.events[0];
      const fresh: Event = {
        id,
        orgId: d.organization.id,
        name: partial.name,
        edition: partial.edition ?? '',
        year: partial.year ?? new Date().getFullYear(),
        status: 'cfp_open',
        tagline: partial.tagline ?? '',
        description: partial.description ?? '',
        venue: partial.venue ?? '',
        mode: partial.mode ?? 'in_person',
        startDate: partial.startDate ?? template.startDate,
        endDate: partial.endDate ?? template.endDate,
        cfpOpenDate: partial.cfpOpenDate ?? template.cfpOpenDate,
        cfpCloseDate: partial.cfpCloseDate ?? template.cfpCloseDate,
        tracks: partial.tracks ?? [...template.tracks],
        rooms: partial.rooms ?? [...template.rooms],
        creditRuleId: partial.creditRuleId ?? template.creditRuleId,
        customQuestions: partial.customQuestions ?? [],
      };
      return { ...d, events: [...d.events, fresh], activeEventId: id };
    });
    return id;
  }, []);

  // ── speakers ──
  const updateSpeaker = useCallback<StoreValue['updateSpeaker']>((id, patch) => {
    setData((d) => ({
      ...d,
      speakers: d.speakers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }, []);

  // ── submissions ──
  const upsertDraft = useCallback<StoreValue['upsertDraft']>((partial) => {
    const id = partial.id ?? makeId('sub');
    const now = new Date().toISOString();
    setData((d) => {
      const existing = d.submissions.find((s) => s.id === id);
      if (existing) {
        return {
          ...d,
          submissions: d.submissions.map((s) =>
            s.id === id ? { ...s, ...partial, id, updatedAt: now } : s,
          ),
        };
      }
      const fresh: Submission = {
        id,
        eventId: d.activeEventId,
        speakerId: partial.speakerId ?? '',
        title: '',
        abstract: '',
        pitch: '',
        format: 'lecture',
        track: d.events.find((e) => e.id === d.activeEventId)?.tracks[0] ?? '',
        level: 'all',
        durationMinutes: 60,
        learningObjectives: [],
        mode: 'in_person',
        coSpeakers: [],
        tags: [],
        customAnswers: {},
        status: 'draft',
        draftStep: 0,
        createdAt: now,
        updatedAt: now,
        ...partial,
      };
      return { ...d, submissions: [...d.submissions, fresh] };
    });
    return id;
  }, []);

  const submitSubmission = useCallback<StoreValue['submitSubmission']>((id) => {
    const now = new Date().toISOString();
    setData((d) => {
      const ev = d.events.find((e) => e.id === d.activeEventId)!;
      const cohort = d.submissions.filter((s) => s.eventId === d.activeEventId);
      return {
        ...d,
        submissions: d.submissions.map((s) => {
          if (s.id !== id) return s;
          const submitted: Submission = {
            ...s,
            status: 'submitted',
            submittedAt: now,
            updatedAt: now,
            draftStep: 5,
          };
          submitted.aiReview = generateReview(submitted, ev, cohort);
          return submitted;
        }),
      };
    });
  }, []);

  const runAIReview = useCallback<StoreValue['runAIReview']>((id) => {
    setData((d) => {
      const ev = d.events.find((e) => e.id === d.activeEventId)!;
      const cohort = d.submissions.filter((s) => s.eventId === d.activeEventId);
      return {
        ...d,
        submissions: d.submissions.map((s) =>
          s.id === id ? { ...s, status: s.status === 'submitted' ? 'under_review' : s.status, aiReview: generateReview(s, ev, cohort) } : s,
        ),
      };
    });
  }, []);

  const decideSubmission = useCallback<StoreValue['decideSubmission']>((id, decision, note) => {
    const now = new Date().toISOString();
    setData((d) => ({
      ...d,
      submissions: d.submissions.map((s) => {
        if (s.id !== id) return s;
        const status: Submission['status'] =
          decision === 'accept' ? 'accepted' : decision === 'waitlist' ? 'waitlisted' : 'declined';
        return {
          ...s,
          status,
          updatedAt: now,
          organizerDecision: {
            decision,
            decidedBy: CURRENT_ORGANIZER,
            decidedAt: now,
            note,
            overrodeAI: s.aiReview ? s.aiReview.suggestedDecision !== (decision === 'waitlist' ? 'review' : decision) : false,
          },
        };
      }),
    }));
  }, []);

  const notifyDecision = useCallback<StoreValue['notifyDecision']>((id) => {
    const now = new Date().toISOString();
    setData((d) => ({
      ...d,
      submissions: d.submissions.map((s) =>
        s.id === id && s.organizerDecision
          ? { ...s, organizerDecision: { ...s.organizerDecision, notifiedAt: now } }
          : s,
      ),
    }));
  }, []);

  const notifyAllDecided = useCallback<StoreValue['notifyAllDecided']>(() => {
    const now = new Date().toISOString();
    let count = 0;
    setData((d) => ({
      ...d,
      submissions: d.submissions.map((s) => {
        if (s.eventId === d.activeEventId && s.organizerDecision && !s.organizerDecision.notifiedAt) {
          count += 1;
          return { ...s, organizerDecision: { ...s.organizerDecision, notifiedAt: now } };
        }
        return s;
      }),
    }));
    return count;
  }, []);

  // ── agenda ──
  const scheduleSubmission = useCallback<StoreValue['scheduleSubmission']>(
    (submissionId, room, day, startMinutes) => {
      setData((d) => {
        const sub = d.submissions.find((s) => s.id === submissionId);
        if (!sub) return d;
        const slot: AgendaSlot = {
          id: makeId('slot'),
          eventId: d.activeEventId,
          submissionId,
          kind: sub.format === 'keynote' ? 'keynote' : 'session',
          title: '',
          room,
          day,
          startMinutes,
          endMinutes: startMinutes + sub.durationMinutes,
        };
        return {
          ...d,
          agenda: [...d.agenda, slot],
          submissions: d.submissions.map((s) => (s.id === submissionId ? { ...s, status: 'scheduled' } : s)),
        };
      });
    },
    [],
  );

  const unschedule = useCallback<StoreValue['unschedule']>((slotId) => {
    setData((d) => {
      const slot = d.agenda.find((s) => s.id === slotId);
      return {
        ...d,
        agenda: d.agenda.filter((s) => s.id !== slotId),
        submissions: slot?.submissionId
          ? d.submissions.map((s) => (s.id === slot.submissionId ? { ...s, status: 'accepted' } : s))
          : d.submissions,
      };
    });
  }, []);

  const moveSlot = useCallback<StoreValue['moveSlot']>((slotId, room, startMinutes) => {
    setData((d) => ({
      ...d,
      agenda: d.agenda.map((s) =>
        s.id === slotId ? { ...s, room, startMinutes, endMinutes: startMinutes + (s.endMinutes - s.startMinutes) } : s,
      ),
    }));
  }, []);

  // ── roster / attendance ──
  const registerAttendee = useCallback<StoreValue['registerAttendee']>((a) => {
    setData((d) => ({
      ...d,
      attendees: [
        ...d.attendees,
        { ...a, id: makeId('att'), registeredAt: new Date().toISOString(), eventId: d.activeEventId },
      ],
    }));
  }, []);

  const toggleCheckIn = useCallback<StoreValue['toggleCheckIn']>((attendeeId, slotId) => {
    const now = new Date().toISOString();
    setData((d) => {
      const existing = d.attendance.find((a) => a.attendeeId === attendeeId && a.slotId === slotId);
      const slot = d.agenda.find((s) => s.id === slotId)!;
      const fullMinutes = slot.endMinutes - slot.startMinutes;
      if (existing) {
        // toggle off
        return { ...d, attendance: d.attendance.filter((a) => a !== existing) };
      }
      return {
        ...d,
        attendance: [
          ...d.attendance,
          {
            id: makeId('attd'),
            attendeeId,
            slotId,
            checkInAt: now,
            minutesAttended: fullMinutes,
            evaluationComplete: false,
          },
        ],
      };
    });
  }, []);

  const toggleEvaluation = useCallback<StoreValue['toggleEvaluation']>((attendeeId, slotId) => {
    setData((d) => ({
      ...d,
      attendance: d.attendance.map((a) =>
        a.attendeeId === attendeeId && a.slotId === slotId
          ? { ...a, evaluationComplete: !a.evaluationComplete }
          : a,
      ),
    }));
  }, []);

  const setPartialAttendance = useCallback<StoreValue['setPartialAttendance']>((attendeeId, slotId, fraction) => {
    setData((d) => {
      const slot = d.agenda.find((s) => s.id === slotId);
      if (!slot) return d;
      const full = slot.endMinutes - slot.startMinutes;
      return {
        ...d,
        attendance: d.attendance.map((a) =>
          a.attendeeId === attendeeId && a.slotId === slotId
            ? { ...a, minutesAttended: Math.round(full * Math.max(0, Math.min(1, fraction))) }
            : a,
        ),
      };
    });
  }, []);

  // Submit a real session evaluation. Recording it also satisfies the
  // evaluation requirement, releasing any credit that was pending it.
  const submitEvaluation = useCallback<StoreValue['submitEvaluation']>((attendeeId, slotId, evaluation) => {
    setData((d) => {
      const exists = d.attendance.some((a) => a.attendeeId === attendeeId && a.slotId === slotId);
      if (exists) {
        return {
          ...d,
          attendance: d.attendance.map((a) =>
            a.attendeeId === attendeeId && a.slotId === slotId
              ? { ...a, evaluation, evaluationComplete: true }
              : a,
          ),
        };
      }
      // No prior check-in: an evaluation implies attendance, so create the record.
      const slot = d.agenda.find((s) => s.id === slotId);
      const full = slot ? slot.endMinutes - slot.startMinutes : 0;
      return {
        ...d,
        attendance: [
          ...d.attendance,
          {
            id: makeId('attd'),
            attendeeId,
            slotId,
            checkInAt: new Date().toISOString(),
            minutesAttended: full,
            evaluationComplete: true,
            evaluation,
          },
        ],
      };
    });
  }, []);

  // ── credits / certificates ──
  const earnedHoursFor = useCallback(
    (attendeeId: string) => {
      const rule = ruleFor(activeEvent.id);
      const ledger = buildLedger(attendeeId, activeEvent.id, data.agenda, rule, data.attendance, data.submissions);
      return totalEarned(ledger);
    },
    [ruleFor, activeEvent.id, data.agenda, data.attendance, data.submissions],
  );

  const certificateFor = useCallback(
    (attendeeId: string) =>
      data.certificates.find((c) => c.attendeeId === attendeeId && c.eventId === activeEvent.id),
    [data.certificates, activeEvent.id],
  );

  const buildCertificate = useCallback(
    (attendeeId: string, d: AppData): Certificate | undefined => {
      const rule = ruleFor(activeEvent.id);
      const ledger = buildLedger(attendeeId, activeEvent.id, d.agenda, rule, d.attendance, d.submissions);
      const earned = ledger.filter((l) => l.earned);
      const total = totalEarned(ledger);

      // Sessions the attendee actually showed up for (some may not have earned credit).
      const attendedSlotIds = new Set(
        d.attendance.filter((a) => a.attendeeId === attendeeId && a.checkInAt).map((a) => a.slotId),
      );
      const attended = ledger.filter((l) => attendedSlotIds.has(l.slotId));

      // Completion when credit was earned; participation when they attended but
      // didn't clear the threshold (e.g. left early / evaluation outstanding).
      const isCompletion = total > 0;
      if (!isCompletion && attended.length === 0) return undefined;

      const existingCount = d.certificates.filter((c) => c.eventId === activeEvent.id).length;
      const sessions = (isCompletion ? earned : attended).map((l) => ({
        title: l.sessionTitle,
        creditHours: isCompletion ? l.creditHours : 0,
      }));
      return {
        id: makeId('cert'),
        serial: `TLS26-${(existingCount + 1).toString().padStart(6, '0')}`,
        attendeeId,
        eventId: activeEvent.id,
        type: isCompletion ? 'completion' : 'participation',
        totalCreditHours: total,
        unitLabel: rule.unitLabel,
        sessions,
        issuedAt: new Date().toISOString(),
        issuingBody: d.organization.accreditationBody,
        providerNumber: d.organization.providerNumber,
      };
    },
    [ruleFor, activeEvent.id],
  );

  const issueCertificate = useCallback<StoreValue['issueCertificate']>(
    (attendeeId) => {
      let issuedId: string | undefined;
      setData((d) => {
        const cert = buildCertificate(attendeeId, d);
        if (!cert) return d;
        issuedId = cert.id;
        const others = d.certificates.filter(
          (c) => !(c.attendeeId === attendeeId && c.eventId === activeEvent.id),
        );
        return { ...d, certificates: [...others, cert] };
      });
      return issuedId;
    },
    [buildCertificate, activeEvent.id],
  );

  const issueAllEligible = useCallback<StoreValue['issueAllEligible']>(() => {
    let count = 0;
    setData((d) => {
      const certs = [...d.certificates];
      for (const att of d.attendees.filter((a) => a.eventId === activeEvent.id)) {
        if (certs.some((c) => c.attendeeId === att.id && c.eventId === activeEvent.id)) continue;
        const cert = buildCertificate(att.id, d);
        if (cert) {
          certs.push(cert);
          count += 1;
        }
      }
      return { ...d, certificates: certs };
    });
    return count;
  }, [buildCertificate, activeEvent.id]);

  const resetDemo = useCallback(() => {
    const fresh = buildSeed();
    setData(fresh);
  }, []);

  const value: StoreValue = {
    data,
    activeEvent,
    creditRule,
    ruleFor,
    setActiveEvent,
    updateEvent,
    createEvent,
    updateSpeaker,
    upsertDraft,
    submitSubmission,
    runAIReview,
    decideSubmission,
    notifyDecision,
    notifyAllDecided,
    scheduleSubmission,
    unschedule,
    moveSlot,
    registerAttendee,
    toggleCheckIn,
    toggleEvaluation,
    setPartialAttendance,
    submitEvaluation,
    earnedHoursFor,
    issueCertificate,
    issueAllEligible,
    certificateFor,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
