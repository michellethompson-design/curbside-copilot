// ─────────────────────────────────────────────────────────────────────────────
// Credit engine — the compliance layer Sessionize doesn't have.
//
// Concrete for the beachhead (K-12 / higher-ed professional development):
//   • Clock hours accrue at 60 instructional minutes = 1 clock hour.
//   • An attendee must be present for ≥ the rule's minimumAttendancePct of a
//     session to earn its credit (partial attendance earns nothing — this is how
//     state PD reporting actually works).
//   • Credit rounds to the rule's increment (quarter hours).
//   • If the rule requires a session evaluation, an unsubmitted evaluation
//     withholds the credit until completed.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AgendaSlot,
  AttendanceRecord,
  CreditLedgerEntry,
  CreditRule,
  Submission,
} from '../data/types';
import { makeId } from './format';

export function roundToIncrement(value: number, increment: number): number {
  if (increment <= 0) return value;
  // toFixed(4) clears binary floating-point drift (e.g. 6.6000000000000005 → 6.6).
  return Number((Math.round(value / increment) * increment).toFixed(4));
}

export function slotMinutes(slot: AgendaSlot): number {
  return Math.max(0, slot.endMinutes - slot.startMinutes);
}

/** Maximum credit a session is worth if fully attended. */
export function slotCreditCeiling(slot: AgendaSlot, rule: CreditRule): number {
  return roundToIncrement(slotMinutes(slot) / rule.minutesPerCreditHour, rule.roundingIncrement);
}

export interface CreditComputation {
  earned: boolean;
  creditHours: number;
  attendancePct: number;
  reason?: string;
}

/** Decide what an attendance record earns against a session slot + rule. */
export function computeCredit(
  slot: AgendaSlot,
  rule: CreditRule,
  record: AttendanceRecord | undefined,
): CreditComputation {
  const sessionLen = slotMinutes(slot);
  const ceiling = slotCreditCeiling(slot, rule);

  if (!record || !record.checkInAt) {
    return { earned: false, creditHours: 0, attendancePct: 0, reason: 'No check-in recorded' };
  }
  const attendancePct = sessionLen > 0 ? Math.min(1, record.minutesAttended / sessionLen) : 0;

  if (attendancePct < rule.minimumAttendancePct) {
    return {
      earned: false,
      creditHours: 0,
      attendancePct,
      reason: `Attended ${Math.round(attendancePct * 100)}% — minimum ${Math.round(
        rule.minimumAttendancePct * 100,
      )}% required`,
    };
  }
  if (rule.requiresEvaluation && !record.evaluationComplete) {
    return {
      earned: false,
      creditHours: ceiling,
      attendancePct,
      reason: 'Session evaluation not yet completed',
    };
  }
  return { earned: true, creditHours: ceiling, attendancePct };
}

/** Build (or rebuild) the full credit ledger for one attendee across the event. */
export function buildLedger(
  attendeeId: string,
  eventId: string,
  slots: AgendaSlot[],
  rule: CreditRule,
  attendance: AttendanceRecord[],
  submissions: Submission[],
): CreditLedgerEntry[] {
  const creditSlots = slots.filter(
    (s) => s.eventId === eventId && (s.kind === 'session' || s.kind === 'keynote'),
  );
  return creditSlots.map((slot) => {
    const record = attendance.find((a) => a.attendeeId === attendeeId && a.slotId === slot.id);
    const comp = computeCredit(slot, rule, record);
    const title =
      slot.kind === 'session' && slot.submissionId
        ? submissions.find((s) => s.id === slot.submissionId)?.title ?? slot.title
        : slot.title;
    return {
      id: makeId('ledger'),
      attendeeId,
      eventId,
      slotId: slot.id,
      sessionTitle: title,
      creditHours: comp.creditHours,
      unitLabel: rule.unitLabel,
      earned: comp.earned,
      reason: comp.reason,
    };
  });
}

export function totalEarned(ledger: CreditLedgerEntry[]): number {
  return ledger.filter((l) => l.earned).reduce((sum, l) => sum + l.creditHours, 0);
}

export function ceuEquivalent(creditHours: number, rule: CreditRule): number | undefined {
  if (!rule.ceuConversionRatio) return undefined;
  return roundToIncrement(creditHours * rule.ceuConversionRatio, 0.1);
}
