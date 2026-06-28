// Small, dependency-free formatting helpers shared across the app.

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function initials(p: { firstName: string; lastName: string }): string {
  return `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase();
}

// minutes from midnight → '9:00 AM'
export function clock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString('en-US', opts ?? { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateRange(startIso: string, endIso: string): string {
  const s = new Date(`${startIso}T00:00:00`);
  const e = new Date(`${endIso}T00:00:00`);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (startIso === endIso) return formatDate(startIso);
  if (sameMonth) {
    return `${s.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${formatDate(startIso, { month: 'short', day: 'numeric' })} – ${formatDate(endIso)}`;
}

export function relativeDays(iso: string, fromIso: string): number {
  const a = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${fromIso.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((a - b) / 86400000);
}

// Stable, dependency-free id generator (avoids Date.now/Math.random concerns).
let _seq = 0;
export function makeId(prefix = 'id'): string {
  _seq += 1;
  return `${prefix}_${_seq.toString(36)}_${(performance.now() | 0).toString(36)}`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function creditLabel(hours: number, unit: string): string {
  const n = Number.isInteger(hours) ? hours.toString() : hours.toFixed(2).replace(/0$/, '');
  const label = hours === 1 ? unit.replace(/s$/, '') : unit;
  return `${n} ${label}`;
}
