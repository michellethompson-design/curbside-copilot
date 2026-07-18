import { cookies } from "next/headers";
import { personForSession, SESSION_COOKIE } from "./auth";
import { db } from "./db";

// No auth today (ONEDAY.md cut): a cookie names the impersonated seed user.
// The switcher in the top bar is the only writer.
const COOKIE = "demo-user";

export const DEMO_IDENTITIES = [
  { email: "dana.whitfield@kvsd.example.org", label: "Dana Whitfield — PD coordinator" },
  { email: "ruth.alvarez@kvsd.example.org", label: "Ruth Alvarez — org owner" },
  { email: "priya.natarajan@kvsd.example.org", label: "Priya Natarajan — door staff" },
  { email: "marcus.bell@kvsd.example.org", label: "Marcus Bell — attendee" },
];

export async function currentUser() {
  const jar = await cookies();
  // A real magic-link session outranks the demo switcher.
  const authed = await personForSession(jar.get(SESSION_COOKIE)?.value);
  if (authed) return authed;
  const id = jar.get(COOKIE)?.value;
  const user = id
    ? await db.person.findUnique({ where: { id }, include: { roles: true } })
    : null;
  if (user) return user;
  return db.person.findUnique({
    where: { email: DEMO_IDENTITIES[0].email },
    include: { roles: true },
  });
}

export function isAdmin(user: { roles: { level: string }[] } | null): boolean {
  return !!user?.roles.some((r) => ["ORG_OWNER", "ORG_ADMIN", "EVENT_ADMIN"].includes(r.level));
}

// Door staff can run check-in for the event they're deputized on — nothing
// else. Dana adds five colleagues for inservice day without making them
// admins of anything.
export function canCheckIn(
  user: { roles: { level: string; eventId: string | null }[] } | null,
  eventId: string,
): boolean {
  return !!user?.roles.some(
    (r) =>
      ["ORG_OWNER", "ORG_ADMIN"].includes(r.level) ||
      (["EVENT_ADMIN", "DOOR_STAFF"].includes(r.level) && (r.eventId === null || r.eventId === eventId)),
  );
}

export const DEMO_USER_COOKIE = COOKIE;
