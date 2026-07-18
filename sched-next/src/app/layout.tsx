import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser, isAdmin, DEMO_IDENTITIES } from "@/lib/demo-user";
import { db } from "@/lib/db";
import { UserSwitcher } from "@/components/UserSwitcher";

export const metadata: Metadata = {
  title: "Sched Next",
  description: "PD-first, API-first event platform prototype",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const identities = await db.person.findMany({
    where: { email: { in: DEMO_IDENTITIES.map((d) => d.email) } },
  });
  const options = DEMO_IDENTITIES.flatMap((d) => {
    const p = identities.find((i) => i.email === d.email);
    return p ? [{ id: p.id, label: d.label }] : [];
  });
  const admin = isAdmin(user);

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            Sched <span className="next">Next</span>
          </Link>
          <nav aria-label="Main">
            <Link href="/">Events</Link>
            <Link href="/me">My agenda</Link>
            {user && <Link href={`/people/${user.id}/transcript`}>My transcript</Link>}
            {admin && <Link href="/compliance">Compliance</Link>}
            {admin && <Link href="/approvals">Approvals</Link>}
            {admin && <Link href="/settings/credit-types">Credit settings</Link>}
          </nav>
          <Link href="/login" style={{ color: "#b9c6d6", fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
            Sign in
          </Link>
          {user && <UserSwitcher options={options} currentId={user.id} />}
        </header>
        {children}
      </body>
    </html>
  );
}
