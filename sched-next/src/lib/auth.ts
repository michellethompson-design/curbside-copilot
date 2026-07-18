import { randomBytes } from "node:crypto";
import { db } from "./db";

// Magic-link auth, demo-grade by design (CLAUDE.md: don't burn time on
// production auth). Real deployment swaps the on-screen link for an email
// send; everything else — single-use tokens, expiring sessions — is the
// same shape production would use.

const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export const SESSION_COOKIE = "session";

export async function createLoginToken(email: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const person = await db.person.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!person) {
    // Same message either way in a real system; the demo can afford honesty.
    return { ok: false, error: "No account with that email in this district." };
  }
  const token = randomBytes(24).toString("base64url");
  await db.loginToken.create({
    data: { token, personId: person.id, expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS) },
  });
  return { ok: true, url: `/login/verify?token=${token}` };
}

export async function consumeLoginToken(token: string): Promise<{ ok: true; sessionToken: string } | { ok: false; error: string }> {
  const found = await db.loginToken.findUnique({ where: { token } });
  if (!found) return { ok: false, error: "This sign-in link is not valid." };
  if (found.usedAt) return { ok: false, error: "This sign-in link was already used — request a fresh one." };
  if (found.expiresAt < new Date()) return { ok: false, error: "This sign-in link expired — request a fresh one." };

  const sessionToken = randomBytes(24).toString("base64url");
  await db.$transaction([
    db.loginToken.update({ where: { id: found.id }, data: { usedAt: new Date() } }),
    db.authSession.create({
      data: { token: sessionToken, personId: found.personId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    }),
  ]);
  return { ok: true, sessionToken };
}

export async function personForSession(sessionToken: string | undefined) {
  if (!sessionToken) return null;
  const session = await db.authSession.findUnique({ where: { token: sessionToken } });
  if (!session || session.expiresAt < new Date()) return null;
  return db.person.findUnique({ where: { id: session.personId }, include: { roles: true } });
}

export async function destroySession(sessionToken: string | undefined) {
  if (!sessionToken) return;
  await db.authSession.deleteMany({ where: { token: sessionToken } });
}
