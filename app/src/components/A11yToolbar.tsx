// The accessibility preferences control — reachable from anywhere in the top bar.
// Reduced motion, text size, density, high-contrast, and focus mode, all
// persistent. This is a first-class feature, not a buried settings page.

import { useEffect, useRef, useState } from 'react';
import { usePreferences } from '../store/Preferences';
import { Icon } from './icons';

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="switch-track"><span className="switch-knob" /></span>
      <span className="sr-only">{label}</span>
    </label>
  );
}

export function A11yToolbar() {
  const { prefs, set, toggle, reset } = usePreferences();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeCount =
    (prefs.reducedMotion ? 1 : 0) +
    (prefs.highContrast ? 1 : 0) +
    (prefs.focusMode ? 1 : 0) +
    (prefs.textScale !== 'default' ? 1 : 0) +
    (prefs.density !== 'comfortable' ? 1 : 0);

  return (
    <div className="a11y-trigger" ref={ref}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon.Accessibility size={18} />
        <span className="nowrap">Accessibility</span>
        {activeCount > 0 && <span className="badge badge-indigo badge-plain tiny" style={{ padding: '0 0.4rem' }}>{activeCount}</span>}
      </button>

      {open && (
        <div className="a11y-panel" role="dialog" aria-label="Accessibility preferences">
          <div className="between" style={{ marginBottom: '0.4rem' }}>
            <strong>Display & reading</strong>
            <button type="button" className="btn-ghost btn btn-sm" onClick={reset}>Reset</button>
          </div>

          <div className="a11y-row">
            <div className="stack-sm" style={{ gap: 0 }}>
              <span className="strong small">Reduced motion</span>
              <span className="tiny faint">Removes animation & transitions</span>
            </div>
            <Toggle label="Reduced motion" checked={prefs.reducedMotion} onChange={() => toggle('reducedMotion')} />
          </div>

          <div className="a11y-row">
            <div className="stack-sm" style={{ gap: 0 }}>
              <span className="strong small">High contrast</span>
              <span className="tiny faint">Stronger text & borders</span>
            </div>
            <Toggle label="High contrast" checked={prefs.highContrast} onChange={() => toggle('highContrast')} />
          </div>

          <div className="a11y-row">
            <div className="stack-sm" style={{ gap: 0 }}>
              <span className="strong small">Focus mode</span>
              <span className="tiny faint">Hides nonessential UI</span>
            </div>
            <Toggle label="Focus mode" checked={prefs.focusMode} onChange={() => toggle('focusMode')} />
          </div>

          <div className="a11y-row">
            <span className="strong small">Text size</span>
            <Segmented
              label="Text size"
              value={prefs.textScale}
              onChange={(v) => set('textScale', v)}
              options={[
                { value: 'default', label: 'A' },
                { value: 'large', label: 'A+' },
                { value: 'xlarge', label: 'A++' },
              ]}
            />
          </div>

          <div className="a11y-row">
            <span className="strong small">Density</span>
            <Segmented
              label="Density"
              value={prefs.density}
              onChange={(v) => set('density', v)}
              options={[
                { value: 'comfortable', label: 'Comfort' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </div>

          <p className="tiny faint" style={{ marginTop: '0.6rem' }}>
            Targets WCAG 2.2 AA · aligned to ADA & Section 508. Preferences are saved on this device.
          </p>
        </div>
      )}
    </div>
  );
}
