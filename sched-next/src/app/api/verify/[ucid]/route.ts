import { NextResponse } from "next/server";
import { verifyUcid } from "@/lib/certificates";

export async function GET(_req: Request, { params }: { params: Promise<{ ucid: string }> }) {
  const { ucid } = await params;
  const result = await verifyUcid(decodeURIComponent(ucid));
  if (!result) return NextResponse.json({ error: "Unknown UCID" }, { status: 404 });
  return NextResponse.json(result);
}
