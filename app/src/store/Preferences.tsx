// ─────────────────────────────────────────────────────────────────────────────
// Accessibility preferences — user-controllable, persistent, applied globally.
//
// Each preference maps to a data-attribute on <html>; all visual response lives
// in CSS (index.css). Preferences persist across the session and are reachable
// from anywhere via the A11yToolbar. This is a differentiator, not a settings
// page nobody finds.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type TextScale = 'default' | 'large' | 'xlarge';
export type Density = 'comfortable' | 'compact';

export interface Preferences {
  reducedMotion: boolean;
  highContrast: boolean;
  focusMode: boolean;
  textScale: TextScale;
  density: Density;
}

const DEFAULTS: Preferences = {
  reducedMotion: false,
  highContrast: false,
  focusMode: false,
  textScale: 'default',
  density: 'comfortable',
};

const STORAGE_KEY = 'lectern.prefs.v1';

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  // Honor the OS reduced-motion setting on first load.
  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return { ...DEFAULTS, reducedMotion: !!prefersReduced };
}

interface PrefValue {
  prefs: Preferences;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  toggle: (key: 'reducedMotion' | 'highContrast' | 'focusMode') => void;
  reset: () => void;
}

const PrefContext = createContext<PrefValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(load);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = prefs.reducedMotion ? 'reduced' : 'full';
    root.dataset.contrast = prefs.highContrast ? 'high' : 'normal';
    root.dataset.focusMode = prefs.focusMode ? 'on' : 'off';
    root.dataset.text = prefs.textScale;
    root.dataset.density = prefs.density;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const value = useMemo<PrefValue>(
    () => ({
      prefs,
      set: (key, val) => setPrefs((p) => ({ ...p, [key]: val })),
      toggle: (key) => setPrefs((p) => ({ ...p, [key]: !p[key] })),
      reset: () => setPrefs(DEFAULTS),
    }),
    [prefs],
  );

  return <PrefContext.Provider value={value}>{children}</PrefContext.Provider>;
}

export function usePreferences(): PrefValue {
  const ctx = useContext(PrefContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
