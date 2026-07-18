import Link from "next/link";
import { createLoginToken } from "@/lib/auth";
import { currentUser } from "@/lib/demo-user";

export const dynamic = "force-dynamic";

// Magic-link sign-in. In this demo build the link renders on screen where a
// real deployment would email it — the flow is otherwise identical.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; url?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await currentUser();

  async function send(formData: FormData) {
    "use server";
    const { redirect } = await import("next/navigation");
    const result = await createLoginToken(String(formData.get("email") ?? ""));
    redirect(
      result.ok
        ? `/login?sent=1&url=${encodeURIComponent(result.url)}`
        : `/login?error=${encodeURIComponent(result.error)}`,
    );
  }

  return (
    <main className="page" style={{ maxWidth: 560 }}>
      <div className="pagehead">
        <div className="eyebrow">Sign in</div>
        <h1>Sign in with your email</h1>
        <p className="sub">
          No passwords. Enter your district email and follow the link. (Demo build: the link appears
          below instead of in your inbox; the flow is otherwise the real one. Currently viewing as{" "}
          <strong>{user?.name}</strong> via the demo switcher.)
        </p>
      </div>

      {sp.sent && sp.url ? (
        <div className="card" style={{ borderLeft: "3px solid var(--ledger)" }}>
          <p style={{ margin: "0 0 8px" }}>
            <strong>Your sign-in link is ready.</strong> In production this arrives by email.
          </p>
          <Link className="btn ledger" href={sp.url}>
            Open my sign-in link
          </Link>
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--slate)" }}>
            Single use, expires in 15 minutes.
          </p>
        </div>
      ) : (
        <form action={send} className="card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label htmlFor="email" style={{ fontWeight: 600, fontSize: 13.5 }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@district.org"
            style={{ flex: 1 }}
            autoFocus
          />
          <button className="primary" type="submit">
            Send link
          </button>
        </form>
      )}
      {sp.error && (
        <p role="alert" style={{ color: "var(--red)", marginTop: 10 }}>
          {sp.error}
        </p>
      )}
    </main>
  );
}
