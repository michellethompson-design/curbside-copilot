// ─────────────────────────────────────────────────────────────────────────────
// Lectern — core domain model
//
// These types are the system of record for a continuing-education event, end to
// end: call for papers → submission → review → schedule → registration →
// attendance → CE credit → certificate → multi-event history. Run 2 documents
// these structures, so names are deliberately explicit.
// ─────────────────────────────────────────────────────────────────────────────

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD' or full ISO timestamp

export type EventStatus =
  | 'draft'
  | 'cfp_open'
  | 'cfp_closed'
  | 'scheduled'
  | 'live'
  | 'completed';

export type SubmissionStatus =
  | 'draft' // speaker still editing — autosaved, resumable
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'waitlisted'
  | 'declined'
  | 'scheduled';

export type SessionFormat =
  | 'workshop'
  | 'lecture'
  | 'panel'
  | 'lightning'
  | 'keynote';

export type DeliveryMode = 'in_person' | 'virtual' | 'hybrid';
export type AudienceLevel = 'intro' | 'intermediate' | 'advanced' | 'all';
export type CertificateType = 'completion' | 'participation';

// ── Organization (the accredited provider that issues credit) ────────────────
export interface Organization {
  id: ID;
  name: string;
  type: string; // e.g. 'Regional Education Service Agency'
  accreditationBody: string; // appears on the certificate issuing line
  providerNumber: string; // state-issued PD provider number
  contactEmail: string;
  brandColor: string;
}

// ── Credit rule (the compliance engine, concrete for K-12 / higher-ed PD) ─────
export interface CreditRule {
  id: ID;
  name: string; // 'K-12 Professional Development Clock Hours'
  jurisdiction: string; // 'Cascadia Department of Education'
  unitLabel: string; // 'Clock Hours' | 'CEUs' | 'Contact Hours'
  minutesPerCreditHour: number; // 60 → one clock hour per 60 instructional minutes
  minimumAttendancePct: number; // 0.90 → must attend ≥90% of a session to earn it
  ceuConversionRatio?: number; // 0.1 → 10 contact hours = 1 CEU (optional display)
  roundingIncrement: number; // 0.25 → credit rounds to nearest quarter hour
  requiresEvaluation: boolean; // attendee must complete the session evaluation
  certificateType: CertificateType;
  notes: string;
}

// ── Event ─────────────────────────────────────────────────────────────────────
export interface EventMetrics {
  submissions: number;
  accepted: number;
  speakers: number;
  registered: number;
  attended: number;
  creditHoursIssued: number;
  certificatesIssued: number;
  avgSessionRating: number; // out of 5
}

export interface Event {
  id: ID;
  orgId: ID;
  name: string;
  edition: string; // 'Spring 2026'
  year: number;
  status: EventStatus;
  tagline: string;
  description: string;
  venue: string;
  mode: DeliveryMode;
  startDate: ISODate;
  endDate: ISODate;
  cfpOpenDate: ISODate;
  cfpCloseDate: ISODate;
  tracks: string[];
  rooms: string[];
  creditRuleId: ID;
  metrics?: EventMetrics; // snapshot, used for completed events in history
}

// ── Speaker profile (reusable — enter once, reuse across submissions) ─────────
export interface SpeakerLink {
  label: string;
  url: string;
}

export interface SpeakerProfile {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  pronouns?: string;
  headline: string; // short tagline
  bio: string;
  org: string;
  role: string;
  location: string;
  avatarColor: string; // for the generated initials avatar
  links: SpeakerLink[];
  expertise: string[];
  accessNeeds?: string; // speaker's own presenting access needs
}

export interface CoSpeaker {
  name: string;
  email: string;
}

// ── Submission (a proposed session) ──────────────────────────────────────────
export interface Submission {
  id: ID;
  eventId: ID;
  speakerId: ID;
  title: string;
  abstract: string; // public description
  pitch: string; // private note to organizers
  format: SessionFormat;
  track: string;
  level: AudienceLevel;
  durationMinutes: number;
  learningObjectives: string[]; // required for CE credit — drives the certificate
  mode: DeliveryMode;
  coSpeakers: CoSpeaker[];
  tags: string[];
  status: SubmissionStatus;
  aiReview?: AIReview;
  organizerDecision?: OrganizerDecision;
  createdAt: ISODate;
  updatedAt: ISODate;
  submittedAt?: ISODate;
  // autosave / resume state for the speaker's multi-step flow
  draftStep: number;
}

// ── AI first-pass review ──────────────────────────────────────────────────────
export type AIFlagKind =
  | 'duplicate'
  | 'off_topic'
  | 'missing_objectives'
  | 'length_mismatch'
  | 'accessibility';

export interface AIFlag {
  kind: AIFlagKind;
  severity: 'low' | 'med' | 'high';
  detail: string;
  relatedSubmissionId?: ID;
}

export interface AIReview {
  summary: string; // one-line auto-summary an organizer can skim
  fitScore: number; // 0–100, fit to event tracks/audience
  qualityScore: number; // 0–100, abstract completeness/clarity
  flags: AIFlag[];
  suggestedDecision: 'accept' | 'review' | 'decline';
  rationale: string;
  generatedAt: ISODate;
}

export interface OrganizerDecision {
  decision: 'accept' | 'waitlist' | 'decline';
  decidedBy: string;
  decidedAt: ISODate;
  note?: string;
  overrodeAI: boolean; // true if organizer disagreed with the suggestion
}

// ── Agenda ────────────────────────────────────────────────────────────────────
export interface AgendaSlot {
  id: ID;
  eventId: ID;
  submissionId?: ID; // empty for breaks / non-session blocks
  kind: 'session' | 'keynote' | 'break' | 'lunch';
  title: string; // used for non-session blocks
  room: string;
  day: ISODate;
  startMinutes: number; // minutes from midnight (e.g. 9:00 → 540)
  endMinutes: number;
}

// ── Roster / registration ─────────────────────────────────────────────────────
export interface Attendee {
  id: ID;
  eventId: ID;
  firstName: string;
  lastName: string;
  email: string;
  role: string; // 'Grade 4 Teacher'
  district: string; // employer / district — the credit is reported to them
  licenseNumber?: string; // educator license # for state credit reporting
  registeredAt: ISODate;
  registrationSource: string; // 'Direct' | 'Eventbrite' (mocked) | 'District bulk'
}

// ── Attendance (the credit-bearing record we own) ─────────────────────────────
export interface AttendanceRecord {
  id: ID;
  attendeeId: ID;
  slotId: ID;
  checkInAt?: ISODate;
  checkOutAt?: ISODate;
  minutesAttended: number;
  evaluationComplete: boolean;
}

// ── Credit ledger (derived, but persisted for audit) ──────────────────────────
export interface CreditLedgerEntry {
  id: ID;
  attendeeId: ID;
  eventId: ID;
  slotId: ID;
  sessionTitle: string;
  creditHours: number;
  unitLabel: string;
  earned: boolean;
  reason?: string; // why credit was not earned, when earned === false
}

// ── Certificate ───────────────────────────────────────────────────────────────
export interface Certificate {
  id: ID;
  serial: string; // human-readable, verifiable serial
  attendeeId: ID;
  eventId: ID;
  type: CertificateType;
  totalCreditHours: number;
  unitLabel: string;
  sessions: { title: string; creditHours: number }[];
  issuedAt: ISODate;
  issuingBody: string;
  providerNumber: string;
}

// ── Mocked external integrations (believable hooks, never live) ───────────────
export interface Integration {
  id: ID;
  category: 'calendar' | 'email' | 'lms' | 'crm' | 'ticketing';
  name: string; // 'Eventbrite', 'Canvas LMS', 'Mailchimp', 'Google Calendar'
  status: 'connected' | 'available';
  detail: string;
}

// ── The whole persisted application state ─────────────────────────────────────
export interface AppData {
  version: number;
  organization: Organization;
  creditRules: CreditRule[];
  events: Event[];
  activeEventId: ID;
  speakers: SpeakerProfile[];
  submissions: Submission[];
  agenda: AgendaSlot[];
  attendees: Attendee[];
  attendance: AttendanceRecord[];
  certificates: Certificate[];
  integrations: Integration[];
}
