"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  bulkCheckInAction,
  checkInAction,
  requestCorrectionAction,
} from "@/app/sessions/[sessionId]/checkin/actions";

export type RosterPerson = {
  id: string;
  name: string;
  email: string;
  checkedIn: boolean;
  correctionPending?: boolean;
};

const REASON_OPTIONS = [
  { code: "DUPLICATE_CHECKIN", label: "Duplicate check-in" },
  { code: "WRONG_PERSON", label: "Wrong person tapped" },
  { code: "LEFT_EARLY", label: "Left early" },
  { code: "DATA_ENTRY_ERROR", label: "Data entry error" },
  { code: "OTHER", label: "Other (explain)" },
];

// Roster mode: built for a gym with bad wifi and as many doors as Dana can
// deputize. Multiple devices work the same roster at once — the server is the
// single source of truth (double taps land exactly one award), and a light
// poll converges every screen within a few seconds. Bulk check-in is a loop
// over the same single-person path: fewer taps, identical records.
export function RosterCheckIn({
  sessionId,
  roster,
  creditSummary,
  canCorrect,
}: {
  sessionId: string;
  roster: RosterPerson[];
  creditSummary: string;
  canCorrect: boolean;
}) {
  const [people, setPeople] = useState(roster);
  const [q, setQ] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [undoFor, setUndoFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonCode, setReasonCode] = useState(REASON_OPTIONS[0].code);
  const [bulkArmed, setBulkArmed] = useState(false);
  const [bulkNote, setBulkNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const pendingRef = useRef(false);
  pendingRef.current = pending;

  const checkedCount = people.filter((p) => p.checkedIn).length;
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? people.filter((p) => p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle))
      : people;
    return filtered.slice(0, 60);
  }, [people, q]);
  const visibleUnchecked = visible.filter((p) => !p.checkedIn);

  // Converge with the other doors: every few seconds, adopt the server's
  // attendance set. Skipped while a local action is in flight so an optimistic
  // tap never flickers backwards.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (pendingRef.current || document.hidden) return;
      try {
        const res = await fetch(`/api/sessions/${sessionId}/attendance`);
        if (!res.ok) return;
        const { personIds } = (await res.json()) as { personIds: string[] };
        const server = new Set(personIds);
        setPeople((ps) =>
          ps.some((p) => p.checkedIn !== server.has(p.id))
            ? ps.map((p) => (p.checkedIn === server.has(p.id) ? p : { ...p, checkedIn: server.has(p.id) }))
            : ps,
        );
      } catch {
        // Gym wifi. The next poll will get through.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [sessionId]);

  function setChecked(personId: string, value: boolean) {
    setPeople((ps) => ps.map((p) => (p.id === personId ? { ...p, checkedIn: value } : p)));
  }

  function handleCheckIn(personId: string) {
    setErrors((e) => ({ ...e, [personId]: "" }));
    startTransition(async () => {
      const result = await checkInAction(sessionId, personId);
      if (result.ok) {
        setChecked(personId, true);
        setFresh((f) => new Set(f).add(personId));
      } else if (result.error === "Already checked in.") {
        // Another door got there first — adopt, don't alarm.
        setChecked(personId, true);
      } else {
        setErrors((e) => ({ ...e, [personId]: result.error }));
      }
    });
  }

  function handleBulk() {
    const ids = visibleUnchecked.map((p) => p.id);
    setBulkArmed(false);
    setBulkNote("");
    startTransition(async () => {
      const result = await bulkCheckInAction(sessionId, ids);
      if ("error" in result) {
        setBulkNote(result.error);
        return;
      }
      const skippedIds = new Set(result.skipped.map((s) => s.personId));
      setPeople((ps) => ps.map((p) => (ids.includes(p.id) && !skippedIds.has(p.id) ? { ...p, checkedIn: true } : p)));
      setFresh((f) => {
        const next = new Set(f);
        for (const id of ids) if (!skippedIds.has(id)) next.add(id);
        return next;
      });
      const overlap = result.skipped.filter((s) => s.error.includes("Overlaps"));
      setBulkNote(
        `${result.checkedIn} checked in` +
          (result.skipped.length
            ? `, ${result.skipped.length} skipped${overlap.length ? ` (${overlap.length} overlapping check-ins — resolve individually)` : ""}`
            : "") +
          ".",
      );
    });
  }

  function handleUndo(personId: string) {
    startTransition(async () => {
      const result = await requestCorrectionAction(sessionId, personId, reasonCode, reason);
      if (result.ok) {
        // The check-in stands until a second admin approves on /approvals.
        setPeople((ps) => ps.map((p) => (p.id === personId ? { ...p, correctionPending: true } : p)));
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
        {visibleUnchecked.length > 1 &&
          (bulkArmed ? (
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className="ledger" disabled={pending} onClick={handleBulk}>
                Confirm: check in {visibleUnchecked.length} people
              </button>
              <button className="quiet" onClick={() => setBulkArmed(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button disabled={pending} onClick={() => setBulkArmed(true)}>
              Check in all {visibleUnchecked.length} shown…
            </button>
          ))}
        <span aria-live="polite" style={{ fontSize: 13, color: "var(--slate)" }}>
          <strong key={checkedCount} className="num pop">{checkedCount.toLocaleString()}</strong> of{" "}
          <span className="num">{people.length.toLocaleString()}</span> checked in · each check-in writes{" "}
          <span className="badge credit num">{creditSummary}</span> to the ledger
        </span>
      </div>
      {bulkNote && (
        <p role="status" style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ledger-deep)", fontWeight: 600 }}>
          {bulkNote}
        </p>
      )}

      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th style={{ width: 260 }}>Check-in</th>
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
                    <select
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      aria-label="Reason code"
                    >
                      {REASON_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Details (required for Other)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      aria-label="Correction details"
                      style={{ width: 180 }}
                    />
                    <button
                      disabled={pending || (reasonCode === "OTHER" && !reason.trim())}
                      onClick={() => handleUndo(p.id)}
                    >
                      Request correction
                    </button>
                    <button className="quiet" onClick={() => { setUndoFor(null); setReason(""); }}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className={fresh.has(p.id) ? "stamp stamp-in" : "stamp"}>✓ Recorded</span>
                    {p.correctionPending ? (
                      <span className="badge pending">Correction pending 2nd admin</span>
                    ) : (
                      canCorrect && (
                        <button className="quiet" style={{ fontSize: 12.5 }} onClick={() => setUndoFor(p.id)}>
                          Undo…
                        </button>
                      )
                    )}
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
          Showing the first 60 matches — keep typing to narrow, or use “Check in all shown” per batch.
        </p>
      )}
    </div>
  );
}
