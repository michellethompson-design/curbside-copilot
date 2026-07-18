import { NextResponse } from "next/server";
import { getPersonTranscript } from "@/lib/transcript";

export async function GET(req: Request, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const creditTypeId = url.searchParams.get("creditTypeId") ?? undefined;
  const transcript = await getPersonTranscript(personId, {
    year: year ? Number(year) : undefined,
    creditTypeId,
  });
  if (!transcript) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  return NextResponse.json(transcript);
}
