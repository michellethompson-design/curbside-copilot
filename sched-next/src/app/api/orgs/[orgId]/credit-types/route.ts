import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const creditTypes = await db.creditType.findMany({ where: { orgId }, orderBy: { name: "asc" } });
  return NextResponse.json({
    creditTypes: creditTypes.map((t) => ({
      id: t.id,
      name: t.name,
      unit: t.unit,
      minutesPerUnit: t.minutesPerUnit,
      incrementMinutes: t.incrementMinutes,
      roundingMode: t.roundingMode,
    })),
  });
}
