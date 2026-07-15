"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toggleAgenda } from "@/app/agenda-actions";
import { trackColor } from "@/lib/track-color";

export type GridSession = {
  id: string;
  title: string;
  speakers: string;
  track: string;
  room: string;
  day: string; // "Monday, August 17, 2026"
  time: string; // "9:15 AM–10:45 AM"
  slotKey: string; // sortable "2026-08-17T13:15"
  minutes: number;
  credits: string[]; // "1.50 Act 48 Hours"
  inAgenda: boolean;
};

export function ScheduleGrid({ sessions, canAgenda }: { sessions: GridSession[]; canAgenda: boolean }) {
  const days = useMemo(() => [...new Set(sessions.map((s) => s.day))], [sessions]);
  const tracks = useMemo(() => [...new Set(sessions.map((s) => s.track))].sort(), [sessions]);
  const times = useMemo(() => {
    const uniq = new Map<string, string>();
    for (const s of sessions) {
      const t = s.time.split("–")[0];
      uniq.set(t, t);
    }
    return [...uniq.keys()];
  }, [sessions]);

  const [day, setDay] = useState("all");
  const [track, setTrack] = useState("all");
  const [time, setTime] = useState("all");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        (day === "all" || s.day === day) &&
        (track === "all" || s.track === track) &&
        (time === "all" || s.time.startsWith(time)) &&
        (!needle ||
          s.title.toLowerCase().includes(needle) ||
          s.speakers.toLowerCase().includes(needle) ||
          s.room.toLowerCase().includes(needle)),
    );
  }, [sessions, day, track, time, q]);

  const slots = useMemo(() => {
    const bySlot = new Map<string, { day: string; time: string; items: GridSession[] }>();
    for (const s of visible) {
      const key = s.slotKey;
      if (!bySlot.has(key)) bySlot.set(key, { day: s.day, time: s.time.split("–")[0], items: [] });
      bySlot.get(key)!.items.push(s);
    }
    return [...bySlot.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [visible]);

  return (
    <div>
      <div className="filters" role="search" aria-label="Filter sessions">
        <label htmlFor="f-day">Day</label>
        <select id="f-day" value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="all">All days</option>
          {days.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label htmlFor="f-track">Track</label>
        <select id="f-track" value={track} onChange={(e) => setTrack(e.target.value)}>
          <option value="all">All tracks</option>
          {tracks.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <label htmlFor="f-time">Start time</label>
        <select id="f-time" value={time} onChange={(e) => setTime(e.target.value)}>
          <option value="all">Any time</option>
          {times.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <label htmlFor="f-q">Search</label>
        <input
          id="f-q"
          type="search"
          placeholder="Title, speaker, room"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span aria-live="polite" style={{ fontSize: 12.5, color: "var(--slate)" }}>
          {visible.length} of {sessions.length} sessions
        </span>
      </div>

      {slots.map((slot) => (
        <section key={slot.day + slot.time} aria-label={`${slot.day} ${slot.time}`}>
          <div className="slot-head">
            {slot.day} · {slot.time}
            <span className="count">
              {slot.items.length} session{slot.items.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="session-list">
            {slot.items.map((s) => (
              <SessionCard key={s.id} s={s} canAgenda={canAgenda} />
            ))}
          </div>
        </section>
      ))}
      {slots.length === 0 && (
        <p style={{ color: "var(--slate)" }}>No sessions match these filters. Clear one to widen the view.</p>
      )}
    </div>
  );
}

function SessionCard({ s, canAgenda }: { s: GridSession; canAgenda: boolean }) {
  const [inAgenda, setInAgenda] = useState(s.inAgenda);
  const [pending, startTransition] = useTransition();
  return (
    <article className="session-card" style={{ borderLeftColor: trackColor(s.track) }}>
      <Link className="title" href={`/sessions/${s.id}`}>
        {s.title}
      </Link>
      <div className="meta">
        <span className="badge track">{s.track}</span>
        <span>{s.room}</span>
        <span className="num">{s.minutes} min</span>
        {s.speakers && <span>{s.speakers}</span>}
      </div>
      <div className="meta">
        {s.credits.map((c) => (
          <span key={c} className="badge credit num">
            {c}
          </span>
        ))}
        {canAgenda && (
          <button
            className="quiet"
            style={{ marginLeft: "auto", padding: "2px 6px", fontSize: 12.5 }}
            disabled={pending}
            aria-pressed={inAgenda}
            onClick={() =>
              startTransition(async () => {
                setInAgenda(!inAgenda);
                await toggleAgenda(s.id);
              })
            }
          >
            {inAgenda ? "✓ On my agenda" : "+ Add to agenda"}
          </button>
        )}
      </div>
    </article>
  );
}
