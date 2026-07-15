import { db } from "@/lib/db";

// Registry-shaped export: an Act 48/PERMS-style upload CSV. The column format
// is MOCKED — it mirrors the shape of a PERMS professional-education upload
// (PPID, name, provider, program, dates, hours) without claiming to be the
// state's current template. The point of the scene: the export matches what
// Dana reports, so this is fewer systems, not another one.
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const url = new URL(req.url);
  const creditTypeId = url.searchParams.get("creditTypeId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!creditTypeId) return new Response("creditTypeId required", { status: 400 });

  const org = await db.organization.findUnique({ where: { id: orgId } });
  const creditType = await db.creditType.findFirst({ where: { id: creditTypeId, orgId } });
  if (!org || !creditType) return new Response("Not found", { status: 404 });

  const records = await db.creditRecord.findMany({
    where: {
      creditTypeId,
      person: { orgId },
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: {
      person: { select: { name: true, licenseId: true } },
      event: { select: { name: true, startsAt: true, endsAt: true } },
    },
  });

  // One row per person x event, units netted (adjustments already carry
  // negative units, so corrected credit simply nets out of the upload).
  const byKey = new Map<
    string,
    { licenseId: string; last: string; first: string; program: string; start: Date; end: Date; units: number }
  >();
  for (const r of records) {
    const key = `${r.personId}|${r.eventId}`;
    const [first, ...rest] = r.person.name.split(" ");
    const e = byKey.get(key) ?? {
      licenseId: r.person.licenseId ?? "",
      last: rest.join(" "),
      first,
      program: r.event.name,
      start: r.event.startsAt,
      end: r.event.endsAt,
      units: 0,
    };
    e.units = Math.round((e.units + r.units) * 10000) / 10000;
    byKey.set(key, e);
  }

  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const lines = [
    "ProfessionalPersonnelID,LastName,FirstName,ProviderName,ProgramName,ProgramStartDate,ProgramEndDate,CreditType,HoursEarned",
    ...[...byKey.values()]
      .filter((e) => e.units > 0)
      .sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first))
      .map((e) =>
        [
          esc(e.licenseId),
          esc(e.last),
          esc(e.first),
          esc(org.name),
          esc(e.program),
          day(e.start),
          day(e.end),
          esc(creditType.name),
          e.units.toFixed(2),
        ].join(","),
      ),
  ];

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="act48-perms-upload-${day(new Date())}.csv"`,
    },
  });
}
