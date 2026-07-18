import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { consumeLoginToken, SESSION_COOKIE } from "@/lib/auth";
import { DEMO_USER_COOKIE } from "@/lib/demo-user";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const result = await consumeLoginToken(token);
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(result.error)}`, url));
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, result.sessionToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 3600,
  });
  // A real sign-in replaces the demo impersonation.
  jar.delete(DEMO_USER_COOKIE);
  return NextResponse.redirect(new URL("/", url));
}
