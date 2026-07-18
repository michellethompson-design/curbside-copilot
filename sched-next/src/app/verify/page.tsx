import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Public certificate verification: no account, no login. An auditor with
// nothing but the UCID off a printed certificate lands here.
export default async function VerifyPage() {
  async function go(formData: FormData) {
    "use server";
    const ucid = String(formData.get("ucid") ?? "").trim().toUpperCase();
    if (ucid) redirect(`/verify/${encodeURIComponent(ucid)}`);
  }

  return (
    <main className="page" style={{ maxWidth: 640 }}>
      <div className="pagehead">
        <div className="eyebrow">Certificate verification</div>
        <h1>Verify a certificate</h1>
        <p className="sub">
          Enter the credential ID (UCID) printed on the certificate. No account needed. This page
          shows only what the certificate itself shows.
        </p>
      </div>
      <form action={go} className="card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <label htmlFor="ucid" style={{ fontWeight: 600, fontSize: 13.5 }}>
          UCID
        </label>
        <input
          id="ucid"
          name="ucid"
          type="text"
          placeholder="KV-XXXX-XXXX-XXXX"
          style={{ flex: 1, fontFamily: "var(--mono)" }}
          autoFocus
        />
        <button className="primary" type="submit">
          Verify
        </button>
      </form>
    </main>
  );
}
