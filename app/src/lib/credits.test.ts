import { describe, expect, it } from 'vitest';
import {
  buildLedger,
  ceuEquivalent,
  computeCredit,
  roundToIncrement,
  slotCreditCeiling,
  totalEarned,
} from './credits';
import type { AgendaSlot, AttendanceRecord, CreditRule, Submission } from '../data/types';

const rule: CreditRule = {
  id: 'r',
  name: 'Clock Hours',
  jurisdiction: 'Test DOE',
  unitLabel: 'Clock Hours',
  minutesPerCreditHour: 60,
  minimumAttendancePct: 0.9,
  ceuConversionRatio: 0.1,
  roundingIncrement: 0.25,
  requiresEvaluation: true,
  certificateType: 'completion',
  notes: '',
};

function slot(over: Partial<AgendaSlot> = {}): AgendaSlot {
  return { id: 's1', eventId: 'e1', submissionId: 'sub1', kind: 'session', title: '', room: 'A', day: '2026-06-28', startMinutes: 600, endMinutes: 660, ...over };
}
function record(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return { id: 'a1', attendeeId: 'att1', slotId: 's1', checkInAt: '2026-06-28T10:00:00', minutesAttended: 60, evaluationComplete: true, ...over };
}

describe('roundToIncrement', () => {
  it('clears binary float drift', () => {
    expect(roundToIncrement(66 * 0.1, 0.1)).toBe(6.6);
  });
  it('rounds to the quarter', () => {
    expect(roundToIncrement(0.83, 0.25)).toBe(0.75);
    expect(roundToIncrement(0.9, 0.25)).toBe(1);
  });
  it('returns the value when increment is zero', () => {
    expect(roundToIncrement(1.234, 0)).toBe(1.234);
  });
});

describe('slotCreditCeiling', () => {
  it('gives 1 hour for a 60-minute session', () => {
    expect(slotCreditCeiling(slot(), rule)).toBe(1);
  });
  it('gives 1.5 hours for a 90-minute session', () => {
    expect(slotCreditCeiling(slot({ endMinutes: 690 }), rule)).toBe(1.5);
  });
});

describe('computeCredit', () => {
  it('awards full credit for full attendance + completed evaluation', () => {
    const c = computeCredit(slot(), rule, record());
    expect(c.earned).toBe(true);
    expect(c.creditHours).toBe(1);
  });

  it('earns nothing without a check-in', () => {
    const c = computeCredit(slot(), rule, undefined);
    expect(c.earned).toBe(false);
    expect(c.creditHours).toBe(0);
    expect(c.reason).toMatch(/check-in/i);
  });

  it('withholds credit below the attendance threshold', () => {
    // 40 of 60 minutes = 67%, under the 90% rule
    const c = computeCredit(slot(), rule, record({ minutesAttended: 40 }));
    expect(c.earned).toBe(false);
    expect(c.creditHours).toBe(0);
    expect(c.reason).toMatch(/minimum/i);
  });

  it('holds credit pending the evaluation but reports the ceiling', () => {
    const c = computeCredit(slot(), rule, record({ evaluationComplete: false }));
    expect(c.earned).toBe(false);
    expect(c.creditHours).toBe(1); // ceiling shown so organizer sees what's pending
    expect(c.reason).toMatch(/evaluation/i);
  });

  it('ignores the evaluation requirement when the rule does not require it', () => {
    const noEval: CreditRule = { ...rule, requiresEvaluation: false };
    const c = computeCredit(slot(), noEval, record({ evaluationComplete: false }));
    expect(c.earned).toBe(true);
  });
});

describe('buildLedger + totalEarned', () => {
  const slots: AgendaSlot[] = [
    slot({ id: 'k', kind: 'keynote', submissionId: undefined, title: 'Keynote', startMinutes: 540, endMinutes: 600 }),
    slot({ id: 's1', submissionId: 'sub1', startMinutes: 600, endMinutes: 660 }),
    slot({ id: 's2', submissionId: 'sub2', startMinutes: 660, endMinutes: 750 }), // 90 min
    slot({ id: 'lunch', kind: 'lunch', submissionId: undefined, title: 'Lunch', startMinutes: 750, endMinutes: 810 }),
  ];
  const subs = [{ id: 'sub1', title: 'Phonics' }, { id: 'sub2', title: 'Data' }] as unknown as Submission[];
  const attendance: AttendanceRecord[] = [
    record({ id: 'r-k', slotId: 'k', minutesAttended: 60 }),
    record({ id: 'r-1', slotId: 's1', minutesAttended: 60 }),
    record({ id: 'r-2', slotId: 's2', minutesAttended: 90 }),
  ];

  it('only scores credit-bearing slots (skips lunch)', () => {
    const ledger = buildLedger('att1', 'e1', slots, rule, attendance, subs);
    expect(ledger).toHaveLength(3); // keynote + 2 sessions, not lunch
  });

  it('sums earned hours: 1 + 1 + 1.5 = 3.5', () => {
    const ledger = buildLedger('att1', 'e1', slots, rule, attendance, subs);
    expect(totalEarned(ledger)).toBe(3.5);
  });

  it('resolves the session title from the submission', () => {
    const ledger = buildLedger('att1', 'e1', slots, rule, attendance, subs);
    expect(ledger.find((l) => l.slotId === 's1')?.sessionTitle).toBe('Phonics');
  });
});

describe('ceuEquivalent', () => {
  it('converts clock hours to CEUs at the rule ratio', () => {
    expect(ceuEquivalent(10, rule)).toBe(1);
    expect(ceuEquivalent(3.5, rule)).toBe(0.4); // 0.35 rounds to nearest 0.1
  });
  it('returns undefined when the rule has no conversion', () => {
    expect(ceuEquivalent(10, { ...rule, ceuConversionRatio: undefined })).toBeUndefined();
  });
});
