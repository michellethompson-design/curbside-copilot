"use client";

import { useMemo, useState, useTransition } from "react";
import { checkInAction, undoCheckInAction } from "@/app/sessions/[sessionId]/checkin/actions";

export type RosterPerson = {
  id: string;
  name: string;
  email: string;
  checkedIn: boolean;
};

// Roster mode: built for a gym with bad wifi. One list, one search box, one
// click per person; every action is a plain button, fully keyboard-operable.
export function RosterCheckIn({
  sessionId,
  roster,
  creditSummary,
}: {
  sessionId: string;
  roster: RosterPerson[];
  creditSummary: string;
}) {
  const [people, setPeople] = useState(roster);
  const [q, setQ] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [undoFor, setUndoFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const checkedCount = people.filter((p) => p.checkedIn).length;
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? people.filter((p) => p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle))
      : people;
    return filtered.slice(0, 60);
  }, [people, q]);

  function setChecked(personId: string, value: boolean) {
    setPeople((ps) => ps.map((p) => (p.id === personId ? { ...p, checkedIn: value } : p)));
  }

  function handleCheckIn(personId: string) {
    setErrors((e) => ({ ...e, [personId]: "" }));
    startTransition(async () => {
      const result = await checkInAction(sessionId, personId);
      if (result.ok) setChecked(personId, true);
      else setErrors((e) => ({ ...e, [personId]: result.error }));
    });
  }

  function handleUndo(personId: string) {
    startTransition(async () => {
      const result = await undoCheckInAction(sessionId, personId, reason);
      if (result.ok) {
        setChecked(personId, false);
        setUndoFor(null);
        setReason("");
      } else {
        setErrors((e) => ({ ...e, [personId]: result.error }));
      }
    });
  }

  return (
    <div>
      <div className="filters">
        <label htmlFor="roster-q">Find person</label>
        <input
          id="roster-q"
          type="search"
          autoFocus
          placeholder="Start typing a name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <span aria-live="polite" style={{ fontSize: 13, color: "var(--slate)" }}>
          <strong className="num">{checkedCount.toLocaleString()}</strong> of{" "}
          <span className="num">{people.length.toLocaleString()}</span> checked in · each check-in writes{" "}
          <span className="badge credit num">{creditSummary}</span> to the ledger
        </span>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th style={{ width: 240 }}>Check-in</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 600 }}>{p.name}</td>
              <td style={{ color: "var(--slate)" }}>{p.email}</td>
              <td>
                {!p.checkedIn ? (
                  <button className="ledger" disabled={pending} onClick={() => handleCheckIn(p.id)}>
                    Check in
                  </button>
                ) : undoFor === p.id ? (
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      placeholder="Reason for correction"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      aria-label="Reason for correction"
                      style={{ width: 200 }}
                    />
                    <button disabled={pending || !reason.trim()} onClick={() => handleUndo(p.id)}>
                      Confirm
                    </button>
                    <button className="quiet" onClick={() => { setUndoFor(null); setReason(""); }}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="badge credit">✓ Checked in</span>
                    <button className="quiet" style={{ fontSize: 12.5 }} onClick={() => setUndoFor(p.id)}>
                      Undo…
                    </button>
                  </span>
                )}
                {errors[p.id] && (
                  <div role="alert" style={{ color: "var(--red)", fontSize: 12.5, marginTop: 4 }}>
                    {errors[p.id]}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: "var(--slate)" }}>
                No one matches “{q}”.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {visible.length === 60 && (
        <p style={{ fontSize: 12.5, color: "var(--slate)" }}>
          Showing the first 60 matches — keep typing to narrow.
        </p>
      )}
    </div>
  );
}
