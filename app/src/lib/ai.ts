// ─────────────────────────────────────────────────────────────────────────────
// AI first-pass review (the on-ramp lever).
//
// A deterministic, explainable heuristic stand-in for an LLM triage pass. It is
// intentionally transparent so the organizer always sees *why* — auto-summary,
// fit + quality scores, duplicate / off-topic / missing-objective flags, and a
// suggested decision the organizer can accept or override. In production this is
// where a Claude call would slot in; the interface (AIReview) stays identical.
// ─────────────────────────────────────────────────────────────────────────────

import type { AIFlag, AIReview, Event, Submission } from '../data/types';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'your',
  'you', 'we', 'our', 'this', 'that', 'is', 'are', 'be', 'how', 'what', 'using',
  'use', 'into', 'from', 'by', 'as', 'at', 'it', 'will', 'can', 'their', 'them',
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Keywords that signal alignment with an education-PD event. */
const PD_SIGNALS = [
  'student', 'students', 'classroom', 'teacher', 'teachers', 'learning', 'literacy',
  'assessment', 'curriculum', 'equity', 'inclusion', 'sel', 'differentiation',
  'pedagogy', 'instruction', 'reading', 'math', 'stem', 'engagement', 'data',
  'standards', 'accessibility', 'multilingual', 'iep', 'intervention', 'phonics',
];

export function generateReview(
  submission: Submission,
  event: Event,
  cohort: Submission[],
): AIReview {
  const titleTokens = new Set(tokens(submission.title));
  const abstractTokens = new Set(tokens(submission.abstract));
  const allTokens = new Set([...titleTokens, ...abstractTokens, ...submission.tags.map((t) => t.toLowerCase())]);

  // ── Fit: track validity, audience signal density, education-PD relevance ──
  const trackValid = event.tracks.includes(submission.track);
  const pdHits = [...allTokens].filter((t) => PD_SIGNALS.includes(t)).length;
  const eventTokens = new Set(tokens(`${event.name} ${event.description} ${event.tracks.join(' ')}`));
  const topicOverlap = jaccard(allTokens, eventTokens);
  const fitScore = clamp(
    (trackValid ? 45 : 10) + Math.min(30, pdHits * 8) + topicOverlap * 80,
  );

  // ── Quality: abstract depth, objectives, structural completeness ──
  const wordCount = submission.abstract.trim().split(/\s+/).filter(Boolean).length;
  const hasObjectives = submission.learningObjectives.filter((o) => o.trim().length > 0).length;
  const lengthScore = wordCount >= 60 ? 35 : wordCount >= 30 ? 22 : wordCount >= 12 ? 12 : 4;
  const objectiveScore = Math.min(30, hasObjectives * 10);
  const specificityScore = Math.min(20, abstractTokens.size * 0.8);
  const tagScore = Math.min(15, submission.tags.length * 5);
  const qualityScore = clamp(lengthScore + objectiveScore + specificityScore + tagScore);

  // ── Flags ──
  const flags: AIFlag[] = [];

  // Duplicate / near-duplicate against the rest of the cohort
  for (const other of cohort) {
    if (other.id === submission.id) continue;
    const otherTokens = new Set([...tokens(other.title), ...tokens(other.abstract)]);
    const sim = jaccard(new Set([...titleTokens, ...abstractTokens]), otherTokens);
    if (sim > 0.34) {
      flags.push({
        kind: 'duplicate',
        severity: sim > 0.5 ? 'high' : 'med',
        detail: `${Math.round(sim * 100)}% topic overlap with "${other.title}"`,
        relatedSubmissionId: other.id,
      });
      break;
    }
  }

  if (!trackValid || (pdHits === 0 && topicOverlap < 0.04)) {
    flags.push({
      kind: 'off_topic',
      severity: !trackValid && pdHits === 0 ? 'high' : 'med',
      detail: !trackValid
        ? `Track "${submission.track}" is not part of this event's program`
        : 'Few signals tying this to K-12 / higher-ed practice',
    });
  }

  if (hasObjectives < 2) {
    flags.push({
      kind: 'missing_objectives',
      severity: hasObjectives === 0 ? 'high' : 'low',
      detail:
        hasObjectives === 0
          ? 'No learning objectives — required to award CE credit'
          : 'Only one learning objective; two or more strengthen the credit record',
    });
  }

  // Workshop with too little time, or lecture padded to a workshop slot
  if (submission.format === 'workshop' && submission.durationMinutes < 60) {
    flags.push({
      kind: 'length_mismatch',
      severity: 'low',
      detail: `Hands-on workshop requested in a ${submission.durationMinutes}-min slot`,
    });
  }

  // ── Suggested decision ──
  const hasHigh = flags.some((f) => f.severity === 'high');
  let suggestedDecision: AIReview['suggestedDecision'];
  if (hasHigh && fitScore < 55) suggestedDecision = 'decline';
  else if (fitScore >= 70 && qualityScore >= 60 && !hasHigh) suggestedDecision = 'accept';
  else suggestedDecision = 'review';

  // ── Summary + rationale ──
  const lead = submission.abstract.trim().split(/(?<=[.!?])\s/)[0] ?? submission.title;
  const summary =
    lead.length > 140 ? `${lead.slice(0, 137).trim()}…` : lead || `${submission.format} on ${submission.track}`;

  const rationaleParts = [
    `Fit ${fitScore}/100 (${trackValid ? `on-track in ${submission.track}` : 'track mismatch'}, ${pdHits} practice signals).`,
    `Quality ${qualityScore}/100 (${wordCount}-word abstract, ${hasObjectives} objective${hasObjectives === 1 ? '' : 's'}).`,
    flags.length
      ? `${flags.length} flag${flags.length === 1 ? '' : 's'} to review.`
      : 'No flags raised.',
    suggestedDecision === 'accept'
      ? 'Strong, on-topic, credit-ready — recommend accept.'
      : suggestedDecision === 'decline'
        ? 'Weak fit with blocking flags — recommend decline.'
        : 'Promising but needs a human read before deciding.',
  ];

  return {
    summary,
    fitScore,
    qualityScore,
    flags,
    suggestedDecision,
    rationale: rationaleParts.join(' '),
    generatedAt: new Date().toISOString(),
  };
}
