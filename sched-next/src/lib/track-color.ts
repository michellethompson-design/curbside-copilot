// Muted, institutional track hues — recognizably Sched's color-coded tracks,
// toned to the palette. Deterministic by track name.
const TRACK_HUES = ["#4a6fa5", "#2e6e4e", "#8a5a83", "#a3762f", "#5f7d8c", "#9d5c3c", "#556b2f", "#6b5b95"];

export function trackColor(track: string): string {
  if (track === "General") return "#1b2a3a";
  let h = 0;
  for (let i = 0; i < track.length; i++) h = (h * 31 + track.charCodeAt(i)) % 997;
  return TRACK_HUES[h % TRACK_HUES.length];
}
