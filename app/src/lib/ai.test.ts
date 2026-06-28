import { describe, expect, it } from 'vitest';
import { generateReview } from './ai';
import type { Event, Submission } from '../data/types';

const event: Event = {
  id: 'e1',
  orgId: 'o1',
  name: 'Teaching & Learning Summit',
  edition: 'Spring 2026',
  year: 2026,
  status: 'live',
  tagline: '',
  description: 'Professional development for K-12 teachers on literacy, students, classroom assessment and instruction.',
  venue: '',
  mode: 'in_person',
  startDate: '2026-06-28',
  endDate: '2026-06-28',
  cfpOpenDate: '2026-03-01',
  cfpCloseDate: '2026-05-01',
  tracks: ['Literacy & Language', 'Assessment & Data', 'EdTech & AI'],
  rooms: ['A'],
  creditRuleId: 'r',
  customQuestions: [],
};

function sub(over: Partial<Submission> = {}): Submission {
  return {
    id: 's', eventId: 'e1', speakerId: 'sp', title: '', abstract: '', pitch: '',
    format: 'lecture', track: 'Literacy & Language', level: 'all', durationMinutes: 60,
    learningObjectives: [], mode: 'in_person', coSpeakers: [], tags: [], customAnswers: {},
    status: 'submitted', createdAt: '', updatedAt: '', draftStep: 5, ...over,
  };
}

describe('generateReview — on-topic, complete submission', () => {
  const s = sub({
    id: 'good',
    title: 'Explicit Phonics Instruction for Early Readers',
    abstract: 'A hands-on workshop where teachers practice an explicit, systematic phonics routine for K-2 students. Participants map a decoding scope and sequence and leave with a sample week of reading instruction for their classroom.',
    track: 'Literacy & Language',
    learningObjectives: ['Sequence a phonics scope and sequence', 'Teach a grapheme explicitly'],
    tags: ['phonics', 'literacy', 'reading'],
  });
  const review = generateReview(s, event, [s]);

  it('scores fit and quality highly', () => {
    expect(review.fitScore).toBeGreaterThanOrEqual(60);
    expect(review.qualityScore).toBeGreaterThanOrEqual(60);
  });
  it('raises no blocking flags', () => {
    expect(review.flags.some((f) => f.kind === 'off_topic')).toBe(false);
    expect(review.flags.some((f) => f.kind === 'missing_objectives')).toBe(false);
  });
  it('does not recommend declining a strong talk', () => {
    expect(review.suggestedDecision).not.toBe('decline');
  });
});

describe('generateReview — duplicate detection', () => {
  const a = sub({
    id: 'a',
    title: 'Explicit Phonics Instruction for Early Readers',
    abstract: 'A hands-on workshop on explicit systematic phonics. Teachers map a decoding scope and sequence and practice teaching a new grapheme to K-2 students.',
    learningObjectives: ['Sequence phonics'],
    tags: ['phonics'],
  });
  const b = sub({
    id: 'b',
    title: 'Systematic Phonics for Early Readers',
    abstract: 'A practical workshop on systematic explicit phonics. Teachers build a decoding scope and sequence and practice teaching a grapheme to early K-2 readers.',
    learningObjectives: ['Build phonics sequence'],
    tags: ['phonics'],
  });

  it('flags the near-duplicate against the cohort', () => {
    const review = generateReview(b, event, [a, b]);
    const dup = review.flags.find((f) => f.kind === 'duplicate');
    expect(dup).toBeDefined();
    expect(dup?.relatedSubmissionId).toBe('a');
  });
});

describe('generateReview — off-topic + missing objectives', () => {
  const s = sub({
    id: 'crypto',
    title: 'Blockchain and Crypto for Personal Wealth Building',
    abstract: 'An overview of cryptocurrency markets, decentralized finance, wallets and exchanges for building a digital-asset portfolio.',
    track: 'EdTech & AI',
    learningObjectives: [],
    tags: ['blockchain', 'crypto', 'finance'],
  });
  const review = generateReview(s, event, [s]);

  it('flags it off-topic', () => {
    expect(review.flags.some((f) => f.kind === 'off_topic')).toBe(true);
  });
  it('flags missing learning objectives', () => {
    const f = review.flags.find((x) => x.kind === 'missing_objectives');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('high');
  });
  it('does not recommend accepting it', () => {
    expect(review.suggestedDecision).not.toBe('accept');
  });
});

describe('generateReview — workshop in a short slot', () => {
  it('flags a length mismatch', () => {
    const s = sub({ format: 'workshop', durationMinutes: 45, abstract: 'A workshop with too little time to do anything hands on with students in the classroom.', learningObjectives: ['Do a thing', 'Do another'] });
    const review = generateReview(s, event, [s]);
    expect(review.flags.some((f) => f.kind === 'length_mismatch')).toBe(true);
  });
});
