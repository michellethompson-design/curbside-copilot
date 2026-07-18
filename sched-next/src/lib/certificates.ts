import { randomBytes } from "node:crypto";
import { db } from "./db";

// Certificate issuance. A certificate is a snapshot with a permanent identity
// — the UCID — never an editable document. When the ledger behind a
// certificate changes (a correction, a late check-in), the next view issues a
// new certificate with a new UCID and marks the old one SUPERSEDED. Every
// UCID ever issued stays publicly verifiable forever, including superseded
// and revoked ones; the verification page simply says so.

// Crockford-style alphabet: no I, L, O, U — an auditor reading a printed
// certificate can type the UCID without look-alike confusion.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateUcid(): string {
  const bytes = randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += ALPHABET[bytes[i] % 32];
    if (i === 3 || i === 7) s += "-";
  }
  return `KV-${s}`;
}

export interface CertTotals {
  creditType: string;
  unit: string;
  units: number;
}

async function computeCertData(personId: string, eventId: string) {
  const records = await db.creditRecord.findMany({
    where: { personId, eventId },
    include: { creditType: true },
  });
  const totals = new Map<string, CertTotals>();
  for (const r of records) {
    const t = totals.get(r.creditTypeId) ?? { creditType: r.creditType.name, unit: r.creditType.unit, units: 0 };
    t.units = Math.round((t.units + r.units) * 10000) / 10000;
    totals.set(r.creditTypeId, t);
  }
  const earned = [...totals.values()].filter((t) => t.units > 0);
  const sessionIds = [...new Set(records.filter((r) => r.units > 0 && r.sessionId).map((r) => r.sessionId!))];
  const attendance = await db.attendance.findMany({
    where: { personId, sessionId: { in: sessionIds } },
    select: { method: true },
  });
  const methods = [...new Set(attendance.map((a) => a.method))];
  return { earned, sessionCount: sessionIds.length, methods };
}

/**
 * Return the current VALID certificate for person x event, issuing a new one
 * (and superseding the old) if the ledger has changed since last issuance.
 * Returns null when there is no positive credit to certify.
 */
export async function ensureCertificate(personId: string, eventId: string) {
  const [person, event, data] = await Promise.all([
    db.person.findUnique({ where: { id: personId } }),
    db.event.findUnique({ where: { id: eventId } }),
    computeCertData(personId, eventId),
  ]);
  if (!person || !event || data.earned.length === 0) return null;

  const totalsJson = JSON.stringify(data.earned);
  const current = await db.certificateIssue.findFirst({
    where: { personId, eventId, status: "VALID" },
    orderBy: { issuedAt: "desc" },
  });
  const personName = person.name;
  if (current && current.totalsJson === totalsJson && current.personName === personName) {
    return current;
  }

  const issued = await db.certificateIssue.create({
    data: {
      ucid: generateUcid(),
      personId,
      eventId,
      personName,
      licenseId: person.licenseId,
      eventName: event.name,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
      sessionCount: data.sessionCount,
      totalsJson,
      methodsJson: JSON.stringify(data.methods),
    },
  });
  if (current) {
    await db.certificateIssue.update({
      where: { id: current.id },
      data: { status: "SUPERSEDED", supersededById: issued.id },
    });
  }
  return issued;
}

const METHOD_LABEL: Record<string, string> = {
  ROSTER: "Verified attendance via roster check-in",
  SELF: "Self check-in",
  QR: "Verified attendance via QR check-in",
};

/** Public verification payload for a UCID — never more than the paper shows. */
export async function verifyUcid(ucid: string) {
  const issue = await db.certificateIssue.findUnique({
    where: { ucid: ucid.trim().toUpperCase() },
  });
  if (!issue) return null;
  const org = await db.organization.findFirstOrThrow();
  const supersededBy = issue.supersededById
    ? await db.certificateIssue.findUnique({ where: { id: issue.supersededById }, select: { ucid: true } })
    : null;
  return {
    ucid: issue.ucid,
    status: issue.status as "VALID" | "SUPERSEDED" | "REVOKED",
    supersededByUcid: supersededBy?.ucid ?? null,
    attendeeName: issue.personName,
    eventName: issue.eventName,
    eventStartsAt: issue.eventStartsAt,
    eventEndsAt: issue.eventEndsAt,
    totals: JSON.parse(issue.totalsJson) as CertTotals[],
    issuingOrganization: org.name,
    verificationMethods: (JSON.parse(issue.methodsJson) as string[]).map((m) => METHOD_LABEL[m] ?? m),
    issuedAt: issue.issuedAt,
  };
}
