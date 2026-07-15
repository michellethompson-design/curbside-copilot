import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findPeopleMissingCredits } from "@/lib/compliance";

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
  const threshold = Number(url.searchParams.get("threshold"));
  if (!creditTypeId || !Number.isFinite(threshold)) {
    return NextResponse.json(
      { error: "Pass creditTypeId (or creditType name) and a numeric threshold" },
      { status: 400 },
    );
  }
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 1000);

  const result = await findPeopleMissingCredits(
    orgId,
    creditTypeId,
    threshold,
    from ? new Date(from) : undefined,
    to ? new Date(to) : undefined,
  );
  if (!result) return NextResponse.json({ error: "Credit type not found in org" }, { status: 404 });
  return NextResponse.json({
    creditType: result.creditType,
    threshold: result.threshold,
    totalBelowThreshold: result.below.length,
    people: result.below.slice(0, limit),
  });
}
