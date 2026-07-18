/**
 * Seed: one district org, two headline events (SPEC.md Stage 0) plus two small
 * historical events so transcripts span years, which the transcript and
 * missing-credits scenes need.
 *
 *  1. August Inservice 2026 — Dana's story event. 2 days, 42 sessions,
 *     1,200 people expected, Act 48 hours at quarter-hour NEAREST rounding.
 *     No attendance seeded: check-in happens live in the demo.
 *  2. Statewide stress event — 600 sessions, 1,500 people. Exists so every
 *     list and schedule view is demonstrably instant at claimed scale.
 *  3. August Inservice 2025 + Spring PD Day 2026 — history: real attendance
 *     and ledger entries, including one correction pair on Dana's record.
 *
 * Deterministic (seeded PRNG) so demo:reset always rebuilds the same world.
 */
import { PrismaClient } from "@prisma/client";
import { minutesToUnits, sessionMinutes, type RoundingPolicy } from "../src/lib/credit-math";

const prisma = new PrismaClient();

// --- deterministic pseudo-randomness -------------------------------------
let lcgState = 48; // Act 48, naturally
function rand(): number {
  lcgState = (lcgState * 1664525 + 1013904223) % 4294967296;
  return lcgState / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// --- name material ---------------------------------------------------------
const FIRST = [
  "Ava","Ben","Carla","Devon","Elena","Frank","Grace","Hector","Imani","Jonas",
  "Kara","Liam","Maya","Noah","Olivia","Priya","Quentin","Rosa","Sam","Tessa",
  "Umar","Vera","Wes","Ximena","Yusuf","Zoe","Aaron","Bianca","Colin","Dara",
  "Eli","Fatima","Gavin","Hana","Ivan","Jade","Kofi","Lena","Marco","Nina",
  "Omar","Paige","Rashid","Selma","Theo","Uma","Victor","Wendy","Yara","Zack",
  "Alice","Bram","Celia","Dmitri","Esther","Felix","Gloria","Hugh","Ines","Joel",
];
const LAST = [
  "Abbott","Barnes","Calhoun","Delgado","Ellis","Fitzgerald","Gonzales","Hoffman","Irwin","Jenkins",
  "Kowalski","Lindqvist","Moreno","Novak","Okafor","Petrov","Quinn","Ramsey","Silva","Tran",
  "Ueda","Vargas","Whitaker","Xu","Yoder","Zimmerman","Ashford","Boyle","Crane","Dover",
  "Eng","Farrell","Grady","Holt","Iverson","Jacobs","Keller","Lombardi","Mercer","Nash",
  "Ochoa","Pruitt","Reyes","Santos","Thorne","Underwood","Vaughn","Winslow","Yates","Zeller",
  "Ainsley","Booker","Castellano","Dunn","Espinoza","Fontaine","Garrett","Hale","Ibrahim","Judd",
];

const TRACKS = ["Literacy", "STEM", "Special Education", "Technology", "SEL & School Climate"];
const TOPICS: Record<string, string[]> = {
  Literacy: [
    "Structured Literacy in the Middle Grades","Conferring That Sticks","Text Sets for Striving Readers",
    "Writing Workshop Without the Chaos","Vocabulary Routines That Transfer","Reading Data Teams in Practice",
  ],
  STEM: [
    "Desmos Beyond the Demo","Three-Act Math Tasks","NGSS Storylines That Hold Together",
    "Data Literacy Across the Sciences","Engineering Notebooks K-8","Productive Struggle, Managed Well",
  ],
  "Special Education": [
    "IEP Goals You Can Actually Measure","Co-Teaching Models Compared","Behavior Plans That Respect Kids",
    "Progress Monitoring Without Drowning","Transition Planning That Starts Early","Paraprofessional Partnerships",
  ],
  Technology: [
    "AI in the Classroom: A Sober Guide","Canvas Cleanup Clinic","Accessibility Checks in Ten Minutes",
    "Data Privacy for Busy Teachers","Screencasting for Feedback","Device Management Without Tears",
  ],
  "SEL & School Climate": [
    "Restorative Conversations 101","Advisory Periods Worth Having","De-escalation in the Hallway",
    "Family Communication Scripts","Belonging Data: What to Do With It","Staff Culture Is Student Culture",
  ],
};
const SPEAKERS = [
  "Dr. Alice Munro-Hayes","J. Okonkwo","Prof. Dan Feld","Marisol Rivera","T. Chen","Dr. Bev Lawton",
  "Kate Osei","R. Gutierrez","Dr. Sam Petit","Lonnie Marsh","Ana Duarte","Dr. Miguel Torres",
];

// --- helpers ---------------------------------------------------------------
/** UTC instant for a wall-clock time in America/New_York (EDT, UTC-4). */
function et(dateISO: string, hour: number, minute = 0): Date {
  return new Date(Date.UTC(
    Number(dateISO.slice(0, 4)), Number(dateISO.slice(5, 7)) - 1, Number(dateISO.slice(8, 10)),
    hour + 4, minute,
  ));
}

async function main() {
  console.log("Seeding…");

  // Wipe in FK order so demo:reset restores pristine state in-place. The seed
  // uses the raw Prisma client deliberately: the append-only ledger guard in
  // src/lib/db.ts protects application paths; a full demo reset is the one
  // sanctioned teardown, and it truncates rather than deleting the database
  // file so a running dev server picks up the fresh state immediately.
  await prisma.certificateIssue.deleteMany();
  await prisma.creditRecord.deleteMany();
  await prisma.claimEvent.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.correctionRequest.deleteMany();
  await prisma.loginToken.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.nameChange.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.agendaItem.deleteMany();
  await prisma.sessionCredit.deleteMany();
  await prisma.role.deleteMany();
  await prisma.session.deleteMany();
  await prisma.event.deleteMany();
  await prisma.creditTypeAuthorization.deleteMany();
  await prisma.creditType.deleteMany();
  await prisma.person.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: { name: "Keystone Valley School District" },
  });

  // --- credit types --------------------------------------------------------
  const act48 = await prisma.creditType.create({
    data: {
      orgId: org.id, name: "Act 48 Hours", unit: "hours",
      minutesPerUnit: 60, incrementMinutes: 15, roundingMode: "NEAREST",
      status: "STATE_CANONICAL", jurisdiction: "PA",
      sourceUrl: "https://www.education.pa.gov/Educators/ContinuedEd/Act48",
      sourceFetchedAt: new Date("2026-06-02T14:00:00Z"),
      sourceRevision: "manual-entry", sourceConfidence: "HIGH",
    },
  });
  const ceu = await prisma.creditType.create({
    data: {
      orgId: org.id, name: "CEUs", unit: "CEUs",
      minutesPerUnit: 600, incrementMinutes: 15, roundingMode: "FLOOR",
    },
  });
  await prisma.creditType.create({
    data: {
      orgId: org.id, name: "Flex Contact Hours", unit: "contact hours",
      minutesPerUnit: 60, incrementMinutes: 30, roundingMode: "CEILING",
    },
  });
  // Role-gated example: Act 45 PIL hours (administrator PD) can only be
  // granted by PIL-authorized staff. Ruth carries the authorization; Dana
  // deliberately does not — the demo shows the block and the unlock.
  const act45 = await prisma.creditType.create({
    data: {
      orgId: org.id, name: "Act 45 PIL Hours", unit: "hours",
      minutesPerUnit: 60, incrementMinutes: 30, roundingMode: "FLOOR",
      status: "STATE_CANONICAL", jurisdiction: "PA",
      sourceUrl: "https://www.education.pa.gov/Educators/ContinuedEd/Act45",
      sourceFetchedAt: new Date("2026-06-02T14:00:00Z"),
      sourceRevision: "manual-entry", sourceConfidence: "HIGH",
      authorizations: { create: [{ requiredRole: "PIL_AUTHORIZED" }] },
    },
  });
  const act48Policy: RoundingPolicy = { minutesPerUnit: 60, incrementMinutes: 15, mode: "NEAREST" };

  // --- people (1,500; Dana's event uses the first 1,200) --------------------
  const peopleData: { orgId: string; name: string; email: string; licenseId: string }[] = [];
  const named = new Set<string>();
  for (let i = 0; i < 1500; i++) {
    let name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
    if (named.has(name)) name = `${name} ${String.fromCharCode(65 + (i % 26))}.`;
    named.add(name);
    peopleData.push({
      orgId: org.id,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}.${i}@kvsd.example.org`,
      licenseId: `PPID-${String(100000 + i * 7)}`,
    });
  }
  // The three demo identities replace generated rows 0-2.
  peopleData[0] = { orgId: org.id, name: "Dana Whitfield", email: "dana.whitfield@kvsd.example.org", licenseId: "PPID-204811" };
  peopleData[1] = { orgId: org.id, name: "Ruth Alvarez", email: "ruth.alvarez@kvsd.example.org", licenseId: "PPID-100019" };
  peopleData[2] = { orgId: org.id, name: "Marcus Bell", email: "marcus.bell@kvsd.example.org", licenseId: "PPID-317755" };
  // Marcus also demonstrates the multi-license MVAR extension (common in VT).
  const marcusLicenses = JSON.stringify(["PPID-317755", "VT-88231"]);
  peopleData[3] = { orgId: org.id, name: "Priya Natarajan", email: "priya.natarajan@kvsd.example.org", licenseId: "PPID-402193" };
  await prisma.person.createMany({ data: peopleData });
  const people = await prisma.person.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "asc" }, select: { id: true, email: true } });
  const byEmail = new Map(people.map((p) => [p.email, p.id]));
  const dana = byEmail.get("dana.whitfield@kvsd.example.org")!;
  const ruth = byEmail.get("ruth.alvarez@kvsd.example.org")!;
  const marcus = byEmail.get("marcus.bell@kvsd.example.org")!;
  const priya = byEmail.get("priya.natarajan@kvsd.example.org")!;
  await prisma.person.update({ where: { id: marcus }, data: { licenseIdsJson: marcusLicenses } });
  const personIds = people.map((p) => p.id);

  // --- events ----------------------------------------------------------------
  const inservice = await prisma.event.create({
    data: {
      orgId: org.id, name: "August Inservice 2026", venue: "Keystone Valley High School",
      startsAt: et("2026-08-17", 8), endsAt: et("2026-08-18", 16),
    },
  });
  const inservice25 = await prisma.event.create({
    data: {
      orgId: org.id, name: "August Inservice 2025", venue: "Keystone Valley High School",
      startsAt: et("2025-08-18", 8), endsAt: et("2025-08-19", 16),
    },
  });
  const springPd = await prisma.event.create({
    data: {
      orgId: org.id, name: "Spring PD Day 2026", venue: "Maplewood Middle School",
      startsAt: et("2026-03-13", 8), endsAt: et("2026-03-13", 15),
    },
  });
  const stress = await prisma.event.create({
    data: {
      orgId: org.id, name: "PA Statewide Educators Conference (stress test)", venue: "Convention Center, Harrisburg",
      startsAt: et("2026-10-05", 8), endsAt: et("2026-10-07", 17),
    },
  });

  // --- roles -----------------------------------------------------------------
  await prisma.role.createMany({
    data: [
      { personId: ruth, level: "ORG_OWNER" },
      { personId: ruth, level: "PIL_AUTHORIZED" },
      { personId: dana, level: "ORG_ADMIN" },
      { personId: dana, level: "EVENT_ADMIN", eventId: inservice.id },
      { personId: priya, level: "DOOR_STAFF", eventId: inservice.id },
      { personId: marcus, level: "ATTENDEE" },
    ],
  });

  // --- session builder ---------------------------------------------------------
  const ROOMS = ["Auditorium", "Library", "Room 104", "Room 118", "Room 122", "Gym Annex", "Cafeteria B"];
  type SessionSeed = {
    eventId: string; title: string; description: string; speakers: string;
    track: string; room: string; capacity: number | null; startsAt: Date; endsAt: Date;
  };

  function inserviceDay(eventId: string, dateISO: string, dayLabel: string, tracks: string[]): SessionSeed[] {
    const out: SessionSeed[] = [];
    out.push({
      eventId, title: `${dayLabel} Keynote: Teaching Is a Team Sport`,
      description: "All-staff opening session in the auditorium.",
      speakers: pick(SPEAKERS), track: "General", room: "Auditorium", capacity: null,
      startsAt: et(dateISO, 8), endsAt: et(dateISO, 9),
    });
    // Four breakout slots: 90, 50, 75, 60 minutes — deliberately mixed so the
    // rounding policy has something to chew on.
    const slots: [number, number, number][] = [
      [9.25, 90, 0], [11, 50, 0], [12.75, 75, 0], [14.25, 60, 0],
    ];
    for (const [startHour, minutes] of slots) {
      for (const track of tracks) {
        const h = Math.floor(startHour), m = Math.round((startHour - h) * 60);
        out.push({
          eventId,
          title: pick(TOPICS[track]),
          description: `${minutes}-minute breakout in the ${track} strand.`,
          speakers: pick(SPEAKERS), track,
          room: pick(ROOMS.slice(1)), capacity: 40 + Math.floor(rand() * 60),
          startsAt: et(dateISO, h, m), endsAt: new Date(et(dateISO, h, m).getTime() + minutes * 60000),
        });
      }
    }
    return out;
  }

  // Story event: 2 days x (keynote + 4 slots x 5 tracks) = 42 sessions.
  const inserviceSessions = [
    ...inserviceDay(inservice.id, "2026-08-17", "Day 1", TRACKS),
    ...inserviceDay(inservice.id, "2026-08-18", "Day 2", TRACKS),
  ];
  // 2025 event: 2 days x (keynote + 4 slots x 4 tracks) = 34 sessions.
  const in25Sessions = [
    ...inserviceDay(inservice25.id, "2025-08-18", "Day 1", TRACKS.slice(0, 4)),
    ...inserviceDay(inservice25.id, "2025-08-19", "Day 2", TRACKS.slice(0, 4)),
  ];
  // Spring PD half-day: keynote + 2 slots x 4 tracks = 9 sessions.
  const springSessions: SessionSeed[] = [
    {
      eventId: springPd.id, title: "Keynote: What the Data Said This Winter",
      description: "District data review.", speakers: pick(SPEAKERS), track: "General",
      room: "Auditorium", capacity: null, startsAt: et("2026-03-13", 8), endsAt: et("2026-03-13", 9),
    },
  ];
  for (const [startHour, minutes] of [[9.5, 90], [12.5, 105]] as [number, number][]) {
    for (const track of TRACKS.slice(0, 4)) {
      const h = Math.floor(startHour), m = Math.round((startHour - h) * 60);
      springSessions.push({
        eventId: springPd.id, title: pick(TOPICS[track]),
        description: `${minutes}-minute workshop.`, speakers: pick(SPEAKERS), track,
        room: pick(ROOMS.slice(1)), capacity: 45, startsAt: et("2026-03-13", h, m),
        endsAt: new Date(et("2026-03-13", h, m).getTime() + minutes * 60000),
      });
    }
  }

  // Stress event: 3 days x 10 slots x 20 concurrent sessions = 600.
  const stressSessions: SessionSeed[] = [];
  const stressDays = ["2026-10-05", "2026-10-06", "2026-10-07"];
  for (let d = 0; d < 3; d++) {
    for (let slot = 0; slot < 10; slot++) {
      const startHour = 8 + Math.floor(slot * 0.9);
      const startMin = (slot * 54) % 60;
      for (let r = 0; r < 20; r++) {
        const track = TRACKS[(slot + r) % TRACKS.length];
        stressSessions.push({
          eventId: stress.id,
          title: `${pick(TOPICS[track])} (${d + 1}.${slot + 1}.${r + 1})`,
          description: "Statewide conference breakout.",
          speakers: pick(SPEAKERS), track,
          room: r < 4 ? `Hall ${String.fromCharCode(65 + r)}` : `Room ${100 + r}`,
          capacity: 60,
          startsAt: et(stressDays[d], startHour, startMin),
          endsAt: new Date(et(stressDays[d], startHour, startMin).getTime() + 50 * 60000),
        });
      }
    }
  }

  await prisma.session.createMany({
    data: [...inserviceSessions, ...in25Sessions, ...springSessions, ...stressSessions],
  });
  const allSessions = await prisma.session.findMany({
    select: { id: true, eventId: true, startsAt: true, endsAt: true, track: true, title: true },
  });

  // --- session credits ---------------------------------------------------------
  // Every session offers Act 48 hours; keynotes pin a flat 1.0. Ninety-minute
  // breakouts additionally offer CEUs so the settings screen has variety.
  const sessionCredits: { sessionId: string; creditTypeId: string; fixedUnits: number | null }[] = [];
  for (const s of allSessions) {
    const isKeynote = s.title.includes("Keynote");
    sessionCredits.push({ sessionId: s.id, creditTypeId: act48.id, fixedUnits: isKeynote ? 1.0 : null });
    const mins = sessionMinutes(s.startsAt, s.endsAt);
    if (mins >= 90 && s.eventId !== stress.id) {
      sessionCredits.push({ sessionId: s.id, creditTypeId: ceu.id, fixedUnits: null });
    }
  }
  // Two Day-2 leadership-strand sessions additionally carry the role-gated
  // Act 45 PIL credit.
  const act45Sessions = allSessions
    .filter((s) => s.eventId === inservice.id && s.track === "SEL & School Climate" && s.startsAt.getUTCDate() === 18)
    .slice(0, 2);
  for (const s of act45Sessions) {
    sessionCredits.push({ sessionId: s.id, creditTypeId: act45.id, fixedUnits: null });
  }
  await prisma.sessionCredit.createMany({ data: sessionCredits });

  // --- history: attendance + ledger for 2025 inservice and Spring PD -----------
  const attendanceRows: { sessionId: string; personId: string; method: string; checkedInAt: Date; recordedById: string }[] = [];
  const ledgerRows: {
    personId: string; eventId: string; sessionId: string; creditTypeId: string;
    units: number; kind: string; createdAt: Date;
  }[] = [];

  function seedHistory(eventId: string, sessions: typeof allSessions, attendeeIds: string[], baseShowRate: number) {
    const byDayAndSlot = new Map<string, typeof allSessions>();
    for (const s of sessions) {
      const key = s.startsAt.toISOString();
      if (!byDayAndSlot.has(key)) byDayAndSlot.set(key, []);
      byDayAndSlot.get(key)!.push(s);
    }
    const slots = [...byDayAndSlot.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const personId of attendeeIds) {
      // Diligence varies by person, giving missing-credits a real distribution.
      const diligence = baseShowRate * (0.55 + rand() * 0.5);
      for (const [, slotSessions] of slots) {
        if (rand() > diligence) continue;
        const s = slotSessions.length === 1 ? slotSessions[0] : pick(slotSessions);
        const checkedInAt = new Date(s.startsAt.getTime() + Math.floor(rand() * 10) * 60000);
        attendanceRows.push({ sessionId: s.id, personId, method: "ROSTER", checkedInAt, recordedById: dana });
        const isKeynote = s.title.includes("Keynote");
        const units = isKeynote ? 1.0 : minutesToUnits(sessionMinutes(s.startsAt, s.endsAt), act48Policy);
        ledgerRows.push({
          personId, eventId, sessionId: s.id, creditTypeId: act48.id,
          units, kind: "AWARD", createdAt: checkedInAt,
        });
      }
    }
  }

  const in25SessionRows = allSessions.filter((s) => s.eventId === inservice25.id);
  const springSessionRows = allSessions.filter((s) => s.eventId === springPd.id);
  // Dana, Ruth, and Marcus always in the history cohort.
  seedHistory(inservice25.id, in25SessionRows, personIds.slice(0, 1100), 0.92);
  seedHistory(springPd.id, springSessionRows, personIds.slice(0, 800), 0.9);

  await prisma.attendance.createMany({ data: attendanceRows });
  await prisma.creditRecord.createMany({ data: ledgerRows });

  // One visible correction pair on Dana's own 2025 record: a duplicate keynote
  // check-in, offset with a reason. The transcript shows both lines.
  const danaKeynote25 = in25SessionRows.find((s) => s.title.includes("Day 1 Keynote"))!;
  const dup = await prisma.creditRecord.create({
    data: {
      personId: dana, eventId: inservice25.id, sessionId: danaKeynote25.id,
      creditTypeId: act48.id, units: 1.0, kind: "AWARD",
      createdAt: new Date(danaKeynote25.startsAt.getTime() + 45 * 60000),
    },
  });
  await prisma.creditRecord.create({
    data: {
      personId: dana, eventId: inservice25.id, sessionId: danaKeynote25.id,
      creditTypeId: act48.id, units: -1.0, kind: "ADJUSTMENT",
      reason: "Duplicate check-in at Day 1 keynote; second scan removed.",
      offsetsId: dup.id,
      createdAt: new Date(danaKeynote25.startsAt.getTime() + 26 * 3600000),
    },
  });

  // --- personal agendas for the story event ------------------------------------
  const inserviceRows = allSessions
    .filter((s) => s.eventId === inservice.id)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const agendaRows: { personId: string; sessionId: string }[] = [];
  for (const personId of [dana, marcus]) {
    const seen = new Set<string>();
    for (const s of inserviceRows) {
      const key = s.startsAt.toISOString();
      if (seen.has(key)) continue;
      if (s.title.includes("Keynote") || rand() < 0.5) {
        seen.add(key);
        agendaRows.push({ personId, sessionId: s.id });
      }
    }
  }
  await prisma.agendaItem.createMany({ data: agendaRows });

  // One waiting off-platform claim so the approvals queue has a live demo.
  const marcusClaim = await prisma.claim.create({
    data: {
      orgId: org.id,
      personId: marcus,
      creditTypeId: act48.id,
      title: "Regional Literacy Conference — assessment strand",
      provider: "PA Reading Association",
      activityDate: et("2026-06-20", 9),
      unitsRequested: 3.0,
      note: "Full-day strand; agenda attached at the office if needed.",
    },
  });
  await prisma.claimEvent.create({
    data: { claimId: marcusClaim.id, actorId: marcus, fromStatus: "—", toStatus: "SUBMITTED" },
  });

  const counts = {
    people: await prisma.person.count(),
    sessions: await prisma.session.count(),
    attendance: await prisma.attendance.count(),
    ledger: await prisma.creditRecord.count(),
  };
  console.log("Seeded:", counts);
  console.log("Demo identities: Dana Whitfield (org admin), Ruth Alvarez (org owner), Marcus Bell (attendee)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
