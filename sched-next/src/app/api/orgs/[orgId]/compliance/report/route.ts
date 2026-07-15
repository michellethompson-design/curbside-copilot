import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getComplianceReport } from "@/lib/compliance";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const url = new URL(req.url);
  let creditTypeId = url.searchParams.get("creditTypeId");
  const creditTypeName = url.searchParams.get("creditType");
  if (!creditTypeId && creditTypeName) {
    const t = await db.creditType.findFirst({
      where: { orgId, name: { contains: creditTypeName } },
    });
    creditTypeId = t?.id ?? null;
  }
  if (!creditTypeId) {
    return NextResponse.json(
      { error: "Pass creditTypeId or creditType (name) — see GET /api/orgs/:id/credit-types" },
      { status: 400 },
    );
  }
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const report = await getComplianceReport(orgId, {
    creditTypeId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  if (!report) return NextResponse.json({ error: "Credit type not found in org" }, { status: 404 });
  return NextResponse.json(report);
}
