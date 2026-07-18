// Muted, institutional track hues — recognizably Sched's color-coded tracks,
// toned to the palette. Deterministic by track name.
const TRACK_HUES = ["#3e63c4", "#0e8a63", "#8a4fa3", "#c17722", "#2d8fa6", "#c05252", "#748a2b", "#7059c9"];

export function trackColor(track: string): string {
  if (track === "General") return "#10233b";
  let h = 0;
  for (let i = 0; i < track.length; i++) h = (h * 31 + track.charCodeAt(i)) % 997;
  return TRACK_HUES[h % TRACK_HUES.length];
}
