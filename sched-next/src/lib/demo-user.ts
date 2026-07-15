import { cookies } from "next/headers";
import { db } from "@/lib/db";

// No auth today (ONEDAY.md cut): a cookie names the impersonated seed user.
// The switcher in the top bar is the only writer.
const COOKIE = "demo-user";

export const DEMO_IDENTITIES = [
  { email: "dana.whitfield@kvsd.example.org", label: "Dana Whitfield — PD coordinator" },
  { email: "ruth.alvarez@kvsd.example.org", label: "Ruth Alvarez — org owner" },
  { email: "marcus.bell@kvsd.example.org", label: "Marcus Bell — attendee" },
];

export async function currentUser() {
  const jar = await cookies();
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

export const DEMO_USER_COOKIE = COOKIE;
