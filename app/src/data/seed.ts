// ─────────────────────────────────────────────────────────────────────────────
// Seed data — one believable organization living its full lifecycle.
//
// Cascadia Regional Education Cooperative runs the Teaching & Learning Summit.
// The Spring 2026 edition is live *today*: some sessions are scheduled, a few
// submissions still await a decision, one is a half-finished draft (resume demo),
// the roster is filling, attendance is being captured, and credit is accruing.
// Three past editions give the dashboard real year-over-year history.
// ─────────────────────────────────────────────────────────────────────────────

import { generateReview } from '../lib/ai';
import type {
  AgendaSlot,
  AppData,
  Attendee,
  AttendanceRecord,
  Certificate,
  CreditRule,
  Event,
  Integration,
  Organization,
  SpeakerProfile,
  Submission,
} from './types';

const TODAY = '2026-06-28';
const LIVE = 'evt_tls26';

// ── Organization ──────────────────────────────────────────────────────────────
const organization: Organization = {
  id: 'org_crec',
  name: 'Cascadia Regional Education Cooperative',
  type: 'Regional Education Service Agency',
  accreditationBody: 'Cascadia Department of Education — Approved Professional Development Provider',
  providerNumber: 'CDE-PD-0417',
  contactEmail: 'pd@cascadiacoop.org',
  brandColor: '#4b3b8f',
};

// ── Credit rules (concrete for the K-12 / higher-ed PD beachhead) ─────────────
const creditRules: CreditRule[] = [
  {
    id: 'rule_clock',
    name: 'K-12 Professional Development Clock Hours',
    jurisdiction: 'Cascadia Department of Education',
    unitLabel: 'Clock Hours',
    minutesPerCreditHour: 60,
    minimumAttendancePct: 0.9,
    ceuConversionRatio: 0.1, // 10 clock hours = 1 CEU
    roundingIncrement: 0.25,
    requiresEvaluation: true,
    certificateType: 'completion',
    notes:
      'Per CDE Rule 181-78: one clock hour is awarded per 60 instructional minutes. ' +
      'Attendees must be present for at least 90% of a session and complete its evaluation. ' +
      'Clock hours apply toward educator license renewal.',
  },
  {
    id: 'rule_ceu',
    name: 'Higher-Education Continuing Education Units (CEUs)',
    jurisdiction: 'Cascadia Board of Higher Education',
    unitLabel: 'CEUs',
    minutesPerCreditHour: 600, // 10 contact hours = 1 CEU
    minimumAttendancePct: 0.8,
    roundingIncrement: 0.1,
    requiresEvaluation: true,
    certificateType: 'completion',
    notes: 'IACET-aligned: 1 CEU per 10 contact hours of structured learning.',
  },
];

// ── Events ────────────────────────────────────────────────────────────────────
const events: Event[] = [
  {
    id: LIVE,
    orgId: 'org_crec',
    name: 'Teaching & Learning Summit',
    edition: 'Spring 2026',
    year: 2026,
    status: 'live',
    tagline: 'Practice-first professional learning for K-12 educators.',
    description:
      'The Cooperative’s flagship professional-development day. Educators across the ' +
      'region earn state clock hours through hands-on sessions on literacy, STEM, ' +
      'equity, assessment, and classroom culture.',
    venue: 'Cascadia Conference Center, Riverton',
    mode: 'in_person',
    startDate: TODAY,
    endDate: TODAY,
    cfpOpenDate: '2026-03-02',
    cfpCloseDate: '2026-05-01',
    tracks: [
      'Literacy & Language',
      'STEM & Computational Thinking',
      'Equity & Inclusion',
      'Assessment & Data',
      'SEL & Classroom Culture',
      'EdTech & AI',
    ],
    rooms: ['Fir Auditorium', 'Cedar Hall', 'Maple Room', 'Birch Studio'],
    creditRuleId: 'rule_clock',
  },
  {
    id: 'evt_tls25',
    orgId: 'org_crec',
    name: 'Teaching & Learning Summit',
    edition: 'Spring 2025',
    year: 2025,
    status: 'completed',
    tagline: 'Practice-first professional learning for K-12 educators.',
    description: 'The 2025 edition of the Cooperative’s flagship PD day.',
    venue: 'Cascadia Conference Center, Riverton',
    mode: 'in_person',
    startDate: '2025-06-26',
    endDate: '2025-06-26',
    cfpOpenDate: '2025-03-01',
    cfpCloseDate: '2025-05-02',
    tracks: ['Literacy & Language', 'STEM & Computational Thinking', 'Equity & Inclusion', 'Assessment & Data'],
    rooms: ['Fir Auditorium', 'Cedar Hall', 'Maple Room', 'Birch Studio'],
    creditRuleId: 'rule_clock',
    metrics: {
      submissions: 84,
      accepted: 32,
      speakers: 29,
      registered: 410,
      attended: 372,
      creditHoursIssued: 1980,
      certificatesIssued: 361,
      avgSessionRating: 4.6,
    },
  },
  {
    id: 'evt_stem25',
    orgId: 'org_crec',
    name: 'STEM Educators Institute',
    edition: 'Fall 2025',
    year: 2025,
    status: 'completed',
    tagline: 'Deep-dive STEM pedagogy and computational thinking.',
    description: 'A two-day institute for STEM and CS educators.',
    venue: 'Riverton Tech Campus',
    mode: 'hybrid',
    startDate: '2025-10-09',
    endDate: '2025-10-10',
    cfpOpenDate: '2025-06-15',
    cfpCloseDate: '2025-08-15',
    tracks: ['STEM & Computational Thinking', 'EdTech & AI', 'Assessment & Data'],
    rooms: ['Lab A', 'Lab B', 'Lecture Hall'],
    creditRuleId: 'rule_clock',
    metrics: {
      submissions: 61,
      accepted: 24,
      speakers: 22,
      registered: 268,
      attended: 251,
      creditHoursIssued: 2510,
      certificatesIssued: 244,
      avgSessionRating: 4.7,
    },
  },
  {
    id: 'evt_lit24',
    orgId: 'org_crec',
    name: 'Literacy Leadership Forum',
    edition: '2024',
    year: 2024,
    status: 'completed',
    tagline: 'Structured literacy and the science of reading.',
    description: 'A focused forum for literacy coaches and reading specialists.',
    venue: 'Cascadia Conference Center, Riverton',
    mode: 'in_person',
    startDate: '2024-11-14',
    endDate: '2024-11-14',
    cfpOpenDate: '2024-08-01',
    cfpCloseDate: '2024-09-30',
    tracks: ['Literacy & Language', 'Assessment & Data', 'Equity & Inclusion'],
    rooms: ['Cedar Hall', 'Maple Room'],
    creditRuleId: 'rule_clock',
    metrics: {
      submissions: 47,
      accepted: 18,
      speakers: 17,
      registered: 196,
      attended: 181,
      creditHoursIssued: 905,
      certificatesIssued: 178,
      avgSessionRating: 4.5,
    },
  },
];

// ── Speakers (reusable profiles — entered once, reused per submission) ─────────
const speakers: SpeakerProfile[] = [
  {
    id: 'spk_amara',
    firstName: 'Amara',
    lastName: 'Okafor',
    email: 'a.okafor@rivertonschools.org',
    pronouns: 'she/her',
    headline: 'Instructional coach & former district literacy lead',
    bio: 'Dr. Amara Okafor has spent 16 years moving research into classroom practice, first as a 3rd-grade teacher and now as a regional instructional coach. She designs PD that teachers actually use on Monday morning.',
    org: 'Riverton Public Schools',
    role: 'Regional Instructional Coach',
    location: 'Riverton, Cascadia',
    avatarColor: '#b4506b',
    links: [{ label: 'Coaching blog', url: 'https://classroommonday.example.org' }],
    expertise: ['Literacy', 'Coaching', 'Equity', 'Curriculum'],
  },
  {
    id: 'spk_devon',
    firstName: 'Devon',
    lastName: 'Reyes',
    email: 'devon.reyes@northvalley.k12.example',
    pronouns: 'he/him',
    headline: 'High-school CS teacher building inclusive computing classrooms',
    bio: 'Devon Reyes teaches AP Computer Science and runs a districtwide CS-for-all initiative. He cares about getting students who never saw themselves as “computer people” to stay in the room.',
    org: 'North Valley High School',
    role: 'Computer Science Teacher',
    location: 'North Valley, Cascadia',
    avatarColor: '#2f8f7a',
    links: [{ label: 'GitHub Classroom resources', url: 'https://github.example/devon-cs' }],
    expertise: ['Computer Science', 'STEM', 'Inclusive pedagogy'],
    accessNeeds: 'Please provide a wireless lapel mic — I move around the room while presenting.',
  },
  {
    id: 'spk_priya',
    firstName: 'Priya',
    lastName: 'Nair',
    email: 'p.nair@cascadiacoop.org',
    pronouns: 'she/her',
    headline: 'District literacy specialist, structured-literacy trainer',
    bio: 'Priya Nair coaches K-2 teams on the science of reading and structured phonics. She has trained over 600 teachers in explicit decoding instruction.',
    org: 'Cascadia Regional Education Cooperative',
    role: 'Literacy Specialist',
    location: 'Riverton, Cascadia',
    avatarColor: '#c06f2a',
    links: [],
    expertise: ['Phonics', 'Structured literacy', 'Early reading'],
  },
  {
    id: 'spk_marcus',
    firstName: 'Marcus',
    lastName: 'Bell',
    email: 'marcus@sel-collective.example',
    pronouns: 'he/him',
    headline: 'SEL consultant & restorative-practices facilitator',
    bio: 'Marcus Bell helps schools build classroom cultures where students feel safe enough to take academic risks. Former middle-school dean, current full-time facilitator.',
    org: 'The SEL Collective',
    role: 'Lead Facilitator',
    location: 'Bayside, Cascadia',
    avatarColor: '#5a6cb0',
    links: [],
    expertise: ['SEL', 'Restorative practices', 'Classroom culture'],
  },
  {
    id: 'spk_lin',
    firstName: 'Lin',
    lastName: 'Zhao',
    email: 'lin.zhao@eastlake.k12.example',
    pronouns: 'they/them',
    headline: 'Assessment & data coordinator',
    bio: 'Lin Zhao turns mountains of benchmark data into something a teacher can act on by Friday. They lead the assessment office for a 9,000-student district.',
    org: 'Eastlake School District',
    role: 'Assessment & Data Coordinator',
    location: 'Eastlake, Cascadia',
    avatarColor: '#3f8fb0',
    links: [],
    expertise: ['Assessment', 'Data literacy', 'MTSS'],
  },
  {
    id: 'spk_sofia',
    firstName: 'Sofía',
    lastName: 'Marín',
    email: 's.marin@rivertonschools.org',
    pronouns: 'she/her',
    headline: 'Multilingual-learner specialist',
    bio: 'Sofía Marín supports newcomer and multilingual students and the teachers who serve them. She believes asset-based language instruction is an equity issue first.',
    org: 'Riverton Public Schools',
    role: 'Multilingual Education Specialist',
    location: 'Riverton, Cascadia',
    avatarColor: '#a85490',
    links: [],
    expertise: ['Multilingual learners', 'Equity', 'Language acquisition'],
  },
  {
    id: 'spk_james',
    firstName: 'James',
    lastName: 'Whitfield',
    email: 'jwhitfield@northvalley.k12.example',
    pronouns: 'he/him',
    headline: 'Director of educational technology',
    bio: 'James Whitfield leads edtech strategy for a mid-size district and is wary of every shiny tool until it earns its place. He writes a widely read newsletter on AI in K-12.',
    org: 'North Valley School District',
    role: 'Director of Educational Technology',
    location: 'North Valley, Cascadia',
    avatarColor: '#7a6cc0',
    links: [{ label: 'Newsletter', url: 'https://classroomstack.example' }],
    expertise: ['EdTech', 'AI in education', 'Digital citizenship'],
  },
  {
    id: 'spk_hana',
    firstName: 'Hana',
    lastName: 'Köhler',
    email: 'h.kohler@cascadiacoop.org',
    pronouns: 'she/her',
    headline: 'Special education & accessibility lead',
    bio: 'Hana Köhler helps general-ed teachers design lessons that work for every learner from the start. She trains teams on Universal Design for Learning and accessible materials.',
    org: 'Cascadia Regional Education Cooperative',
    role: 'Accessibility & Special Education Lead',
    location: 'Riverton, Cascadia',
    avatarColor: '#4f9e6a',
    links: [],
    expertise: ['UDL', 'Accessibility', 'Special education'],
  },
];

// ── Submissions ───────────────────────────────────────────────────────────────
// Helper keeps the literal list readable; timestamps are plausible.
type SubSeed = Omit<Submission, 'createdAt' | 'updatedAt' | 'submittedAt' | 'aiReview'> & {
  submittedAt?: string;
  review?: 'auto' | 'none'; // 'auto' = pre-generate an AI review; 'none' = leave for organizer
};

const subSeeds: SubSeed[] = [
  {
    id: 'sub_keynote',
    eventId: LIVE,
    speakerId: 'spk_amara',
    title: 'Teaching Like the Research Means It',
    abstract:
      'We say we are “research-based,” but classrooms rarely change. This opening keynote walks through three practices the science of learning is unambiguous about — retrieval practice, spaced review, and explicit modeling — and what it actually looks like to run them in a real, messy classroom on a Tuesday.',
    pitch: 'Sets an energizing, practice-first tone for the day.',
    format: 'keynote',
    track: 'Literacy & Language',
    level: 'all',
    durationMinutes: 60,
    learningObjectives: [
      'Name three learning-science practices with strong evidence',
      'Plan one immediate change to a current unit',
      'Explain retrieval practice to a colleague',
    ],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['learning science', 'retrieval practice', 'keynote'],
    status: 'scheduled',
    organizerDecision: { decision: 'accept', decidedBy: 'M. Hayes', decidedAt: '2026-05-06', overrodeAI: false, note: 'Obvious keynote.' },
    draftStep: 5,
    submittedAt: '2026-04-21',
    review: 'auto',
  },
  {
    id: 'sub_phonics',
    eventId: LIVE,
    speakerId: 'spk_priya',
    title: 'Decoding Doesn’t Happen by Accident: Explicit Phonics in K-2',
    abstract:
      'A hands-on workshop on sequencing explicit, systematic phonics instruction. Participants will map a decoding scope-and-sequence, practice a routine for teaching a new grapheme, and leave with a one-week sample plan they can use immediately with early readers.',
    pitch: 'High demand from K-2 teams this year.',
    format: 'workshop',
    track: 'Literacy & Language',
    level: 'intro',
    durationMinutes: 60,
    learningObjectives: [
      'Sequence a systematic phonics scope-and-sequence',
      'Run an explicit grapheme-introduction routine',
      'Adapt the routine for a struggling decoder',
    ],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['phonics', 'structured literacy', 'early reading'],
    status: 'scheduled',
    organizerDecision: { decision: 'accept', decidedBy: 'M. Hayes', decidedAt: '2026-05-06', overrodeAI: false },
    draftStep: 5,
    submittedAt: '2026-04-18',
    review: 'auto',
  },
  {
    id: 'sub_cs',
    eventId: LIVE,
    speakerId: 'spk_devon',
    title: 'Keeping Them in the Room: Inclusive Intro Computer Science',
    abstract:
      'Too many students decide in week two that CS “isn’t for them.” This session shares concrete moves — pair-programming norms, low-floor first projects, and feedback language — that keep historically excluded students engaged through the hard middle of a first programming course.',
    pitch: 'Pairs well with the equity track.',
    format: 'lecture',
    track: 'STEM & Computational Thinking',
    level: 'intermediate',
    durationMinutes: 60,
    learningObjectives: [
      'Identify three drop-off points in intro CS',
      'Design a low-floor first project',
      'Use feedback language that sustains belonging',
    ],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['computer science', 'equity', 'engagement'],
    status: 'scheduled',
    organizerDecision: { decision: 'accept', decidedBy: 'M. Hayes', decidedAt: '2026-05-07', overrodeAI: false },
    draftStep: 5,
    submittedAt: '2026-04-25',
    review: 'auto',
  },
  {
    id: 'sub_equity',
    eventId: LIVE,
    speakerId: 'spk_sofia',
    title: 'Every Newcomer Can Access Grade-Level Content',
    abstract:
      'Multilingual learners are too often handed watered-down work. This session models asset-based scaffolds — sentence frames, strategic native-language use, and visual anchors — that let newcomers engage with the same rigorous content as their peers.',
    pitch: '',
    format: 'lecture',
    track: 'Equity & Inclusion',
    level: 'all',
    durationMinutes: 60,
    learningObjectives: [
      'Apply three scaffolds that preserve rigor',
      'Plan strategic native-language use in a lesson',
      'Audit a task for unnecessary language load',
    ],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['multilingual', 'equity', 'scaffolding'],
    status: 'scheduled',
    organizerDecision: { decision: 'accept', decidedBy: 'M. Hayes', decidedAt: '2026-05-07', overrodeAI: false },
    draftStep: 5,
    submittedAt: '2026-04-22',
    review: 'auto',
  },
  {
    id: 'sub_sel',
    eventId: LIVE,
    speakerId: 'spk_marcus',
    title: 'The First Six Minutes: Routines That Build a Safe Classroom',
    abstract:
      'Classroom culture is built in the transitions, not the lesson plans. In this 90-minute workshop, teachers practice three opening routines and a repair conversation protocol that together lower the temperature of a room and make academic risk-taking possible.',
    pitch: 'Needs the long workshop slot for the practice rounds.',
    format: 'workshop',
    track: 'SEL & Classroom Culture',
    level: 'all',
    durationMinutes: 90,
    learningObjectives: [
      'Run three culture-building opening routines',
      'Facilitate a restorative repair conversation',
      'Plan the first six minutes of a class',
    ],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['SEL', 'restorative practices', 'classroom management'],
    status: 'scheduled',
    organizerDecision: { decision: 'accept', decidedBy: 'M. Hayes', decidedAt: '2026-05-08', overrodeAI: false },
    draftStep: 5,
    submittedAt: '2026-04-20',
    review: 'auto',
  },
  {
    id: 'sub_data',
    eventId: LIVE,
    speakerId: 'spk_lin',
    title: 'From Benchmark Data to Tuesday’s Lesson',
    abstract:
      'Benchmark season produces dashboards nobody uses. This session offers a 30-minute team protocol for turning a fresh data drop into a specific, small instructional change — with a worked example from a real 5th-grade math team.',
    pitch: '',
    format: 'lecture',
    track: 'Assessment & Data',
    level: 'intermediate',
    durationMinutes: 90,
    learningObjectives: [
      'Run a 30-minute data-to-action protocol',
      'Translate a data point into one instructional move',
      'Avoid three common data-team traps',
    ],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['assessment', 'data', 'MTSS'],
    status: 'scheduled',
    organizerDecision: { decision: 'accept', decidedBy: 'M. Hayes', decidedAt: '2026-05-08', overrodeAI: false },
    draftStep: 5,
    submittedAt: '2026-04-19',
    review: 'auto',
  },
  {
    id: 'sub_ai',
    eventId: LIVE,
    speakerId: 'spk_james',
    title: 'A Sane Classroom Policy for AI Writing Tools',
    abstract:
      'Bans don’t work and free-for-alls don’t either. This session offers a practical framework for deciding when AI writing tools help learning and when they short-circuit it, plus three classroom policies you can adapt by grade band.',
    pitch: '',
    format: 'lecture',
    track: 'EdTech & AI',
    level: 'all',
    durationMinutes: 60,
    learningObjectives: [
      'Distinguish productive from short-circuiting AI use',
      'Adapt an AI-use policy for your grade band',
      'Design one AI-resilient assignment',
    ],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['AI', 'edtech', 'academic integrity'],
    status: 'scheduled',
    organizerDecision: { decision: 'accept', decidedBy: 'M. Hayes', decidedAt: '2026-05-09', overrodeAI: false },
    draftStep: 5,
    submittedAt: '2026-04-27',
    review: 'auto',
  },
  {
    id: 'sub_access',
    eventId: LIVE,
    speakerId: 'spk_hana',
    title: 'Designed for Every Learner from the Start: UDL in Practice',
    abstract:
      'Retrofitting accommodations is exhausting and never quite works. This workshop walks teams through designing a single lesson with Universal Design for Learning so that the accommodations are built in — multiple means of engagement, representation, and expression — and shows how that lifts every student, not only those with IEPs.',
    pitch: 'Showcases our accessibility commitment.',
    format: 'workshop',
    track: 'Equity & Inclusion',
    level: 'all',
    durationMinutes: 60,
    learningObjectives: [
      'Apply the three UDL principles to one lesson',
      'Build in accommodations rather than retrofit them',
      'Create an accessible version of a handout',
    ],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['UDL', 'accessibility', 'special education'],
    status: 'scheduled',
    organizerDecision: { decision: 'accept', decidedBy: 'M. Hayes', decidedAt: '2026-05-09', overrodeAI: false },
    draftStep: 5,
    submittedAt: '2026-04-23',
    review: 'auto',
  },

  // ── Still awaiting a decision (populate the review queue) ──
  {
    id: 'sub_review1',
    eventId: LIVE,
    speakerId: 'spk_lin',
    title: 'Grading for Growth: Standards-Based Grading That Survives Contact with Parents',
    abstract:
      'A panel on moving to standards-based grading without a parent revolt. Three practitioners share what they communicated, what they kept from the old system, and where they compromised. Honest about the messy middle.',
    pitch: 'Could be strong but the abstract is a little thin on takeaways.',
    format: 'panel',
    track: 'Assessment & Data',
    level: 'intermediate',
    durationMinutes: 60,
    learningObjectives: ['Plan a parent-communication sequence for SBG'],
    mode: 'in_person',
    coSpeakers: [
      { name: 'Renee Park', email: 'rpark@eastlake.k12.example' },
      { name: 'Tom Ableton', email: 'tableton@eastlake.k12.example' },
    ],
    tags: ['grading', 'assessment'],
    status: 'submitted',
    draftStep: 5,
    submittedAt: '2026-04-29',
    review: 'none',
  },
  {
    id: 'sub_dup_phonics',
    eventId: LIVE,
    speakerId: 'spk_amara',
    title: 'Systematic Phonics That Actually Sticks in K-2',
    abstract:
      'A practical workshop on teaching explicit, systematic phonics to early readers. Participants will build a decoding scope-and-sequence, practice introducing a new grapheme, and walk away with a sample week of decoding instruction for K-2 classrooms.',
    pitch: '',
    format: 'workshop',
    track: 'Literacy & Language',
    level: 'intro',
    durationMinutes: 60,
    learningObjectives: ['Build a phonics scope-and-sequence', 'Teach a new grapheme explicitly'],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['phonics', 'early reading', 'structured literacy'],
    status: 'submitted',
    draftStep: 5,
    submittedAt: '2026-04-30',
    review: 'none', // organizer runs AI → expect a DUPLICATE flag vs sub_phonics
  },
  {
    id: 'sub_offtopic',
    eventId: LIVE,
    speakerId: 'spk_james',
    title: 'Blockchain and Crypto for Personal Wealth Building',
    abstract:
      'An overview of cryptocurrency markets, decentralized finance, and how individuals can build a diversified digital-asset portfolio for long-term returns. Covers wallets, exchanges, and tax considerations.',
    pitch: 'Submitted under EdTech but… not sure this fits.',
    format: 'lecture',
    track: 'EdTech & AI',
    level: 'intro',
    durationMinutes: 60,
    learningObjectives: [],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['blockchain', 'crypto', 'finance'],
    status: 'submitted',
    draftStep: 5,
    submittedAt: '2026-04-30',
    review: 'none', // organizer runs AI → expect OFF-TOPIC + missing-objectives flags
  },

  // ── A half-finished draft belonging to the demo speaker (resume showcase) ──
  {
    id: 'sub_draft',
    eventId: LIVE,
    speakerId: 'spk_devon',
    title: 'Unplugged Computing: Teaching CS Concepts Without Devices',
    abstract:
      'A starter draft — exploring how to teach core computer-science ideas (algorithms, abstraction, debugging) with no computers at all.',
    pitch: '',
    format: 'workshop',
    track: 'STEM & Computational Thinking',
    level: 'intro',
    durationMinutes: 60,
    learningObjectives: ['Teach an algorithm unplugged'],
    mode: 'in_person',
    coSpeakers: [],
    tags: ['computer science', 'unplugged'],
    status: 'draft',
    draftStep: 2, // resumes the speaker mid-flow
    review: 'none',
  },
];

// ── Agenda (Spring 2026, single day) ──────────────────────────────────────────
const agenda: AgendaSlot[] = [
  { id: 'slot_keynote', eventId: LIVE, submissionId: 'sub_keynote', kind: 'keynote', title: 'Opening Keynote', room: 'Fir Auditorium', day: TODAY, startMinutes: 540, endMinutes: 600 },
  { id: 'slot_break1', eventId: LIVE, kind: 'break', title: 'Coffee & connections', room: 'Atrium', day: TODAY, startMinutes: 600, endMinutes: 615 },
  { id: 'slot_phonics', eventId: LIVE, submissionId: 'sub_phonics', kind: 'session', title: '', room: 'Cedar Hall', day: TODAY, startMinutes: 615, endMinutes: 675 },
  { id: 'slot_cs', eventId: LIVE, submissionId: 'sub_cs', kind: 'session', title: '', room: 'Maple Room', day: TODAY, startMinutes: 615, endMinutes: 675 },
  { id: 'slot_equity', eventId: LIVE, submissionId: 'sub_equity', kind: 'session', title: '', room: 'Birch Studio', day: TODAY, startMinutes: 615, endMinutes: 675 },
  { id: 'slot_lunch', eventId: LIVE, kind: 'lunch', title: 'Lunch (provided)', room: 'Atrium', day: TODAY, startMinutes: 675, endMinutes: 735 },
  { id: 'slot_sel', eventId: LIVE, submissionId: 'sub_sel', kind: 'session', title: '', room: 'Cedar Hall', day: TODAY, startMinutes: 735, endMinutes: 825 },
  { id: 'slot_data', eventId: LIVE, submissionId: 'sub_data', kind: 'session', title: '', room: 'Maple Room', day: TODAY, startMinutes: 735, endMinutes: 825 },
  { id: 'slot_ai', eventId: LIVE, submissionId: 'sub_ai', kind: 'session', title: '', room: 'Fir Auditorium', day: TODAY, startMinutes: 840, endMinutes: 900 },
  { id: 'slot_access', eventId: LIVE, submissionId: 'sub_access', kind: 'session', title: '', room: 'Birch Studio', day: TODAY, startMinutes: 840, endMinutes: 900 },
];

// ── Roster ────────────────────────────────────────────────────────────────────
const attendeeNames: Array<[string, string, string, string, string]> = [
  // first, last, role, district, source
  ['Maya', 'Thompson', 'Grade 4 Teacher', 'Riverton Public Schools', 'Direct'],
  ['Carlos', 'Mendez', 'Grade 1 Teacher', 'Riverton Public Schools', 'District bulk'],
  ['Aisha', 'Rahman', 'Middle School Math', 'Eastlake School District', 'Direct'],
  ['Ben', 'Carter', 'HS English', 'North Valley School District', 'Eventbrite'],
  ['Grace', 'Liu', 'Instructional Coach', 'Eastlake School District', 'District bulk'],
  ['Daniel', 'Osei', 'Special Education', 'Riverton Public Schools', 'Direct'],
  ['Hannah', 'Schmidt', 'Kindergarten', 'Bayside Unified', 'Direct'],
  ['Ravi', 'Patel', 'HS Computer Science', 'North Valley School District', 'Eventbrite'],
  ['Olivia', 'Nguyen', 'Reading Specialist', 'Cascadia Coop Member', 'District bulk'],
  ['Marcus', 'Johnson', 'Assistant Principal', 'Bayside Unified', 'Direct'],
  ['Sara', 'Goldberg', 'Grade 3 Teacher', 'Riverton Public Schools', 'District bulk'],
  ['Tyler', 'Brooks', 'PE / Health', 'Eastlake School District', 'Direct'],
  ['Nina', 'Volkov', 'ESL Teacher', 'Riverton Public Schools', 'Direct'],
  ['Andre', 'Dubois', 'Grade 6 Science', 'North Valley School District', 'Eventbrite'],
];

const attendees: Attendee[] = attendeeNames.map(([first, last, role, district, source], i) => ({
  id: `att_${i + 1}`,
  eventId: LIVE,
  firstName: first,
  lastName: last,
  email: `${first.toLowerCase()}.${last.toLowerCase()}@example.org`,
  role,
  district,
  licenseNumber: `CDE-${(100437 + i * 53).toString()}`,
  registeredAt: '2026-06-1' + ((i % 9) + 1),
  registrationSource: source,
}));

// ── Attendance (the live event is mid-flight) ─────────────────────────────────
// Deterministic spread so credits, analytics, and check-in all have real state.
const creditSlotIds = ['slot_keynote', 'slot_phonics', 'slot_cs', 'slot_equity', 'slot_sel', 'slot_data', 'slot_ai', 'slot_access'];
const slotLenById: Record<string, number> = Object.fromEntries(
  agenda.map((s) => [s.id, s.endMinutes - s.startMinutes]),
);

const attendance: AttendanceRecord[] = [];
attendees.forEach((att, i) => {
  creditSlotIds.forEach((slotId, j) => {
    // Everyone attends the keynote. Otherwise, attend roughly 2 of the 3 blocks.
    const attends = slotId === 'slot_keynote' || (i + j) % 3 !== 0;
    if (!attends) return;
    const full = slotLenById[slotId];
    // Every 6th (attendee+slot) leaves early → below the 90% threshold.
    const partial = (i + j) % 6 === 0 && slotId !== 'slot_keynote';
    const minutes = partial ? Math.round(full * 0.7) : full;
    attendance.push({
      id: `attd_${att.id}_${slotId}`,
      attendeeId: att.id,
      slotId,
      checkInAt: `${TODAY}T0${9 + Math.floor(j / 3)}:0${j % 6}:00`,
      checkOutAt: `${TODAY}T17:00:00`,
      minutesAttended: minutes,
      // Most complete the evaluation; every 4th hasn't yet (credit withheld pending eval).
      evaluationComplete: (i + j) % 4 !== 0,
    });
  });
});

// ── A sample issued certificate (so the certificate route is demonstrable) ────
const certificates: Certificate[] = [
  {
    id: 'cert_sample',
    serial: 'TLS26-000001',
    attendeeId: 'att_1',
    eventId: LIVE,
    type: 'completion',
    totalCreditHours: 3,
    unitLabel: 'Clock Hours',
    sessions: [
      { title: 'Teaching Like the Research Means It', creditHours: 1 },
      { title: 'Decoding Doesn’t Happen by Accident: Explicit Phonics in K-2', creditHours: 1 },
      { title: 'A Sane Classroom Policy for AI Writing Tools', creditHours: 1 },
    ],
    issuedAt: `${TODAY}T15:30:00`,
    issuingBody: organization.accreditationBody,
    providerNumber: organization.providerNumber,
  },
];

// ── Mocked integrations (believable hooks, never live) ────────────────────────
const integrations: Integration[] = [
  { id: 'int_eventbrite', category: 'ticketing', name: 'Eventbrite', status: 'connected', detail: 'Registrations sync into the roster every 15 min. 4 of 14 attendees arrived via Eventbrite.' },
  { id: 'int_stripe', category: 'ticketing', name: 'Stripe', status: 'available', detail: 'For paid-registration events. Lectern never touches card data — it reads paid/refunded status only.' },
  { id: 'int_canvas', category: 'lms', name: 'Canvas LMS', status: 'available', detail: 'Push earned clock hours to educators’ Canvas transcripts on certificate issue.' },
  { id: 'int_gcal', category: 'calendar', name: 'Google Calendar', status: 'connected', detail: 'Accepted speakers get their session times auto-added to their calendars.' },
  { id: 'int_mailchimp', category: 'email', name: 'Mailchimp', status: 'connected', detail: 'Decision letters and certificate-ready notices send through Mailchimp.' },
  { id: 'int_hubspot', category: 'crm', name: 'HubSpot', status: 'available', detail: 'Sync member districts and attendance history into the cooperative’s CRM.' },
];

// ── Assemble, generating AI reviews where requested ───────────────────────────
export function buildSeed(): AppData {
  const liveEvent = events.find((e) => e.id === LIVE)!;
  const liveCohort: Submission[] = subSeeds
    .filter((s) => s.eventId === LIVE)
    .map((s) => stripSeed(s));

  const submissions: Submission[] = subSeeds.map((seed) => {
    const sub = stripSeed(seed);
    if (seed.review === 'auto') {
      sub.aiReview = generateReview(sub, liveEvent, liveCohort);
    }
    return sub;
  });

  return {
    version: 1,
    organization,
    creditRules,
    events,
    activeEventId: LIVE,
    speakers,
    submissions,
    agenda,
    attendees,
    attendance,
    certificates,
    integrations,
  };
}

function stripSeed(seed: SubSeed): Submission {
  const { review, submittedAt, ...rest } = seed;
  return {
    ...rest,
    createdAt: '2026-04-15',
    updatedAt: submittedAt ?? '2026-04-15',
    submittedAt,
  };
}

// The id of the speaker we treat as the signed-in user (for the speaker portal).
export const CURRENT_SPEAKER_ID = 'spk_devon';
export const CURRENT_ORGANIZER = 'M. Hayes';
