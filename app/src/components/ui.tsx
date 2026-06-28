// Shared presentational components + a tiny toast system.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SubmissionStatus } from '../data/types';
import { initials } from '../lib/format';
import { Icon } from './icons';

// ── Avatar ────────────────────────────────────────────────────────────────────
export function Avatar({
  person,
  color,
  size = 'md',
}: {
  person: { firstName: string; lastName: string };
  color: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls = size === 'lg' ? 'avatar avatar-lg' : size === 'sm' ? 'avatar avatar-sm' : 'avatar';
  return (
    <span className={cls} style={{ background: color }} aria-hidden="true">
      {initials(person)}
    </span>
  );
}

// ── Submission status badge ─────────────────────────────────────────────────────
const STATUS_META: Record<SubmissionStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'badge' },
  submitted: { label: 'Submitted', cls: 'badge badge-blue' },
  under_review: { label: 'In review', cls: 'badge badge-amber' },
  accepted: { label: 'Accepted', cls: 'badge badge-green' },
  waitlisted: { label: 'Waitlisted', cls: 'badge badge-amber' },
  declined: { label: 'Declined', cls: 'badge badge-red' },
  scheduled: { label: 'Scheduled', cls: 'badge badge-indigo' },
};
export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const m = STATUS_META[status];
  return <span className={m.cls}>{m.label}</span>;
}

// ── Score meter ─────────────────────────────────────────────────────────────────
export function ScoreMeter({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'var(--green)' : value >= 45 ? 'var(--amber)' : 'var(--red)';
  return (
    <div className="stack-sm" style={{ gap: '0.3rem' }}>
      <div className="row between tiny">
        <span className="strong">{label}</span>
        <span className="meter-num" style={{ color }}>{value}<span className="faint">/100</span></span>
      </div>
      <div
        className="meter-bar"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${value} out of 100`}
      >
        <span style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Section head ────────────────────────────────────────────────────────────────
export function SectionHead({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div className="stack-sm">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────────
export function EmptyState({ icon = 'ClipboardCheck', title, children }: { icon?: keyof typeof Icon; title: string; children?: ReactNode }) {
  const I = Icon[icon];
  return (
    <div className="empty">
      <I size={34} />
      <h4 style={{ color: 'var(--ink)' }}>{title}</h4>
      {children && <p className="small" style={{ maxWidth: '40ch', margin: '0.4rem auto 0' }}>{children}</p>}
    </div>
  );
}

// ── Toast system ────────────────────────────────────────────────────────────────
interface ToastItem { id: number; message: string; icon: keyof typeof Icon; }
const ToastContext = createContext<{ push: (m: string, icon?: keyof typeof Icon) => void } | null>(null);
let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, icon: keyof typeof Icon = 'CheckCircle') => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, message, icon }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true">
        {toasts.map((t) => {
          const I = Icon[t.icon];
          return (
            <div className="toast" key={t.id} role="status">
              <I size={18} /> {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
